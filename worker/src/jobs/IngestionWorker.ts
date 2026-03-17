import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { StorageService } from '../services/StorageService';
import { DorisClient } from '../services/DorisClient';

const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null // Required by BullMQ
});

const storageService = new StorageService();
const dorisClient = new DorisClient();

interface IngestionJobData {
    datasetId: string;
    versionId: string;
    fileId: string; // SeaweedFS object key
    tableName: string; // Doris table name
}

export const initIngestionWorker = async () => {
    // Ensure bucket is ready
    await storageService.initBucket();

    console.log(`[Worker] Started listening on queue: ingestion-queue`);
    
    const worker = new Worker<IngestionJobData>(
        'ingestion-queue',
        async (job: Job<IngestionJobData>) => {
            console.log(`[Job ${job.id}] Starting ingestion for dataset version: ${job.data.versionId}`);
            
            try {
                // 1. Update Directus state to 'Processing' (placeholder)
                console.log(`[Job ${job.id}] Updating status in Directus to Processing...`);
                // TODO: Call Directus API

                // 2. Open Stream from SeaweedFS
                console.log(`[Job ${job.id}] Downloading ${job.data.fileId} from SeaweedFS...`);
                const stream = await storageService.downloadFileStream(job.data.fileId);

                // 3. Stream Load to Doris
                console.log(`[Job ${job.id}] Pushing stream to Doris table: ${job.data.tableName}`);
                await dorisClient.streamLoadCSV(job.data.tableName, stream);

                // 4. Update Directus state to 'Ready'
                console.log(`[Job ${job.id}] Ingestion complete! Updating status to Ready.`);
                // TODO: Call Directus API
                
            } catch (error: any) {
                console.error(`[Job ${job.id}] Ingestion failed:`, error.message);
                // 5. Update Directus state to 'Failed'
                // TODO: Call Directus API
                throw error;
            }
        },
        { connection: connection as any }
    );

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed with error:`, err);
    });

    return worker;
};
