import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBatchStatus } from './IngestionBatchStatus';

test('resolveBatchStatus should return failed when any failed exists', () => {
    const status = resolveBatchStatus(['ready', 'processing', 'failed']);
    assert.equal(status, 'failed');
});

test('resolveBatchStatus should return processing when still processing', () => {
    const status = resolveBatchStatus(['ready', 'processing']);
    assert.equal(status, 'processing');
});

test('resolveBatchStatus should return ready when all ready', () => {
    const status = resolveBatchStatus(['ready', 'ready']);
    assert.equal(status, 'ready');
});

