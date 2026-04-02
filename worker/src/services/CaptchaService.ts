import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import type { Redis } from 'ioredis';

type CaptchaProvider = 'internal' | 'turnstile';

type CaptchaConfig = {
    provider: string;
    failClosed: boolean;
    challengeTtlSeconds: number;
    ticketTtlSeconds: number;
    internalLeniency?: number;
    ticketSecret: string;
    turnstileSiteKey: string;
    turnstileSecret: string;
};

type Point = {
    x: number;
    y: number;
};

type BehaviorPoint = {
    x: number;
    y: number;
    t: number;
};

type BehaviorProof = {
    points: BehaviorPoint[];
    startedAt?: number;
    completedAt?: number;
    summary?: Record<string, unknown>;
};

type InternalChallengePayload = {
    id: string;
    nonce: string;
    action: string;
    issuedAt: number;
    expiresAt: number;
    attempts: number;
    canvas: {
        width: number;
        height: number;
    };
    start: Point;
    target: Point;
    checkpoints: Point[];
    tolerancePx: number;
};

type TicketPayload = {
    jti: string;
    action: string;
    provider: CaptchaProvider;
    subHash: string;
    ipHash: string;
    uaHash: string;
    iat: number;
    exp: number;
    riskScore: number;
};

type VerifyContext = {
    ip?: string;
    userAgent?: string;
    requestId?: string;
};

type VerifyResponse = {
    success: true;
    provider: CaptchaProvider;
    action: string;
    captchaTicket: string;
    expiresInSeconds: number;
    riskScore: number;
};

type ConsumeResponse = {
    success: true;
    payload: TicketPayload;
};

export class CaptchaError extends Error {
    code: string;
    status: number;
    meta?: Record<string, unknown>;

    constructor(code: string, message: string, status: number, meta?: Record<string, unknown>) {
        super(message);
        this.code = code;
        this.status = status;
        this.meta = meta;
    }
}

type InternalScore = {
    riskScore: number;
    summary: {
        pointCount: number;
        durationMs: number;
        totalDistancePx: number;
        avgSpeed: number;
        speedVariance: number;
        directionChanges: number;
        maxJumpPx: number;
        endDistancePx: number;
        checkpointCoverage: number;
    };
};

const MAX_INTERNAL_ATTEMPTS = 5;

const serialize = (value: unknown): string => JSON.stringify(value);

const deserializeChallenge = (raw: string): InternalChallengePayload => {
    const parsed = JSON.parse(raw) as InternalChallengePayload;
    return parsed;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const distance = (a: Point, b: Point): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
};

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

const normalizeSubject = (subject: string): string => subject.trim().toLowerCase();

const toBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

const fromBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

const safeSigEqual = (a: string, b: string): boolean => {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
};

const asProvider = (provider: string): CaptchaProvider => {
    return provider === 'turnstile' ? 'turnstile' : 'internal';
};

const parseBehaviorPoint = (value: any): BehaviorPoint | null => {
    const x = Number(value?.x);
    const y = Number(value?.y);
    const t = Number(value?.t);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(t)) return null;
    return { x, y, t };
};

const minDistanceToPoints = (points: BehaviorPoint[], target: Point): number => {
    let min = Number.POSITIVE_INFINITY;
    for (const p of points) {
        const d = distance(p, target);
        if (d < min) min = d;
    }
    return min;
};

const computePathDistance = (points: BehaviorPoint[]): { totalDistance: number; maxJump: number; speeds: number[]; directionChanges: number } => {
    let totalDistance = 0;
    let maxJump = 0;
    const speeds: number[] = [];
    let directionChanges = 0;
    let previousSignX = 0;

    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const curr = points[i];
        const segDistance = distance(prev, curr);
        totalDistance += segDistance;
        if (segDistance > maxJump) maxJump = segDistance;

        const dt = Math.max(1, curr.t - prev.t);
        speeds.push(segDistance / dt);

        const dx = curr.x - prev.x;
        const signX = Math.abs(dx) < 0.35 ? 0 : dx > 0 ? 1 : -1;
        if (previousSignX !== 0 && signX !== 0 && previousSignX !== signX) {
            directionChanges += 1;
        }
        if (signX !== 0) previousSignX = signX;
    }

    return { totalDistance, maxJump, speeds, directionChanges };
};

const variance = (values: number[]): number => {
    if (values.length === 0) return 0;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / values.length;
};

const captchaChallengeKey = (challengeId: string): string => `captcha:challenge:${challengeId}`;
const captchaTicketKey = (jti: string): string => `captcha:ticket:jti:${jti}`;

export class CaptchaService {
    private redis: Redis;

