/**
 * init-projects.mjs
 *
 * Directus schema migration — Project Hub (workspaces page) collections.
 *
 * This script is idempotent: each step is wrapped in a try/catch so it
 * can be run multiple times without causing errors when fields / relations
 * already exist.
 *
 * Run:
 *   cd scripts && node init-projects.mjs
 *
 * Prerequisites:
 *   - Directus is running and reachable
 *   - .env at repo root contains ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_BASE_PATH
 *   - The base `projects` collection was created by init-directus.mjs
 */

import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DIRECTUS_URL = `http://localhost:8080${process.env.ADMIN_BASE_PATH ?? ''}`
const EMAIL        = process.env.ADMIN_EMAIL
const PASSWORD     = process.env.ADMIN_PASSWORD

/** ─── Auth ──────────────────────────────────────────────────────────────── */

async function authenticate() {
  const res = await axios.post(`${DIRECTUS_URL}/auth/login`, {
    email:    EMAIL,
    password: PASSWORD,
  })
  return res.data.data.access_token
}

/** ─── Helpers ───────────────────────────────────────────────────────────── */

function makeClient(token) {
  return axios.create({
    baseURL: DIRECTUS_URL,
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function upsertField(client, collection, field) {
  try {
    await client.post(`/fields/${collection}`, field)
    console.log(`  ✅ field ${collection}.${field.field}`)
  } catch (err) {
    const code = err.response?.data?.errors?.[0]?.extensions?.code
    if (code === 'RECORD_NOT_UNIQUE' || err.response?.status === 400) {
      console.log(`  ⏭  field ${collection}.${field.field} already exists, skipping`)
    } else {
      console.error(`  ❌ field ${collection}.${field.field}:`, err.response?.data ?? err.message)
    }
  }
}

async function upsertCollection(client, payload) {
  try {
    await client.post('/collections', payload)
    console.log(`✅ Created collection: ${payload.collection}`)
  } catch (err) {
    const code = err.response?.data?.errors?.[0]?.extensions?.code
    if (code === 'RECORD_NOT_UNIQUE' || err.response?.status === 400) {
      console.log(`⏭  Collection ${payload.collection} already exists, skipping`)
    } else {
      console.error(`❌ Failed to create ${payload.collection}:`, err.response?.data ?? err.message)
    }
  }
}

async function upsertRelation(client, payload) {
  try {
    await client.post('/relations', payload)
    console.log(`✅ Relation ${payload.collection}.${payload.field} → ${payload.related_collection}`)
  } catch (err) {
    const msg = err.response?.data?.errors?.[0]?.message ?? err.message
    if (msg?.toLowerCase().includes('already exists') || err.response?.status === 400) {
      console.log(`⏭  Relation ${payload.collection}.${payload.field} already exists, skipping`)
    } else {
      console.error(`❌ Relation ${payload.collection}.${payload.field}:`, msg)
    }
  }
}

/** ─── Main ──────────────────────────────────────────────────────────────── */

async function run() {
  console.log(`🔗 Connecting to Directus at ${DIRECTUS_URL}`)

  let token
  try {
    token = await authenticate()
    console.log('✅ Authenticated as Admin\n')
  } catch (err) {
    console.error('❌ Auth Failed:', err.response?.data ?? err.message)
    process.exit(1)
  }

  const client = makeClient(token)

  /** ── 1. Extend `projects` collection with Project Hub fields ───────── */

  console.log('\n📦 Extending `projects` collection fields...')

  const projectFields = [
    /** Route slug used by /project/:slug */
    {
      field: 'slug',
      type: 'string',
      meta: {
        interface: 'input',
        width: 'half',
        note: '项目路由标识（建议唯一，如 "sales-ops"）',
      },
    },
    /** Status: active | warning | archived */
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'active' },
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: '运行中',  value: 'active'   },
            { text: '资源告警', value: 'warning'  },
            { text: '已归档',  value: 'archived' },
          ],
        },
        display: 'labels',
        display_options: {
          choices: [
            { text: '运行中',  value: 'active',   foreground: '#059669', background: '#d1fae5' },
            { text: '资源告警', value: 'warning',  foreground: '#b45309', background: '#fef3c7' },
            { text: '已归档',  value: 'archived', foreground: '#6b7280', background: '#f3f4f6' },
          ],
        },
        width: 'half',
      },
    },
    /** Visibility: private | internal | public */
    {
      field: 'visibility',
      type: 'string',
      schema: { default_value: 'private' },
      meta: {
        interface: 'select-dropdown',
        options: {
          choices: [
            { text: '私有', value: 'private'  },
            { text: '内部', value: 'internal' },
            { text: '公开', value: 'public'   },
          ],
        },
        width: 'half',
      },
    },
    /** Tenant / org display name */
    {
      field: 'tenant',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '所属租户 / 事业部名称' },
    },
    /** Accent color for card header */
    {
      field: 'color',
      type: 'string',
      schema: { default_value: '#1677ff' },
      meta: { interface: 'select-color', width: 'half' },
    },
    /** Tags — stored as JSON array */
    {
      field: 'tags',
      type: 'json',
      meta: {
        interface: 'tags',
        width: 'full',
        note: '项目标签（JSON 数组）',
      },
    },
    /** Human-readable storage summary label, e.g. "1.2 TB" */
    {
      field: 'storage_label',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '存储容量标签，如 "1.2 TB"' },
    },
    /** Cube.js semantic health 0–100 */
    {
      field: 'cube_health',
      type: 'integer',
      schema: { default_value: 100 },
      meta: { interface: 'input', width: 'half', note: 'Cube.js 语义层健康度 (0–100)' },
    },
    /** Doris query latency label */
    {
      field: 'doris_latency',
      type: 'string',
      schema: { default_value: '—' },
      meta: { interface: 'input', width: 'half', note: 'Doris 查询延迟标签，如 "12ms"' },
    },
    /** Last activity ISO timestamp */
    {
      field: 'last_active',
      type: 'timestamp',
      meta: { interface: 'datetime', width: 'half', special: ['date-created'] },
    },
    /** Computed counters — updated by Worker jobs or triggers */
    {
      field: 'members_count',
      type: 'integer',
      schema: { default_value: 0 },
      meta: { interface: 'input', readonly: true, width: 'half', note: '成员数（由系统计算）' },
    },
    {
      field: 'datasets_count',
      type: 'integer',
      schema: { default_value: 0 },
      meta: { interface: 'input', readonly: true, width: 'half', note: '数据集数（由系统计算）' },
    },
    {
      field: 'workbooks_count',
      type: 'integer',
      schema: { default_value: 0 },
      meta: { interface: 'input', readonly: true, width: 'half', note: '工作台数（由系统计算）' },
    },
    {
      field: 'recipes_count',
      type: 'integer',
      schema: { default_value: 0 },
      meta: { interface: 'input', readonly: true, width: 'half', note: '配方数（由系统计算）' },
    },
  ]

  for (const field of projectFields) {
    await upsertField(client, 'projects', field)
  }

  /** ── 1.5. Extend `directus_users` with admin fields ─────────────── */

  console.log('\n👤 Extending `directus_users` collection fields...')

  const userFields = [
    {
      field: 'tenant',
      type: 'string',
      meta: { interface: 'input', width: 'half', note: '所属租户 / 事业部名称' },
    },
    {
      field: 'mfa_enabled',
      type: 'boolean',
      schema: { default_value: false },
      meta: { interface: 'boolean', width: 'half', note: 'MFA 是否已启用（Admin Console 展示字段）' },
    },
    {
      field: 'last_login_at',
      type: 'timestamp',
      meta: { interface: 'datetime', width: 'half', note: '最近登录时间（Admin Console 展示字段）' },
    },
  ]

  for (const field of userFields) {
    await upsertField(client, 'directus_users', field)
  }

  /** ── 1.6. Extend dataset import schema for multi-source ingest ───── */

  console.log('\n🧩 Extending `datasets` / `dataset_versions` for multi-source ingest...')

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

  for (const field of datasetFields) {
    await upsertField(client, 'datasets', field)
  }

  const datasetVersionFields = [
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

  for (const field of datasetVersionFields) {
    await upsertField(client, 'dataset_versions', field)
  }

  /** ── 2. Create `project_members` junction collection ──────────────── */

  console.log('\n📦 Creating `project_members` junction collection...')

  await upsertCollection(client, {
    collection: 'project_members',
    schema: {},
    meta: {
      icon: 'people',
      note: '项目成员关系（project ↔ directus_users），含角色字段',
      hidden: false,
      singleton: false,
    },
    fields: [
      {
        field: 'id',
        type: 'integer',
        schema: { is_primary_key: true, has_auto_increment: true },
        meta: { hidden: true },
      },
      {
        field: 'project_id',
        type: 'uuid',
        meta: { interface: 'input', hidden: false },
      },
      {
        field: 'directus_users_id',
        type: 'uuid',
        meta: { interface: 'input', hidden: false },
      },
      {
        field: 'role',
        type: 'string',
        schema: { default_value: 'Viewer' },
        meta: {
          interface: 'select-dropdown',
          options: {
            choices: [
              { text: '项目所有者',   value: 'Owner'   },
              { text: '数据管理员',   value: 'Data Admin' },
              { text: '数据分析师',   value: 'Analyst'  },
              { text: '业务决策者',   value: 'Viewer'   },
            ],
          },
        },
      },
    ],
  })

  /** ── 3. Create `project_starred` junction collection ─────────────── */

  console.log('\n📦 Creating `project_starred` junction collection...')

  await upsertCollection(client, {
    collection: 'project_starred',
    schema: {},
    meta: {
      icon: 'star',
      note: '用户收藏项目关系（project ↔ directus_users）',
      hidden: false,
      singleton: false,
    },
    fields: [
      {
        field: 'id',
        type: 'integer',
        schema: { is_primary_key: true, has_auto_increment: true },
        meta: { hidden: true },
      },
      {
        field: 'project_id',
        type: 'uuid',
        meta: { interface: 'input', hidden: true },
      },
      {
        field: 'directus_users_id',
        type: 'uuid',
        meta: { interface: 'input', hidden: true },
      },
    ],
  })

  /** ── 4. Create Relations ─────────────────────────────────────────── */

  console.log('\n🔗 Creating relations...')

  const relations = [
    /** project_members.project_id → projects */
    {
      collection: 'project_members',
      field: 'project_id',
      related_collection: 'projects',
      meta: {
        many_collection: 'project_members',
        many_field:      'project_id',
        one_collection:  'projects',
        one_field:       null,
        sort_field:      null,
        junction_field:  null,
      },
      schema: {
        on_delete: 'CASCADE',
      },
    },
    /** project_members.directus_users_id → directus_users */
    {
      collection: 'project_members',
      field: 'directus_users_id',
      related_collection: 'directus_users',
      meta: {
        many_collection: 'project_members',
        many_field:      'directus_users_id',
        one_collection:  'directus_users',
        one_field:       null,
        junction_field:  null,
      },
      schema: {
        on_delete: 'CASCADE',
      },
    },
    /** project_starred.project_id → projects */
    {
      collection: 'project_starred',
      field: 'project_id',
      related_collection: 'projects',
      meta: {
        many_collection: 'project_starred',
        many_field:      'project_id',
        one_collection:  'projects',
        one_field:       null,
        junction_field:  null,
      },
      schema: {
        on_delete: 'CASCADE',
      },
    },
    /** project_starred.directus_users_id → directus_users */
    {
      collection: 'project_starred',
      field: 'directus_users_id',
      related_collection: 'directus_users',
      meta: {
        many_collection: 'project_starred',
        many_field:      'directus_users_id',
        one_collection:  'directus_users',
        one_field:       null,
        junction_field:  null,
      },
      schema: {
        on_delete: 'CASCADE',
      },
    },
  ]

  for (const rel of relations) {
    await upsertRelation(client, rel)
  }

  /** ── 5. Set RBAC permissions for non-admin roles ─────────────────── */

  console.log('\n🔐 Granting `projects` / `project_members` read access to all authenticated users...')

  /**
   * Directus v11: create policy + permissions for the public/authenticated access policy.
   * Here we simply allow authenticated users to read all 3 collections.
   * Fine-grained row-level filtering (e.g., only projects where the user is a member)
   * can be added via the Directus admin UI under Settings → Roles → Permissions.
   */
  const collectionsToGrant = ['projects', 'project_members', 'project_starred']
  for (const coll of collectionsToGrant) {
    try {
      /** Check if an authenticated role exists and grant read */
      await client.post('/permissions', {
        collection: coll,
        action:     'read',
        fields:     ['*'],
        /** policy null = applies to all authenticated users in Directus v11 */
        policy:     null,
      })
      console.log(`  ✅ Read permission granted for ${coll}`)
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message ?? err.message
      if (msg?.toLowerCase().includes('already exists') || err.response?.status === 400) {
        console.log(`  ⏭  Read permission for ${coll} already exists`)
      } else {
        console.error(`  ❌ Permission ${coll}:`, msg)
      }
    }
  }

  /** Allow authenticated users to manage their own starred records */
  for (const action of ['create', 'delete']) {
    try {
      await client.post('/permissions', {
        collection: 'project_starred',
        action,
        fields:     ['*'],
        policy:     null,
      })
      console.log(`  ✅ ${action} permission granted for project_starred`)
    } catch (err) {
      console.log(`  ⏭  ${action} permission for project_starred: already exists or skipped`)
    }
  }

  console.log('\n🎉 Project Hub schema migration complete!\n')
  console.log('Next steps:')
  console.log('  1. Open Directus Admin UI → Settings → Collections → projects')
  console.log('     Add row-level filter on project_members so users only see their projects.')
  console.log('  2. Use Directus Admin UI to seed test projects, or run:')
  console.log('     node seed-projects.mjs')
}

run().catch((err) => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
