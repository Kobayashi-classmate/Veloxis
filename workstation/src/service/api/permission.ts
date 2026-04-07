/**
 * 权限相关 API — 对接 Directus v11 后端
 *
 * Directus v11 权限模型：
 *   - JWT payload 直接携带 admin_access / app_access 字段
 *   - GET /users/me          → 用户基本信息（role 字段为 UUID 字符串）
 *   - GET /roles/<roleId>    → 角色信息（含 policies 数组）
 *   - GET /permissions       → 当前用户可见的权限条目（admin 用户不需要查）
 */

import { UserPermission, Role, PermissionCode } from '../../types/permission'
import request from '@/service/request'
import { buildAdminAccessProfile } from '@src/utils/adminAccess'

export type Permission = {
  code: string
  name?: string
}

/** 解析 JWT payload（不做签名验证，仅读取声明字段） */
const parseJwtPayload = (token: string): Record<string, any> => {
  try {
    const base64 = token.split('.')[1]
    if (!base64) return {}
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

/** 从 localStorage 读取当前 JWT token 字符串 */
const readRawToken = (): string => {
  try {
    const raw = localStorage.getItem('token')
    if (!raw) return ''
    const parsed = JSON.parse(raw)
    return typeof parsed?.token === 'string' ? parsed.token : ''
  } catch {
    return ''
  }
}

/** Directus /permissions 条目结构（v11） */
interface DirectusPermission {
  collection: string
  action: 'create' | 'read' | 'update' | 'delete'
  policy?: string | null
}

const toPermissionCode = (collection: string, action: string): PermissionCode =>
  `${collection}:${action}` as PermissionCode

const toScopeId = (value: any): string => {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''

  if (typeof value.id === 'string' && value.id.trim()) return value.id.trim()
  if (typeof value.organization_id === 'string' && value.organization_id.trim()) return value.organization_id.trim()
  if (typeof value.tenant_id === 'string' && value.tenant_id.trim()) return value.tenant_id.trim()
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim()
  if (typeof value.organization_name === 'string' && value.organization_name.trim())
    return value.organization_name.trim()
  if (typeof value.tenant_name === 'string' && value.tenant_name.trim()) return value.tenant_name.trim()

  return ''
}

const isAuthStatusError = (error: any): boolean => {
  const status = Number(error?.status || error?.response?.status || 0)
  return status === 401 || status === 403
}

const fetchCurrentUserInfo = async (): Promise<any> => {
  const fieldCandidates = [
    'id,email,first_name,last_name,role,organization,organization.id,organization.name,tenant,tenant.id,tenant.name',
    'id,email,first_name,last_name,role,organization,organization.id,organization.name,tenant',
    'id,email,first_name,last_name,role,organization,organization.id,organization.name',
    'id,email,first_name,last_name,role,tenant,tenant.id,tenant.name',
    'id,email,first_name,last_name,role,tenant',
  ]

  let lastError: any = null
  for (const fields of fieldCandidates) {
    try {
      const meResp = (await request.get('/users/me', { fields })) as any
      return meResp?.data ?? meResp
    } catch (error) {
      if (isAuthStatusError(error)) {
        throw error
      }
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error('Failed to fetch current user info')
}

/**
 * 获取当前用户权限信息，对接 Directus v11。
 */
export const getUserPermissions = async (_userId?: string): Promise<UserPermission> => {
  try {
    // Step 1: 从 JWT payload 读取 admin_access（最可靠，无需额外请求）
    const rawToken = readRawToken()
    const jwtPayload = parseJwtPayload(rawToken)
    const isAdmin: boolean = jwtPayload.admin_access === true

    // Step 2: 获取用户基本信息
    const me = await fetchCurrentUserInfo()
    const organizationScope = toScopeId(me?.organization) || toScopeId(me?.tenant)

    if (!me?.id) {
      return { userId: '', username: '', roles: [], permissions: [], routes: [] }
    }

    const roleId: string = typeof me.role === 'string' ? me.role : (me.role?.id ?? '')

    // Step 3: 管理员直接授予超级权限，无需查 permissions 表
    if (isAdmin) {
      const frontendRoles: Role[] = roleId
        ? [
            {
              id: roleId,
              name: 'Administrator',
              code: 'super_admin',
              description: 'Administrator',
              permissions: ['*:*'],
              isDefault: false,
            },
          ]
        : []

      const adminProfile = buildAdminAccessProfile(frontendRoles, { isPlatformAdmin: true })
      const adminRoutes = adminProfile.allowedPaths

      return {
        userId: me.id,
        username: me.email,
        roles: frontendRoles,
        permissions: ['*:*'],
        routes: Array.from(new Set(['*', ...adminRoutes])),
        organization: organizationScope,
        tenant: organizationScope,
      }
    }

    // Step 4: 普通角色 — 获取角色名称
    let roleName = roleId
    if (roleId) {
      try {
        const roleResp = (await request.get(`/roles/${roleId}`, { fields: 'id,name' })) as any
        const roleData = roleResp?.data ?? roleResp
        roleName = roleData?.name ?? roleId
      } catch {
        // 忽略，使用 roleId 作为名称
      }
    }

    const frontendRoles: Role[] = roleId
      ? [{ id: roleId, name: roleName, code: roleId, description: roleName, permissions: [], isDefault: true }]
      : []

    // Step 5: 查询当前用户可见的 permissions 条目
    let permissionCodes: PermissionCode[] = []
    try {
      const permResp = (await request.get('/permissions', {
        limit: -1,
        fields: 'collection,action',
      })) as any

      const permList: DirectusPermission[] = permResp?.data ?? permResp ?? []

      permissionCodes = Array.isArray(permList)
        ? permList
            .filter((p) => p.collection && !p.collection.startsWith('directus_'))
            .map((p) => toPermissionCode(p.collection, p.action))
        : []
    } catch (e) {
      console.warn('[permission] 获取权限条目失败:', e)
    }

    // Step 6: 从权限码推导可访问的前端路由
    const adminProfile = buildAdminAccessProfile(frontendRoles)
    const collectionSet = new Set(permissionCodes.map((code) => code.split(':')[0]))
    const collectionRoutes = Array.from(collectionSet).map((c) => `/${c}`)
    const adminRoutes = adminProfile.allowedPaths

    // 仅对 Admin Console 角色补充管理入口权限码，避免普通业务用户误入。
    if (adminProfile.isAdminConsoleUser && !permissionCodes.includes('system:read')) {
      permissionCodes = [...permissionCodes, 'system:read']
    }

    const routes: string[] = Array.from(new Set(['/', ...collectionRoutes, ...adminRoutes]))

    return {
      userId: me.id,
      username: me.email,
      roles: frontendRoles,
      permissions: permissionCodes,
      routes,
      organization: organizationScope,
      tenant: organizationScope,
    }
  } catch (error: any) {
    const status = error?.response?.status

    // 401：认证失效，可进入 refresh 链路
    if (status === 401) {
      error.isUnauthorized = true
      error.isAuthExpired = true
      error.canRetry = !error.config?._isRefreshRequest
      error.status = 401
    }

    // 403：权限不足，不触发 refresh/logout
    if (status === 403) {
      error.isForbidden = true
      error.status = 403
      error.canRetry = false
    }

    throw error
  }
}

/**
 * 获取所有角色列表
 */
export const getRoles = async (): Promise<Role[]> => {
  try {
    const resp = (await request.get('/roles', { limit: -1, fields: 'id,name' })) as any
    const list: any[] = resp?.data ?? resp ?? []
    return list.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.id,
      description: r.name,
      permissions: [],
      isDefault: true,
    }))
  } catch (e) {
    console.error('[permission] 获取角色列表失败:', e)
    return []
  }
}

export const checkPermission = async (permission: PermissionCode, _userId?: string): Promise<boolean> => {
  const { permissions } = await getUserPermissions()
  if (permissions.includes('*:*')) return true
  if (permissions.includes(permission)) return true
  const [resource] = permission.split(':')
  return permissions.includes(`${resource}:*` as PermissionCode)
}

export const checkAllPermissions = async (permissions: PermissionCode[], userId?: string): Promise<boolean> => {
  const results = await Promise.all(permissions.map((p) => checkPermission(p, userId)))
  return results.every(Boolean)
}

export const checkAnyPermission = async (permissions: PermissionCode[], userId?: string): Promise<boolean> => {
  const results = await Promise.all(permissions.map((p) => checkPermission(p, userId)))
  return results.some(Boolean)
}

export const getUserRoutes = async (_userId?: string): Promise<string[]> => {
  const { routes } = await getUserPermissions()
  return routes
}

export const getCurrentPermissions = async (): Promise<Permission[]> => {
  try {
    const { permissions } = await getUserPermissions()
    return permissions.map((code) => ({ code }))
  } catch (e) {
    console.warn('[permission] getCurrentPermissions 失败:', e)
    return []
  }
}
