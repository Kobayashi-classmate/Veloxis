import request from '../request'
import { getProjects } from './projects'
import { getWorkerHealth } from './worker'

export type AdminDataScope = {
  tenantScoped?: boolean
  tenantId?: string
}

export type AdminOverviewAlert = {
  id: string
  level: 'low' | 'medium' | 'high' | 'critical'
  module: string
  title: string
  created_at: string
  tenant_id: string
}

export type AdminRecentChange = {
  id: string
  module: string
  actor: string
  action: string
  target: string
  changed_at: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
}

export type AdminOverviewPayload = {
  health: {
    platform_status: 'healthy' | 'warning' | 'critical'
    active_tenants: number
    active_projects: number
    running_jobs: number
    failed_jobs: number
    plugin_enabled_count: number
  }
  alerts: AdminOverviewAlert[]
  recent_changes: AdminRecentChange[]
}

export type AdminUserRecord = {
  id: string
  email: string
  display_name: string
  role_code: string
  role_name: string
  tenant_id: string
  tenant_name: string
  status: 'active' | 'locked' | 'pending'
  mfa_enabled: boolean
  last_login_at: string
}

export type AdminRoleRecord = {
  id: string
  code: string
  name: string
  scope: 'platform' | 'tenant'
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  permissions: string[]
  updated_at: string
}

export type AdminProjectRecord = {
  id: string
  slug: string
  name: string
  tenant_id: string
  tenant_name: string
  owner_user: string
  status: string
  member_count: number
  last_activity_at: string
}

export type AdminPluginDefinitionRecord = {
  id: string
  code: string
  name: string
  version: string
  min_platform_version: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: string
}

export type AdminPluginInstallationRecord = {
  id: string
  plugin_code: string
  scope_type: 'platform' | 'tenant' | 'project'
  scope_id: string
  enabled: boolean
  installed_at: string
  updated_at: string
  status: string
}

export type AdminAuditEvent = {
  id: string
  actor: string
  module: string
  action: string
  target: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: string
  scope_type: 'platform' | 'tenant' | 'project'
  scope_id: string
  created_at: string
}

export type AdminPluginsPayload = {
  definitions: AdminPluginDefinitionRecord[]
  installations: AdminPluginInstallationRecord[]
  audit: AdminAuditEvent[]
}

type WorkerRegistryRecord = {
  id?: string
  plugin_id?: string
  version?: string
  type?: string
  status?: string
  platform_version_range?: string | null
  permissions_json?: string[] | string | null
  manifest_json?: {
    id?: string
    name?: string
    version?: string
    permissions?: string[]
    platformVersionRange?: string
  } | null
  last_error?: string | null
  date_created?: string
  date_updated?: string
}

type WorkerInstallationRecord = {
  id?: string
  plugin_id?: string
  version?: string
  scope_type?: string
  scope_id?: string | null
  status?: string
  enabled_at?: string | null
  date_created?: string
  date_updated?: string
}

type WorkerAuditLog = {
  id?: string
  action?: string
  success?: boolean
  request_id?: string | null
  date_created?: string
}

const EMPTY_OVERVIEW: AdminOverviewPayload = {
  health: {
    platform_status: 'healthy',
    active_tenants: 0,
    active_projects: 0,
    running_jobs: 0,
    failed_jobs: 0,
    plugin_enabled_count: 0,
  },
  alerts: [],
  recent_changes: [],
}

const PLATFORM_SCOPE_ID = 'tenant_global'

const safeString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback
}

const toArray = <T = any>(payload: any): T[] => {
  const data = payload?.data ?? payload
  return Array.isArray(data) ? data : []
}

const safeCall = async <T>(runner: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await runner()
  } catch {
    return fallback
  }
}

const safeRequest = async (runner: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await runner()
  } catch {
    return null
  }
}

const toRoleToken = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const extractId = (value: any): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value?.id === 'string') return value.id
  return ''
}

const extractName = (value: any): string => {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value?.name === 'string') return value.name
  const firstName = safeString(value?.first_name)
  const lastName = safeString(value?.last_name)
  return [firstName, lastName].filter(Boolean).join(' ')
}

const normalizeTenantScope = <T extends { tenant_id?: string; tenant_name?: string }>(
  rows: T[],
  options?: AdminDataScope
) => {
  if (!options?.tenantScoped) return rows

  const tenantId = options.tenantId || ''
  if (!tenantId) return rows

  const filtered = rows.filter((item) => item.tenant_id === tenantId || item.tenant_name === tenantId)
  return filtered.length > 0 ? filtered : rows
}

