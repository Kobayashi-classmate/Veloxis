/**
 * init-rbac.mjs
 *
 * 为 Veloxis 配置 Directus v11 行级权限（Row-Level Security）
 *
 * 执行结果：
 *   - 创建 "Authenticated Users" Policy（非管理员已认证用户的权限载体）
 *   - 创建 "Member" Role 并挂载上述 Policy
 *   - 为以下集合配置行级读写权限，确保数据按项目隔离：
 *       datasets         → 仅限当前用户所在项目
 *       dataset_versions → 通过 dataset_id 关联到项目
 *       recipes          → 通过 dataset_id 关联到项目
 *       projects         → 仅限当前用户参与的项目
 *       project_members  → 仅限当前用户所在项目的成员列表
 *       project_starred  → 仅限当前用户的收藏
 *       directus_users   → 仅当前用户自身
 *       directus_files   → 允许读写（文件夹隔离已在上传时通过 folder 字段实现）
 *       directus_folders → 允许读写
 *
 * 平台级管理员（admin_access: true）不受影响，可跨项目查看所有数据。
 *
 * 使用方法：
 *   cd scripts && node init-rbac.mjs
 *
 * 依赖：.env 中的 DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD
 */

import axios from 'axios'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '../.env') })

const BASE  = process.env.DIRECTUS_URL  || process.env.PUBLIC_URL || 'http://localhost:8080/hdjskefs45'
const EMAIL = process.env.DIRECTUS_ADMIN_EMAIL    || 'admin@yourcompany.com'
const PASS  = process.env.DIRECTUS_ADMIN_PASSWORD || 'SuperStrongPassword123!'

let TOKEN = ''

async function login() {
  const res = await axios.post(`${BASE}/auth/login`, { email: EMAIL, password: PASS })
  TOKEN = res.data.data.access_token
  console.log('✅ Logged in as', EMAIL)
}

function api(method, path, data) {
  return axios({ method, url: `${BASE}${path}`, data, headers: { Authorization: `Bearer ${TOKEN}` } })
    .then(r => r.data.data)
    .catch(e => {
      const msg = e.response?.data?.errors?.[0]?.message ?? e.message
      throw new Error(`${method.toUpperCase()} ${path}: ${msg}`)
    })
}

async function ensurePolicy(name) {
  // 查询是否已存在
  const list = await api('get', `/policies?filter[name][_eq]=${encodeURIComponent(name)}&limit=1`)
  if (list?.length > 0) {
    console.log(`  ⏭  Policy "${name}" already exists: ${list[0].id}`)
    return list[0].id
  }
  const created = await api('post', '/policies', {
    name,
    admin_access: false,
    app_access: true,
    enforce_tfa: false,
  })
  console.log(`  ✅ Policy "${name}" created: ${created.id}`)
  return created.id
}

async function ensureRole(name) {
  const list = await api('get', `/roles?filter[name][_eq]=${encodeURIComponent(name)}&limit=1`)
  if (list?.length > 0) {
    console.log(`  ⏭  Role "${name}" already exists: ${list[0].id}`)
    return list[0].id
  }
  const created = await api('post', '/roles', {
    name,
    admin_access: false,
    app_access: true,
  })
  console.log(`  ✅ Role "${name}" created: ${created.id}`)
  return created.id
}

async function ensureAccess(roleId, policyId) {
  // 查询是否已挂载
  const list = await api('get', `/access?filter[role][_eq]=${roleId}&filter[policy][_eq]=${policyId}&limit=1`)
  if (list?.length > 0) {
    console.log(`  ⏭  Policy already attached to role`)
    return
  }
  await api('post', '/access', { role: roleId, user: null, policy: policyId })
  console.log(`  ✅ Policy attached to role`)
}

async function ensurePermission(policyId, collection, action, fields, permissions) {
  // 查询是否已存在
  const existing = await api('get',
    `/permissions?filter[policy][_eq]=${policyId}&filter[collection][_eq]=${collection}&filter[action][_eq]=${action}&limit=1`)
  if (existing?.length > 0) {
    console.log(`  ⏭  ${collection}:${action} already exists`)
    return
  }
  await api('post', '/permissions', { collection, action, fields, policy: policyId, permissions })
  console.log(`  ✅ ${collection}:${action}`)
}

