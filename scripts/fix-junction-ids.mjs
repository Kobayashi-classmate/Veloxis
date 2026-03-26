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

  // These collections were created with auto-incrementing integer IDs by default.
  // We need to remove the "uuid" special flag that we accidentally added, 
  // so Directus doesn't try to insert a UUID string into an integer column.
  const collections = ['project_members', 'project_starred']
  
  for (const coll of collections) {
    console.log(`🔧 Reverting ${coll}.id meta to support auto-increment...`)
    try {
      await client.patch(`/fields/${coll}/id`, {
        meta: {
          special: null // Remove the uuid special behavior
        }
      })
      console.log(`✅ ${coll}.id updated`)
    } catch (err) {
      console.error(`❌ Failed to update ${coll}.id:`, err.response?.data ?? err.message)
    }
  }
}

run()