const normalizeScopeType = (scopeType?: string): 'platform' | 'tenant' | 'project' => {
  const normalized = String(scopeType || '').toLowerCase()
  if (normalized === 'tenant') return 'tenant'
  if (normalized === 'project') return 'project'
  return 'platform'
}

const isEnabledStatus = (status: string): boolean => {
  return ['enabled', 'installed', 'validated', 'upgraded'].includes(status)
}

const resolveRiskLevelFromPermissions = (permissions: string[], type = ''): 'low' | 'medium' | 'high' | 'critical' => {
  const normalized = permissions.map((item) => String(item || '').toLowerCase())
  if (normalized.some((item) => item.includes('*') || item.startsWith('system') || item.startsWith('admin'))) {
    return 'critical'
  }
  if (type === 'ai-capability' || normalized.some((item) => item.includes('write') || item.includes('delete'))) {
    return 'high'
  }
  if (normalized.length > 0) return 'medium'
  return 'low'
}

const resolveRiskByAction = (action = ''): 'low' | 'medium' | 'high' | 'critical' => {
  const value = action.toLowerCase()
  if (value.includes('grant') || value.includes('elevate') || value.includes('uninstall')) return 'critical'
  if (value.includes('delete') || value.includes('disable') || value.includes('enable')) return 'high'
  if (value.includes('update') || value.includes('upgrade') || value.includes('create')) return 'medium'
  return 'low'
}

const resolveModuleByCollection = (collection = ''): string => {
  const value = collection.toLowerCase()
  if (value.includes('role')) return 'roles'
  if (value.includes('user')) return 'users'
  if (value.includes('project')) return 'projects'
  if (value.includes('plugin')) return 'plugins'
  return 'system'
}

const formatDate = (value: unknown): string => {
  const raw = safeString(value)
  if (!raw) return '-'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toISOString()
}

const sortByDateDesc = <T extends { created_at?: string }>(rows: T[]): T[] => {
  return [...rows].sort((a, b) => {
    const left = new Date(a.created_at || 0).getTime()
    const right = new Date(b.created_at || 0).getTime()
    return right - left
  })
}

const fetchPluginState = async (): Promise<{
  registry: WorkerRegistryRecord[]
  installations: WorkerInstallationRecord[]
}> => {
  const [registryResponse, installationsResponse] = await Promise.all([
    safeRequest(() => request.get('/worker-api/plugins/registry', {}, { showError: false })),
    safeRequest(() => request.get('/worker-api/plugins/installations', { includeManifest: true }, { showError: false })),
  ])

  return {
    registry: toArray<WorkerRegistryRecord>(registryResponse),
    installations: toArray<WorkerInstallationRecord>(installationsResponse),
  }
}

const fetchPluginAuditEvents = async (
  installations: WorkerInstallationRecord[],
  options?: AdminDataScope
): Promise<AdminAuditEvent[]> => {
  const scopedInstallations =
    options?.tenantScoped && options.tenantId
      ? installations.filter((item) => safeString(item.scope_id) === options.tenantId)
      : installations

  if (!scopedInstallations.length) return []

  const installationMap = new Map<string, WorkerInstallationRecord>()
  scopedInstallations.forEach((item) => {
    if (item.id) installationMap.set(item.id, item)
  })

  const logsPerInstallation = await Promise.all(
    scopedInstallations.slice(0, 40).map(async (installation) => {
      const installationId = safeString(installation.id)
      if (!installationId) return [] as WorkerAuditLog[]
      const response = await safeRequest(() =>
        request.get(`/worker-api/plugins/installations/${installationId}/audit-logs`, {}, { showError: false })
      )
      return toArray<WorkerAuditLog>(response)
    })
  )

  const events: AdminAuditEvent[] = []
  logsPerInstallation.flat().forEach((log) => {
    const installationId = safeString((log as any).installation_id)
    const installation = installationMap.get(installationId)
    const scopeType = normalizeScopeType(installation?.scope_type)
    const scopeId = safeString(installation?.scope_id, PLATFORM_SCOPE_ID)

    events.push({
      id: safeString(log.id, `${installationId || 'plugin'}:${safeString(log.action)}:${safeString(log.date_created)}`),
      actor: safeString(log.request_id, 'system'),
      module: 'plugins',
      action: safeString(log.action, 'plugin.unknown'),
      target: safeString(installation?.plugin_id, installationId || 'plugin'),
      risk_level: scopeType === 'platform' ? 'critical' : 'high',
      status: log.success === false ? 'failed' : 'success',
      scope_type: scopeType,
      scope_id: scopeId,
      created_at: formatDate(log.date_created),
    })
  })

  return events
}

