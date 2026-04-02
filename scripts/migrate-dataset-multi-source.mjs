import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve('../.env') })

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH || ''}`
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

async function login() {
  const res = await axios.post(`${DIRECTUS_URL}/auth/login`, {
    email: EMAIL,
    password: PASSWORD,
  })
  return res.data.data.access_token
}

function createClient(token) {
  return axios.create({
    baseURL: DIRECTUS_URL,
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function upsertField(client, collection, field) {
  try {
    await client.post(`/fields/${collection}`, field)
    console.log(`✅ field ${collection}.${field.field}`)
  } catch (err) {
    const code = err.response?.data?.errors?.[0]?.extensions?.code
    const msg = err.response?.data?.errors?.[0]?.message ?? err.message
    if (code === 'RECORD_NOT_UNIQUE' || err.response?.status === 400 || msg?.toLowerCase().includes('already exists')) {
      console.log(`⏭  field ${collection}.${field.field} already exists`)
      return
    }
    throw err
  }
}

async function migrateSchema(client) {
  const datasetFields = [
    {
      field: 'root_dataset_id',
      type: 'uuid',
      meta: { interface: 'select-dropdown-m2o', width: 'half', note: '主数据源 ID（子数据源指向主数据源）' },
    },
    {
      field: 'schema_fingerprint',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '结构指纹（映射后 storageName 集合哈希）' },
    },
    {
      field: 'schema_order',
      type: 'integer',
      schema: { default_value: 1 },
      meta: { interface: 'input', width: 'half', note: '结构分组序号（1,2,3...）' },
    },
    {
      field: 'merge_same_schema',
      type: 'boolean',
      schema: { default_value: true },
      meta: { interface: 'boolean', width: 'half', note: '同结构 source unit 是否合并导入' },
    },
  ]

  const versionFields = [
    {
      field: 'ingest_batch_id',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '批次导入 ID（同一次导入动作共享）' },
    },
    {
      field: 'sheet_name',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: 'Excel 选中的 Sheet 名称' },
    },
    {
      field: 'schema_fingerprint',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '结构指纹（映射后 storageName 集合哈希）' },
    },
    {
      field: 'source_file_name',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '来源文件名（溯源）' },
    },
    {
      field: 'source_sheet_name',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '来源 Sheet 名称（溯源）' },
    },
  ]

  for (const field of datasetFields) {
    await upsertField(client, 'datasets', field)
  }

  for (const field of versionFields) {
    await upsertField(client, 'dataset_versions', field)
  }
}

async function backfillMinimal(client) {
  console.log('🔄 minimal backfill: datasets.schema_order -> 1 / merge_same_schema -> true (when null)')
  const listRes = await client.get('/items/datasets', {
    params: {
      fields: 'id,schema_order,merge_same_schema',
      limit: -1,
    },
  })

  const rows = listRes.data?.data ?? []
  let updated = 0
  for (const row of rows) {
    const patch = {}
    if (row?.schema_order === null || row?.schema_order === undefined) {
      patch.schema_order = 1
    }
    if (row?.merge_same_schema === null || row?.merge_same_schema === undefined) {
      patch.merge_same_schema = true
    }
    if (Object.keys(patch).length === 0) continue
    await client.patch(`/items/datasets/${row.id}`, patch)
    updated += 1
  }
  console.log(`✅ backfill completed, updated ${updated} datasets`)
}

async function run() {
  console.log(`🔗 Directus: ${DIRECTUS_URL}`)
  const token = await login()
  const client = createClient(token)

  await migrateSchema(client)
  await backfillMinimal(client)

  console.log('🎉 dataset multi-source migration done')
}

run().catch((err) => {
  console.error('❌ migration failed:', err.response?.data ?? err.message)
  process.exit(1)
})
