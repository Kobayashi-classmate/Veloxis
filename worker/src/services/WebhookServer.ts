import express from 'express';
import bodyParser from 'body-parser';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import axios from 'axios';

const app = express();
app.use(bodyParser.json());

const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null
});

const ingestionQueue = new Queue('ingestion-queue', { connection: connection as any });

/**
 * Endpoint to receive Directus Webhook (Event: items.create)
 */
app.post('/webhooks/ingestion', async (req, res) => {
    const payload = req.body;
    console.log('[Webhook] Received Directus event for:', payload.collection);

    if (payload.collection === 'dataset_versions' && payload.event.includes('create')) {
        const { id, dataset_id, file_id } = payload.payload;
        
        // Simple table name mapping: remove hyphens
        const tableName = `ds_${dataset_id.replace(/-/g, '_')}`;

        let extension = 'csv';
        let projectId = 'default_project';

        try {
            // Get Token
            const authRes = await axios.post(`${config.directus.url}/auth/login`, {
                email: config.directus.email,
                password: config.directus.password
            });
            const token = authRes.data.data.access_token;
            const headers = { Authorization: `Bearer ${token}` };
            
            // Fetch File Metadata
            try {
                const fileMetaRes = await axios.get(`${config.directus.url}/files/${file_id}`, { headers });
                const filename = fileMetaRes.data.data.filename_download;
                if (filename.toLowerCase().endsWith('.xlsx')) {
                    extension = 'xlsx';
                }
            } catch(e) {}

            // Fetch Dataset Metadata to get Project ID
            try {
                const dsRes = await axios.get(`${config.directus.url}/items/datasets/${dataset_id}`, { headers });
                if (dsRes.data.data && dsRes.data.data.project_id) {
                    projectId = dsRes.data.data.project_id;
                }
            } catch(e) {
                console.error('[Webhook] Failed to fetch dataset metadata');
            }

        } catch (e: any) {
            console.error('[Webhook] Directus API error:', e.message);
        }

        console.log(`[Webhook] Queuing job for Directus File [${file_id}] -> Doris [${tableName}] (Ext: ${extension}, Project: ${projectId})`);
        
        await ingestionQueue.add('ingest-from-directus', {
            datasetId: dataset_id,
            versionId: id,
            fileId: file_id,
            tableName: tableName,
            extension: extension,
            storageSource: 'directus',
            projectId: projectId
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
