import express from 'express';
import bodyParser from 'body-parser';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import axios from 'axios';
import { DorisQueryService } from './DorisQueryService';
import { ChartBindingService } from './ChartBindingService';
import { WorkbookExportService } from './WorkbookExportService';
import { getWorkbenchQueue } from '../jobs/WorkbenchWorker';
import { authenticateWorkerApi, WorkerApiRequest } from '../middleware/workerApiAuth';

const app = express();
app.use(bodyParser.json());

const connection = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
});

const ingestionQueue = new Queue('ingestion-queue', { connection: connection as any });

const serverStartTime = Date.now();
const dorisQueryService = new DorisQueryService();
const chartBindingService = new ChartBindingService();
const workbookExportService = new WorkbookExportService();

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractId(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && typeof value.id === 'string') return value.id;
    return null;
}

/**
 * Validates dataset accessibility under the caller's token and resolves the
 * canonical project_id from Directus.
 */
async function resolveProjectIdForDataset(datasetId: string, accessToken: string): Promise<string> {
    try {
        const dsRes = await axios.get(`${config.directus.url}/items/datasets/${datasetId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: 'id,project_id' },
        });
        const projectId = extractId(dsRes.data?.data?.project_id);
        if (!projectId) {
            throw Object.assign(new Error(`Dataset ${datasetId} has no project_id`), { code: 'DATASET_PROJECT_NOT_FOUND' });
        }
        return projectId;
    } catch (err: any) {
        const status = err?.response?.status;
        if (status === 403) {
            throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
        }
        if (status === 404) {
            throw Object.assign(new Error(`Dataset ${datasetId} not found`), { code: 'DATASET_NOT_FOUND' });
        }
        throw err;
    }
}

async function buildHealthPayload() {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    let redisStatus: 'connected' | 'disconnected' = 'disconnected';

    try {
        await connection.ping();
        redisStatus = 'connected';
    } catch {
        redisStatus = 'disconnected';
    }

    const healthy = redisStatus === 'connected';
    return {
        healthy,
        payload: {
            status: healthy ? 'ok' : 'degraded',
            uptime: uptimeSeconds,
            timestamp: new Date().toISOString(),
            queues: {
                ingestion: redisStatus,
                workbench: redisStatus,
            },
            version: '1.0.0',
        },
    };
}

/**
 * GET /health
 * Docker healthcheck + monitoring probe.
 */
app.get('/health', async (_req, res) => {
    const { healthy, payload } = await buildHealthPayload();
    res.status(healthy ? 200 : 503).json(payload);
});

/**
 * Endpoint to receive Directus Webhook (Event: items.create)
 */
app.post('/webhooks/ingestion', async (req, res) => {
    const payload = req.body;
    console.log('[Webhook] Received Directus event for:', payload.collection);
    console.log('[Webhook] Raw payload:', JSON.stringify(payload).slice(0, 500));

    if (payload.collection === 'dataset_versions' && payload.event.includes('create')) {
        const versionId = payload.key ?? payload.payload?.id;
        const { dataset_id, file_id } = payload.payload ?? {};

        if (!versionId || !dataset_id || !file_id) {
            console.error('[Webhook] Missing required fields:', { versionId, dataset_id, file_id });
            return res.status(200).json({ status: 'error', reason: 'missing fields' });
        }

        const tableName = `ds_${dataset_id.replace(/-/g, '_')}`;
        let extension = 'csv';
        let projectId = 'default_project';

        try {
            const authRes = await axios.post(`${config.directus.url}/auth/login`, {
                email: config.directus.email,
                password: config.directus.password,
            });
            const token = authRes.data.data.access_token;
            const headers = { Authorization: `Bearer ${token}` };

            try {
                const fileMetaRes = await axios.get(`${config.directus.url}/files/${file_id}`, { headers });
                const filename = fileMetaRes.data.data.filename_download;
                if (filename.toLowerCase().endsWith('.xlsx')) {
                    extension = 'xlsx';
                }
            } catch {
                // Ignore file metadata failures; extension fallback stays csv.
            }

            try {
                const dsRes = await axios.get(`${config.directus.url}/items/datasets/${dataset_id}`, { headers });
                if (dsRes.data.data && dsRes.data.data.project_id) {
                    projectId = dsRes.data.data.project_id;
                }
            } catch {
                console.error('[Webhook] Failed to fetch dataset metadata');
            }
        } catch (e: any) {
            console.error('[Webhook] Directus API error:', e.message);
        }

        console.log(`[Webhook] Queuing job for Directus File [${file_id}] -> Doris [${tableName}] (Ext: ${extension}, Project: ${projectId})`);

        await ingestionQueue.add('ingest-from-directus', {
            datasetId: dataset_id,
            versionId,
            fileId: file_id,
            tableName,
            extension,
            storageSource: 'directus',
            projectId,
        });

        return res.status(200).json({ status: 'queued', jobId: versionId });
    }

    return res.status(200).json({ status: 'ignored' });
});

// Protected Worker API router
const workerApi = express.Router();
workerApi.use(authenticateWorkerApi);

/**
 * GET /worker-api/health
 * Authenticated probe endpoint.
 */
workerApi.get('/health', async (_req, res) => {
    const { healthy, payload } = await buildHealthPayload();
    res.status(healthy ? 200 : 503).json(payload);
});

/**
 * GET /worker-api/datasets/:datasetId/columns
 */
workerApi.get('/datasets/:datasetId/columns', async (req, res) => {
    const { datasetId } = req.params;
    const authReq = req as WorkerApiRequest;
    console.log(`[WorkerAPI] GET /datasets/${datasetId}/columns`);

    if (!isUuid(datasetId)) {
        return res.status(400).json({ error: `Invalid datasetId format: "${datasetId}"` });
    }

    try {
        // Access control boundary: dataset must be readable by caller token.
        await resolveProjectIdForDataset(datasetId, authReq.workerAccessToken!);
        const columns = await dorisQueryService.describeTable(datasetId);
        return res.status(200).json({ columns });
    } catch (err: any) {
        if (err.code === 'INVALID_DATASET_ID') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 'FORBIDDEN') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (err.code === 'DATASET_NOT_FOUND' || err.code === 'DATASET_PROJECT_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err.code === 'TABLE_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        console.error(`[WorkerAPI] Column metadata error for dataset ${datasetId}:`, err.message);
        return res.status(500).json({ error: 'Failed to fetch column metadata' });
    }
});

/**
 * POST /worker-api/datasets/:datasetId/query
 */
workerApi.post('/datasets/:datasetId/query', async (req, res) => {
    const { datasetId } = req.params;
    const body = req.body;
    const authReq = req as WorkerApiRequest;

    console.log(`[WorkerAPI] POST /datasets/${datasetId}/query`);

    if (!isUuid(datasetId)) {
        return res.status(400).json({ error: `Invalid datasetId format: "${datasetId}"` });
    }
    if (!body.xColumn) {
        return res.status(400).json({ error: 'xColumn is required' });
    }

    try {
        // Access control boundary + canonical RLS context from server side.
        const projectId = await resolveProjectIdForDataset(datasetId, authReq.workerAccessToken!);
        if (body.projectId && body.projectId !== projectId) {
            console.warn(`[WorkerAPI] Ignoring client projectId for dataset ${datasetId}; using server-resolved project_id`);
        } else if (body.projectId) {
            console.warn(`[WorkerAPI] Deprecated field projectId provided for dataset ${datasetId}; ignored`);
        }

        const result = await dorisQueryService.queryDataset(datasetId, {
            xColumn: body.xColumn,
            yColumn: body.yColumn,
            seriesColumn: body.seriesColumn,
            aggregation: body.aggregation,
            limit: body.limit,
            filters: body.filters,
            projectId,
        });
        return res.status(200).json(result);
    } catch (err: any) {
        if (err.code === 'INVALID_DATASET_ID') {
            return res.status(400).json({ error: err.message });
        }
        if (err.code === 'FORBIDDEN') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (err.code === 'DATASET_NOT_FOUND' || err.code === 'DATASET_PROJECT_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err.message?.startsWith('Unsafe column identifier')) {
            return res.status(400).json({ error: err.message });
        }
        if (err.message?.startsWith('Invalid aggregation')) {
            return res.status(400).json({ error: err.message });
        }
        console.error(`[WorkerAPI] Query error for dataset ${datasetId}:`, err.message);
        return res.status(500).json({ error: 'Failed to execute dataset query' });
    }
});

/**
 * PUT /worker-api/charts/:chartId/binding
 */
workerApi.put('/charts/:chartId/binding', async (req, res) => {
    const { chartId } = req.params;
    const binding = req.body;
    const authReq = req as WorkerApiRequest;

    console.log(`[WorkerAPI] PUT /charts/${chartId}/binding`);

    if (!binding.dataset_id) {
        return res.status(400).json({ error: 'dataset_id is required' });
    }
    if (!binding.x_column) {
        return res.status(400).json({ error: 'x_column is required' });
    }

    try {
        const saved = await chartBindingService.saveBinding(chartId, binding, authReq.workerAccessToken!);
        return res.status(200).json({ binding: saved });
    } catch (err: any) {
        if (err?.response?.status === 403) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (err?.response?.status === 404) {
            return res.status(404).json({ error: 'Chart not found' });
        }
        console.error(`[WorkerAPI] Binding save error for chart ${chartId}:`, err.message);
        return res.status(500).json({ error: 'Failed to save chart binding' });
    }
});

/**
 * GET /worker-api/charts/:chartId/binding/data
 * NOTE: projectId query param is deprecated and ignored.
 */
workerApi.get('/charts/:chartId/binding/data', async (req, res) => {
    const { chartId } = req.params;
    const authReq = req as WorkerApiRequest;

    if (req.query.projectId) {
        console.warn(`[WorkerAPI] Deprecated query param projectId ignored for chart ${chartId}`);
    }

    console.log(`[WorkerAPI] GET /charts/${chartId}/binding/data`);

    try {
        const result = await chartBindingService.resolveBindingData(chartId, authReq.workerAccessToken!);
        return res.status(200).json(result);
    } catch (err: any) {
        if (err.code === 'BINDING_NOT_FOUND' || err.code === 'CHART_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err?.response?.status === 403) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (err?.response?.status === 404) {
            return res.status(404).json({ error: 'Chart or related records not found' });
        }
        console.error(`[WorkerAPI] Binding data resolution error for chart ${chartId}:`, err.message);
        return res.status(500).json({ error: 'Failed to resolve chart binding data' });
    }
});

/**
 * GET /worker-api/workbooks/:workbookId/export
 */
workerApi.get('/workbooks/:workbookId/export', async (req, res) => {
    const { workbookId } = req.params;
    const authReq = req as WorkerApiRequest;
    console.log(`[WorkerAPI] GET /workbooks/${workbookId}/export`);

    try {
        const exportData = await workbookExportService.exportWorkbook(workbookId, authReq.workerAccessToken!);
        const filename = `workbook_${workbookId}_${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).json(exportData);
    } catch (err: any) {
        if (err.code === 'WORKBOOK_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err?.response?.status === 403) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        console.error(`[WorkerAPI] Export error for workbook ${workbookId}:`, err.message);
        return res.status(500).json({ error: 'Failed to export workbook' });
    }
});

/**
 * POST /worker-api/jobs/regenerate-schema
 */
workerApi.post('/jobs/regenerate-schema', async (req, res) => {
    const { datasetId, tableName } = req.body;
    const authReq = req as WorkerApiRequest;
    console.log(`[WorkerAPI] POST /jobs/regenerate-schema for dataset ${datasetId}`);

    if (!datasetId) {
        return res.status(400).json({ error: 'datasetId is required' });
    }
    if (!isUuid(datasetId)) {
        return res.status(400).json({ error: `Invalid datasetId format: "${datasetId}"` });
    }

    try {
        // Access boundary: caller must be allowed to read this dataset.
        await resolveProjectIdForDataset(datasetId, authReq.workerAccessToken!);
        const canonicalTableName = `ds_${datasetId.replace(/-/g, '_')}`;
        if (tableName && tableName !== canonicalTableName) {
            console.warn(`[WorkerAPI] Ignoring client tableName "${tableName}" for dataset ${datasetId}; using canonical "${canonicalTableName}"`);
        } else if (tableName) {
            console.warn(`[WorkerAPI] Deprecated field tableName provided for dataset ${datasetId}; ignored`);
        }

        const workbenchQueue = getWorkbenchQueue();
        const job = await workbenchQueue.add('regenerate-schema', {
            type: 'regenerate-schema',
            datasetId,
            tableName: canonicalTableName,
        });

        console.log(`[WorkerAPI] Enqueued regenerate-schema job ${job.id} for dataset ${datasetId}`);
        return res.status(202).json({ status: 'queued', jobId: job.id });
    } catch (err: any) {
        if (err.code === 'FORBIDDEN') {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (err.code === 'DATASET_NOT_FOUND' || err.code === 'DATASET_PROJECT_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        console.error(`[WorkerAPI] Failed to enqueue regenerate-schema job:`, err.message);
        return res.status(500).json({ error: 'Failed to enqueue schema regeneration job' });
    }
});

// New public prefix
app.use('/worker-api', workerApi);
// Backward-compatible internal prefix
app.use('/api', workerApi);

export const startWebhookServer = (port: number = 3000) => {
    app.listen(port, '0.0.0.0', () => {
        console.log(`[Webhook Server] Ready on port ${port}. Waiting for Directus triggers...`);
    });
};