const fetchDirectusActivityEvents = async (limit = 80): Promise<AdminAuditEvent[]> => {
  const response = await safeRequest(() => request.get('/activity', { limit, sort: '-timestamp' }, { showError: false }))

  const rows = toArray<any>(response)
  return rows.map((item) => {
    const action = safeString(item?.action, 'activity.unknown')
    const collection = safeString(item?.collection)
    const actor = extractName(item?.user) || safeString(item?.user) || 'system'

    return {
      id: safeString(item?.id, `${collection}:${action}:${safeString(item?.timestamp)}`),
      actor,
      module: resolveModuleByCollection(collection),
      action,
      target: safeString(item?.item, collection || '-'),
      risk_level: resolveRiskByAction(action),
      status: 'success',
      scope_type: 'platform',
      scope_id: PLATFORM_SCOPE_ID,
      created_at: formatDate(item?.timestamp || item?.date_created),
    } as AdminAuditEvent
  })
}

const summarizeJobsFromWorkerHealth = (workerHealth: any): { running: number; failed: number } => {
  const ingestion = safeString(workerHealth?.queues?.ingestion)
  const workbench = safeString(workerHealth?.queues?.workbench)
  const queueStates = [ingestion, workbench]

  return {
    running: queueStates.filter((status) => status === 'connected').length,
    failed: queueStates.filter((status) => status === 'disconnected').length,
  }
}

export const fetchAdminUsers = async (options?: AdminDataScope): Promise<{
  users: AdminUserRecord[]
  roleOptions: Array<{ value: string; label: string }>
}> => {
  const [usersResponse, rolesResponse] = await Promise.all([
    request.get(
      '/users',
      {
        limit: -1,
        fields: 'id,email,first_name,last_name,status,last_access,last_login_at,role,tenant,tfa_secret,mfa_enabled',
      },
      { showError: false }
    ),
    safeRequest(() => request.get('/roles', { limit: -1, fields: 'id,name' }, { showError: false })),
  ])

  const roleMap = new Map<string, string>()
  toArray<any>(rolesResponse).forEach((role) => {
    const roleId = safeString(role?.id)
    if (!roleId) return
    roleMap.set(roleId, safeString(role?.name, roleId))
  })

  const mapped = toArray<any>(usersResponse).map<AdminUserRecord>((item) => {
    const roleId = extractId(item?.role)
    const roleName = extractName(item?.role) || roleMap.get(roleId) || roleId || 'User'
    const roleCode = toRoleToken(roleName || roleId || 'user')
    const rawTenant = item?.tenant
    const tenantId = extractId(rawTenant) || safeString(rawTenant)
    const tenantName = extractName(rawTenant) || safeString(rawTenant, 'Platform')
    const firstName = safeString(item?.first_name)
    const lastName = safeString(item?.last_name)
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || safeString(item?.display_name) || safeString(item?.email)
    const rawStatus = safeString(item?.status, 'active').toLowerCase()

    let status: AdminUserRecord['status'] = 'active'
    if (['suspended', 'blocked', 'locked', 'inactive'].includes(rawStatus)) status = 'locked'
    if (['invited', 'pending'].includes(rawStatus)) status = 'pending'

    return {
      id: safeString(item?.id),
      email: safeString(item?.email),
      display_name: displayName || safeString(item?.id),
      role_code: roleCode || 'user',
      role_name: roleName || 'User',
      tenant_id: tenantId,
      tenant_name: tenantName || 'Platform',
      status,
      mfa_enabled: Boolean(item?.mfa_enabled || item?.tfa_secret),
      last_login_at: formatDate(item?.last_access || item?.last_login_at),
    }
  })

  const scopedUsers = normalizeTenantScope(mapped, options)
  const roleOptions = Array.from(
    new Map(scopedUsers.map((item) => [item.role_code, { value: item.role_code, label: item.role_name }])).values()
  ).sort((a, b) => a.label.localeCompare(b.label))

  return {
    users: scopedUsers,
    roleOptions,
  }
}

