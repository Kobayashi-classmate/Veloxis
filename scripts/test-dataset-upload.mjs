import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import FormData from 'form-data';
import fs from 'fs';

const envPath = path.resolve('../.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH || ''}`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
    console.log("Authenticating...");
    const authRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
        email: EMAIL,
        password: PASSWORD
    });
    const token = authRes.data.data.access_token;
    
    // Get the first project id to use
    const projectsRes = await axios.get(`${DIRECTUS_URL}/items/projects`, { headers: { Authorization: `Bearer ${token}` } });
    const projectId = projectsRes.data.data[0]?.id;
    if (!projectId) {
        console.error("No project found to associate dataset.");
        return;
    }
    console.log(`Using Project ID: ${projectId}`);
    
    try {
        console.log("Uploading file...");
        const formData = new FormData();
        formData.append('title', 'sample.csv');
        formData.append('file', fs.createReadStream('../workstation/sample.csv'));

        const uploadRes = await axios.post(`${DIRECTUS_URL}/files`, formData, { 
            headers: { 
                Authorization: `Bearer ${token}`,
                ...formData.getHeaders()
            } 
        });
        
        const fileId = uploadRes.data.data.id;
        console.log("File uploaded, ID:", fileId);
        
        console.log("Creating dataset...");
        const datasetRes = await axios.post(`${DIRECTUS_URL}/items/datasets`, {
            name: 'API Test Dataset',
            project_id: projectId,
            type: 'CSV',
            status: 'ready'
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        const datasetId = datasetRes.data.data.id;
        console.log("Dataset created, ID:", datasetId);
        
        console.log("Creating dataset version...");
        const versionRes = await axios.post(`${DIRECTUS_URL}/items/dataset_versions`, {
            dataset_id: datasetId,
            version_name: 'v1.0',
            file_id: fileId,
            status: 'processing'
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        console.log("Dataset Version created, ID:", versionRes.data.data.id);
        
        console.log("Success! File upload and dataset creation works.");
        
    } catch(e) {
        console.log("Error:", e.response?.data || e.message);
    }
}
run();