import express from 'express';
import bodyParser from 'body-parser';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';

const app = express();
app.use(bodyParser.json());

const connection = new IORedis({
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
    console.log('[Webhook] Received ingestion event:', JSON.stringify(payload, null, 2));

    // Expected Directus Payload Structure:
    // {
    //   event: 'items.create',
    //   collection: 'dataset_versions',
    //   payload: { id, dataset_id, file_id, ... },
    //   key: 'some-uuid'
    // }
    
    if (payload.collection === 'dataset_versions' && payload.event.includes('create')) {
        const { id, dataset_id, file_id } = payload.payload;
        
        // We'll generate a table name based on dataset_id or a unique name
        const tableName = `ds_${dataset_id.replace(/-/g, '_')}`;

        console.log(`[Webhook] Queuing ingestion job for ${file_id} into ${tableName}`);
        
        await ingestionQueue.add('ingest-from-directus', {
            datasetId: dataset_id,
            versionId: id,
            fileId: file_id,
            tableName: tableName
        });
        
        return res.status(200).json({ status: 'queued', jobId: id });
    }

    res.status(200).json({ status: 'ignored' });
});

export const startWebhookServer = (port: number = 3000) => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`[Webhook Server] Listening on port ${port}`);
    });
};
