import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { S3Client, PutObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import mysql from 'mysql2/promise';
import fs from 'fs';
import { config } from './config';

const run = async () => {
    console.log("🚀 [Test Script] Starting Data Engine Throughput Test");

    const csvPath = '/tmp/test_data.csv';
    const rows = 100000;
    console.log(`[Test Script] Generating ${rows} rows of CSV data...`);
    const stream = fs.createWriteStream(csvPath);
    for (let i = 1; i <= rows; i++) {
        stream.write(`${i},TestName_${i},${(Math.random() * 1000).toFixed(2)},2026-03-17 12:00:00\n`);
    }
    stream.end();
    await new Promise(resolve => stream.on('finish', resolve));
    
    console.log("[Test Script] Uploading to SeaweedFS...");
    const s3 = new S3Client({
        region: 'us-east-1',
        endpoint: 'http://seaweedfs:8333',
        forcePathStyle: true,
        credentials: { accessKeyId: 'any', secretAccessKey: 'any' }
    });

    try {
        await s3.send(new CreateBucketCommand({ Bucket: config.s3.bucket }));
    } catch (e: any) {
        if (e.name !== 'BucketAlreadyExists' && e.name !== 'BucketAlreadyOwnedByYou') {
            console.log("[Test Script] Bucket creation note:", e.message);
        }
    }

    const fileId = `test_ingest_${Date.now()}.csv`;
    const fileStream = fs.createReadStream(csvPath);
    await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: fileId, Body: fileStream }));
    console.log(`[Test Script] ✅ Uploaded to S3 with File ID: ${fileId}`);

    console.log("[Test Script] Creating Apache Doris table...");
    const db = await mysql.createConnection({ host: config.doris.host, port: 9030, user: config.doris.user, password: config.doris.password });
    await db.query(`CREATE DATABASE IF NOT EXISTS ${config.doris.database}`);
    const tableName = `test_ingestion_${Date.now()}`;
    await db.query(`CREATE TABLE IF NOT EXISTS ${config.doris.database}.${tableName} (id INT, name VARCHAR(50), amount DOUBLE, created_at DATETIME) DUPLICATE KEY(id) DISTRIBUTED BY HASH(id) BUCKETS 1 PROPERTIES ("replication_allocation" = "tag.location.default: 1");`);
    console.log(`[Test Script] ✅ Doris table created: ${tableName}`);
    await db.end();

    console.log("[Test Script] Pushing job to BullMQ queue...");
    const connection = new Redis({ host: config.redis.host, port: config.redis.port, maxRetriesPerRequest: null });
    const queue = new Queue('ingestion-queue', { connection: connection as any });
    await queue.add('ingest-csv-test', { datasetId: 'test', versionId: 'v1.test', fileId: fileId, tableName: tableName });
    console.log(`[Test Script] ✅ Job pushed! Check worker logs.`);
    await connection.quit();
    process.exit(0);
};

run().catch(console.error);