    private provider: CaptchaProvider;

    private failClosed: boolean;

    private challengeTtlSeconds: number;

    private ticketTtlSeconds: number;

    private internalLeniency: number;

    private ticketSecret: string;

    private turnstileSiteKey: string;

    private turnstileSecret: string;

    constructor(redis: Redis, cfg: CaptchaConfig) {
        this.redis = redis;
        this.provider = asProvider(cfg.provider);
        this.failClosed = cfg.failClosed !== false;
        this.challengeTtlSeconds = clamp(Math.floor(cfg.challengeTtlSeconds || 120), 30, 600);
        this.ticketTtlSeconds = clamp(Math.floor(cfg.ticketTtlSeconds || 120), 30, 600);
        this.internalLeniency = clamp(Number(cfg.internalLeniency) || 1, 0.6, 1.8);
        this.ticketSecret = String(cfg.ticketSecret || '');
        this.turnstileSiteKey = String(cfg.turnstileSiteKey || '');
        this.turnstileSecret = String(cfg.turnstileSecret || '');
    }

    getConfig() {
        const turnstileReady = this.turnstileReady();
        return {
            success: true,
            provider: this.provider,
            required: true,
            failClosed: this.failClosed,
            available: this.provider === 'internal' ? true : turnstileReady,
            internalLeniency: this.internalLeniency,
            turnstileSiteKey: this.provider === 'turnstile' ? this.turnstileSiteKey : '',
        };
    }

    async createChallenge(action: string): Promise<{
        provider: 'internal';
        action: string;
        challengeId: string;
        nonce: string;
        expiresInSeconds: number;
        puzzle: {
            type: 'trace_path';
            canvas: { width: number; height: number };
            start: Point;
            target: Point;
            checkpoints: Point[];
            tolerancePx: number;
        };
    }> {
        this.ensureRedisReady();

        if (this.provider !== 'internal') {
            throw new CaptchaError(
                'CAPTCHA_PROVIDER_UNAVAILABLE',
                'captcha challenge is disabled under current provider',
                503,
                { provider: this.provider },
            );
        }

        const challenge = this.generateInternalChallenge(action);
        await this.redis.set(captchaChallengeKey(challenge.id), serialize(challenge), 'EX', this.challengeTtlSeconds);

        return {
            provider: 'internal',
            action,
            challengeId: challenge.id,
            nonce: challenge.nonce,
            expiresInSeconds: this.challengeTtlSeconds,
            puzzle: {
                type: 'trace_path',
                canvas: challenge.canvas,
                start: challenge.start,
                target: challenge.target,
                checkpoints: challenge.checkpoints,
                tolerancePx: challenge.tolerancePx,
            },
        };
    }

