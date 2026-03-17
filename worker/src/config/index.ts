import dotenv from 'dotenv';
import path from 'path';

// Since this runs in a docker container, the actual environment variables
// might be passed via docker-compose, but we fallback to .env for local dev.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
        url: `http://directus:8055${process.env.ADMIN_BASE_PATH || ''}`,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
    }
};
