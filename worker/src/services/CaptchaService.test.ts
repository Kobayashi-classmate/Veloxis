import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptchaError, CaptchaService } from './CaptchaService';

type StoredValue = {
    value: string;
    expiresAt: number | null;
};

class FakeRedis {
    status = 'ready';

    private store = new Map<string, StoredValue>();

    private now(): number {
        return Date.now();
    }

    private isExpired(record: StoredValue): boolean {
        return record.expiresAt !== null && record.expiresAt <= this.now();
    }

    private read(key: string): StoredValue | null {
        const record = this.store.get(key);
        if (!record) return null;
        if (this.isExpired(record)) {
            this.store.delete(key);
            return null;
        }
        return record;
    }

    async set(key: string, value: string, ...args: string[]): Promise<string | null> {
        let expiresAt: number | null = null;
        let nx = false;

        for (let i = 0; i < args.length; i += 1) {
            const flag = (args[i] || '').toUpperCase();
            if (flag === 'EX') {
                const sec = Number(args[i + 1] || '0');
                expiresAt = this.now() + sec * 1000;
                i += 1;
                continue;
            }
            if (flag === 'PX') {
                const ms = Number(args[i + 1] || '0');
                expiresAt = this.now() + ms;
                i += 1;
                continue;
            }
            if (flag === 'NX') {
                nx = true;
            }
        }

        if (nx && this.read(key)) {
            return null;
        }

        this.store.set(key, { value, expiresAt });
        return 'OK';
    }

    async get(key: string): Promise<string | null> {
        return this.read(key)?.value ?? null;
    }

    async del(key: string): Promise<number> {
        return this.store.delete(key) ? 1 : 0;
    }

    async pttl(key: string): Promise<number> {
        const record = this.read(key);
        if (!record) return -2;
        if (record.expiresAt === null) return -1;
        return Math.max(0, record.expiresAt - this.now());
    }

    async eval(_script: string, _keyCount: number, key: string, ttlRaw: string, expected: string): Promise<number> {
        const record = this.read(key);
        if (!record) return 0;
        if (record.value !== expected) return -1;
        const ttl = Math.max(1, Number(ttlRaw || '1'));
        this.store.set(key, { value: 'used', expiresAt: this.now() + ttl * 1000 });
        return 1;
    }
}

const buildProofFromPuzzle = (puzzle: any) => {
    const route = [puzzle.start, ...(puzzle.checkpoints || []), puzzle.target];
    const points: Array<{ x: number; y: number; t: number }> = [];
    let time = 0;

    for (let i = 1; i < route.length; i += 1) {
        const from = route[i - 1];
        const to = route[i];
        const steps = 7;
        for (let s = 0; s <= steps; s += 1) {
            const ratio = s / steps;
            const wobble = (s % 2 === 0 ? 0.8 : -0.8) * Math.min(1, i);
            points.push({
                x: Number((from.x + (to.x - from.x) * ratio).toFixed(2)),
                y: Number((from.y + (to.y - from.y) * ratio + wobble).toFixed(2)),
                t: Math.round(time),
            });
            time += 35 + (s % 3) * 11;
        }
    }

    return {
        points,
        startedAt: points[0].t,
        completedAt: points[points.length - 1].t,
        summary: {
            pointCount: points.length,
        },
    };
};

const createInternalService = (redis: any) =>
    new CaptchaService(redis, {
        provider: 'internal',
        failClosed: true,
        challengeTtlSeconds: 120,
        ticketTtlSeconds: 120,
        ticketSecret: 'unit-test-secret',
        turnstileSecret: '',
        turnstileSiteKey: '',
    });

test('CaptchaService internal flow should issue and consume one-time ticket', async () => {
    const redis = new FakeRedis();
    const service = createInternalService(redis as any);
    const challenge = await service.createChallenge('signin');
    const proof = buildProofFromPuzzle(challenge.puzzle);

    const verified = await service.verifyAndIssueTicket(
        {
            action: 'signin',
            subject: 'user@example.com',
            challengeId: challenge.challengeId,
            nonce: challenge.nonce,
            behaviorProof: proof,
        },
        { ip: '127.0.0.1', userAgent: 'unit-test-agent' },
    );

    assert.equal(verified.success, true);
    assert.equal(typeof verified.captchaTicket, 'string');

    const consumeResult = await service.consumeTicketForLogin(
        verified.captchaTicket,
        'signin',
        'user@example.com',
        { ip: '127.0.0.1', userAgent: 'unit-test-agent' },
    );
    assert.equal(consumeResult.success, true);

    await assert.rejects(
        () =>
            service.consumeTicketForLogin(verified.captchaTicket, 'signin', 'user@example.com', {
                ip: '127.0.0.1',
                userAgent: 'unit-test-agent',
            }),
        (err: any) => err instanceof CaptchaError && err.code === 'CAPTCHA_TICKET_REPLAY',
    );
});

test('CaptchaService should reject ticket when context does not match', async () => {
    const redis = new FakeRedis();
    const service = createInternalService(redis as any);
    const challenge = await service.createChallenge('signin');
    const proof = buildProofFromPuzzle(challenge.puzzle);

    const verified = await service.verifyAndIssueTicket(
        {
            action: 'signin',
            subject: 'user@example.com',
            challengeId: challenge.challengeId,
            nonce: challenge.nonce,
            behaviorProof: proof,
        },
        { ip: '10.0.0.1', userAgent: 'ua-1' },
    );

    await assert.rejects(
        () =>
            service.consumeTicketForLogin(verified.captchaTicket, 'signin', 'other@example.com', {
                ip: '10.0.0.1',
                userAgent: 'ua-1',
            }),
        (err: any) => err instanceof CaptchaError && err.code === 'CAPTCHA_VERIFY_FAILED',
    );
});

test('CaptchaService turnstile mode should fail closed when provider is not configured', async () => {
    const redis = new FakeRedis();
    const service = new CaptchaService(redis as any, {
        provider: 'turnstile',
        failClosed: true,
        challengeTtlSeconds: 120,
        ticketTtlSeconds: 120,
        ticketSecret: 'unit-test-secret',
        turnstileSecret: '',
        turnstileSiteKey: '',
    });

    await assert.rejects(
        () =>
            service.verifyAndIssueTicket(
                {
                    action: 'signin',
                    subject: 'user@example.com',
                    token: 'test-token',
                },
                { ip: '127.0.0.1', userAgent: 'unit-test' },
            ),
        (err: any) => err instanceof CaptchaError && err.code === 'CAPTCHA_PROVIDER_UNAVAILABLE',
    );
});

