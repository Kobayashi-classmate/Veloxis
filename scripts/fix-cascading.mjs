import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH ?? ''}`
const EMAIL        = process.env.ADMIN_EMAIL
const PASSWORD     = process.env.ADMIN_PASSWORD

async function authenticate() {
  const res = await axios.post(`${DIRECTUS_URL}/auth/login`, { email: EMAIL, password: PASSWORD })
  return res.data.data.access_token
}

async function run() {
  const token = await authenticate()
  const client = axios.create({
    baseURL: DIRECTUS_URL,
    headers: { Authorization: `Bearer ${token}` },
  })

  console.log('🔗 Fixing cascading deletes for project-related collections...')

  const relationsToFix = [
    { collection: 'datasets', field: 'project_id', related_collection: 'projects' },
    { collection: 'project_members', field: 'project_id', related_collection: 'projects' },
    { collection: 'project_starred', field: 'project_id', related_collection: 'projects' },
    { collection: 'dataset_versions', field: 'dataset_id', related_collection: 'datasets' },
    { collection: 'recipes', field: 'dataset_id', related_collection: 'datasets' }
  ]

  for (const rel of relationsToFix) {
    try {
      // Directus allows patching relations to set on_delete behavior
      await client.patch(`/relations/${rel.collection}/${rel.field}`, {
        schema: {
          on_delete: 'CASCADE'
        }
      })
      console.log(`✅ ${rel.collection}.${rel.field} -> CASCADE`)
    } catch (err) {
        // If the relation doesn't exist in the relations endpoint, it might be via the field
        console.error(`❌ Failed to fix ${rel.collection}.${rel.field}:`, err.response?.data ?? err.message)
    }
  }
}

run()
