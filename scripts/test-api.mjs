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
    
    try {
        const res = await axios.get(`${DIRECTUS_URL}/webhooks`, { headers: { Authorization: `Bearer ${token}` } });
        console.log("Webhooks:", res.data);
    } catch(e) {
        console.log("Webhooks error:", e.response?.data);
    }

    try {
        const res = await axios.get(`${DIRECTUS_URL}/flows`, { headers: { Authorization: `Bearer ${token}` } });
        console.log("Flows:", res.data);
    } catch(e) {
        console.log("Flows error:", e.response?.data);
    }
}
run();
