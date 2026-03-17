import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { DorisClient } from '../services/DorisClient';
import { ExcelConverter } from '../utils/ExcelConverter';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null
});

const dorisClient = new DorisClient();

interface IngestionJobData {
    datasetId: string;
    versionId: string;
    fileId: string; // Directus File UUID
    tableName: string;
    extension: 'xlsx' | 'csv';
}

export const initIngestionWorker = async () => {
    console.log(`[Worker] ✨ Ingestion Engine Online (Queue: ingestion-queue)`);
    
    const worker = new Worker<IngestionJobData>(
        'ingestion-queue',
        async (job: Job<IngestionJobData>) => {
            const { versionId, fileId, tableName, extension } = job.data;
            console.log(`[Job ${job.id}] Processing ${extension} ingestion for ${tableName}`);
            
            try {
                // 1. Get Token & Download file from Directus
                // In a real scenario, we might use a service token
                const authRes = await axios.post(`${config.directus.url}/auth/login`, {
                    email: config.directus.email,
                    password: config.directus.password
                });
                const token = authRes.data.data.access_token;
                const headers = { Authorization: `Bearer ${token}` };

                // Update version status to 'processing'
                await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`, 
                    { status: 'processing' }, { headers });

                // 2. Fetch File Stream
                const fileUrl = `${config.directus.url}/assets/${fileId}`;
                const fileRes = await axios.get(fileUrl, { headers, responseType: 'arraybuffer' });
                const tempPath = path.join('/tmp', `${fileId}.${extension}`);
                fs.writeFileSync(tempPath, fileRes.data);

                // 3. Convert to CSV Stream
                let csvBuffer: Buffer;
                if (extension === 'xlsx') {
                    console.log(`[Job ${job.id}] Converting Excel to CSV...`);
                    const csvString = ExcelConverter.toCSV(tempPath);
                    csvBuffer = Buffer.from(csvString);
                } else {
                    csvBuffer = fs.readFileSync(tempPath);
                }

                // 4. Heavy Lift: Stream Load into Doris
                console.log(`[Job ${job.id}] Pumping data into Doris...`);
                await dorisClient.streamLoad(tableName, csvBuffer);

                // 5. Cleanup & Success Status
                fs.unlinkSync(tempPath);
                await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`, 
                    { status: 'ready' }, { headers });
                
                console.log(`[Job ${job.id}] 🏆 Done! ${tableName} is now live in Doris.`);
                
            } catch (error: any) {
                console.error(`[Job ${job.id}] ❌ Error:`, error.message);
                // Attempt to mark as failed in Directus
                try {
                    const authRes = await axios.post(`${config.directus.url}/auth/login`, {
                        email: config.directus.email,
                        password: config.directus.password
                    });
                    const token = authRes.data.data.access_token;
                    await axios.patch(`${config.directus.url}/items/dataset_versions/${versionId}`, 
                        { status: 'failed' }, { headers: { Authorization: `Bearer ${token}` } });
                } catch (e) {}
                throw error;
            }
        },
        { connection: connection as any }
    );

    return worker;
};
