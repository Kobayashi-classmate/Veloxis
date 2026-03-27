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
    const meResp = (await request.get('/users/me', { fields: 'id,email,first_name,last_name,role,tenant' })) as any
    const me = meResp?.data ?? meResp

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

      return {
        userId: me.id,
        username: me.email,
        roles: frontendRoles,
        permissions: ['*:*'],
        routes: ['*'],
        tenant: me.tenant,
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
    const collectionSet = new Set(permissionCodes.map((code) => code.split(':')[0]))
    const routes: string[] = ['/', ...Array.from(collectionSet).map((c) => `/${c}`)]

    return {
      userId: me.id,
      username: me.email,
      roles: frontendRoles,
      permissions: permissionCodes,
      routes,
      tenant: me.tenant,
    }
  } catch (error: any) {
    // 增加对授权错误的处理逻辑，确保 request.js 能够识别并触发 refresh/logout
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      error.isUnauthorized = true
      error.canRetry = !error.config?._isRefreshRequest
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