async function main() {
  await login()

  console.log('\n📋 Step 1: 创建 Authenticated Users Policy')
  const policyId = await ensurePolicy('Authenticated Users')

  console.log('\n👤 Step 2: 创建 Member Role 并挂载 Policy')
  const roleId = await ensureRole('Member')
  await ensureAccess(roleId, policyId)

  console.log('\n🔐 Step 3: 配置集合行级权限')

  /** 行级过滤规则 */
  const DATASET_FILTER  = { project_id: { _in: '$CURRENT_USER.project_members.project_id' } }
  const VERSION_FILTER  = { dataset_id: { project_id: { _in: '$CURRENT_USER.project_members.project_id' } } }
  const RECIPE_FILTER   = { dataset_id: { project_id: { _in: '$CURRENT_USER.project_members.project_id' } } }
  const PROJECT_FILTER  = { members: { directus_users_id: { _eq: '$CURRENT_USER' } } }
  const PM_FILTER       = { project_id: { members: { directus_users_id: { _eq: '$CURRENT_USER' } } } }
  const STARRED_FILTER  = { directus_users_id: { _eq: '$CURRENT_USER' } }
  const SELF_FILTER     = { id: { _eq: '$CURRENT_USER' } }
  const OPEN            = {}

  const perms = [
    /** datasets：按项目隔离 */
    ['datasets', 'read',   ['*'], DATASET_FILTER],
    ['datasets', 'create', ['*'], OPEN],
    ['datasets', 'update', ['*'], DATASET_FILTER],
    ['datasets', 'delete', ['*'], DATASET_FILTER],

    /** dataset_versions：通过 dataset_id 关联项目 */
    ['dataset_versions', 'read',   ['*'], VERSION_FILTER],
    ['dataset_versions', 'create', ['*'], OPEN],
    ['dataset_versions', 'update', ['*'], VERSION_FILTER],

    /** recipes：通过 dataset_id 关联项目 */
    ['recipes', 'read',   ['*'], RECIPE_FILTER],
    ['recipes', 'create', ['*'], OPEN],
    ['recipes', 'update', ['*'], RECIPE_FILTER],
    ['recipes', 'delete', ['*'], RECIPE_FILTER],

    /** projects：仅限参与的项目 */
    ['projects', 'read', ['*'], PROJECT_FILTER],

    /** project_members：仅限所在项目的成员列表 */
    ['project_members', 'read', ['*'], PM_FILTER],

    /** project_starred：仅自己的收藏 */
    ['project_starred', 'read',   ['*'], STARRED_FILTER],
    ['project_starred', 'create', ['*'], OPEN],
    ['project_starred', 'delete', ['*'], STARRED_FILTER],

    /** directus_users：只读自身 */
    ['directus_users', 'read', ['*'], SELF_FILTER],

    /** directus_files：允许读写（文件夹由上传时 folder 字段控制） */
    ['directus_files', 'read',   ['*'], OPEN],
    ['directus_files', 'create', ['*'], OPEN],

    /** directus_folders：允许读写 */
    ['directus_folders', 'read',   ['*'], OPEN],
    ['directus_folders', 'create', ['*'], OPEN],
  ]

  for (const [collection, action, fields, filter] of perms) {
    await ensurePermission(policyId, collection, action, fields, filter)
  }

  console.log('\n🎉 RBAC 配置完成！')
  console.log('\n说明：')
  console.log('  - 平台管理员（Administrator role）不受以上规则限制，可跨项目访问全部数据')
  console.log('  - 非管理员用户需分配 Member role，数据自动按所参与的项目隔离')
  console.log('  - datasets / dataset_versions / recipes 仅返回当前用户所在项目的数据')
  console.log('  - 新建用户时，在 Directus 后台将其 role 设为 Member 即可生效')
}

main().catch(e => {
  console.error('❌ 错误:', e.message)
  process.exit(1)
})
