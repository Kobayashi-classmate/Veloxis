import axios from 'axios'
import dotenv from 'dotenv'
import path from 'path'
import { execFileSync } from 'child_process'

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

function isAlreadyExists(err) {
  const code = err?.response?.data?.errors?.[0]?.extensions?.code
  const msg = String(err?.response?.data?.errors?.[0]?.message || err?.message || '').toLowerCase()
  return code === 'RECORD_NOT_UNIQUE' || msg.includes('already exists') || err?.response?.status === 400
}

async function upsertCollection(client, payload) {
  try {
    await client.post('/collections', payload)
    console.log(`✅ collection ${payload.collection}`)
  } catch (err) {
    if (isAlreadyExists(err)) {
      console.log(`⏭  collection ${payload.collection} already exists`)
      return
    }
    throw err
  }
}

async function upsertField(client, collection, field) {
  try {
    await client.post(`/fields/${collection}`, field)
    console.log(`✅ field ${collection}.${field.field}`)
  } catch (err) {
    if (isAlreadyExists(err)) {
      console.log(`⏭  field ${collection}.${field.field} already exists`)
      return
    }
    throw err
  }
}

async function ensureFieldType(client, collection, field, expectedType) {
  const currentRes = await client.get(`/fields/${collection}/${field}`)
  const currentType = currentRes?.data?.data?.type
  const currentSchemaType = currentRes?.data?.data?.schema?.data_type
  const expected = String(expectedType).toLowerCase()
  const typeMatch = !currentType || String(currentType).toLowerCase() === expected
  const schemaMatch = !currentSchemaType || String(currentSchemaType).toLowerCase() === expected
  if (typeMatch && schemaMatch) {
    return
  }
  try {
    await client.patch(`/fields/${collection}/${field}`, { type: expectedType, schema: { data_type: expectedType } })
    const verifyRes = await client.get(`/fields/${collection}/${field}`)
    const verifyType = String(verifyRes?.data?.data?.type || '').toLowerCase()
    const verifySchemaType = String(verifyRes?.data?.data?.schema?.data_type || '').toLowerCase()
    if (verifyType !== expected || verifySchemaType !== expected) {
      throw new Error(`field type verify mismatch: type=${verifyType}, schema=${verifySchemaType}, expected=${expected}`)
    }
    console.log(`✅ field type ${collection}.${field}: ${currentType || currentSchemaType} -> ${expectedType}`)
  } catch (err) {
    const rawError = err?.response?.data || err?.message || err
    const errText = String(rawError?.errors?.[0]?.message || rawError).toLowerCase()
    if (errText.includes('cannot cast type')) {
      await recreateFieldWithBlueprint(client, collection, field)
      return
    }
    console.error(`❌ field type convert failed ${collection}.${field}:`, rawError)
    throw err
  }
}

async function upsertRelation(client, payload) {
  try {
    await client.post('/relations', payload)
    console.log(`✅ relation ${payload.collection}.${payload.field} -> ${payload.related_collection}`)
  } catch (err) {
    if (isAlreadyExists(err)) {
      console.log(`⏭  relation ${payload.collection}.${payload.field} already exists`)
      return
    }
    throw err
  }
}

function toSlug(source, fallback = 'tenant') {
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

function toTenantCode(source, fallback = 'TENANT') {
  const token = toSlug(source, fallback.toLowerCase())
    .replace(/-/g, '_')
    .replace(/[^A-Z0-9_]/gi, '')
    .toUpperCase()
  return token || fallback
}

function asString(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('id' in value && value.id !== undefined && value.id !== null) return String(value.id).trim()
    if ('name' in value && value.name !== undefined && value.name !== null) return String(value.name).trim()
    if ('code' in value && value.code !== undefined && value.code !== null) return String(value.code).trim()
    return ''
  }
  return String(value).trim()
}

function asKey(value) {
  return asString(value).toLowerCase()
}

function isIntToken(value) {
  return /^\d+$/.test(asString(value))
}

function toIdOrNull(value) {
  const token = asString(value)
  return token || null
}

function extractTenantToken(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    return asString(value.id || value.name || value.code || value.slug)
  }
  return asString(value)
}

const DEFAULT_ORG_TYPES = [
  { code: 'company', name: '公司' },
  { code: 'office', name: '办事处' },
  { code: 'regional_division', name: '区域大区' },
  { code: 'business_unit', name: '事业部' },
  { code: 'functional_department', name: '职能部门' },
  { code: 'squad', name: '小组' },
  { code: 'team', name: '团队' },
  { code: 'project_group', name: '项目组' },
  { code: 'virtual_org', name: '虚拟组织' },
]

