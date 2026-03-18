import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import crypto from 'crypto';

const envPath = path.resolve('../.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH || ''}`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
    const authRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
        email: EMAIL,
        password: PASSWORD
    });
    const token = authRes.data.data.access_token;
    
    const client = axios.create({
        baseURL: DIRECTUS_URL,
        headers: { Authorization: `Bearer ${token}` }
    });

    try {
        console.log("1. Uploading file to Directus...");
        const formData = new FormData();
        formData.append('title', 'dirty_sales.csv');
        formData.append('file', fs.createReadStream('./sample_sales.csv'));
        
        const uploadRes = await axios.post(`${DIRECTUS_URL}/files`, formData, {
            headers: {
                ...formData.getHeaders(),
                Authorization: `Bearer ${token}`
            }
        });
        const fileId = uploadRes.data.data.id;
        console.log(`✅ File uploaded. ID: ${fileId}`);

        console.log("2. Creating Project...");
        const projectId = crypto.randomUUID();
        await client.post('/items/projects', {
            id: projectId,
            name: "ETL Test Project"
        });
        
        console.log("3. Creating Dataset...");
        const datasetId = crypto.randomUUID();
        await client.post('/items/datasets', {
            id: datasetId,
            name: "ETL Dirty Sales Dataset",
            project_id: projectId,
            type: "sales"
        });

        // 3.5 Create Recipe collection (dynamic definition to ensure it exists)
        try {
            await client.post('/collections', {
                collection: 'recipes',
                fields: [
                    { field: 'id', type: 'uuid', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: false } },
                    { field: 'dataset_id', type: 'uuid' },
                    { field: 'config', type: 'json' }
                ],
                meta: { icon: 'settings_suggest' }
            });
            console.log("✅ Created 'recipes' collection dynamically");
        } catch(e) { }

        console.log("4. Creating Recipe...");
        const recipeId = crypto.randomUUID();
        await client.post('/items/recipes', {
            id: recipeId,
            dataset_id: datasetId,
            config: [
                { type: "rename", from: "customer_name", to: "buyer" },
                { type: "uppercase", field: "buyer" },
                { type: "filter", field: "purchase_amount" }
            ]
        });
        console.log(`✅ Recipe created. ID: ${recipeId}`);

        console.log("5. Creating Dataset Version (triggering webhook)...");
        const versionId = crypto.randomUUID();
        await client.post('/items/dataset_versions', {
            id: versionId,
            dataset_id: datasetId,
            version_name: "v1.etl",
            file_id: fileId,
            status: "processing"
        });
        console.log(`✅ Version created. ID: ${versionId}`);

        console.log(`Please check Data Worker logs to see if ETL operators renamed 'customer_name' to 'buyer' and uppercased it.`);

    } catch(e) {
        console.log("❌ Error:", e.response?.data || e.message);
    }
}
run();
