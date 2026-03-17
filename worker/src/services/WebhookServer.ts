import express from 'express';
import bodyParser from 'body-parser';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';

const app = express();
app.use(bodyParser.json());

const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null
});

const ingestionQueue = new Queue('ingestion-queue', { connection: connection as any });

/**
 * Endpoint to receive Directus Webhook (Event: items.create or items.update)
 */
app.post('/webhooks/ingestion', async (req, res) => {
    const payload = req.body;
    console.log('[Webhook] Received Directus event for:', payload.collection);

    if (payload.collection === 'dataset_versions' && payload.event.includes('create')) {
        const { id, dataset_id, file_id } = payload.payload;
        
        // Simple table name mapping: remove hyphens
        const tableName = `ds_${dataset_id.replace(/-/g, '_')}`;

        // Need to guess extension, assume Excel for now as our primary test format, 
        // in production we'd fetch the file metadata from directus.
        const extension = 'xlsx';

        console.log(`[Webhook] Queuing job for Directus File [${file_id}] -> Doris [${tableName}]`);
        
        await ingestionQueue.add('ingest-from-directus', {
            datasetId: dataset_id,
            versionId: id,
            fileId: file_id,
            tableName: tableName,
            extension: extension
        });
        
        return res.status(200).json({ status: 'queued', jobId: id });
    }

    res.status(200).json({ status: 'ignored' });
});

export const startWebhookServer = (port: number = 3000) => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`[Webhook Server] Ready on port ${port}. Waiting for Directus triggers...`);
    });
};
