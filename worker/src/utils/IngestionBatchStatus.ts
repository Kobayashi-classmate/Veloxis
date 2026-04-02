export type DatasetBatchStatus = 'failed' | 'processing' | 'ready';

export function resolveBatchStatus(statuses: string[]): DatasetBatchStatus {
    const normalized = statuses.map((s) => String(s || '').toLowerCase());
    if (normalized.some((s) => s === 'failed')) return 'failed';
    if (normalized.some((s) => s === 'processing')) return 'processing';
    if (normalized.length > 0 && normalized.every((s) => s === 'ready')) return 'ready';
    return 'processing';
}

