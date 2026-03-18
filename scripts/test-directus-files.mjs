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
        const fileId = "47c1eea7-95d5-4468-a6a3-1e1f59ce8f9c";
        const fileRes = await axios.get(`${DIRECTUS_URL}/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } });
        console.log("File:", fileRes.data);
    } catch(e) {
        console.log("Error:", e.response?.data || e.message);
    }
}
run();