const FIELD_BLUEPRINTS = {
  'org_units.tenant_id': { field: 'tenant_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
  'org_units.organization_id': { field: 'organization_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
  'org_units.parent_id': { field: 'parent_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
  'org_units.manager_user_id': { field: 'manager_user_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', width: 'half' } },
  'org_memberships.tenant_id': { field: 'tenant_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
  'org_memberships.organization_id': { field: 'organization_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
  'org_memberships.org_unit_id': { field: 'org_unit_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
  'org_memberships.user_id': { field: 'user_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', width: 'half' } },
  'projects.owner_org_unit_id': {
    field: 'owner_org_unit_id',
    type: 'uuid',
    meta: { interface: 'input', width: 'half', note: '项目归属组织节点' },
  },
  'projects.tenant_id': {
    field: 'tenant_id',
    type: 'uuid',
    meta: { interface: 'input', width: 'half', note: '项目所属租户（结构化）' },
  },
  'projects.organization_id': {
    field: 'organization_id',
    type: 'uuid',
    meta: { interface: 'input', width: 'half', note: '项目所属组织范围（兼容字段）' },
  },
  'directus_users.organization': {
    field: 'organization',
    type: 'uuid',
    meta: { interface: 'select-dropdown-m2o', width: 'half', note: '用户所属组织范围（organizations 关系）' },
  },
}

async function recreateFieldWithBlueprint(client, collection, field) {
  const key = `${collection}.${field}`
  const blueprint = FIELD_BLUEPRINTS[key]
  if (!blueprint) {
    throw new Error(`Missing field blueprint for ${key}`)
  }

  try {
    await client.delete(`/fields/${collection}/${field}`)
    console.log(`⚠️  field dropped ${key} for type recreation`)
  } catch (err) {
    if (err?.response?.status !== 404) {
      throw err
    }
  }

  await client.post(`/fields/${collection}`, blueprint)
  console.log(`✅ field recreated ${key} as ${blueprint.type}`)
}

async function createUuidCollection(client, payload) {
  await client.post('/collections', {
    collection: payload.collection,
    schema: {},
    meta: payload.meta,
    fields: [
      {
        field: 'id',
        type: 'uuid',
        meta: { hidden: true, readonly: true },
        schema: { is_primary_key: true, has_auto_increment: false, default_value: 'gen_random_uuid()' },
      },
    ],
  })
  console.log(`✅ collection ${payload.collection} (uuid id)`)
}

async function ensureUuidCollection(client, payload) {
  let exists = true
  try {
    await client.get(`/collections/${payload.collection}`)
  } catch (err) {
    if (err?.response?.status === 404) {
      exists = false
    } else if (err?.response?.status === 403) {
      // Some Directus setups return 403 for missing collections on /collections/{name}.
      // Fallback to listing visible collections before deciding whether to create.
      const listRes = await client.get('/collections', { params: { fields: 'collection', limit: -1 } })
      const collectionRows = listRes?.data?.data || []
      const isVisible = collectionRows.some((item) => String(item?.collection || '') === payload.collection)
      if (!isVisible) {
        exists = false
      } else {
        throw err
      }
    } else {
      throw err
    }
  }

  if (!exists) {
    await createUuidCollection(client, payload)
    return
  }

  const idField = await client.get(`/fields/${payload.collection}/id`)
  const idType = String(idField?.data?.data?.type || '').toLowerCase()
  const idSchemaType = String(idField?.data?.data?.schema?.data_type || '').toLowerCase()
  if (idType === 'uuid' && idSchemaType === 'uuid') {
    return
  }

  const rows = await client.get(`/items/${payload.collection}`, { params: { fields: 'id', limit: 1 } })
  const hasData = Array.isArray(rows?.data?.data) && rows.data.data.length > 0
  if (hasData) {
    throw new Error(
      `collection ${payload.collection} currently uses non-uuid id and has data; please export data and clean table before uuid migration`
    )
  }

  await client.delete(`/collections/${payload.collection}`)
  console.log(`⚠️  collection dropped ${payload.collection} to switch primary key to uuid`)
  await createUuidCollection(client, payload)
}

async function ensureCollections(client) {
  const collectionConfigs = [
    {
      collection: 'organizations',
      meta: {
        icon: 'corporate_fare',
        note: '组织作用域（与 tenants 兼容映射）',
        hidden: false,
        singleton: false,
      },
    },
    {
      collection: 'org_types',
      meta: {
        icon: 'schema',
        note: '组织类型定义',
        hidden: false,
        singleton: false,
      },
    },
    {
      collection: 'org_memberships',
      meta: {
        icon: 'group',
        note: '成员与组织节点关系',
        hidden: false,
        singleton: false,
      },
    },
    {
      collection: 'org_units',
      meta: {
        icon: 'account_tree',
        note: '租户内组织节点',
        hidden: false,
        singleton: false,
      },
    },
    {
      collection: 'tenants',
      meta: {
        icon: 'domain',
        note: '租户边界模型',
        hidden: false,
        singleton: false,
      },
    },
  ]

  for (const collection of collectionConfigs) {
    await ensureUuidCollection(client, collection)
  }
}

async function ensureFields(client) {
  const organizationFields = [
    { field: 'name', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'code', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'slug', type: 'string', meta: { interface: 'input', width: 'half' } },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'active' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Active', value: 'active' },
            { text: 'Inactive', value: 'inactive' },
          ],
        },
      },
    },
    { field: 'settings', type: 'json', meta: { interface: 'list', width: 'full' } },
  ]

  const tenantFields = [
    { field: 'name', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'code', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'slug', type: 'string', meta: { interface: 'input', width: 'half' } },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'active' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Active', value: 'active' },
            { text: 'Inactive', value: 'inactive' },
          ],
        },
      },
    },
    {
      field: 'structure_mode',
      type: 'string',
      schema: { default_value: 'standard_tree' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Flat', value: 'flat' },
            { text: 'Standard Tree', value: 'standard_tree' },
            { text: 'Custom Tree', value: 'custom_tree' },
          ],
        },
      },
    },
    { field: 'max_depth', type: 'integer', schema: { default_value: 4 }, meta: { interface: 'input', width: 'half' } },
    { field: 'settings', type: 'json', meta: { interface: 'list', width: 'full' } },
  ]

  const orgUnitFields = [
    { field: 'tenant_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
    { field: 'organization_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
    { field: 'parent_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
    { field: 'name', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'code', type: 'string', meta: { interface: 'input', width: 'half' } },
    {
      field: 'type',
      type: 'string',
      schema: { default_value: 'department' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Tenant Root', value: 'tenant_root' },
            { text: 'Division', value: 'division' },
            { text: 'Department', value: 'department' },
            { text: 'Team', value: 'team' },
            { text: 'Virtual', value: 'virtual' },
          ],
        },
      },
    },
    { field: 'path', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'depth', type: 'integer', schema: { default_value: 0 }, meta: { interface: 'input', width: 'half' } },
    { field: 'manager_user_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', width: 'half' } },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'active' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Active', value: 'active' },
            { text: 'Inactive', value: 'inactive' },
          ],
        },
      },
    },
    { field: 'settings', type: 'json', meta: { interface: 'list', width: 'full' } },
  ]

  const membershipFields = [
    { field: 'tenant_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
    { field: 'organization_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
    { field: 'org_unit_id', type: 'uuid', meta: { interface: 'input', width: 'half' } },
    { field: 'user_id', type: 'uuid', meta: { interface: 'select-dropdown-m2o', width: 'half' } },
    {
      field: 'membership_type',
      type: 'string',
      schema: { default_value: 'secondary' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Primary', value: 'primary' },
            { text: 'Secondary', value: 'secondary' },
          ],
        },
      },
    },
    { field: 'is_primary', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean', width: 'half' } },
    { field: 'member_type', type: 'string', schema: { default_value: 'internal' }, meta: { interface: 'input', width: 'half' } },
    { field: 'is_manager', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean', width: 'half' } },
    { field: 'management_roles', type: 'json', meta: { interface: 'list', width: 'full' } },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'active' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Active', value: 'active' },
            { text: 'Inactive', value: 'inactive' },
          ],
        },
      },
    },
  ]

  const orgTypeFields = [
    { field: 'name', type: 'string', meta: { interface: 'input', width: 'half' } },
    { field: 'code', type: 'string', meta: { interface: 'input', width: 'half' } },
    {
      field: 'status',
      type: 'string',
      schema: { default_value: 'active' },
      meta: {
        interface: 'select-dropdown',
        width: 'half',
        options: {
          choices: [
            { text: 'Active', value: 'active' },
            { text: 'Inactive', value: 'inactive' },
          ],
        },
      },
    },
    { field: 'sort_order', type: 'integer', schema: { default_value: 1 }, meta: { interface: 'input', width: 'half' } },
  ]

  for (const field of organizationFields) {
    await upsertField(client, 'organizations', field)
  }
  for (const field of tenantFields) {
    await upsertField(client, 'tenants', field)
  }
  for (const field of orgUnitFields) {
    await upsertField(client, 'org_units', field)
  }
  for (const field of membershipFields) {
    await upsertField(client, 'org_memberships', field)
  }
  for (const field of orgTypeFields) {
    await upsertField(client, 'org_types', field)
  }
}

