/**
 * init-plugins.mjs
 *
 * Creates plugin metadata collections in Directus:
 *   - plugins_registry
 *   - plugin_installations
 *   - plugin_audit_logs
 *
 * Run:
 *   cd scripts && node init-plugins.mjs
 */

import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH ?? ''}`
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

async function authenticate() {
  const res = await axios.post(`${DIRECTUS_URL}/auth/login`, {
    email: EMAIL,
    password: PASSWORD,
  })
  return res.data.data.access_token
}

function makeClient(token) {
  return axios.create({
    baseURL: DIRECTUS_URL,
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function upsertCollection(client, payload) {
  try {
    await client.post('/collections', payload)
    console.log(`✅ collection ${payload.collection}`)
  } catch (error) {
    const code = error.response?.data?.errors?.[0]?.extensions?.code
    if (code === 'RECORD_NOT_UNIQUE' || error.response?.status === 400) {
      console.log(`⏭  collection ${payload.collection} already exists`)
      return
    }
    throw error
  }
}

async function upsertField(client, collection, field) {
  try {
    await client.post(`/fields/${collection}`, field)
    console.log(`  ✅ field ${collection}.${field.field}`)
  } catch (error) {
    const code = error.response?.data?.errors?.[0]?.extensions?.code
    if (code === 'RECORD_NOT_UNIQUE' || error.response?.status === 400) {
      console.log(`  ⏭  field ${collection}.${field.field} already exists`)
      return
    }
    throw error
  }
}

async function upsertRelation(client, payload) {
  try {
    await client.post('/relations', payload)
    console.log(`✅ relation ${payload.collection}.${payload.field} -> ${payload.related_collection}`)
  } catch (error) {
    const message = error.response?.data?.errors?.[0]?.message ?? error.message
    if (message.toLowerCase().includes('already exists') || error.response?.status === 400) {
      console.log(`⏭  relation ${payload.collection}.${payload.field} already exists`)
      return
    }
    throw error
  }
}

async function run() {
  console.log(`🔗 Connecting to Directus: ${DIRECTUS_URL}`)
  const token = await authenticate()
  const client = makeClient(token)

  await upsertCollection(client, {
    collection: 'plugins_registry',
    schema: {},
    meta: {
      icon: 'extension',
      note: 'Plugin manifest registry',
    },
  })

  await upsertCollection(client, {
    collection: 'plugin_installations',
    schema: {},
    meta: {
      icon: 'inventory_2',
      note: 'Plugin installations by scope',
    },
  })

  await upsertCollection(client, {
    collection: 'plugin_audit_logs',
    schema: {},
    meta: {
      icon: 'history',
      note: 'Plugin lifecycle audit logs',
    },
  })

  const registryFields = [
    { field: 'id', type: 'uuid', schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
    { field: 'plugin_id', type: 'string' },
    { field: 'version', type: 'string' },
    { field: 'type', type: 'string' },
    { field: 'api_version', type: 'string' },
    { field: 'publisher', type: 'string' },
    { field: 'level', type: 'string' },
    { field: 'runtime_json', type: 'json' },
    { field: 'entry_json', type: 'json' },
    { field: 'permissions_json', type: 'json' },
    { field: 'slots_json', type: 'json' },
    { field: 'events_json', type: 'json' },
    { field: 'hooks_json', type: 'json' },
    { field: 'config_schema', type: 'string' },
    { field: 'platform_version_range', type: 'string' },
    { field: 'checksum', type: 'string' },
    { field: 'artifact_checksum', type: 'string' },
    { field: 'artifact_path', type: 'string' },
    { field: 'manifest_json', type: 'json' },
    { field: 'status', type: 'string' },
    { field: 'validated_at', type: 'timestamp' },
    { field: 'last_error', type: 'text', meta: { interface: 'textarea' } },
  ]

  const installationFields = [
    { field: 'id', type: 'uuid', schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
    { field: 'plugin_registry_id', type: 'uuid' },
    { field: 'plugin_id', type: 'string' },
    { field: 'version', type: 'string' },
    { field: 'type', type: 'string' },
    { field: 'scope_type', type: 'string' },
    { field: 'scope_id', type: 'string' },
    { field: 'status', type: 'string' },
    { field: 'granted_permissions_json', type: 'json' },
    { field: 'config_json', type: 'json' },
    { field: 'enabled_at', type: 'timestamp' },
    { field: 'disabled_at', type: 'timestamp' },
    { field: 'uninstalled_at', type: 'timestamp' },
    { field: 'last_error', type: 'text', meta: { interface: 'textarea' } },
  ]

  const auditFields = [
    { field: 'id', type: 'uuid', schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true } },
    { field: 'installation_id', type: 'uuid' },
    { field: 'plugin_id', type: 'string' },
    { field: 'version', type: 'string' },
    { field: 'scope_type', type: 'string' },
    { field: 'scope_id', type: 'string' },
    { field: 'action', type: 'string' },
    { field: 'from_status', type: 'string' },
    { field: 'to_status', type: 'string' },
    { field: 'actor_id', type: 'string' },
    { field: 'actor_email', type: 'string' },
    { field: 'request_id', type: 'string' },
    { field: 'success', type: 'boolean' },
    { field: 'error_message', type: 'text', meta: { interface: 'textarea' } },
    { field: 'detail_json', type: 'json' },
  ]

  for (const field of registryFields) {
    await upsertField(client, 'plugins_registry', field)
  }

  for (const field of installationFields) {
    await upsertField(client, 'plugin_installations', field)
  }

  for (const field of auditFields) {
    await upsertField(client, 'plugin_audit_logs', field)
  }

  await upsertRelation(client, {
    collection: 'plugin_installations',
    field: 'plugin_registry_id',
    related_collection: 'plugins_registry',
    meta: {
      many_collection: 'plugin_installations',
      many_field: 'plugin_registry_id',
      one_collection: 'plugins_registry',
    },
  })

  await upsertRelation(client, {
    collection: 'plugin_audit_logs',
    field: 'installation_id',
    related_collection: 'plugin_installations',
    meta: {
      many_collection: 'plugin_audit_logs',
      many_field: 'installation_id',
      one_collection: 'plugin_installations',
    },
  })

  console.log('🎉 Plugin collections initialized')
}

run().catch((error) => {
  console.error('❌ init-plugins failed:', error.response?.data ?? error.message)
  process.exit(1)
})
