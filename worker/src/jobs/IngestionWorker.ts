import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { DorisClient } from '../services/DorisClient';
import { StorageService } from '../services/StorageService';
import { ExcelConverter } from '../utils/ExcelConverter';
import { CsvHelper } from '../utils/CsvHelper';
import { CubeSchemaGenerator } from '../utils/CubeSchemaGenerator';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
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
}

export const initIngestionWorker = async () => {
    console.log(`[Worker] ✨ Ingestion Engine Online (Queue: ingestion-queue)`);
    
    // Ensure bucket is ready
    await storageService.initBucket();

    const worker = new Worker<IngestionJobData>(
        'ingestion-queue',
        async (job: Job<IngestionJobData>) => {
            const { datasetId, versionId, fileId, tableName, extension = 'csv', storageSource = 'directus', projectId = 'default_project' } = job.data;
            console.log(`[Job ${job.id}] Processing ${extension} ingestion from ${storageSource} for ${tableName} (Project: ${projectId})`);
            
            let token = '';
            let headers = {};
            const isTest = versionId.startsWith('v1.test');

            try {
                if (!isTest) {
                    const authRes = await axios.post(`${config.directus.url}/auth/login`, {
                        email: config.directus.email,
                        password: config.directus.password
                    });
                    token = authRes.data.data.access_token;
                    headers = { Authorization: `Bearer ${token}` };

                    await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`, 
                        { status: 'processing' }, { headers });
                }

                const tempPath = path.join('/tmp', `${fileId}.${extension}`);

                // 2. Fetch File Stream
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

                // 3. Convert to CSV / Prepare Headers
                let csvBuffer: Buffer;
                let csvPathToRead = tempPath;

                if (extension === 'xlsx') {
                    console.log(`[Job ${job.id}] Converting Excel to CSV...`);
                    const csvString = ExcelConverter.toCSV(tempPath);
                    csvBuffer = Buffer.from(csvString);
                    // Write to temp file for CsvHelper to read headers
                    csvPathToRead = path.join('/tmp', `${fileId}_converted.csv`);
                    fs.writeFileSync(csvPathToRead, csvBuffer);
                } else {
                    csvBuffer = fs.readFileSync(tempPath);
                }

                // 4. Create Table Dynamically
                const csvHeaders = CsvHelper.getHeaders(csvPathToRead);
                console.log(`[Job ${job.id}] Detected headers:`, csvHeaders);
                await dorisClient.ensureTableExists(tableName, csvHeaders);

                // 5. Heavy Lift: Stream Load into Doris
                console.log(`[Job ${job.id}] Pumping data into Doris...`);
                await dorisClient.streamLoad(tableName, csvBuffer, { headers: csvHeaders, projectId: projectId });

                // 6. Generate Dynamic Cube.js Schema
                CubeSchemaGenerator.generateSchema(tableName, csvHeaders, datasetId);

                // 7. Cleanup & Success Status
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                if (csvPathToRead !== tempPath && fs.existsSync(csvPathToRead)) fs.unlinkSync(csvPathToRead);
                
                if (!isTest) {
                    await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`, 
                        { status: 'ready' }, { headers });
                }
                
                console.log(`[Job ${job.id}] 🏆 Done! ${tableName} is now live in Doris.`);
                
            } catch (error: any) {
                console.error(`[Job ${job.id}] ❌ Error:`, error.message);
                if (!isTest) {
                    try {
                        const authRes = await axios.post(`${config.directus.url}/auth/login`, {
                            email: config.directus.email,
                            password: config.directus.password
                        });
                        const refreshHeaders = { Authorization: `Bearer ${authRes.data.data.access_token}` };
                        await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`, 
                            { status: 'failed' }, { headers: refreshHeaders });
                    } catch (e) {}
                }
                throw error;
            }
        },
        { connection: connection as any }
    );

    return worker;
};