export const fetchAdminRoles = async (): Promise<AdminRoleRecord[]> => {
  const [rolesResponse, permissionsResponse] = await Promise.all([
    request.get('/roles', { limit: -1, fields: 'id,name,admin_access,date_updated,date_created' }, { showError: false }),
    safeRequest(() => request.get('/permissions', { limit: -1, fields: 'role,collection,action' }, { showError: false })),
  ])

  const permissionMap = new Map<string, Set<string>>()
  toArray<any>(permissionsResponse).forEach((item) => {
    const roleId = extractId(item?.role) || safeString(item?.role)
    if (!roleId) return
    const code = `${safeString(item?.collection)}:${safeString(item?.action)}`
    if (!permissionMap.has(roleId)) {
      permissionMap.set(roleId, new Set())
    }
    if (code !== ':') {
      permissionMap.get(roleId)?.add(code)
    }
  })

  return toArray<any>(rolesResponse).map<AdminRoleRecord>((item) => {
    const roleName = safeString(item?.name, 'Role')
    const roleCode = toRoleToken(roleName) || safeString(item?.id)
    const adminAccess = Boolean(item?.admin_access)
    const permissions = Array.from(permissionMap.get(safeString(item?.id)) || [])

    const scope: AdminRoleRecord['scope'] = roleCode.includes('tenant') ? 'tenant' : 'platform'

    let riskLevel: AdminRoleRecord['risk_level'] = 'medium'
    if (adminAccess || roleCode.includes('super_admin') || roleCode === 'administrator' || roleCode === 'admin') {
      riskLevel = 'critical'
    } else if (roleCode.includes('operator') || roleCode.includes('tenant_admin')) {
      riskLevel = 'high'
    }

    return {
      id: safeString(item?.id),
      code: roleCode || safeString(item?.id),
      name: roleName,
      scope,
      risk_level: riskLevel,
      permissions: adminAccess && permissions.length === 0 ? ['*:*'] : permissions,
      updated_at: formatDate(item?.date_updated || item?.date_created),
    }
  })
}

export const fetchAdminProjects = async (options?: AdminDataScope): Promise<AdminProjectRecord[]> => {
  const [projects, ownerMembersResponse] = await Promise.all([
    getProjects(),
    safeRequest(() =>
      request.get(
        '/items/project_members',
        {
          fields:
            'project_id,role,directus_users_id.email,directus_users_id.first_name,directus_users_id.last_name',
          'filter[role][_eq]': 'Owner',
          limit: -1,
        },
        { showError: false }
      )
    ),
  ])

  const ownerMap = new Map<string, string>()
  toArray<any>(ownerMembersResponse).forEach((item) => {
    const projectId = extractId(item?.project_id) || safeString(item?.project_id)
    if (!projectId) return
    const user = item?.directus_users_id
    const ownerName = extractName(user) || safeString(user?.email) || safeString(user)
    if (ownerName) ownerMap.set(projectId, ownerName)
  })

  const mapped = projects.map<AdminProjectRecord>((item) => {
    const tenantName = safeString(item?.tenant)
    return {
      id: safeString(item?.id),
      slug: safeString(item?.slug),
      name: safeString(item?.name),
      tenant_id: tenantName,
      tenant_name: tenantName,
      owner_user: ownerMap.get(safeString(item?.id)) || '-',
      status: safeString(item?.status, 'active'),
      member_count: Number(item?.members ?? 0),
      last_activity_at: safeString(item?.lastActive, '-'),
    }
  })

  return normalizeTenantScope(mapped, options)
}

export const fetchAdminPlugins = async (options?: AdminDataScope): Promise<AdminPluginsPayload> => {
  const { registry, installations } = await fetchPluginState()

  const scopedInstallations = options?.tenantScoped
    ? installations.filter((item) => !options.tenantId || safeString(item.scope_id) === options.tenantId)
    : installations

  const definitions = registry.map<AdminPluginDefinitionRecord>((item) => {
    const manifest = item?.manifest_json || {}
    const pluginCode = safeString(item?.plugin_id || (manifest as any)?.id)
    const permissionsRaw = (manifest as any)?.permissions || item?.permissions_json || []
    const permissions = Array.isArray(permissionsRaw)
      ? permissionsRaw.map((value) => String(value))
      : safeString(permissionsRaw)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
    const risk = resolveRiskLevelFromPermissions(permissions, safeString(item?.type))

    return {
      id: safeString(item?.id, `${pluginCode}@${safeString(item?.version)}`),
      code: pluginCode,
      name: safeString((manifest as any)?.name, pluginCode || 'Plugin'),
      version: safeString(item?.version || (manifest as any)?.version),
      min_platform_version: safeString(
        (manifest as any)?.platformVersionRange || item?.platform_version_range,
        '>=1.0.0'
      ),
      risk_level: risk,
      status: safeString(item?.status, 'unknown'),
    }
  })

  const installationRows = scopedInstallations.map<AdminPluginInstallationRecord>((item) => {
    const status = safeString(item?.status, 'unknown')
    return {
      id: safeString(item?.id),
      plugin_code: safeString(item?.plugin_id),
      scope_type: normalizeScopeType(safeString(item?.scope_type)),
      scope_id: safeString(item?.scope_id, PLATFORM_SCOPE_ID),
      enabled: isEnabledStatus(status),
      installed_at: formatDate(item?.enabled_at || item?.date_created),
      updated_at: formatDate(item?.date_updated || item?.date_created),
      status,
    }
  })

  const pluginAudit = await fetchPluginAuditEvents(scopedInstallations, options)

  return {
    definitions,
    installations: installationRows,
    audit: sortByDateDesc(pluginAudit),
  }
}

