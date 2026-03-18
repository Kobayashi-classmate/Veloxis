import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

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
        // Delete existing flows named "Trigger Data Worker Ingestion"
        const flowsRes = await client.get('/flows?filter[name][_eq]=Trigger Data Worker Ingestion');
        for (const flow of flowsRes.data.data) {
            await client.delete(`/flows/${flow.id}`);
            console.log(`✅ Deleted old flow ${flow.id}`);
        }

        const flowRes = await client.post('/flows', {
            name: "Trigger Data Worker Ingestion",
            icon: "webhook",
            color: "#FF0000",
            status: "active",
            trigger: "event",
            options: {
                type: "action",
                scope: ["items.create"],
                collections: ["dataset_versions"]
            }
        });
        const flowId = flowRes.data.data.id;
        console.log("✅ Flow created:", flowId);

        const opRes = await client.post('/operations', {
            name: "Send Webhook to Worker",
            key: "send_webhook",
            type: "request",
            position_x: 20,
            position_y: 20,
            options: {
                method: "POST",
                url: "http://data-worker:3000/webhooks/ingestion",
                body: "{{$trigger}}"
            },
            flow: flowId
        });
        console.log("✅ Operation created:", opRes.data.data.id);

        // Update Flow to use this operation as the start
        await client.patch(`/flows/${flowId}`, {
            operation: opRes.data.data.id
        });
        console.log("✅ Flow linked to Operation.");

    } catch(e) {
        console.log("❌ Error:", e.response?.data || e.message);
    }
}
run();
