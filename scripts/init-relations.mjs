import { createDirectus, rest, createRelation, staticToken } from '@directus/sdk';
import axios from 'axios';
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
        console.log("✅ Authenticated as Admin via Axios");
    } catch (err) {
        console.error("❌ Auth Failed:", err.response?.data || err.message);
        return;
    }

    const client = createDirectus(DIRECTUS_URL)
        .with(staticToken(token))
        .with(rest());

    const tryCreateRelation = async (rel) => {
        try {
            await client.request(createRelation(rel));
            console.log(`✅ Created relation: ${rel.collection}.${rel.field} -> ${rel.related_collection}`);
        } catch (err) {
            console.log(`⚠️ Relation ${rel.collection}.${rel.field} skipped or failed: ${err.errors?.[0]?.message || err.message}`);
        }
    };

    const relations = [
        {
            collection: 'datasets',
            field: 'project_id',
            related_collection: 'projects',
            meta: {
                many_collection: 'datasets',
                many_field: 'project_id',
                one_collection: 'projects',
                one_field: null
            }
        },
        {
            collection: 'dataset_versions',
            field: 'dataset_id',
            related_collection: 'datasets',
            meta: {
                many_collection: 'dataset_versions',
                many_field: 'dataset_id',
                one_collection: 'datasets',
                one_field: null
            }
        },
        {
            collection: 'recipes',
            field: 'dataset_id',
            related_collection: 'datasets',
            meta: {
                many_collection: 'recipes',
                many_field: 'dataset_id',
                one_collection: 'datasets',
                one_field: null
            }
        }
    ];

    for (const rel of relations) {
        await tryCreateRelation(rel);
    }
}

run();
