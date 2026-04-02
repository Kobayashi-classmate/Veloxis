import type { Role } from '@src/types/permission'

export type AdminRoleCode = 'super_admin' | 'operator' | 'tenant_admin' | 'none'

export const ADMIN_ROUTE_PATHS = {
  root: '/admin',
  overview: '/admin/overview',
  users: '/admin/users',
  roles: '/admin/roles',
  projects: '/admin/projects',
  plugins: '/admin/plugins',
  audit: '/admin/audit',
  legacy: '/admin/legacy',
} as const

const SUPER_ADMIN_PATTERNS = new Set([
  'super_admin',
  'superadmin',
  'platform_admin',
  'platformadmin',
  'administrator',
  'admin',
])

const OPERATOR_PATTERNS = new Set(['operator', 'ops', 'ops_auditor', 'auditor'])

const TENANT_ADMIN_PATTERNS = new Set(['tenant_admin', 'tenantadmin'])

const ROLE_LABEL_MAP: Record<AdminRoleCode, string> = {
  super_admin: 'Super Admin',
  operator: 'Operator',
  tenant_admin: 'Tenant Admin',
  none: 'User',
}

const toRoleToken = (value: string | undefined): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const collectRoleTokens = (roles: Array<Pick<Role, 'name' | 'code'> | Partial<Role>> = []): Set<string> => {
  const tokens = new Set<string>()

  roles.forEach((role) => {
    if (!role) return
    const codeToken = toRoleToken(role.code)
    const nameToken = toRoleToken(role.name)

    if (codeToken) {
      tokens.add(codeToken)
      tokens.add(codeToken.replace(/_/g, ''))
    }

    if (nameToken) {
      tokens.add(nameToken)
      tokens.add(nameToken.replace(/_/g, ''))
    }
  })

  return tokens
}

const hasAnyToken = (tokens: Set<string>, patterns: Set<string>): boolean => {
  for (const token of tokens) {
    if (patterns.has(token)) return true
  }
  return false
}

export const resolveAdminRoleCode = (
  roles: Array<Pick<Role, 'name' | 'code'> | Partial<Role>> = [],
  options?: { isPlatformAdmin?: boolean }
): AdminRoleCode => {
  if (options?.isPlatformAdmin) return 'super_admin'

  const tokens = collectRoleTokens(roles)
  if (tokens.size === 0) return 'none'

  if (hasAnyToken(tokens, SUPER_ADMIN_PATTERNS)) return 'super_admin'
  if (hasAnyToken(tokens, OPERATOR_PATTERNS)) return 'operator'
  if (hasAnyToken(tokens, TENANT_ADMIN_PATTERNS)) return 'tenant_admin'

  return 'none'
}

export const getAdminAllowedPaths = (roleCode: AdminRoleCode): string[] => {
  switch (roleCode) {
    case 'super_admin':
      return [
        ADMIN_ROUTE_PATHS.root,
        ADMIN_ROUTE_PATHS.overview,
        ADMIN_ROUTE_PATHS.users,
        ADMIN_ROUTE_PATHS.roles,
        ADMIN_ROUTE_PATHS.projects,
        ADMIN_ROUTE_PATHS.plugins,
        ADMIN_ROUTE_PATHS.audit,
        ADMIN_ROUTE_PATHS.legacy,
      ]
    case 'operator':
      return [
        ADMIN_ROUTE_PATHS.root,
        ADMIN_ROUTE_PATHS.overview,
        ADMIN_ROUTE_PATHS.projects,
        ADMIN_ROUTE_PATHS.plugins,
        ADMIN_ROUTE_PATHS.audit,
        ADMIN_ROUTE_PATHS.legacy,
      ]
    case 'tenant_admin':
      return [
        ADMIN_ROUTE_PATHS.root,
        ADMIN_ROUTE_PATHS.overview,
        ADMIN_ROUTE_PATHS.users,
        ADMIN_ROUTE_PATHS.projects,
        ADMIN_ROUTE_PATHS.legacy,
      ]
    default:
      return []
  }
}

export type AdminAccessProfile = {
  roleCode: AdminRoleCode
  roleLabel: string
  isAdminConsoleUser: boolean
  tenantScoped: boolean
  allowedPaths: string[]
  capabilities: {
    overview: boolean
    users: boolean
    roles: boolean
    projects: boolean
    plugins: boolean
    audit: boolean
    legacy: boolean
    highRiskMutation: boolean
  }
}

export const buildAdminAccessProfile = (
  roles: Array<Pick<Role, 'name' | 'code'> | Partial<Role>> = [],
  options?: { isPlatformAdmin?: boolean }
): AdminAccessProfile => {
  const roleCode = resolveAdminRoleCode(roles, options)
  const allowedPaths = getAdminAllowedPaths(roleCode)
  const isAdminConsoleUser = roleCode !== 'none'

  return {
    roleCode,
    roleLabel: ROLE_LABEL_MAP[roleCode],
    isAdminConsoleUser,
    tenantScoped: roleCode === 'tenant_admin',
    allowedPaths,
    capabilities: {
      overview: isAdminConsoleUser,
      users: roleCode === 'super_admin' || roleCode === 'tenant_admin',
      roles: roleCode === 'super_admin',
      projects: isAdminConsoleUser,
      plugins: roleCode === 'super_admin' || roleCode === 'operator',
      audit: roleCode === 'super_admin' || roleCode === 'operator',
      legacy: isAdminConsoleUser,
      highRiskMutation: roleCode === 'super_admin',
    },
  }
}

export const isAdminPath = (pathname = ''): boolean => {
  const raw = String(pathname || '').trim().split('?')[0]
  return raw === ADMIN_ROUTE_PATHS.root || raw.startsWith(`${ADMIN_ROUTE_PATHS.root}/`)
}