async function ensureAuditFields(client, collections) {
  const auditFields = [
    {
      field: 'date_created',
      type: 'timestamp',
      meta: { interface: 'datetime', hidden: true, readonly: true, special: ['date-created'] },
    },
    {
      field: 'date_updated',
      type: 'timestamp',
      meta: { interface: 'datetime', hidden: true, readonly: true, special: ['date-updated'] },
    },
    {
      field: 'user_created',
      type: 'uuid',
      meta: { interface: 'select-dropdown-m2o', hidden: true, readonly: true, special: ['user-created'] },
    },
    {
      field: 'user_updated',
      type: 'uuid',
      meta: { interface: 'select-dropdown-m2o', hidden: true, readonly: true, special: ['user-updated'] },
    },
  ]

  for (const collection of collections) {
    for (const field of auditFields) {
      await upsertField(client, collection, field)
    }
  }
}

async function ensureRelations(client) {
  const relations = [
    {
      collection: 'org_units',
      field: 'tenant_id',
      related_collection: 'tenants',
      meta: { many_collection: 'org_units', many_field: 'tenant_id', one_collection: 'tenants' },
      schema: { on_delete: 'CASCADE' },
    },
    {
      collection: 'org_units',
      field: 'organization_id',
      related_collection: 'tenants',
      meta: { many_collection: 'org_units', many_field: 'organization_id', one_collection: 'tenants' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_units',
      field: 'parent_id',
      related_collection: 'org_units',
      meta: { many_collection: 'org_units', many_field: 'parent_id', one_collection: 'org_units' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_units',
      field: 'manager_user_id',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_units', many_field: 'manager_user_id', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_memberships',
      field: 'tenant_id',
      related_collection: 'tenants',
      meta: { many_collection: 'org_memberships', many_field: 'tenant_id', one_collection: 'tenants' },
      schema: { on_delete: 'CASCADE' },
    },
    {
      collection: 'org_memberships',
      field: 'organization_id',
      related_collection: 'tenants',
      meta: { many_collection: 'org_memberships', many_field: 'organization_id', one_collection: 'tenants' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_memberships',
      field: 'org_unit_id',
      related_collection: 'org_units',
      meta: { many_collection: 'org_memberships', many_field: 'org_unit_id', one_collection: 'org_units' },
      schema: { on_delete: 'CASCADE' },
    },
    {
      collection: 'org_memberships',
      field: 'user_id',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_memberships', many_field: 'user_id', one_collection: 'directus_users' },
      schema: { on_delete: 'CASCADE' },
    },
    {
      collection: 'projects',
      field: 'owner_org_unit_id',
      related_collection: 'org_units',
      meta: { many_collection: 'projects', many_field: 'owner_org_unit_id', one_collection: 'org_units' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'projects',
      field: 'tenant_id',
      related_collection: 'tenants',
      meta: { many_collection: 'projects', many_field: 'tenant_id', one_collection: 'tenants' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'projects',
      field: 'organization_id',
      related_collection: 'tenants',
      meta: { many_collection: 'projects', many_field: 'organization_id', one_collection: 'tenants' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'directus_users',
      field: 'organization',
      related_collection: 'organizations',
      meta: { many_collection: 'directus_users', many_field: 'organization', one_collection: 'organizations' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'tenants',
      field: 'user_created',
      related_collection: 'directus_users',
      meta: { many_collection: 'tenants', many_field: 'user_created', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'tenants',
      field: 'user_updated',
      related_collection: 'directus_users',
      meta: { many_collection: 'tenants', many_field: 'user_updated', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_units',
      field: 'user_created',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_units', many_field: 'user_created', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_units',
      field: 'user_updated',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_units', many_field: 'user_updated', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_memberships',
      field: 'user_created',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_memberships', many_field: 'user_created', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_memberships',
      field: 'user_updated',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_memberships', many_field: 'user_updated', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'projects',
      field: 'user_created',
      related_collection: 'directus_users',
      meta: { many_collection: 'projects', many_field: 'user_created', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'projects',
      field: 'user_updated',
      related_collection: 'directus_users',
      meta: { many_collection: 'projects', many_field: 'user_updated', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'organizations',
      field: 'user_created',
      related_collection: 'directus_users',
      meta: { many_collection: 'organizations', many_field: 'user_created', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'organizations',
      field: 'user_updated',
      related_collection: 'directus_users',
      meta: { many_collection: 'organizations', many_field: 'user_updated', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_types',
      field: 'user_created',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_types', many_field: 'user_created', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
    {
      collection: 'org_types',
      field: 'user_updated',
      related_collection: 'directus_users',
      meta: { many_collection: 'org_types', many_field: 'user_updated', one_collection: 'directus_users' },
      schema: { on_delete: 'SET NULL' },
    },
  ]

  for (const relation of relations) {
    await upsertRelation(client, relation)
  }
}

async function ensureProjectAndUserFields(client) {
  await upsertField(client, 'projects', {
    field: 'owner_org_unit_id',
    type: 'uuid',
    meta: { interface: 'input', width: 'half', note: '项目归属组织节点' },
  })

  await upsertField(client, 'projects', {
    field: 'tenant_id',
    type: 'uuid',
    meta: { interface: 'input', width: 'half', note: '项目所属租户（结构化）' },
  })

  await upsertField(client, 'projects', {
    field: 'organization_id',
    type: 'uuid',
    meta: { interface: 'input', width: 'half', note: '项目所属组织范围（兼容字段）' },
  })

  await upsertField(client, 'directus_users', {
    field: 'tenant',
    type: 'string',
    meta: { interface: 'input', width: 'half', note: '历史租户作用域（兼容字段）' },
  })

  await upsertField(client, 'directus_users', {
    field: 'organization',
    type: 'uuid',
    meta: { interface: 'select-dropdown-m2o', width: 'half', note: '组织作用域（结构化字段）' },
  })
}

async function ensureRelationFieldTypes(client) {
  const expected = [
    ['org_units', 'tenant_id', 'uuid'],
    ['org_units', 'organization_id', 'uuid'],
    ['org_units', 'parent_id', 'uuid'],
    ['org_units', 'manager_user_id', 'uuid'],
    ['org_memberships', 'tenant_id', 'uuid'],
    ['org_memberships', 'organization_id', 'uuid'],
    ['org_memberships', 'org_unit_id', 'uuid'],
    ['org_memberships', 'user_id', 'uuid'],
    ['projects', 'owner_org_unit_id', 'uuid'],
    ['projects', 'tenant_id', 'uuid'],
    ['projects', 'organization_id', 'uuid'],
    ['directus_users', 'organization', 'uuid'],
  ]
  for (const [collection, field, type] of expected) {
    await ensureFieldType(client, collection, field, type)
  }
}

async function normalizeUserScopeField(client) {
  const [usersRes, organizationsRes, tenantsRes] = await Promise.all([
    client.get('/users', { params: { fields: 'id,tenant,organization', limit: -1 } }),
    client.get('/items/organizations', { params: { fields: 'id,name,slug,code', limit: -1 } }),
    client.get('/items/tenants', { params: { fields: 'id,name,slug,code', limit: -1 } }),
  ])

  const users = usersRes.data?.data || []
  const organizations = organizationsRes.data?.data || []
  const tenants = tenantsRes.data?.data || []

  const organizationByToken = new Map()
  organizations.forEach((item) => {
    const orgId = toIdOrNull(item?.id)
    if (!orgId) return
    ;[item?.id, item?.name, item?.slug, item?.code].forEach((token) => {
      const key = asKey(token)
      if (key && !organizationByToken.has(key)) {
        organizationByToken.set(key, orgId)
      }
    })
  })

  const tenantToOrganization = new Map()
  tenants.forEach((item) => {
    const tenantId = toIdOrNull(item?.id)
    if (!tenantId) return

    const directMatch = organizationByToken.get(asKey(tenantId))
    if (directMatch) {
      tenantToOrganization.set(tenantId, directMatch)
      return
    }

    const fuzzyMatch = [item?.name, item?.slug, item?.code]
      .map((token) => organizationByToken.get(asKey(token)))
      .find(Boolean)

    if (fuzzyMatch) {
      tenantToOrganization.set(tenantId, fuzzyMatch)
    }
  })

  let updated = 0
  for (const row of users) {
    const userId = toIdOrNull(row?.id)
    if (!userId) continue

    const currentOrganization = toIdOrNull(row?.organization) || ''
    const tenantToken = extractTenantToken(row?.tenant)
    const resolvedOrganization =
      organizationByToken.get(asKey(currentOrganization)) ||
      tenantToOrganization.get(toIdOrNull(tenantToken)) ||
      organizationByToken.get(asKey(tenantToken)) ||
      ''

    if (!resolvedOrganization || resolvedOrganization === currentOrganization) continue

    await client.patch(`/users/${userId}`, { organization: resolvedOrganization })
    updated += 1
  }

  console.log(`✅ directus_users.organization backfill completed, updated ${updated} rows`)
}

async function loadTenantMaps(client) {
  let tenantsRes
  try {
    tenantsRes = await client.get('/items/tenants', { params: { fields: 'id,name,slug,code', limit: -1 } })
  } catch (err) {
    tenantsRes = await client.get('/items/tenants', { params: { fields: 'id,name,slug', limit: -1 } })
  }
  const rows = tenantsRes.data?.data || []
  const byKey = new Map()
  rows.forEach((row) => {
    const id = toIdOrNull(row?.id)
    if (!id) return
    ;[row?.id, row?.name, row?.slug, row?.code].forEach((token) => {
      const key = asKey(token)
      if (key) byKey.set(key, id)
    })
  })
  return { rows, byKey }
}

async function ensureTenantByToken(client, token, tenantMaps) {
  const raw = asString(token)
  if (!raw) return null
  const key = asKey(raw)
  if (!key) return null
  if (tenantMaps.byKey.has(key)) {
    return tenantMaps.byKey.get(key)
  }

  if (isIntToken(raw)) {
    return null
  }

  const name = raw
  try {
    const response = await client.post('/items/tenants', {
      name,
      code: toTenantCode(name),
      slug: toSlug(name),
      status: 'active',
      structure_mode: 'standard_tree',
      max_depth: 4,
      settings: {
        inheritRoleDownwardByDefault: false,
        inheritPermissionUpward: false,
        requirePrimaryOrgUnit: true,
      },
    })
    const id = toIdOrNull(response?.data?.data?.id)
    if (id) {
      tenantMaps.byKey.set(asKey(id), id)
      tenantMaps.byKey.set(asKey(name), id)
      tenantMaps.byKey.set(asKey(toSlug(name)), id)
      console.log(`✅ tenant created from legacy token: ${name}`)
      return id
    }
  } catch (err) {
    if (!isAlreadyExists(err)) throw err
    const refreshed = await loadTenantMaps(client)
    tenantMaps.rows = refreshed.rows
    tenantMaps.byKey = refreshed.byKey
    return tenantMaps.byKey.get(key) || null
  }

  return null
}

async function backfillTenants(client) {
  const [projectsRes, usersRes, orgRes, membershipRes] = await Promise.all([
    client.get('/items/projects', { params: { fields: 'id,tenant,tenant_id', limit: -1 } }),
    client.get('/users', { params: { fields: 'id,tenant', limit: -1 } }),
    client.get('/items/org_units', { params: { fields: 'id,tenant_id', limit: -1 } }),
    client.get('/items/org_memberships', { params: { fields: 'id,tenant_id', limit: -1 } }),
  ])

  const tenantNameSet = new Set()
  ;(projectsRes.data?.data || []).forEach((item) => {
    const token = extractTenantToken(item?.tenant)
    if (token && !isIntToken(token)) tenantNameSet.add(token)
  })
  ;(usersRes.data?.data || []).forEach((item) => {
    const token = extractTenantToken(item?.tenant)
    if (token && !isIntToken(token)) tenantNameSet.add(token)
  })
  ;(orgRes.data?.data || []).forEach((item) => {
    const token = extractTenantToken(item?.tenant_id)
    if (token && !isIntToken(token)) tenantNameSet.add(token)
  })
  ;(membershipRes.data?.data || []).forEach((item) => {
    const token = extractTenantToken(item?.tenant_id)
    if (token && !isIntToken(token)) tenantNameSet.add(token)
  })

  const existingMap = (await loadTenantMaps(client)).byKey
  for (const tenantName of tenantNameSet) {
    if (existingMap.has(asKey(tenantName))) continue
    try {
      await client.post('/items/tenants', {
        name: tenantName,
        code: toTenantCode(tenantName),
        slug: toSlug(tenantName),
        status: 'active',
        structure_mode: 'standard_tree',
        max_depth: 4,
        settings: {
          inheritRoleDownwardByDefault: false,
          inheritPermissionUpward: false,
          requirePrimaryOrgUnit: true,
        },
      })
      console.log(`✅ tenant created: ${tenantName}`)
    } catch (err) {
      if (!isAlreadyExists(err)) {
        throw err
      }
    }
  }
}

async function backfillTenantCodes(client) {
  let tenantsRes
  try {
    tenantsRes = await client.get('/items/tenants', { params: { fields: 'id,name,slug,code', limit: -1 } })
  } catch (err) {
    return
  }

  const rows = tenantsRes.data?.data || []
  for (const row of rows) {
    const tenantId = asString(row?.id)
    if (!tenantId) continue
    const currentCode = asString(row?.code)
    if (currentCode) continue
    const code = toTenantCode(row?.name || row?.slug || tenantId)
    await client.patch(`/items/tenants/${tenantId}`, { code })
  }
  console.log('✅ tenants.code backfill completed')
}

async function backfillOrganizationsFromTenants(client) {
  const [tenantRes, organizationRes] = await Promise.all([
    client.get('/items/tenants', { params: { fields: 'id,name,code,slug,status,settings', limit: -1 } }),
    client.get('/items/organizations', { params: { fields: 'id,name,code,slug,status,settings', limit: -1 } }),
  ])

  const tenantRows = tenantRes.data?.data || []
  const organizationById = new Map(
    (organizationRes.data?.data || [])
      .map((item) => [toIdOrNull(item?.id), item])
      .filter(([id]) => Boolean(id))
  )

  for (const tenant of tenantRows) {
    const id = toIdOrNull(tenant?.id)
    if (!id) continue

    const payload = {
      id,
      name: asString(tenant?.name) || 'Organization',
      code: asString(tenant?.code) || toTenantCode(tenant?.name || id),
      slug: asString(tenant?.slug) || toSlug(tenant?.name || id, `org-${id.slice(0, 8)}`),
      status: asString(tenant?.status) || 'active',
      settings: tenant?.settings || {},
    }

    const current = organizationById.get(id)
    if (!current) {
      await client.post('/items/organizations', payload)
      continue
    }

    const patch = {}
    if (asString(current?.name) !== payload.name) patch.name = payload.name
    if (asString(current?.code) !== payload.code) patch.code = payload.code
    if (asString(current?.slug) !== payload.slug) patch.slug = payload.slug
    if (asString(current?.status || 'active') !== payload.status) patch.status = payload.status
    if (Object.keys(patch).length) {
      await client.patch(`/items/organizations/${id}`, patch)
    }
  }

  console.log('✅ organizations backfill completed from tenants')
}

function buildOrgIndex(orgRows) {
  const byId = new Map()
  const byToken = new Map()
  orgRows.forEach((row) => {
    const id = toIdOrNull(row?.id)
    if (!id) return
    byId.set(id, row)
    ;[row?.id, row?.name, row?.code, row?.path].forEach((token) => {
      const key = asKey(token)
      if (key && !byToken.has(key)) byToken.set(key, id)
    })
  })
  return { byId, byToken }
}

function resolveTenantIdFromToken(token, tenantMaps) {
  const raw = asString(token)
  if (!raw) return null
  const key = asKey(raw)
  if (!key) return null
  return tenantMaps.byKey.get(key) || null
}

async function collectLegacyReferenceSnapshot(client) {
  const [orgRes, membershipRes, projectsRes] = await Promise.all([
    client.get('/items/org_units', { params: { fields: 'id,tenant_id,parent_id,name,code,path', limit: -1 } }),
    client.get('/items/org_memberships', { params: { fields: 'id,tenant_id,org_unit_id,user_id', limit: -1 } }),
    client.get('/items/projects', { params: { fields: 'id,tenant,tenant_id,owner_org_unit_id', limit: -1 } }),
  ])
  return {
    orgRows: orgRes.data?.data || [],
    membershipRows: membershipRes.data?.data || [],
    projectRows: projectsRes.data?.data || [],
  }
}

async function normalizeReferences(client, snapshot) {
  const [orgRes, membershipRes, projectsRes, usersRes] = await Promise.all([
    client.get('/items/org_units', {
      params: { fields: 'id,tenant_id,organization_id,parent_id,name,code,path', limit: -1 },
    }),
    client.get('/items/org_memberships', {
      params: { fields: 'id,tenant_id,organization_id,org_unit_id,user_id', limit: -1 },
    }),
    client.get('/items/projects', {
      params: { fields: 'id,tenant,tenant_id,organization_id,owner_org_unit_id', limit: -1 },
    }),
    client.get('/users', { params: { fields: 'id,tenant', limit: -1 } }),
  ])

  const sourceOrgRows = snapshot?.orgRows?.length ? snapshot.orgRows : orgRes.data?.data || []
  const sourceMembershipRows = snapshot?.membershipRows?.length ? snapshot.membershipRows : membershipRes.data?.data || []
  const sourceProjectRows = snapshot?.projectRows?.length ? snapshot.projectRows : projectsRes.data?.data || []
  const currentOrgRows = orgRes.data?.data || []
  const currentMembershipRows = membershipRes.data?.data || []
  const currentProjectRows = projectsRes.data?.data || []
  const currentOrgById = new Map(currentOrgRows.map((item) => [asString(item?.id), item]))
  const currentMembershipById = new Map(currentMembershipRows.map((item) => [asString(item?.id), item]))
  const currentProjectById = new Map(currentProjectRows.map((item) => [asString(item?.id), item]))

  const tenantMaps = await loadTenantMaps(client)
  const orgIndex = buildOrgIndex(sourceOrgRows)

  const normalizedOrgRows = sourceOrgRows.map((row) => {
    const id = toIdOrNull(row?.id)
    const legacyTenantToken = extractTenantToken(row?.tenant_id)
    const legacyParentToken = asString(row?.parent_id)
    const parentId =
      toIdOrNull(row?.parent_id) ||
      (legacyParentToken ? orgIndex.byToken.get(asKey(legacyParentToken)) || null : null)
    const tenantId = resolveTenantIdFromToken(legacyTenantToken, tenantMaps)
    return {
      id,
      raw: row,
      tenantId,
      parentId,
      legacyTenantToken,
    }
  })

  for (const row of normalizedOrgRows) {
    if (!row.id) continue
    if (!row.tenantId && row.legacyTenantToken && !isIntToken(row.legacyTenantToken)) {
      row.tenantId = await ensureTenantByToken(client, row.legacyTenantToken, tenantMaps)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    normalizedOrgRows.forEach((row) => {
      if (row.tenantId || !row.parentId) return
      const parent = normalizedOrgRows.find((item) => item.id === row.parentId)
      if (parent?.tenantId) {
        row.tenantId = parent.tenantId
        changed = true
      }
    })
  }

  for (const row of normalizedOrgRows) {
    if (!row.id) continue
    const current = currentOrgById.get(asString(row.id))
    const patch = {}
    const currentTenant = toIdOrNull(current?.tenant_id)
    const currentOrganization = toIdOrNull(current?.organization_id)
    const currentParent = toIdOrNull(current?.parent_id)
    if ((row.tenantId || null) !== (currentTenant || null)) {
      patch.tenant_id = row.tenantId
    }
    if ((row.tenantId || null) !== (currentOrganization || null)) {
      patch.organization_id = row.tenantId
    }
    if ((row.parentId || null) !== (currentParent || null)) {
      patch.parent_id = row.parentId
    }
    if (Object.keys(patch).length) {
      await client.patch(`/items/org_units/${row.id}`, patch)
    }
  }

  const refreshedOrgRes = await client.get('/items/org_units', {
    params: { fields: 'id,tenant_id,organization_id,name,code,path', limit: -1 },
  })
  const refreshedOrgRows = refreshedOrgRes.data?.data || []
  const refreshedOrgIndex = buildOrgIndex(refreshedOrgRows)
  const tenantByOrgId = new Map(
    refreshedOrgRows
      .map((item) => [toIdOrNull(item?.id), toIdOrNull(item?.tenant_id)])
      .filter(([id]) => Boolean(id))
  )
  const userTenantMap = new Map()
  ;(usersRes.data?.data || []).forEach((item) => {
    const userId = asString(item?.id)
    if (!userId) return
    const tenantToken = extractTenantToken(item?.tenant)
    const tenantId = resolveTenantIdFromToken(tenantToken, tenantMaps)
    if (tenantId) userTenantMap.set(userId, tenantId)
  })

  for (const row of sourceMembershipRows) {
    const id = asString(row?.id)
    if (!id) continue
    const current = currentMembershipById.get(id)
    const orgToken = asString(row?.org_unit_id)
    const orgId =
      toIdOrNull(row?.org_unit_id) ||
      (orgToken ? refreshedOrgIndex.byToken.get(asKey(orgToken)) || null : null)
    let tenantId = resolveTenantIdFromToken(extractTenantToken(row?.tenant_id), tenantMaps)
    if (!tenantId && orgId) {
      tenantId = tenantByOrgId.get(orgId) || null
    }
    if (!tenantId) {
      const userId = asString(row?.user_id)
      tenantId = userTenantMap.get(userId) || null
    }

    const patch = {}
    if ((toIdOrNull(current?.org_unit_id) || null) !== (orgId || null)) {
      patch.org_unit_id = orgId
    }
    if ((toIdOrNull(current?.tenant_id) || null) !== (tenantId || null)) {
      patch.tenant_id = tenantId
    }
    if ((toIdOrNull(current?.organization_id) || null) !== (tenantId || null)) {
      patch.organization_id = tenantId
    }
    if (Object.keys(patch).length) {
      await client.patch(`/items/org_memberships/${id}`, patch)
    }
  }

  for (const row of sourceProjectRows) {
    const id = asString(row?.id)
    if (!id) continue
    const current = currentProjectById.get(id)
    const ownerOrgToken = asString(row?.owner_org_unit_id)
    const ownerOrgId =
      toIdOrNull(row?.owner_org_unit_id) ||
      (ownerOrgToken ? refreshedOrgIndex.byToken.get(asKey(ownerOrgToken)) || null : null)
    let tenantId = resolveTenantIdFromToken(extractTenantToken(row?.tenant_id), tenantMaps)
    if (!tenantId) {
      tenantId = resolveTenantIdFromToken(extractTenantToken(row?.tenant), tenantMaps)
    }
    if (!tenantId && ownerOrgId) {
      tenantId = tenantByOrgId.get(ownerOrgId) || null
    }

    const patch = {}
    if ((toIdOrNull(current?.owner_org_unit_id) || null) !== (ownerOrgId || null)) {
      patch.owner_org_unit_id = ownerOrgId
    }
    if ((toIdOrNull(current?.tenant_id) || null) !== (tenantId || null)) {
      patch.tenant_id = tenantId
    }
    if ((toIdOrNull(current?.organization_id) || null) !== (tenantId || null)) {
      patch.organization_id = tenantId
    }
    if (Object.keys(patch).length) {
      await client.patch(`/items/projects/${id}`, patch)
    }
  }

  console.log('✅ legacy tenant/org references normalized')
}

async function ensureRootOrgUnits(client) {
  const [tenantsRes, orgRes] = await Promise.all([
    client.get('/items/tenants', { params: { fields: 'id,name', limit: -1 } }),
    client.get('/items/org_units', { params: { fields: 'id,tenant_id,type,parent_id,name,code', limit: -1 } }),
  ])

  const existingRoots = new Map(
    (orgRes.data?.data || [])
      .filter((item) => (item?.type || '').toLowerCase() === 'tenant_root' && !item?.parent_id)
      .map((item) => [String(item.tenant_id), item])
  )

  for (const tenant of tenantsRes.data?.data || []) {
    const tenantId = String(tenant?.id || '')
    if (!tenantId || existingRoots.has(tenantId)) continue
    await client.post('/items/org_units', {
      tenant_id: tenantId,
      organization_id: tenantId,
      parent_id: null,
      name: String(tenant?.name || 'Tenant'),
      code: `${toSlug(tenant?.name || 'tenant', 'tenant').toUpperCase()}_ROOT`,
      type: 'tenant_root',
      depth: 0,
      path: `/${tenantId}`,
      status: 'active',
      settings: {
        inheritRoleDownwardByDefault: false,
        inheritPermissionUpward: false,
      },
    })
    console.log(`✅ root org created for tenant: ${tenant?.name}`)
  }
}

async function repairCrossOrganizationParents(client) {
  const orgRes = await client.get('/items/org_units', {
    params: { fields: 'id,parent_id,organization_id', limit: -1 },
  })
  const orgRows = orgRes.data?.data || []
  const orgById = new Map(orgRows.map((row) => [asString(row?.id), row]).filter(([id]) => Boolean(id)))

  let patched = 0
  for (const row of orgRows) {
    const id = asString(row?.id)
    const parentId = toIdOrNull(row?.parent_id)
    if (!id || !parentId) continue

    const parent = orgById.get(parentId)
    if (!parent) continue

    const childOrgId = toIdOrNull(row?.organization_id)
    const parentOrgId = toIdOrNull(parent?.organization_id)
    if (!childOrgId || !parentOrgId || childOrgId === parentOrgId) continue

    await client.patch(`/items/org_units/${id}`, { parent_id: null })
    patched += 1
  }

  console.log(`✅ cross-organization parent links repaired, patched ${patched} rows`)
}

function runPostgresSql(query, label) {
  const postgresUser = process.env.POSTGRES_USER
  const postgresPassword = process.env.POSTGRES_PASSWORD
  const postgresDb = process.env.POSTGRES_DB
  if (!postgresUser || !postgresPassword || !postgresDb) {
    throw new Error('POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB is required to apply DB constraints')
  }

  try {
    execFileSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        '-e',
        `PGPASSWORD=${postgresPassword}`,
        'postgres',
        'psql',
        '-U',
        postgresUser,
        '-d',
        postgresDb,
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        query,
      ],
      {
        cwd: path.resolve('..'),
        stdio: 'pipe',
        encoding: 'utf8',
      }
    )
    console.log(`✅ ${label}`)
  } catch (error) {
    const stderr = String(error?.stderr || error?.message || error)
    throw new Error(`failed to execute postgres sql for "${label}": ${stderr}`)
  }
}

async function ensureOrgParentScopeConstraints(client) {
  await runPostgresSql(
    `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_units_id_organization_id_uniq'
      AND conrelid = 'public.org_units'::regclass
  ) THEN
    ALTER TABLE public.org_units
      ADD CONSTRAINT org_units_id_organization_id_uniq UNIQUE (id, organization_id);
  END IF;
END $$;
`,
    'org_units(id, organization_id) unique constraint ensured'
  )

  await runPostgresSql(
    `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_units_parent_scope_fk'
      AND conrelid = 'public.org_units'::regclass
  ) THEN
    ALTER TABLE public.org_units
      ADD CONSTRAINT org_units_parent_scope_fk
      FOREIGN KEY (parent_id, organization_id)
      REFERENCES public.org_units (id, organization_id)
      ON UPDATE CASCADE
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;
`,
    'org_units parent scope foreign key ensured'
  )

  await runPostgresSql(
    `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'org_units_parent_scope_fk'
      AND conrelid = 'public.org_units'::regclass
      AND NOT convalidated
  ) THEN
    ALTER TABLE public.org_units VALIDATE CONSTRAINT org_units_parent_scope_fk;
  END IF;
END $$;
`,
    'org_units parent scope foreign key validated'
  )
}

async function ensureOrgTypeSeeds(client) {
  let response
  try {
    response = await client.get('/items/org_types', { params: { fields: 'id,code,name', limit: -1 } })
  } catch (err) {
    if (err?.response?.status === 404) {
      return
    }
    throw err
  }

  const rows = response?.data?.data || []
  const existing = new Set()
  rows.forEach((row) => {
    const codeKey = asKey(row?.code)
    const nameKey = asKey(row?.name)
    if (codeKey) existing.add(`code:${codeKey}`)
    if (nameKey) existing.add(`name:${nameKey}`)
  })

  for (let index = 0; index < DEFAULT_ORG_TYPES.length; index += 1) {
    const item = DEFAULT_ORG_TYPES[index]
    const codeKey = asKey(item.code)
    const nameKey = asKey(item.name)
    if (existing.has(`code:${codeKey}`) || existing.has(`name:${nameKey}`)) {
      continue
    }
    try {
      await client.post('/items/org_types', {
        name: item.name,
        code: item.code,
        status: 'active',
        sort_order: index + 1,
      })
      existing.add(`code:${codeKey}`)
      existing.add(`name:${nameKey}`)
      console.log(`✅ org type seeded: ${item.name}`)
    } catch (err) {
      if (!isAlreadyExists(err)) {
        throw err
      }
    }
  }
}

async function run() {
  console.log(`🔗 Directus: ${DIRECTUS_URL}`)
  const token = await login()
  const client = createClient(token)

  await ensureCollections(client)
  await ensureFields(client)
  await ensureAuditFields(client, ['organizations', 'tenants', 'org_units', 'org_memberships', 'projects', 'org_types'])
  await ensureProjectAndUserFields(client)
  await backfillTenants(client)
  await backfillTenantCodes(client)
  await backfillOrganizationsFromTenants(client)
  const legacySnapshot = await collectLegacyReferenceSnapshot(client)
  await ensureRelationFieldTypes(client)
  await normalizeReferences(client, legacySnapshot)
  await normalizeUserScopeField(client)
  await ensureRelations(client)
  await ensureRootOrgUnits(client)
  await repairCrossOrganizationParents(client)
  await ensureOrgParentScopeConstraints(client)
  await ensureOrgTypeSeeds(client)

  console.log('🎉 organization model migration completed')
}

run().catch((err) => {
  console.error('❌ organization model migration failed:', err?.response?.data || err?.message || err)
  process.exit(1)
})
