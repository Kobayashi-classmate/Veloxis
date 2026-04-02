import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { DorisClient } from '../services/DorisClient';
import { StorageService } from '../services/StorageService';
import { ExcelConverter } from '../utils/ExcelConverter';
import { CsvHelper } from '../utils/CsvHelper';
import { CubeSchemaGenerator } from '../utils/CubeSchemaGenerator';
import { ETLPipeline, ETLOperator } from '../utils/ETLPipeline';
import { resolveBatchStatus } from '../utils/IngestionBatchStatus';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null
});

const dorisClient = new DorisClient();
const storageService = new StorageService();

export interface IngestionJobData {
    datasetId: string;
    versionId: string;
    fileId: string; // Directus File UUID or S3 Key
    tableName: string;
    extension?: 'xlsx' | 'csv';
    storageSource?: 'directus' | 's3'; // default directus
    projectId?: string;
    ingestBatchId?: string;
    sheetName?: string;
    sheetIndex?: number;
    schemaFingerprint?: string;
    sourceFileName?: string;
    sourceSheetName?: string;
}

/** 流式计算文件 SHA-256，不将整个文件读入内存 */
async function computeFileHashStream(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function loginDirectus(): Promise<{ token: string; headers: Record<string, string> }> {
    const authRes = await axios.post(`${config.directus.url}/auth/login`, {
        email: config.directus.email,
        password: config.directus.password
    });
    const token = authRes.data.data.access_token;
    return {
        token,
        headers: { Authorization: `Bearer ${token}` },
    };
}

async function syncDatasetStatusByBatch(
    datasetId: string,
    ingestBatchId: string | undefined,
    headers: Record<string, string>,
    fallbackStatus?: 'processing' | 'ready' | 'failed'
) {
    if (!ingestBatchId) {
        if (fallbackStatus) {
            await axios.patch(`${config.directus.url}/items/datasets/${datasetId}`, { status: fallbackStatus }, { headers });
        }
        return;
    }

    const versionsRes = await axios.get(`${config.directus.url}/items/dataset_versions`, {
        headers,
        params: {
            'filter[dataset_id][_eq]': datasetId,
            'filter[ingest_batch_id][_eq]': ingestBatchId,
            fields: 'id,status',
            limit: -1,
        },
    });
    const versions: Array<{ status?: string }> = versionsRes.data?.data ?? [];
    const status = resolveBatchStatus(versions.map((v) => String(v.status || '')));
    await axios.patch(`${config.directus.url}/items/datasets/${datasetId}`, { status }, { headers });
}

async function fetchVersionMetadata(versionId: string, headers: Record<string, string>) {
    const versionRes = await axios.get(`${config.directus.url}/items/dataset_versions/${versionId}`, {
        headers,
        params: {
            fields: 'id,sheet_name,ingest_batch_id,schema_fingerprint,source_file_name,source_sheet_name',
        },
    });
    return versionRes.data?.data ?? {};
}

export const initIngestionWorker = async () => {
    console.log(`[Worker] ✨ Ingestion Engine Online (Queue: ingestion-queue)`);

    // Ensure bucket is ready
    await storageService.initBucket();

    const worker = new Worker<IngestionJobData>(
        'ingestion-queue',
        async (job: Job<IngestionJobData>) => {
            const {
                datasetId,
                versionId,
                fileId,
                tableName,
                extension = 'csv',
                storageSource = 'directus',
                projectId = 'default_project',
                ingestBatchId: fromJobBatchId,
                sheetName: fromJobSheetName,
                sheetIndex: fromJobSheetIndex,
                schemaFingerprint: fromJobSchemaFingerprint,
                sourceFileName: fromJobSourceFileName,
                sourceSheetName: fromJobSourceSheetName,
            } = job.data;
            console.log(`[Job ${job.id}] Processing ${extension} ingestion from ${storageSource} for ${tableName} (Project: ${projectId})`);

            let token = '';
            let headers: Record<string, string> = {};
            const isTest = versionId.startsWith('v1.test');
            let ingestBatchId = fromJobBatchId;
            let sheetName = fromJobSheetName;
            let sheetIndex = fromJobSheetIndex;
            let schemaFingerprint = fromJobSchemaFingerprint;
            let sourceFileName = fromJobSourceFileName;
            let sourceSheetName = fromJobSourceSheetName;

            try {
                if (!isTest) {
                    const auth = await loginDirectus();
                    token = auth.token;
                    headers = auth.headers;

                    const versionMeta = await fetchVersionMetadata(versionId, headers);
                    ingestBatchId = ingestBatchId ?? versionMeta.ingest_batch_id ?? undefined;
                    sheetName = sheetName ?? versionMeta.sheet_name ?? undefined;
                    schemaFingerprint = schemaFingerprint ?? versionMeta.schema_fingerprint ?? undefined;
                    sourceFileName = sourceFileName ?? versionMeta.source_file_name ?? undefined;
                    sourceSheetName = sourceSheetName ?? versionMeta.source_sheet_name ?? sheetName ?? undefined;

                    await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`,
                        { status: 'processing' }, { headers });
                    await syncDatasetStatusByBatch(datasetId, ingestBatchId, headers, 'processing');
                }

                const tempPath = path.join('/tmp', `${fileId}.${extension}`);

                // 2. Fetch File
                if (storageSource === 's3') {
                    console.log(`[Job ${job.id}] Downloading from S3 (SeaweedFS)...`);
                    const fileStream = await storageService.downloadFileStream(fileId);
                    const writeStream = fs.createWriteStream(tempPath);
                    await pipeline(fileStream, writeStream);
                } else {
                    console.log(`[Job ${job.id}] Downloading from Directus...`);
                    const fileUrl = `${config.directus.url}/assets/${fileId}`;
                    const fileRes = await axios.get(fileUrl, { headers, responseType: 'arraybuffer' });
                    fs.writeFileSync(tempPath, fileRes.data);
                }

                // 2b. 流式计算 SHA-256（避免大文件 readFileSync OOM）
                const fileHash = await computeFileHashStream(tempPath);
                if (!isTest) {
                    await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`,
                        { file_hash: fileHash }, { headers });
                }

                // 3. Convert to CSV
                let csvPathToRead = tempPath;

                if (extension === 'xlsx') {
                    console.log(`[Job ${job.id}] Converting Excel to CSV...`);
                    csvPathToRead = path.join('/tmp', `${fileId}_converted.csv`);
                    const fileSizeBytes = fs.statSync(tempPath).size;
                    if (fileSizeBytes > 20 * 1024 * 1024) {
                        // Large file: ExcelJS streaming SAX parser — peak memory is one row, not full workbook
                        console.log(`[Job ${job.id}] Large file (${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB), using ExcelJS streaming converter...`);
                        await ExcelConverter.toCSVFileStream(tempPath, csvPathToRead, {
                            sheetName,
                            sheetIndex,
                        });
                    } else {
                        const csvString = ExcelConverter.toCSV(tempPath, {
                            sheetName,
                            sheetIndex,
                        });
                        fs.writeFileSync(csvPathToRead, csvString);
                    }
                    // 无论大小文件，均不 readFileSync — 统一用 createReadStream 传给 Doris
                }

                // 4. Check for ETL Recipes
                let etlOperators: ETLOperator[] = [];
                let finalCsvPathToRead = csvPathToRead;
                let recipeConfig: Array<{type: string; from?: string; to?: string; label?: string}> = [];

                if (!isTest) {
                    try {
                        const recipesRes = await axios.get(`${config.directus.url}/items/recipes?filter[dataset_id][_eq]=${datasetId}`, { headers });
                        if (recipesRes.data.data && recipesRes.data.data.length > 0) {
                            const recipe = recipesRes.data.data[0];
                            if (recipe.config && Array.isArray(recipe.config)) {
                                recipeConfig = recipe.config;
                                etlOperators = recipe.config;
                                console.log(`[Job ${job.id}] Fetched ${etlOperators.length} ETL recipes from Directus.`);
                            }
                        } else {
                            console.log(`[Job ${job.id}] No ETL recipes found for this dataset.`);
                        }
                    } catch(e: any) {
                        console.error(`[Job ${job.id}] Failed to fetch recipes:`, e.response?.data || e.message);
                    }
                }

                let csvHeaders: string[] = [];

                if (etlOperators.length > 0) {
                    console.log(`[Job ${job.id}] Applying ETL Pipeline (${etlOperators.length} ops)...`);
                    const etlOutputPath = path.join('/tmp', `${fileId}_etl.csv`);
                    csvHeaders = await ETLPipeline.process(csvPathToRead, etlOutputPath, etlOperators);
                    finalCsvPathToRead = etlOutputPath;
                    // ETL 输出也写在磁盘，不 readFileSync
                } else {
                    const renameOps = recipeConfig.filter(op => op.type === 'rename' && op.to);
                    if (renameOps.length > 0) {
                        csvHeaders = renameOps.map(op => op.to!);
                        console.log(`[Job ${job.id}] Using recipe storageName headers (no-op ETL):`, csvHeaders);
                    } else {
                        csvHeaders = CsvHelper.getHeaders(finalCsvPathToRead);
                    }
                }

                console.log(`[Job ${job.id}] Final Detected headers:`, csvHeaders);
                if (schemaFingerprint) {
                    console.log(`[Job ${job.id}] Schema fingerprint: ${schemaFingerprint}`);
                }

                // 5. Create Table Dynamically
                await dorisClient.ensureTableExists(tableName, csvHeaders);

                // 6. Stream Load into Doris — ReadStream 直接传输，内存占用与文件大小无关
                console.log(`[Job ${job.id}] Pumping data into Doris...`);
                const csvStream = fs.createReadStream(finalCsvPathToRead);
                await dorisClient.streamLoad(tableName, csvStream, {
                    headers: csvHeaders,
                    projectId: projectId,
                    sourceFileName: sourceFileName || fileId,
                    sourceSheetName: sourceSheetName || sheetName || '',
                    ingestBatchId: ingestBatchId || '',
                });

                // 7. Generate Dynamic Cube.js Schema
                CubeSchemaGenerator.generateSchema(tableName, csvHeaders, datasetId);

                // 8. Cleanup & Success Status
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                if (csvPathToRead !== tempPath && fs.existsSync(csvPathToRead)) fs.unlinkSync(csvPathToRead);
                if (finalCsvPathToRead !== csvPathToRead && finalCsvPathToRead !== tempPath && fs.existsSync(finalCsvPathToRead)) {
                    fs.unlinkSync(finalCsvPathToRead);
                }

                if (!isTest) {
                    await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`,
                        { status: 'ready' }, { headers });
                    await syncDatasetStatusByBatch(datasetId, ingestBatchId, headers, 'ready');
                }

                console.log(`[Job ${job.id}] 🏆 Done! ${tableName} is now live in Doris.`);

            } catch (error: any) {
                console.error(`[Job ${job.id}] ❌ Error:`, error.message);

                // Cleanup temp files on failure to avoid disk leaks
                try {
                    const tempPath = path.join('/tmp', `${fileId}.${extension}`);
                    const csvPathToRead = path.join('/tmp', `${fileId}_converted.csv`);
                    const etlOutputPath = path.join('/tmp', `${fileId}_etl.csv`);
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    if (fs.existsSync(csvPathToRead)) fs.unlinkSync(csvPathToRead);
                    if (fs.existsSync(etlOutputPath)) fs.unlinkSync(etlOutputPath);
                } catch (cleanupErr: any) {
                    console.warn(`[Job ${job.id}] Failed to cleanup temp files:`, cleanupErr.message);
                }

                if (!isTest) {
                    try {
                        const auth = await loginDirectus();
                        const refreshHeaders = auth.headers;
                        await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`,
                            { status: 'failed', error_message: (error.message ?? '未知错误').slice(0, 500) }, { headers: refreshHeaders });
                        await syncDatasetStatusByBatch(datasetId, ingestBatchId, refreshHeaders, 'failed');
                    } catch (e) {}
                }
                throw error;
            }
        },
        {
            connection: connection as any,
            // 延长 BullMQ 锁持续时间（默认 30s），避免大文件长时间处理时锁超时丢失
            lockDuration: 300000, // 5 分钟
        }
    );

    return worker;
};