    async verifyAndIssueTicket(payload: any, context: VerifyContext): Promise<VerifyResponse> {
        this.ensureRedisReady();

        const action = typeof payload?.action === 'string' && payload.action.trim() ? payload.action.trim() : 'signin';
        const subject = typeof payload?.subject === 'string' ? payload.subject : '';
        if (!subject.trim()) {
            throw new CaptchaError('CAPTCHA_REQUIRED', 'captcha subject is required', 400);
        }

        if (this.provider === 'turnstile') {
            if (!this.turnstileReady()) {
                throw new CaptchaError('CAPTCHA_PROVIDER_UNAVAILABLE', 'turnstile provider not configured', 503);
            }
            const token = typeof payload?.token === 'string' ? payload.token.trim() : '';
            if (!token) {
                throw new CaptchaError('CAPTCHA_REQUIRED', 'turnstile token is required', 400);
            }
            const verified = await this.verifyTurnstileToken(token, context.ip, action);
            if (!verified.success) {
                throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha verification failed', 400, {
                    errorCodes: verified.errorCodes,
                });
            }
            return this.issueTicket(action, subject, 'turnstile', context, 96);
        }

        const challengeId = typeof payload?.challengeId === 'string' ? payload.challengeId.trim() : '';
        const nonce = typeof payload?.nonce === 'string' ? payload.nonce.trim() : '';
        const behaviorProof = payload?.behaviorProof as BehaviorProof | undefined;

        if (!challengeId || !nonce || !behaviorProof) {
            throw new CaptchaError('CAPTCHA_REQUIRED', 'challengeId, nonce and behaviorProof are required', 400);
        }

        const score = await this.verifyInternalChallenge(challengeId, nonce, action, behaviorProof);
        return this.issueTicket(action, subject, 'internal', context, score.riskScore, score.summary);
    }

    async consumeTicketForLogin(captchaTicket: string, action: string, subject: string, context: VerifyContext): Promise<ConsumeResponse> {
        this.ensureRedisReady();

        if (!captchaTicket || !captchaTicket.trim()) {
            throw new CaptchaError('CAPTCHA_REQUIRED', 'captchaTicket is required', 400);
        }
        if (!this.ticketSecret) {
            throw new CaptchaError('CAPTCHA_PROVIDER_UNAVAILABLE', 'captcha ticket secret not configured', 503);
        }

        const payload = this.verifyTicket(captchaTicket, action, subject, context);

        const now = Math.floor(Date.now() / 1000);
        const remainingTtl = Math.max(1, payload.exp - now);
        const lua = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local expected = ARGV[2]
local current = redis.call('GET', key)
if not current then
  return 0
end
if current ~= expected then
  return -1
end
redis.call('SET', key, 'used', 'EX', ttl)
return 1
`;

        const result = await this.redis.eval(lua, 1, captchaTicketKey(payload.jti), String(remainingTtl), 'issued');
        const consumeResult = typeof result === 'number' ? result : Number(result);
        if (consumeResult === 0) {
            throw new CaptchaError('CAPTCHA_TICKET_EXPIRED', 'captcha ticket expired', 400);
        }
        if (consumeResult === -1) {
            throw new CaptchaError('CAPTCHA_TICKET_REPLAY', 'captcha ticket already consumed', 400);
        }
        if (consumeResult !== 1) {
            throw new CaptchaError('CAPTCHA_PROVIDER_UNAVAILABLE', 'captcha ticket consume failed', 503);
        }

        return { success: true, payload };
    }

    private ensureRedisReady(): void {
        if (this.redis.status !== 'ready' && this.failClosed) {
            throw new CaptchaError('CAPTCHA_PROVIDER_UNAVAILABLE', 'captcha redis unavailable', 503);
        }
    }

    private generateInternalChallenge(action: string): InternalChallengePayload {
        const width = 320;
        const height = 140;
        const tolerancePx = 18;
        const id = randomUUID();
        const nonce = randomBytes(12).toString('hex');
        const issuedAt = Date.now();
        const expiresAt = issuedAt + this.challengeTtlSeconds * 1000;

        const start: Point = {
            x: 22,
            y: 46 + Math.floor(Math.random() * 50),
        };
        const target: Point = {
            x: width - 26,
            y: 42 + Math.floor(Math.random() * 56),
        };

        const cp1x = Math.floor(width * 0.35);
        const cp2x = Math.floor(width * 0.58);
        const cp3x = Math.floor(width * 0.78);
        const interpY = (ratio: number): number => start.y + (target.y - start.y) * ratio;
        const minOffset = Math.round(tolerancePx * 1.7);
        const maxOffset = 42;
        let previousSign = Math.random() > 0.5 ? 1 : -1;
        const createCheckpoint = (x: number, ratio: number): Point => {
            const baseY = interpY(ratio);
            const upRoom = Math.max(0, Math.floor(baseY - 20));
            const downRoom = Math.max(0, Math.floor(height - 20 - baseY));
            const preferredSign = previousSign * -1;
            const alternateSign = preferredSign * -1;
            const preferredRoom = preferredSign < 0 ? upRoom : downRoom;
            const alternateRoom = alternateSign < 0 ? upRoom : downRoom;

            let sign = preferredSign;
            if (preferredRoom < minOffset && alternateRoom >= minOffset) {
                sign = alternateSign;
            } else if (preferredRoom < minOffset && alternateRoom < minOffset) {
                sign = downRoom >= upRoom ? 1 : -1;
            }
            previousSign = sign;

            const room = sign < 0 ? upRoom : downRoom;
            const maxAllowedOffset = Math.min(maxOffset, room);
            const minAllowedOffset = Math.min(minOffset, maxAllowedOffset);
            const offset =
                minAllowedOffset +
                (maxAllowedOffset > minAllowedOffset
                    ? Math.floor(Math.random() * (maxAllowedOffset - minAllowedOffset + 1))
                    : 0);
            const jitter = Math.floor(Math.random() * 7) - 3;
            return {
                x,
                y: clamp(Math.round(baseY + sign * offset + jitter), 20, height - 20),
            };
        };
        const checkpoints: Point[] = [createCheckpoint(cp1x, 0.35), createCheckpoint(cp2x, 0.58), createCheckpoint(cp3x, 0.78)];

        return {
            id,
            nonce,
            action,
            issuedAt,
            expiresAt,
            attempts: 0,
            canvas: { width, height },
            start,
            target,
            checkpoints,
            tolerancePx,
        };
    }

    private parseBehaviorProof(proof: BehaviorProof): BehaviorPoint[] {
        if (!proof || !Array.isArray(proof.points)) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid behavior proof payload', 400);
        }
        const parsedPoints: BehaviorPoint[] = [];
        for (const rawPoint of proof.points) {
            const point = parseBehaviorPoint(rawPoint);
            if (!point) {
                throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid behavior point data', 400);
            }
            parsedPoints.push(point);
        }
        if (parsedPoints.length < 16 || parsedPoints.length > 420) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid behavior point count', 400);
        }
        for (let i = 1; i < parsedPoints.length; i += 1) {
            if (parsedPoints[i].t < parsedPoints[i - 1].t) {
                throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid behavior timestamp order', 400);
            }
        }
        return parsedPoints;
    }

    private evaluateBehavior(challenge: InternalChallengePayload, proof: BehaviorProof): InternalScore {
        const leniency = this.internalLeniency;
        const points = this.parseBehaviorProof(proof);
        const first = points[0];
        const last = points[points.length - 1];
        const durationMs = Math.max(
            0,
            (Number(proof.completedAt) || last.t) - (Number(proof.startedAt) || first.t),
        );
        const endDistancePx = distance(last, challenge.target);
        const startDistancePx = distance(first, challenge.start);

        if (durationMs < 220 / leniency || durationMs > 20_000) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha behavior duration out of range', 400);
        }
        if (startDistancePx > challenge.tolerancePx * 1.8 * leniency) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha behavior start mismatch', 400);
        }
        if (endDistancePx > challenge.tolerancePx * 1.3 * leniency) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha behavior end mismatch', 400);
        }

        const { totalDistance, maxJump, speeds, directionChanges } = computePathDistance(points);
        if (totalDistance < 80 / leniency || totalDistance > 4000 * leniency) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha path distance out of range', 400);
        }
        if (maxJump > 130 * leniency) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha path jump too large', 400);
        }

        const speedVariance = variance(speeds);
        if (speedVariance < 0.0000005 / (leniency * leniency)) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha behavior too uniform', 400);
        }

        const midCheckpoints = [...challenge.checkpoints];
        let passedMidCheckpoints = 0;
        for (const checkpoint of midCheckpoints) {
            const min = minDistanceToPoints(points, checkpoint);
            if (min <= challenge.tolerancePx * 1.25 * leniency) {
                passedMidCheckpoints += 1;
            }
        }
        const requiredMidCheckpoints = Math.max(1, midCheckpoints.length - 1);
        if (passedMidCheckpoints < requiredMidCheckpoints) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha checkpoint coverage too low', 400);
        }
        const checkpointCoverage =
            midCheckpoints.length === 0 ? 1 : passedMidCheckpoints / midCheckpoints.length;

        const avgSpeed = totalDistance / Math.max(1, durationMs);
        let riskScore = 100;
        if (directionChanges < 1) riskScore -= 10;
        if (directionChanges < 3) riskScore -= 8;
        if (maxJump > 70) riskScore -= 12;
        if (durationMs < 800) riskScore -= 10;
        if (speedVariance < 0.0002) riskScore -= 10;
        if (avgSpeed > 1.8) riskScore -= 12;
        riskScore = clamp(Math.round(riskScore), 1, 100);

        return {
            riskScore,
            summary: {
                pointCount: points.length,
                durationMs,
                totalDistancePx: Number(totalDistance.toFixed(2)),
                avgSpeed: Number(avgSpeed.toFixed(4)),
                speedVariance: Number(speedVariance.toFixed(6)),
                directionChanges,
                maxJumpPx: Number(maxJump.toFixed(2)),
                endDistancePx: Number(endDistancePx.toFixed(2)),
                checkpointCoverage: Number(checkpointCoverage.toFixed(4)),
            },
        };
    }

    private async verifyInternalChallenge(challengeId: string, nonce: string, action: string, behaviorProof: BehaviorProof): Promise<InternalScore> {
        const key = captchaChallengeKey(challengeId);
        const raw = await this.redis.get(key);
        if (!raw) {
            throw new CaptchaError('CAPTCHA_CHALLENGE_EXPIRED', 'captcha challenge not found or expired', 400);
        }
        const ttlMs = await this.redis.pttl(key);
        const challenge = deserializeChallenge(raw);

        if (challenge.nonce !== nonce) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha nonce mismatch', 400);
        }
        if (challenge.action !== action) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha action mismatch', 400);
        }
        if (challenge.expiresAt <= Date.now()) {
            await this.redis.del(key);
            throw new CaptchaError('CAPTCHA_CHALLENGE_EXPIRED', 'captcha challenge expired', 400);
        }

        try {
            const score = this.evaluateBehavior(challenge, behaviorProof);
            await this.redis.del(key);
            return score;
        } catch (err: any) {
            challenge.attempts += 1;
            if (challenge.attempts >= MAX_INTERNAL_ATTEMPTS || ttlMs <= 0) {
                await this.redis.del(key);
            } else {
                await this.redis.set(key, serialize(challenge), 'PX', ttlMs);
            }
            throw err;
        }
    }

    private ticketSignature(payloadB64: string): string {
        return createHmac('sha256', this.ticketSecret).update(payloadB64).digest('base64url');
    }

    private verifyTicket(token: string, action: string, subject: string, context: VerifyContext): TicketPayload {
        const parts = token.split('.');
        if (parts.length !== 2) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid captcha ticket format', 400);
        }
        const [payloadB64, signature] = parts;
        const expectedSignature = this.ticketSignature(payloadB64);
        if (!safeSigEqual(signature, expectedSignature)) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid captcha ticket signature', 400);
        }

        let payload: TicketPayload;
        try {
            payload = JSON.parse(fromBase64Url(payloadB64)) as TicketPayload;
        } catch {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'invalid captcha ticket payload', 400);
        }

        const now = Math.floor(Date.now() / 1000);
        if (!payload.exp || payload.exp < now) {
            throw new CaptchaError('CAPTCHA_TICKET_EXPIRED', 'captcha ticket expired', 400);
        }
        if (payload.action !== action) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha ticket action mismatch', 400);
        }

        const subHash = sha256Hex(normalizeSubject(subject));
        const ipHash = sha256Hex((context.ip || '').trim());
        const uaHash = sha256Hex((context.userAgent || '').trim());

        if (payload.subHash !== subHash || payload.ipHash !== ipHash || payload.uaHash !== uaHash) {
            throw new CaptchaError('CAPTCHA_VERIFY_FAILED', 'captcha ticket context mismatch', 400);
        }

        return payload;
    }

    private async issueTicket(
        action: string,
        subject: string,
        provider: CaptchaProvider,
        context: VerifyContext,
        riskScore: number,
        summary?: Record<string, unknown>,
    ): Promise<VerifyResponse> {
        if (!this.ticketSecret) {
            throw new CaptchaError('CAPTCHA_PROVIDER_UNAVAILABLE', 'captcha ticket secret not configured', 503);
        }
        const now = Math.floor(Date.now() / 1000);
        const payload: TicketPayload = {
            jti: randomUUID(),
            action,
            provider,
            subHash: sha256Hex(normalizeSubject(subject)),
            ipHash: sha256Hex((context.ip || '').trim()),
            uaHash: sha256Hex((context.userAgent || '').trim()),
            iat: now,
            exp: now + this.ticketTtlSeconds,
            riskScore: clamp(Math.round(riskScore), 1, 100),
        };

        const payloadB64 = toBase64Url(serialize(payload));
        const signature = this.ticketSignature(payloadB64);
        const ticket = `${payloadB64}.${signature}`;

        const setResult = await this.redis.set(captchaTicketKey(payload.jti), 'issued', 'EX', this.ticketTtlSeconds, 'NX');
        if (setResult !== 'OK') {
            throw new CaptchaError('CAPTCHA_PROVIDER_UNAVAILABLE', 'captcha ticket issue failed', 503);
        }

        return {
            success: true,
            provider,
            action,
            captchaTicket: ticket,
            expiresInSeconds: this.ticketTtlSeconds,
            riskScore: payload.riskScore,
            ...(summary ? { summary } : {}),
        } as VerifyResponse;
    }

    private turnstileReady(): boolean {
        return this.turnstileSecret.length > 0 && this.turnstileSiteKey.length > 0;
    }

    private async verifyTurnstileToken(
        token: string,
        remoteIp?: string,
        action?: string,
    ): Promise<{ success: boolean; errorCodes: string[] }> {
        const params = new URLSearchParams({
            secret: this.turnstileSecret,
            response: token,
        });

        if (remoteIp) params.set('remoteip', remoteIp);

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        if (!response.ok) {
            return { success: false, errorCodes: [`UPSTREAM_${response.status}`] };
        }

        const data = await response.json() as {
            success?: boolean;
            action?: string;
            'error-codes'?: string[];
        };

        if (action && data.action && data.action !== action) {
            return { success: false, errorCodes: ['ACTION_MISMATCH'] };
        }

        return {
            success: data.success === true,
            errorCodes: Array.isArray(data['error-codes']) ? data['error-codes'] : [],
        };
    }
}
