import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve('../.env');
dotenv.config({ path: envPath });

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH || ''}`;
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

async function run() {
    try {
        const authRes = await axios.post(`${DIRECTUS_URL}/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });
        const token = authRes.data.data.access_token;
        const client = axios.create({
            baseURL: DIRECTUS_URL,
            headers: { Authorization: `Bearer ${token}` }
        });

        // Add 'recipes' collection if not exists
        try {
            await client.post('/collections', {
                collection: 'recipes',
                fields: [
                    { field: 'id', type: 'uuid', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: false } }
                ],
                meta: { icon: 'settings_suggest' }
            });
            console.log("✅ Created 'recipes' collection");
            
            await client.post('/fields/recipes', { field: 'dataset_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o' }, schema: { is_nullable: false } });
            await client.post('/fields/recipes', { field: 'config', type: 'json', meta: { interface: 'list' } });
            
            await client.post('/relations', {
                collection: 'recipes',
                field: 'dataset_id',
                related_collection: 'datasets',
                meta: {
                    one_field: null,
                    sort_field: null,
                    one_deselect_action: 'nullify',
                    junction_field: null
                },
                schema: {
                    table: 'recipes',
                    column: 'dataset_id',
                    foreign_key_table: 'datasets',
                    foreign_key_column: 'id',
                    on_update: 'NO ACTION',
                    on_delete: 'CASCADE'
                }
            });
            console.log("✅ Configured fields and relations for 'recipes'");
        } catch (e) {
            console.log("ℹ️ Collection 'recipes' may already exist or failed:", e.response?.data);
        }

    } catch(e) {
        console.error("❌ Error:", e.response?.data || e.message);
    }
}
run();