export const fetchAdminAudit = async (
  options?: AdminDataScope & {
    limit?: number
  }
): Promise<AdminAuditEvent[]> => {
  const limit = Math.max(options?.limit || 80, 1)
  const { installations } = await fetchPluginState()
  const pluginEvents = await fetchPluginAuditEvents(installations, options)
  const directusEvents = options?.tenantScoped ? [] : await fetchDirectusActivityEvents(limit)
  const combined = sortByDateDesc([...pluginEvents, ...directusEvents])

  return combined.slice(0, limit)
}

export const fetchAdminOverview = async (options?: AdminDataScope): Promise<AdminOverviewPayload> => {
  const [projects, pluginState, auditEvents, workerHealth] = await Promise.all([
    safeCall(() => fetchAdminProjects(options), [] as AdminProjectRecord[]),
    safeCall(() => fetchAdminPlugins(options), { definitions: [], installations: [], audit: [] } as AdminPluginsPayload),
    safeCall(() => fetchAdminAudit({ ...options, limit: 8 }), [] as AdminAuditEvent[]),
    safeCall(() => getWorkerHealth(), null),
  ])
  const jobsSummary = summarizeJobsFromWorkerHealth(workerHealth)

  const activeTenants = new Set(projects.map((item) => item.tenant_name).filter(Boolean)).size
  const activeProjects = projects.filter((item) => item.status !== 'archived').length
  const pluginEnabledCount = pluginState.installations.filter((item) => item.enabled).length

  let platformStatus: AdminOverviewPayload['health']['platform_status'] = 'healthy'
  if (jobsSummary.failed > 0 || workerHealth?.status === 'degraded') {
    platformStatus = 'warning'
  }
  if (jobsSummary.failed >= 5) {
    platformStatus = 'critical'
  }

  const alerts: AdminOverviewAlert[] = []
  if (workerHealth?.status === 'degraded') {
    alerts.push({
      id: 'alt_worker_degraded',
      level: 'high',
      module: 'worker',
      title: 'Worker health degraded, check queue and connectivity.',
      created_at: new Date().toISOString(),
      tenant_id: options?.tenantId || PLATFORM_SCOPE_ID,
    })
  }
  if (jobsSummary.failed > 0) {
    alerts.push({
      id: 'alt_failed_jobs',
      level: jobsSummary.failed >= 5 ? 'critical' : 'medium',
      module: 'jobs',
      title: `${jobsSummary.failed} failed jobs detected in the current window.`,
      created_at: new Date().toISOString(),
      tenant_id: options?.tenantId || PLATFORM_SCOPE_ID,
    })
  }

  const pluginErrors = pluginState.definitions.filter((item) => item.status === 'error')
  if (pluginErrors.length > 0) {
    alerts.push({
      id: 'alt_plugin_error',
      level: 'high',
      module: 'plugins',
      title: `${pluginErrors.length} plugins are currently in error status.`,
      created_at: new Date().toISOString(),
      tenant_id: options?.tenantId || PLATFORM_SCOPE_ID,
    })
  }

  const recentChanges: AdminRecentChange[] = auditEvents.slice(0, 6).map((event) => ({
    id: event.id,
    module: event.module,
    actor: event.actor,
    action: event.action,
    target: event.target,
    changed_at: event.created_at,
    risk_level: event.risk_level,
  }))

  return {
    ...EMPTY_OVERVIEW,
    health: {
      platform_status: platformStatus,
      active_tenants: options?.tenantScoped ? 1 : activeTenants,
      active_projects: activeProjects,
      running_jobs: jobsSummary.running,
      failed_jobs: jobsSummary.failed,
      plugin_enabled_count: pluginEnabledCount,
    },
    alerts,
    recent_changes: recentChanges,
  }
}
