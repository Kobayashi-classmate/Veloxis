import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
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
        const projectId = crypto.randomUUID();
        const projRes = await client.post('/items/projects', {
            id: projectId,
            name: "Test Project",
            description: "A test project"
        });
        console.log("✅ Project created:", projectId);

        const datasetId = crypto.randomUUID();
        const dsRes = await client.post('/items/datasets', {
            id: datasetId,
            name: "Test Dataset",
            project_id: projectId,
            type: "sales",
            status: "draft"
        });
        console.log("✅ Dataset created:", datasetId);

        const versionId = crypto.randomUUID();
        const verRes = await client.post('/items/dataset_versions', {
            id: versionId,
            dataset_id: datasetId,
            version_name: "v1.test",
            file_id: "test_ingest_1773798826514.csv",
            status: "processing"
        });
        console.log("✅ Version created:", versionId);

    } catch(e) {
        console.log("❌ Error:", e.response?.data || e.message);
    }
}
run();
