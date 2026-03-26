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

  console.log('🔧 Fixing projects.id field to auto-generate UUID...')
  try {
    await client.patch('/fields/projects/id', {
      schema: {
        is_primary_key: true,
        has_auto_increment: false,
        default_value: 'NULL'
      },
      meta: {
          special: ['uuid']
      }
    })
    console.log('✅ projects.id updated')
  } catch (err) {
    console.error('❌ Failed to update projects.id:', err.response?.data ?? err.message)
  }
  
  // Also fix other collections from init-directus.mjs
  const collections = ['datasets', 'dataset_versions', 'recipes']
  for (const coll of collections) {
      try {
        await client.patch(`/fields/${coll}/id`, {
          schema: { is_primary_key: true, has_auto_increment: false },
          meta: { special: ['uuid'] }
        })
        console.log(`✅ ${coll}.id updated`)
      } catch (err) {
        console.error(`❌ Failed to update ${coll}.id:`, err.response?.data ?? err.message)
      }
  }
}

run()
