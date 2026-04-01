import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { config } from '../config';
import { DorisQueryService } from '../services/DorisQueryService';
import { CubeSchemaGenerator } from '../utils/CubeSchemaGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// Job Data Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkbenchJobData {
    /** Discriminator — allows future job types on the same queue. */
    type: 'regenerate-schema';
    /** UUID of the dataset whose Cube.js schema should be regenerated. */
    datasetId: string;
    /**
     * Doris table name.  If omitted the worker derives it from datasetId
     * using the same convention as IngestionWorker.
     */
    tableName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Redis connection for this module
// ─────────────────────────────────────────────────────────────────────────────

let _connection: Redis | null = null;

function getRedisConnection(): Redis {
    if (!_connection) {
        _connection = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            maxRetriesPerRequest: null,
        });
    }
    return _connection;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue accessor (used by WebhookServer to enqueue jobs)
// ─────────────────────────────────────────────────────────────────────────────

let _queue: Queue<WorkbenchJobData> | null = null;

/**
 * Returns the singleton workbench-queue BullMQ Queue instance.
 * Safe to call before initWorkbenchWorker().
 */
export function getWorkbenchQueue(): Queue<WorkbenchJobData> {
    if (!_queue) {
        _queue = new Queue<WorkbenchJobData>('workbench-queue', {
            connection: getRedisConnection() as any,
        });
    }
    return _queue;
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker initializer (called from src/index.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bootstraps the BullMQ worker that processes workbench background tasks.
 * Currently handles one job type:
 *
 *   regenerate-schema — re-reads column metadata from Doris and overwrites the
 *                        Cube.js .js model file in /cube/conf/model/.
 *
 * More job types (e.g. invalidate-query-cache, capture-thumbnail) can be
 * added by extending the switch statement without changing the queue name.
 */
export const initWorkbenchWorker = async (): Promise<Worker<WorkbenchJobData>> => {
    console.log(`[WorkbenchWorker] ✨ Workbench Engine Online (Queue: workbench-queue)`);

    const dorisQuery = new DorisQueryService();

    const worker = new Worker<WorkbenchJobData>(
        'workbench-queue',
        async (job: Job<WorkbenchJobData>) => {
            const { type, datasetId, tableName: explicitTable } = job.data;

            // Canonical table name — mirrors IngestionWorker convention.
            // Even if a client provides tableName, we never trust it over datasetId.
            const canonicalTableName = `ds_${datasetId.replace(/-/g, '_')}`;
            if (explicitTable && explicitTable !== canonicalTableName) {
                console.warn(
                    `[WorkbenchWorker Job ${job.id}] Ignoring non-canonical tableName "${explicitTable}" for dataset ${datasetId}; using "${canonicalTableName}"`
                );
            }
            const tableName = canonicalTableName;

            console.log(`[WorkbenchWorker Job ${job.id}] Processing type="${type}" for dataset ${datasetId} (table: ${tableName})`);

            switch (type) {
                case 'regenerate-schema': {
                    await handleRegenerateSchema(job.id ?? 'unknown', datasetId, tableName, dorisQuery);
                    break;
                }
                default: {
                    // Future-proof: unknown types are logged and discarded, not thrown,
                    // so they don't clog the retry mechanism.
                    console.warn(`[WorkbenchWorker Job ${job.id}] Unknown job type: "${type}" — skipping`);
                }
            }
        },
        {
            connection: getRedisConnection() as any,
            lockDuration: 60_000, // 1 minute — schema generation is fast
        }
    );

    worker.on('failed', (job, err) => {
        console.error(`[WorkbenchWorker] Job ${job?.id} failed:`, err.message);
    });

    return worker;
};

// ─────────────────────────────────────────────────────────────────────────────
// Job Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the current column list from the live Doris table and regenerates the
 * Cube.js schema file.  This is idempotent — it can be re-run at any time.
 */
async function handleRegenerateSchema(
    jobId: string,
    datasetId: string,
    tableName: string,
    dorisQuery: DorisQueryService
): Promise<void> {
    console.log(`[WorkbenchWorker Job ${jobId}] Fetching columns for ${tableName} from Doris...`);

    let columns: string[];
    try {
        const dorisColumns = await dorisQuery.describeTable(datasetId);
        columns = dorisColumns.map((c) => c.name);
    } catch (err: any) {
        if (err.code === 'TABLE_NOT_FOUND') {
            console.warn(`[WorkbenchWorker Job ${jobId}] Table ${tableName} does not exist in Doris yet — skipping schema gen`);
            return;
        }
        throw err;
    }

    if (columns.length === 0) {
        console.warn(`[WorkbenchWorker Job ${jobId}] No columns found for ${tableName} — skipping schema gen`);
        return;
    }

    console.log(`[WorkbenchWorker Job ${jobId}] Regenerating Cube.js schema for ${tableName} with ${columns.length} columns`);
    CubeSchemaGenerator.generateSchema(tableName, columns, datasetId);
    console.log(`[WorkbenchWorker Job ${jobId}] ✅ Schema regenerated for dataset ${datasetId}`);
}
