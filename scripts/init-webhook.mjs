import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve('../.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH || ''}`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
    let token;
    try {
        const authRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        token = authRes.data.data.access_token;
        console.log("✅ Authenticated as Admin");
    } catch (err) {
        console.error("❌ Auth Failed:", err.response?.data || err.message);
        return;
    }

    const client = axios.create({
        baseURL: DIRECTUS_URL,
        headers: { Authorization: `Bearer ${token}` }
    });

    try {
        await client.post('/webhooks', {
            name: "Trigger Data Worker Ingestion",
            method: "POST",
            url: "http://data-worker:3000/webhooks/ingestion",
            status: "active",
            data: true,
            actions: ["create"],
            collections: ["dataset_versions"]
        });
        console.log("✅ Webhook created successfully.");
    } catch (err) {
        console.error("❌ Failed to create webhook:", err.response?.data || err.message);
    }
}

run();
