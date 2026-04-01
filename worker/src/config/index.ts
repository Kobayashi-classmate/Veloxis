import dotenv from 'dotenv';
import path from 'path';

// Since this runs in a docker container, the actual environment variables
// might be passed via docker-compose, but we fallback to .env for local dev.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const parseIntWithDefault = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const asBoolean = (value: string | undefined, fallback: boolean): boolean => {
    if (typeof value !== 'string') return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

export const config = {
    // S3 (SeaweedFS) Configuration
    s3: {
        endpoint: process.env.S3_ENDPOINT || 'http://seaweedfs:8333',
        accessKey: process.env.S3_ACCESS_KEY || 'dcd_admin_key',
        secretKey: process.env.S3_SECRET_KEY || 'dcd_super_secret_key_2026',
        bucket: process.env.S3_BUCKET || 'veloxis-data',
        region: 'us-east-1', // Required by S3 client but ignored by SeaweedFS
        forcePathStyle: true,
    },
    // Redis & BullMQ
    redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    // Apache Doris HTTP Client for Stream Load
    doris: {
        host: process.env.CUBEJS_DB_HOST || 'doris-fe',
        httpPort: process.env.DORIS_HTTP_PORT || '8030', // FE HTTP port for stream load
        user: process.env.CUBEJS_DB_USER || 'root',
        password: process.env.CUBEJS_DB_PASS || '',
        database: process.env.CUBEJS_DB_NAME || 'veloxis_data',
    },
    // Directus API (Control Plane)
    directus: {
        // We communicate with directus container internally, so no base path is needed
        url: `http://directus:8055`,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    },
    captcha: {
        provider: (process.env.CAPTCHA_PROVIDER || 'internal').toLowerCase(),
        failClosed: asBoolean(process.env.CAPTCHA_FAIL_CLOSED, true),
        challengeTtlSeconds: parseIntWithDefault(process.env.CAPTCHA_CHALLENGE_TTL_SECONDS, 120),
        ticketTtlSeconds: parseIntWithDefault(process.env.CAPTCHA_TICKET_TTL_SECONDS, 120),
        ticketSecret: process.env.CAPTCHA_TICKET_SECRET || process.env.SECRET || '',
        turnstileSiteKey: process.env.CAPTCHA_TURNSTILE_SITE_KEY || '',
        turnstileSecret: process.env.CAPTCHA_TURNSTILE_SECRET || '',
    },
};
