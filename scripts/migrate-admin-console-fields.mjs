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

function toSlug(source, fallback = 'project') {
  const normalized = String(source || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
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

async function ensureAdminFields(client) {
  const projectFields = [
    {
      field: 'slug',
      type: 'string',
      meta: {
        interface: 'input',
        width: 'half',
        note: '项目路由标识（建议唯一，如 "sales-ops"）',
      },
    },
  ]

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

  for (const field of projectFields) {
    await upsertField(client, 'projects', field)
  }

  for (const field of userFields) {
    await upsertField(client, 'directus_users', field)
  }
}

async function backfillProjectSlugs(client) {
  console.log('🔄 backfill projects.slug ...')
  const listRes = await client.get('/items/projects', {
    params: {
      fields: 'id,name,slug',
      limit: -1,
    },
  })

  const rows = listRes.data?.data ?? []
  const used = new Set(
    rows
      .map((row) => String(row?.slug || '').trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase())
  )

  let updated = 0
  for (const row of rows) {
    const current = String(row?.slug || '').trim()
    if (current) continue

    const base = toSlug(row?.name, `project-${String(row?.id || '').slice(0, 8) || 'item'}`)
    let next = base
    let index = 2
    while (used.has(next.toLowerCase())) {
      next = `${base}-${index}`
      index += 1
    }

    used.add(next.toLowerCase())
    await client.patch(`/items/projects/${row.id}`, { slug: next })
    updated += 1
  }

  console.log(`✅ projects.slug backfill completed, updated ${updated} rows`)
}

async function backfillUserAdminFields(client) {
  console.log('🔄 backfill directus_users.mfa_enabled / last_login_at ...')
  const listRes = await client.get('/users', {
    params: {
      fields: 'id,last_access,tfa_secret,mfa_enabled,last_login_at',
      limit: -1,
    },
  })

  const rows = listRes.data?.data ?? []
  let updated = 0

  for (const row of rows) {
    const patch = {}
    const currentMfa = row?.mfa_enabled
    const currentLastLogin = row?.last_login_at
    const lastAccess = row?.last_access
    const hasTfaSecret = Boolean(row?.tfa_secret)

    if (currentMfa === null || currentMfa === undefined) {
      patch.mfa_enabled = hasTfaSecret
    }

    if (!currentLastLogin && lastAccess) {
      patch.last_login_at = lastAccess
    }

    if (Object.keys(patch).length === 0) continue
    await client.patch(`/users/${row.id}`, patch)
    updated += 1
  }

  console.log(`✅ directus_users admin fields backfill completed, updated ${updated} rows`)
}

async function run() {
  console.log(`🔗 Directus: ${DIRECTUS_URL}`)
  const token = await login()
  const client = createClient(token)

  await ensureAdminFields(client)
  await backfillProjectSlugs(client)
  await backfillUserAdminFields(client)

  console.log('🎉 admin console fields migration done')
}

run().catch((err) => {
  const status = err?.response?.status
  const statusText = err?.response?.statusText
  const payload = err?.response?.data
  const detail = payload || err?.message || err?.code || String(err)
  console.error('❌ migration failed:', detail)
  if (status) {
    console.error(`❌ http status: ${status}${statusText ? ` ${statusText}` : ''}`)
  }
  process.exit(1)
})
