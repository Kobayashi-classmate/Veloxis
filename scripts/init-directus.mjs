import axios from 'axios';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve('../.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH}`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
    console.log(`Connecting to Directus at ${DIRECTUS_URL}`);
    
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

    const createCollection = async (payload) => {
        try {
            await client.post('/collections', payload);
            console.log(`✅ Created collection: ${payload.collection}`);
        } catch (err) {
            console.error(`❌ Failed to create ${payload.collection}:`, JSON.stringify(err.response?.data || err.message, null, 2));
        }
    };

    const createRelation = async (payload) => {
        try {
            await client.post('/relations', payload);
            console.log(`✅ Created relation: ${payload.collection}.${payload.field} -> ${payload.related_collection}`);
        } catch (err) {
            console.error(`❌ Failed to create relation ${payload.field}:`, err.response?.data?.errors?.[0]?.message || err.message);
        }
    };

    // 2. Define Collections (MUST include schema: {} to create physical DB tables)
    const collections = [
        {
            collection: "projects",
            schema: {},
            meta: { icon: "folder", note: "Tenant Projects" },
            fields: [
                { field: "id", type: "uuid", schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
                { field: "name", type: "string" },
                { field: "description", type: "text", meta: { interface: "textarea" } }
            ]
        },
        {
            collection: "datasets",
            schema: {},
            meta: { icon: "database", note: "Datasets belonging to projects" },
            fields: [
                { field: "id", type: "uuid", schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
                { field: "name", type: "string" },
                { field: "project_id", type: "uuid" },
                { field: "type", type: "string" },
                { field: "status", type: "string", meta: { interface: "select-dropdown", options: { choices: [{text:"Draft", value:"draft"}, {text:"Ready", value:"ready"}] } } }
            ]
        },
        {
            collection: "dataset_versions",
            schema: {},
            meta: { icon: "history", note: "Versions of datasets processing" },
            fields: [
                { field: "id", type: "uuid", schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
                { field: "dataset_id", type: "uuid" },
                { field: "version_name", type: "string" },
                { field: "file_id", type: "string", meta: { note: "SeaweedFS ID" } },
                { field: "status", type: "string", meta: { interface: "select-dropdown", options: { choices: [{text:"Processing", value:"processing"}, {text:"Ready", value:"ready"}, {text:"Failed", value:"failed"}] } } }
            ]
        },
        {
            collection: "recipes",
            schema: {},
            meta: { icon: "receipt_long", note: "Automation Queues / Data Wash Pipelines" },
            fields: [
                { field: "id", type: "uuid", schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
                { field: "dataset_id", type: "uuid" },
                { field: "name", type: "string" },
                { field: "config", type: "json", meta: { interface: "list" } }
            ]
        }
    ];

    for (const coll of collections) {
        await createCollection(coll);
    }

    // 3. Create Relations
    const relations = [
        {
            collection: "datasets",
            field: "project_id",
            related_collection: "projects",
            meta: {
                many_collection: "datasets",
                many_field: "project_id",
                one_collection: "projects"
            }
        },
        {
            collection: "dataset_versions",
            field: "dataset_id",
            related_collection: "datasets",
            meta: {
                many_collection: "dataset_versions",
                many_field: "dataset_id",
                one_collection: "datasets"
            }
        },
        {
            collection: "recipes",
            field: "dataset_id",
            related_collection: "datasets",
            meta: {
                many_collection: "recipes",
                many_field: "dataset_id",
                one_collection: "datasets"
            }
        }
    ];

    for (const rel of relations) {
        await createRelation(rel);
    }
}

run();
