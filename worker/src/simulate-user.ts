import axios from 'axios';
import fs from 'fs';
import mysql from 'mysql2/promise';
import FormData from 'form-data';
import { config } from './config';

async function simulate() {
    console.log("🎬 [Simulation] Starting User Simulation for 'test - max.xlsx'...");

    // Use internal directus address for simulation script running inside the same network
    const DIRECTUS_INTERNAL = 'http://directus:8055';

    // 1. Authenticate
    console.log(`[Simulation] Logging in as ${config.directus.email}...`);
    const authRes = await axios.post(`${DIRECTUS_INTERNAL}/auth/login`, {
        email: config.directus.email,
        password: config.directus.password
    });
    const token = authRes.data.data.access_token;
    const headers = { Authorization: `Bearer ${token}` };
    console.log("✅ Authenticated.");

    // 2. Setup Meta Records
    console.log("[Simulation] 1. Creating mock Project and Dataset...");
    const project = await axios.post(`${DIRECTUS_INTERNAL}/items/projects`, { name: 'Max Stress Project' }, { headers });
    const projectId = project.data.data.id;

    const dataset = await axios.post(`${DIRECTUS_INTERNAL}/items/datasets`, { 
        name: 'Max Stress Dataset', 
        project_id: projectId,
        status: 'draft'
    }, { headers });
    const datasetId = dataset.data.data.id;

    // 3. Prepare Doris Table
    console.log("[Simulation] 2. Preparing Doris Table...");
    const db = await mysql.createConnection({ host: 'doris-fe', port: 9030, user: 'root', password: '' });
    const tableName = `ds_${datasetId.replace(/-/g, '_')}`;
    await db.query(`CREATE DATABASE IF NOT EXISTS veloxis_data`);
    await db.query(`DROP TABLE IF EXISTS veloxis_data.${tableName}`);
    await db.query(`CREATE TABLE veloxis_data.${tableName} (c1 VARCHAR(255), c2 TEXT, c3 TEXT, c4 TEXT, c5 TEXT, c6 TEXT, c7 TEXT, c8 TEXT, c9 TEXT, c10 TEXT) DUPLICATE KEY(c1) DISTRIBUTED BY HASH(c1) BUCKETS 1 PROPERTIES ("replication_allocation" = "tag.location.default: 1");`);
    await db.end();

    // 4. Upload file to Directus
    console.log("[Simulation] 3. Uploading 'test - max.xlsx' to Directus Assets (70MB)...");
    const form = new FormData();
    form.append('file', fs.createReadStream('/app/test_file/test - max.xlsx'));
    
    const uploadRes = await axios.post(`${DIRECTUS_INTERNAL}/files`, form, {
        headers: { ...headers, ...form.getHeaders() },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
    const fileId = uploadRes.data.data.id;
    console.log(`✅ File uploaded. ID: ${fileId}`);

    // 5. Create Dataset Version
    console.log("[Simulation] 4. Creating Dataset Version...");
    const versionRes = await axios.post(`${DIRECTUS_INTERNAL}/items/dataset_versions`, {
        dataset_id: datasetId,
        version_name: 'Max Load v1',
        file_id: fileId,
        status: 'processing'
    }, { headers });
    const versionId = versionRes.data.data.id;

    // 6. Trigger Webhook
    console.log("[Simulation] 5. Triggering Data Worker Webhook...");
    const webhookUrl = 'http://localhost:3000/webhooks/ingestion';
    await axios.post(webhookUrl, {
        event: 'items.create',
        collection: 'dataset_versions',
        payload: {
            id: versionId,
            dataset_id: datasetId,
            file_id: fileId
        }
    });

    console.log(`\n🚀 [Simulation] SUCCESS! Webhook triggered.`);
    console.log(`The Data Worker is now processing the ingestion in the background.`);
    console.log(`Run 'docker logs -f veloxis_data_worker' to monitor.`);
    process.exit(0);
}

simulate().catch(e => {
    console.error("❌ Simulation Failed:", e.response?.data || e.message);
    process.exit(1);
});
