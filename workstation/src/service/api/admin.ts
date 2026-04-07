import request from '../request'
import { getProjects } from './projects'
import { getWorkerHealth } from './worker'

export type AdminDataScope = {
  organizationScoped?: boolean
  organizationId?: string
}

export type AdminOverviewAlert = {
  id: string
  level: 'low' | 'medium' | 'high' | 'critical'
  module: string
  title: string
  created_at: string
  organization_id: string
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
    active_organizations: number
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
  first_name: string
  last_name: string
  display_name: string
  role_id: string
  role_code: string
  role_name: string
  organization_id: string
  organization_name: string
  status: 'active' | 'locked' | 'pending'
  status_raw: string
  mfa_enabled: boolean
  last_login_at: string
}

export type AdminUserRoleOption = {
  value: string
  label: string
}

export type AdminUserRoleRecord = {
  id: string
  code: string
  name: string
}

export type AdminScopeOption = {
  value: string
  label: string
}

export type AdminUserCreateInput = {
  email: string
  password: string
  firstName?: string
  lastName?: string
  roleId?: string
  organizationId?: string
  status?: 'active' | 'locked' | 'pending'
}

export type AdminUserUpdateInput = {
  firstName?: string
  lastName?: string
  roleId?: string
  organizationId?: string
  status?: 'active' | 'locked' | 'pending'
}

export type AdminOrganizationNodeType = string

export type AdminOrganizationStatus = 'active' | 'inactive'

export type AdminOrganizationRecord = {
  id: string
  organization_id: string
  organization_name: string
  parent_id: string
  parent_name: string
  name: string
  code: string
  node_type: AdminOrganizationNodeType
  owner_user_id: string
  owner_name: string
  status: AdminOrganizationStatus
  member_count: number
  project_count: number
  policy_summary: string
  depth: number
  children_count: number
  created_at: string
  updated_at: string
}

export type AdminOrganizationOption = {
  value: string
  label: string
  organization_id: string
  status: AdminOrganizationStatus
}

export type AdminOrganizationsPayload = {
  nodes: AdminOrganizationRecord[]
  scopeOptions: AdminScopeOption[]
  organizationOptions: AdminOrganizationOption[]
  organizationTypeRecords: AdminOrganizationTypeRecord[]
  organizationTypeOptions: AdminOrganizationTypeOption[]
}

export type AdminOrganizationCreateInput = {
  organizationId?: string
  name: string
  code?: string
  nodeType?: AdminOrganizationNodeType
  parentId?: string
  ownerUserId?: string
  status?: AdminOrganizationStatus
}

export type AdminOrganizationUpdateInput = {
  name?: string
  code?: string
  nodeType?: AdminOrganizationNodeType
  parentId?: string
  status?: AdminOrganizationStatus
}

export type AdminMemberType = 'internal' | 'contractor' | 'partner'
export type AdminMemberRelationType = 'primary' | 'secondary'
export type AdminMemberAnomaly = 'no_primary_org' | 'multi_primary_conflict' | 'inactive_org_binding'

export type AdminMemberAffiliationRecord = {
  id: string
  org_unit_id: string
  org_unit_name: string
  relation_type: AdminMemberRelationType
  status: AdminOrganizationStatus
  is_manager: boolean
}

export type AdminMemberRecord = {
  id: string
  user_id: string
  email: string
  display_name: string
  organization_id: string
  organization_name: string
  member_type: AdminMemberType
  management_roles: string[]
  primary_org_unit_id: string
  primary_org_unit_name: string
  secondary_org_units: Array<{ id: string; name: string }>
  project_count: number
  owned_project_count: number
  anomaly_flags: AdminMemberAnomaly[]
  affiliations: AdminMemberAffiliationRecord[]
  status: AdminOrganizationStatus
}

export type AdminMembersPayload = {
  members: AdminMemberRecord[]
  scopeOptions: AdminScopeOption[]
  organizationOptions: AdminOrganizationOption[]
  memberTypeOptions: AdminUserRoleOption[]
}

export type AdminMemberAffiliationCreateInput = {
  userId: string
  organizationId: string
  orgUnitId: string
  relationType: AdminMemberRelationType
  memberType?: AdminMemberType
  isManager?: boolean
}

export type AdminMemberPrimaryUpdateInput = {
  userId: string
  organizationId: string
  orgUnitId: string
}

export type AdminMemberSecondaryCreateInput = {
  userId: string
  organizationId: string
  orgUnitId: string
  isManager?: boolean
}

export type AdminRoleRecord = {
  id: string
  code: string
  name: string
  scope: 'platform' | 'organization'
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  permissions: string[]
  updated_at: string
}

export type AdminProjectRecord = {
  id: string
  slug: string
  name: string
  organization_id: string
  organization_name: string
  owner_org_unit_id?: string
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
  scope_type: 'platform' | 'organization' | 'project'
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
  scope_type: 'platform' | 'organization' | 'project'
  scope_id: string
  created_at: string
}

export type AdminOrganizationTypeRecord = {
  id: string
  code: string
  name: string
  status: AdminOrganizationStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export type AdminOrganizationTypeOption = {
  value: string
  label: string
  code: string
  disabled?: boolean
}

export type AdminOrganizationTypeCreateInput = {
  name: string
  code?: string
  status?: AdminOrganizationStatus
}

export type AdminOrganizationTypeUpdateInput = {
  name?: string
  code?: string
  status?: AdminOrganizationStatus
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

type AdminFallbackStore = {
  initialized: boolean
  organizations: AdminOrganizationRecord[]
  members: AdminMemberRecord[]
  scopeOptions: AdminScopeOption[]
  organizationTypes: AdminOrganizationTypeRecord[]
}

const EMPTY_OVERVIEW: AdminOverviewPayload = {
  health: {
    platform_status: 'healthy',
    active_organizations: 0,
    active_projects: 0,
    running_jobs: 0,
    failed_jobs: 0,
    plugin_enabled_count: 0,
  },
  alerts: [],
  recent_changes: [],
}

const PLATFORM_SCOPE_ID = 'organization_global'
const ORG_COLLECTION_PATH = '/items/org_units'
const ORG_MEMBERSHIP_COLLECTION_PATH = '/items/org_memberships'
const ORG_TYPE_COLLECTION_PATH = '/items/org_types'
const ORG_SCOPE_FIELD = 'organization_id'
const DEFAULT_ORGANIZATION_TYPE_NAMES = [
  '公司',
  '办事处',
  '区域大区',
  '事业部',
  '职能部门',
  '小组',
  '团队',
  '项目组',
  '虚拟组织',
]
const adminFallbackStore: AdminFallbackStore = {
  initialized: false,
  organizations: [],
  members: [],
  scopeOptions: [],
  organizationTypes: [],
}

const ORGANIZATION_TYPES_CACHE_TTL_MS = 10000
let organizationTypesInFlightPromise: Promise<AdminOrganizationTypeRecord[]> | null = null
let organizationTypesCacheAt = 0

const invalidateOrganizationTypesCache = () => {
  organizationTypesInFlightPromise = null
  organizationTypesCacheAt = 0
}

const safeString = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return fallback
}

const toErrorText = (error: any): string => {
  const message = safeString(error?.message)
  const responseText = safeString(error?.response?.data?.errors?.[0]?.message || error?.response?.data?.message)
  const raw = safeString(error?.response?.data ? JSON.stringify(error.response.data) : '')
  return [message, responseText, raw].filter(Boolean).join(' ').toLowerCase()
}

const isPermissionDeniedError = (error: any): boolean => {
  const status = Number(error?.status || error?.response?.status || 0)
  const code = safeString(error?.code).toLowerCase()
  const message = toErrorText(error)
  if (status === 403 || code === 'forbidden') return true
  if (message.includes("don't have permission to access collection")) return true
  if (message.includes('no permission')) return true
  if (message.includes('forbidden')) return true
  return false
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

const fetchScopeOptionsResponse = async (): Promise<unknown> => {
  const rowsResponse = await safeRequest(() =>
    request.get(
      ORG_COLLECTION_PATH,
      {
        limit: -1,
        fields: 'id,name,parent_id,organization_id,organization_id.id,organization_id.name',
      },
      { showError: false }
    )
  )
  const rows = toArray<any>(rowsResponse)
  const scopeById = new Map<string, { id: string; name: string }>()

  rows.forEach((row) => {
    const scopeRef = row?.organization_id
    const scopeId = safeString(scopeRef?.id || scopeRef)
    if (!scopeId) return
    const isRoot = !safeString(row?.parent_id?.id || row?.parent_id)
    const scopeNameCandidate = safeString(scopeRef?.name || (isRoot ? row?.name : '') || scopeRef || scopeId)
    const existing = scopeById.get(scopeId)
    if (!existing) {
      scopeById.set(scopeId, { id: scopeId, name: scopeNameCandidate || scopeId })
      return
    }
    if ((!existing.name || existing.name === existing.id) && scopeNameCandidate) {
      existing.name = scopeNameCandidate
    }
  })

  return Array.from(scopeById.values())
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
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value?.id === 'string') return value.id
  if (typeof value?.id === 'number' && Number.isFinite(value.id)) return String(value.id)
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

const normalizeOrganizationScope = <T extends { organization_id?: string; organization_name?: string }>(
  rows: T[],
  options?: AdminDataScope
) => {
  if (!options?.organizationScoped) return rows

  const organizationId = options.organizationId || ''
  if (!organizationId) return rows

  return rows.filter((item) => item.organization_id === organizationId || item.organization_name === organizationId)
}

const normalizeScopeType = (scopeType?: string): 'platform' | 'organization' | 'project' => {
  const normalized = String(scopeType || '').toLowerCase()
  if (normalized === 'organization') return 'organization'
  if (normalized === 'project') return 'project'
  return 'platform'
}

const normalizeUserStatus = (rawStatus: string): AdminUserRecord['status'] => {
  const normalized = String(rawStatus || '').toLowerCase()
  if (['suspended', 'blocked', 'locked', 'inactive'].includes(normalized)) return 'locked'
  if (['invited', 'pending'].includes(normalized)) return 'pending'
  return 'active'
}

const toDirectusUserStatus = (status: AdminUserRecord['status'] = 'active'): string => {
  if (status === 'locked') return 'suspended'
  if (status === 'pending') return 'invited'
  return 'active'
}

const normalizeOrganizationStatus = (value: unknown): AdminOrganizationStatus => {
  const normalized = safeString(value, 'active').toLowerCase()
  if (['inactive', 'disabled', 'archived', 'suspended'].includes(normalized)) return 'inactive'
  return 'active'
}

const normalizeOrganizationType = (value: unknown): AdminOrganizationNodeType => {
  const normalized = safeString(value, '').trim()
  return normalized || '职能部门'
}

const normalizeMemberType = (value: unknown): AdminMemberType => {
  const normalized = safeString(value, 'internal').toLowerCase()
  if (normalized === 'contractor') return 'contractor'
  if (normalized === 'partner') return 'partner'
  return 'internal'
}

const normalizeMemberRelationType = (value: unknown, isPrimary?: boolean): AdminMemberRelationType => {
  const normalized = safeString(value).toLowerCase()
  if (normalized === 'primary') return 'primary'
  if (normalized === 'secondary') return 'secondary'
  return isPrimary ? 'primary' : 'secondary'
}

const shouldUseFallbackAdapter = (error: any): boolean => {
  const status = Number(error?.status || error?.response?.status || 0)
  const code = safeString(error?.code).toLowerCase()
  const message = toErrorText(error)
  if (status === 403 || status === 404 || code === 'forbidden') return true
  if (message.includes('does not exist')) return true
  if (message.includes('unknown field')) return true
  if (message.includes('not a valid field')) return true
  if (message.includes('invalid payload')) return true
  if (message.includes('invalid query')) return true
  if (message.includes("don't have permission to access collection")) return true
  if (message.includes('no permission')) return true
  return false
}

const toScopeOptions = (
  users: AdminUserRecord[],
  projects: AdminProjectRecord[],
  organizationsResponse: unknown
): AdminScopeOption[] => {
  const fromOrganizations = toArray<any>(organizationsResponse).map((item) => ({
    value: safeString(item?.id || item?.code || item?.slug || item?.name),
    label: safeString(item?.name || item?.code || item?.slug || item?.id),
  }))
  const fromUsers = users.map((item) => ({
    value: item.organization_id || item.organization_name,
    label: item.organization_name || item.organization_id,
  }))
  const fromProjects = projects.map((item) => ({
    value: item.organization_id || item.organization_name,
    label: item.organization_name || item.organization_id,
  }))

  return Array.from(
    new Map(
      [...fromOrganizations, ...fromUsers, ...fromProjects]
        .filter((item) => item.value)
        .map((item) => [item.value, { value: item.value, label: item.label }])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label))
}

const decorateOrganizationNodes = (nodes: AdminOrganizationRecord[]): AdminOrganizationRecord[] => {
  const byId = new Map(nodes.map((item) => [item.id, item]))
  const childCountMap = new Map<string, number>()

  nodes.forEach((node) => {
    if (!node.parent_id) return
    childCountMap.set(node.parent_id, (childCountMap.get(node.parent_id) || 0) + 1)
  })

  const resolveDepth = (node: AdminOrganizationRecord): number => {
    let depth = 0
    let parentId = node.parent_id
    let guard = 0
    while (parentId && byId.has(parentId) && guard < 20) {
      depth += 1
      parentId = byId.get(parentId)?.parent_id || ''
      guard += 1
    }
    return depth
  }

  return nodes.map((node) => {
    const parent = node.parent_id ? byId.get(node.parent_id) : null
    return {
      ...node,
      parent_name: node.parent_name || parent?.name || '-',
      depth: resolveDepth(node),
      children_count: childCountMap.get(node.id) || 0,
    }
  })
}

const toOrganizationOptions = (nodes: AdminOrganizationRecord[]): AdminOrganizationOption[] => {
  return nodes
    .map((item) => ({
      value: item.id,
      label: `${item.name} (${item.code})`,
      organization_id: item.organization_id,
      status: item.status,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const toOrganizationTypeOption = (record: AdminOrganizationTypeRecord): AdminOrganizationTypeOption => ({
  value: record.code,
  label: record.name,
  code: record.code,
  disabled: record.status !== 'active',
})

const normalizeOrganizationTypeRecord = (item: any, fallbackSortOrder = 0): AdminOrganizationTypeRecord => {
  const name = safeString(item?.name || item?.label, '')
  return {
    id: safeString(item?.id || item?.code || toRoleToken(name)),
    code: safeString(item?.code || toRoleToken(name)),
    name: name || safeString(item?.code || item?.id, '未命名类型'),
    status: normalizeOrganizationStatus(item?.status),
    sort_order: Number(item?.sort_order ?? fallbackSortOrder) || fallbackSortOrder,
    created_at: formatDate(item?.date_created),
    updated_at: formatDate(item?.date_updated || item?.date_created),
  }
}

const sortOrganizationTypes = (rows: AdminOrganizationTypeRecord[]): AdminOrganizationTypeRecord[] => {
  return [...rows].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })
}

const buildDefaultOrganizationTypeRecords = (): AdminOrganizationTypeRecord[] => {
  return DEFAULT_ORGANIZATION_TYPE_NAMES.map((name, index) => ({
    id: `fallback_org_type_${index + 1}`,
    code: toRoleToken(name) || `org_type_${index + 1}`,
    name,
    status: 'active',
    sort_order: index + 1,
    created_at: '-',
    updated_at: '-',
  }))
}

const buildFallbackOrganizations = (
  users: AdminUserRecord[],
  projects: AdminProjectRecord[],
  scopeOptions: AdminScopeOption[]
): AdminOrganizationRecord[] => {
  const projectCountByOrganization = new Map<string, number>()
  projects.forEach((item) => {
    const key = item.organization_id || item.organization_name
    if (!key) return
    projectCountByOrganization.set(key, (projectCountByOrganization.get(key) || 0) + 1)
  })

  const userByOrganization = new Map<string, AdminUserRecord[]>()
  users.forEach((user) => {
    const key = user.organization_id || user.organization_name
    if (!key) return
    if (!userByOrganization.has(key)) userByOrganization.set(key, [])
    userByOrganization.get(key)?.push(user)
  })

  return scopeOptions.map((organization) => {
    const organizationUsers = userByOrganization.get(organization.value) || []
    const owner = organizationUsers.find((item) => item.role_code === 'organization_admin') || organizationUsers[0]
    const codeToken = toRoleToken(organization.label || organization.value).toUpperCase() || 'ORG'

    return {
      id: `fallback_org_${toRoleToken(organization.value || organization.label) || 'organization'}`,
      organization_id: organization.value,
      organization_name: organization.label,
      parent_id: '',
      parent_name: '-',
      name: organization.label,
      code: `${codeToken}_ROOT`,
      node_type: '公司',
      owner_user_id: owner?.id || '',
      owner_name: owner?.display_name || owner?.email || '-',
      status: 'active',
      member_count: organizationUsers.length,
      project_count: projectCountByOrganization.get(organization.value) || 0,
      policy_summary: 'inheritRoleDownwardByDefault=false; inheritPermissionUpward=false',
      depth: 0,
      children_count: 0,
      created_at: '-',
      updated_at: '-',
    }
  })
}

const buildMemberAnomalyFlags = (affiliations: AdminMemberAffiliationRecord[]): AdminMemberAnomaly[] => {
  const flags: AdminMemberAnomaly[] = []
  const primaryCount = affiliations.filter((item) => item.relation_type === 'primary').length
  if (primaryCount === 0) flags.push('no_primary_org')
  if (primaryCount > 1) flags.push('multi_primary_conflict')
  if (affiliations.some((item) => item.status === 'inactive')) flags.push('inactive_org_binding')
  return flags
}

const withNormalizedMemberShape = (member: AdminMemberRecord): AdminMemberRecord => {
  const primaryAffiliations = member.affiliations.filter((item) => item.relation_type === 'primary')
  const secondaryAffiliations = member.affiliations.filter((item) => item.relation_type === 'secondary')
  const primary = primaryAffiliations[0]

  return {
    ...member,
    primary_org_unit_id: primary?.org_unit_id || '',
    primary_org_unit_name: primary?.org_unit_name || '',
    secondary_org_units: secondaryAffiliations.map((item) => ({
      id: item.org_unit_id,
      name: item.org_unit_name,
    })),
    anomaly_flags: buildMemberAnomalyFlags(member.affiliations),
    status: member.affiliations.some((item) => item.status === 'active') ? 'active' : 'inactive',
  }
}

const buildFallbackMembers = (
  users: AdminUserRecord[],
  organizations: AdminOrganizationRecord[],
  projects: AdminProjectRecord[]
): AdminMemberRecord[] => {
  const projectByOrganization = new Map<string, AdminProjectRecord[]>()
  projects.forEach((item) => {
    const key = item.organization_id || item.organization_name
    if (!key) return
    if (!projectByOrganization.has(key)) projectByOrganization.set(key, [])
    projectByOrganization.get(key)?.push(item)
  })

  return users.map((user) => {
    const organizationKey = user.organization_id || user.organization_name
    const matchedOrganizations = organizations.filter(
      (item) =>
        (item.organization_id === organizationKey || item.organization_name === organizationKey) &&
        item.status === 'active'
    )
    const preferredPrimary =
      matchedOrganizations.find((item) => item.owner_user_id && item.owner_user_id === user.id) ||
      matchedOrganizations[0]
    const primaryAffiliation: AdminMemberAffiliationRecord[] = preferredPrimary
      ? [
          {
            id: `fallback_rel_${user.id}_${preferredPrimary.id}`,
            org_unit_id: preferredPrimary.id,
            org_unit_name: preferredPrimary.name,
            relation_type: 'primary',
            status: preferredPrimary.status,
            is_manager: preferredPrimary.owner_user_id === user.id,
          },
        ]
      : []

    const organizationProjects = projectByOrganization.get(organizationKey) || []
    const ownedProjectCount = organizationProjects.filter(
      (project) => project.owner_user === user.email || project.owner_user === user.display_name
    ).length

    const managementRoles = [] as string[]
    if (user.role_code === 'organization_admin') {
      managementRoles.push('organization_admin')
    }
    if (preferredPrimary?.owner_user_id === user.id) {
      managementRoles.push('org_owner')
    }

    return withNormalizedMemberShape({
      id: `fallback_member_${user.id}`,
      user_id: user.id,
      email: user.email,
      display_name: user.display_name || user.email,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
      member_type: 'internal',
      management_roles: managementRoles,
      primary_org_unit_id: preferredPrimary?.id || '',
      primary_org_unit_name: preferredPrimary?.name || '',
      secondary_org_units: [],
      project_count: ownedProjectCount,
      owned_project_count: ownedProjectCount,
      anomaly_flags: [],
      affiliations: primaryAffiliation,
      status: user.status === 'active' ? 'active' : 'inactive',
    })
  })
}

const mutateFallbackMembers = (updater: (rows: AdminMemberRecord[]) => AdminMemberRecord[]): AdminMemberRecord[] => {
  adminFallbackStore.members = updater(adminFallbackStore.members).map(withNormalizedMemberShape)
  return adminFallbackStore.members
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

const ensureSeedOrganizationTypes = async (): Promise<AdminOrganizationTypeRecord[]> => {
  const seedPayload = DEFAULT_ORGANIZATION_TYPE_NAMES.map((name, index) => ({
    name,
    code: toRoleToken(name),
    status: 'active',
    sort_order: index + 1,
  }))

  await Promise.all(
    seedPayload.map((item) => safeRequest(() => request.post(ORG_TYPE_COLLECTION_PATH, item, { showError: false })))
  )

  const seededResponse = await safeRequest(() =>
    request.get(
      ORG_TYPE_COLLECTION_PATH,
      { limit: -1, fields: 'id,code,name,status,sort_order,date_created,date_updated' },
      { showError: false }
    )
  )
  const seededRows = toArray<any>(seededResponse).map((item, index) => normalizeOrganizationTypeRecord(item, index + 1))
  return sortOrganizationTypes(seededRows)
}

export const fetchAdminOrganizationTypes = async (): Promise<AdminOrganizationTypeRecord[]> => {
  const cacheIsFresh =
    organizationTypesCacheAt > 0 && Date.now() - organizationTypesCacheAt < ORGANIZATION_TYPES_CACHE_TTL_MS
  if (cacheIsFresh && adminFallbackStore.organizationTypes.length) {
    return sortOrganizationTypes(adminFallbackStore.organizationTypes)
  }

  if (organizationTypesInFlightPromise) {
    return organizationTypesInFlightPromise
  }

  organizationTypesInFlightPromise = (async () => {
    const response = await safeRequest(() =>
      request.get(
        ORG_TYPE_COLLECTION_PATH,
        { limit: -1, fields: 'id,code,name,status,sort_order,date_created,date_updated' },
        { showError: false }
      )
    )
    let rows = toArray<any>(response).map((item, index) => normalizeOrganizationTypeRecord(item, index + 1))

    if (!rows.length) {
      rows = await ensureSeedOrganizationTypes()
    }

    if (!rows.length) {
      if (!adminFallbackStore.organizationTypes.length) {
        adminFallbackStore.organizationTypes = buildDefaultOrganizationTypeRecords()
      }
      organizationTypesCacheAt = Date.now()
      return sortOrganizationTypes(adminFallbackStore.organizationTypes)
    }

    adminFallbackStore.organizationTypes = sortOrganizationTypes(rows)
    organizationTypesCacheAt = Date.now()
    return adminFallbackStore.organizationTypes
  })()

  try {
    return await organizationTypesInFlightPromise
  } finally {
    organizationTypesInFlightPromise = null
  }
}

export const createAdminOrganizationType = async (input: AdminOrganizationTypeCreateInput): Promise<void> => {
  invalidateOrganizationTypesCache()
  const payload = {
    name: input.name,
    code: input.code || toRoleToken(input.name),
    status: input.status || 'active',
    sort_order: adminFallbackStore.organizationTypes.length + 1,
  }

  try {
    await request.post(ORG_TYPE_COLLECTION_PATH, payload, { showError: false })
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  adminFallbackStore.organizationTypes = sortOrganizationTypes([
    ...adminFallbackStore.organizationTypes,
    {
      id: `fallback_org_type_${Date.now()}`,
      code: payload.code,
      name: payload.name,
      status: normalizeOrganizationStatus(payload.status),
      sort_order: payload.sort_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])
}

export const updateAdminOrganizationType = async (
  typeId: string,
  input: AdminOrganizationTypeUpdateInput
): Promise<void> => {
  invalidateOrganizationTypesCache()
  const payload: Record<string, unknown> = {}
  if ('name' in input && input.name) payload.name = input.name
  if ('code' in input && input.code) payload.code = input.code
  if ('status' in input && input.status) payload.status = input.status

  try {
    await request.patch(`${ORG_TYPE_COLLECTION_PATH}/${typeId}`, payload, { showError: false })
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  adminFallbackStore.organizationTypes = sortOrganizationTypes(
    adminFallbackStore.organizationTypes.map((item) =>
      item.id === typeId
        ? {
            ...item,
            name: input.name || item.name,
            code: input.code || item.code,
            status: input.status || item.status,
            updated_at: new Date().toISOString(),
          }
        : item
    )
  )
}

export const reorderAdminOrganizationTypes = async (orderedTypeIds: string[]): Promise<void> => {
  invalidateOrganizationTypesCache()
  const patchTasks = orderedTypeIds.map((id, index) =>
    request.patch(`${ORG_TYPE_COLLECTION_PATH}/${id}`, { sort_order: index + 1 }, { showError: false })
  )
  try {
    await Promise.all(patchTasks)
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  const orderMap = new Map(orderedTypeIds.map((id, index) => [id, index + 1]))
  adminFallbackStore.organizationTypes = sortOrganizationTypes(
    adminFallbackStore.organizationTypes.map((item) => ({
      ...item,
      sort_order: orderMap.get(item.id) || item.sort_order,
      updated_at: new Date().toISOString(),
    }))
  )
}

export const deleteAdminOrganizationType = async (typeId: string): Promise<void> => {
  invalidateOrganizationTypesCache()
  try {
    await request.delete(`${ORG_TYPE_COLLECTION_PATH}/${typeId}`, {}, { showError: false })
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  adminFallbackStore.organizationTypes = sortOrganizationTypes(
    adminFallbackStore.organizationTypes
      .filter((item) => item.id !== typeId)
      .map((item, index) => ({
        ...item,
        sort_order: index + 1,
        updated_at: new Date().toISOString(),
      }))
  )
}

const fetchPluginState = async (): Promise<{
  registry: WorkerRegistryRecord[]
  installations: WorkerInstallationRecord[]
}> => {
  const [registryResponse, installationsResponse] = await Promise.all([
    safeRequest(() => request.get('/worker-api/plugins/registry', {}, { showError: false })),
    safeRequest(() =>
      request.get('/worker-api/plugins/installations', { includeManifest: true }, { showError: false })
    ),
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
    options?.organizationScoped && options.organizationId
      ? installations.filter((item) => safeString(item.scope_id) === options.organizationId)
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
  const response = await safeRequest(() =>
    request.get('/activity', { limit, sort: '-timestamp' }, { showError: false })
  )

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

const fetchDirectusUsersResponse = async (): Promise<unknown> => {
  const baseFields = 'id,email,first_name,last_name,status,last_access,last_login_at,role,tfa_secret,mfa_enabled'
  return request.get('/users', { limit: -1, fields: `${baseFields},organization` }, { showError: false })
}

export const fetchAdminUsers = async (
  options?: AdminDataScope
): Promise<{
  users: AdminUserRecord[]
  roleOptions: Array<{ value: string; label: string }>
  roleRecords: AdminUserRoleRecord[]
  scopeOptions: AdminScopeOption[]
}> => {
  const usersResponse = await fetchDirectusUsersResponse()
  const [rolesResponse, organizationsResponse] = await Promise.all([
    safeRequest(() => request.get('/roles', { limit: -1, fields: 'id,name' }, { showError: false })),
    fetchScopeOptionsResponse(),
  ])

  const roleMap = new Map<string, AdminUserRoleRecord>()
  toArray<any>(rolesResponse).forEach((role) => {
    const roleId = safeString(role?.id)
    if (!roleId) return
    const roleName = safeString(role?.name, roleId)
    roleMap.set(roleId, {
      id: roleId,
      code: toRoleToken(roleName || roleId) || roleId,
      name: roleName,
    })
  })

  const mapped = toArray<any>(usersResponse).map<AdminUserRecord>((item) => {
    const roleId = extractId(item?.role)
    const roleName = extractName(item?.role) || roleMap.get(roleId)?.name || roleId || 'User'
    const roleCode = toRoleToken(roleName || roleId || 'user')
    const rawOrganization = item?.organization
    const organizationId = extractId(rawOrganization) || safeString(rawOrganization)
    const organizationName = extractName(rawOrganization) || safeString(rawOrganization, 'Platform')
    const firstName = safeString(item?.first_name)
    const lastName = safeString(item?.last_name)
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ') || safeString(item?.display_name) || safeString(item?.email)
    const statusRaw = safeString(item?.status, 'active').toLowerCase()
    const status = normalizeUserStatus(statusRaw)

    return {
      id: safeString(item?.id),
      email: safeString(item?.email),
      first_name: firstName,
      last_name: lastName,
      display_name: displayName || safeString(item?.id),
      role_id: roleId,
      role_code: roleCode || 'user',
      role_name: roleName || 'User',
      organization_id: organizationId,
      organization_name: organizationName || 'Platform',
      status,
      status_raw: statusRaw || 'active',
      mfa_enabled: Boolean(item?.mfa_enabled || item?.tfa_secret),
      last_login_at: formatDate(item?.last_login_at || item?.last_access),
    }
  })

  const scopedUsers = normalizeOrganizationScope(mapped, options)
  const roleRecords = Array.from(
    new Map(
      [
        ...roleMap.values(),
        ...scopedUsers.map((item) => ({ id: item.role_id, code: item.role_code, name: item.role_name })),
      ]
        .filter((item) => item.id)
        .map((item) => [item.id, item])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name))
  const roleOptions = Array.from(
    new Map(scopedUsers.map((item) => [item.role_code, { value: item.role_code, label: item.role_name }])).values()
  ).sort((a, b) => a.label.localeCompare(b.label))
  const scopeOptions = Array.from(
    new Map(
      [
        ...toArray<any>(organizationsResponse).map((item) => ({
          value: safeString(item?.id || item?.code || item?.slug || item?.name),
          label: safeString(item?.name || item?.code || item?.slug || item?.id),
        })),
        ...scopedUsers.map((item) => ({
          value: item.organization_id,
          label: item.organization_name || item.organization_id,
        })),
      ]
        .filter((item) => item.value)
        .map((item) => [item.value, item])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label))

  return {
    users: scopedUsers,
    roleOptions,
    roleRecords,
    scopeOptions,
  }
}

const buildUserWritePayload = (input: Partial<AdminUserCreateInput & AdminUserUpdateInput>) => {
  const payload: Record<string, unknown> = {}

  if ('email' in input && input.email) {
    payload.email = input.email.trim()
  }
  if ('password' in input && input.password) {
    payload.password = input.password
  }
  if ('firstName' in input) {
    payload.first_name = input.firstName || null
  }
  if ('lastName' in input) {
    payload.last_name = input.lastName || null
  }
  if ('roleId' in input && input.roleId) {
    payload.role = input.roleId
  }
  if ('status' in input && input.status) {
    payload.status = toDirectusUserStatus(input.status)
  }

  return payload
}

const submitAdminUserMutation = async (
  method: 'post' | 'patch',
  path: string,
  input: Partial<AdminUserCreateInput & AdminUserUpdateInput>
) => {
  const payload = buildUserWritePayload(input)
  if (method === 'post') {
    await request.post(path, payload, { showError: false })
    return
  }
  await request.patch(path, payload, { showError: false })
}

export const createAdminUser = async (input: AdminUserCreateInput): Promise<void> => {
  await submitAdminUserMutation('post', '/users', input)
}

export const updateAdminUser = async (userId: string, input: AdminUserUpdateInput): Promise<void> => {
  await submitAdminUserMutation('patch', `/users/${userId}`, input)
}

export const resetAdminUserMfa = async (userId: string): Promise<void> => {
  await request.patch(`/users/${userId}`, { mfa_enabled: false, tfa_secret: null }, { showError: false })
}

const fetchOrgUnitsResponse = async (): Promise<unknown> => {
  const baseFields =
    'id,name,code,type,status,path,depth,parent_id,parent_id.id,parent_id.name,manager_user_id,manager_user_id.id,manager_user_id.email,manager_user_id.first_name,manager_user_id.last_name,settings'
  return request.get(
    ORG_COLLECTION_PATH,
    {
      limit: -1,
      fields: `${baseFields},${ORG_SCOPE_FIELD},${ORG_SCOPE_FIELD}.id,${ORG_SCOPE_FIELD}.name`,
    },
    { showError: false }
  )
}

export const fetchAdminOrganizations = async (options?: AdminDataScope): Promise<AdminOrganizationsPayload> => {
  const [
    orgUnitsResponse,
    organizationsResponse,
    usersPayload,
    projects,
    membershipsResponse,
    projectBindingsResponse,
    organizationTypeRecords,
  ] = await Promise.all([
    safeRequest(fetchOrgUnitsResponse),
    fetchScopeOptionsResponse(),
    safeCall(() => fetchAdminUsers(), {
      users: [],
      roleOptions: [],
      roleRecords: [],
      scopeOptions: [],
    } as Awaited<ReturnType<typeof fetchAdminUsers>>),
    safeCall(() => fetchAdminProjects(), [] as AdminProjectRecord[]),
    safeRequest(() =>
      request.get(
        ORG_MEMBERSHIP_COLLECTION_PATH,
        {
          limit: -1,
          fields: 'id,org_unit_id,org_unit_id.id,status',
        },
        { showError: false }
      )
    ),
    safeRequest(() =>
      request.get(
        '/items/projects',
        { limit: -1, fields: 'id,owner_org_unit_id,owner_org_unit_id.id' },
        { showError: false }
      )
    ),
    safeCall(() => fetchAdminOrganizationTypes(), [] as AdminOrganizationTypeRecord[]),
  ])

  const scopeOptions = toScopeOptions(usersPayload.users, projects, organizationsResponse)
  const rows = toArray<any>(orgUnitsResponse)
  const memberCountByOrg = new Map<string, number>()
  toArray<any>(membershipsResponse).forEach((item) => {
    if (normalizeOrganizationStatus(item?.status) !== 'active') return
    const orgId = extractId(item?.org_unit_id) || safeString(item?.org_unit_id)
    if (!orgId) return
    memberCountByOrg.set(orgId, (memberCountByOrg.get(orgId) || 0) + 1)
  })
  const projectCountByOrg = new Map<string, number>()
  toArray<any>(projectBindingsResponse).forEach((item) => {
    const orgId = extractId(item?.owner_org_unit_id) || safeString(item?.owner_org_unit_id)
    if (!orgId) return
    projectCountByOrg.set(orgId, (projectCountByOrg.get(orgId) || 0) + 1)
  })

  let nodes: AdminOrganizationRecord[] = rows.map((item) => {
    const organization = item?.organization_id
    const manager =
      item?.manager_user_id ||
      item?.owner_user_id ||
      item?.owner_user ||
      item?.manager ||
      item?.leader
    const parent = item?.parent_id || item?.parent
    const organizationId = extractId(organization) || safeString(organization)
    const organizationName = extractName(organization) || organizationId || 'Platform'

    return {
      id: safeString(item?.id),
      organization_id: organizationId,
      organization_name: organizationName,
      parent_id: extractId(parent) || safeString(parent),
      parent_name: extractName(parent) || '',
      name: safeString(item?.name, safeString(item?.id)),
      code: safeString(
        item?.code,
        toRoleToken(safeString(item?.name, safeString(item?.id))).toUpperCase()
      ).toUpperCase(),
      node_type: normalizeOrganizationType(item?.type || item?.node_type),
      owner_user_id: extractId(manager) || safeString(manager),
      owner_name:
        extractName(manager) || safeString(manager?.email) || safeString(manager?.name) || safeString(manager) || '-',
      status: normalizeOrganizationStatus(item?.status),
      member_count: Number(
        item?.member_count ?? item?.members_count ?? memberCountByOrg.get(safeString(item?.id)) ?? 0
      ),
      project_count: Number(
        item?.project_count ?? item?.projects_count ?? projectCountByOrg.get(safeString(item?.id)) ?? 0
      ),
      policy_summary: 'inheritRoleDownwardByDefault=false; inheritPermissionUpward=false',
      depth: Number(item?.depth ?? 0) || 0,
      children_count: Number(item?.children_count ?? 0),
      created_at: formatDate(item?.date_created),
      updated_at: formatDate(item?.date_updated || item?.date_created),
    }
  })

  if (rows.length === 0) {
    if (!adminFallbackStore.initialized) {
      adminFallbackStore.organizations = buildFallbackOrganizations(usersPayload.users, projects, scopeOptions)
      adminFallbackStore.scopeOptions = scopeOptions
      adminFallbackStore.initialized = true
    }
    nodes = adminFallbackStore.organizations
  }

  const decorated = decorateOrganizationNodes(nodes)
  const scopedNodes = normalizeOrganizationScope(decorated, options)
  const scopedScopeOptions = options?.organizationScoped
    ? scopeOptions.filter((item) => item.value === options.organizationId || item.label === options.organizationId)
    : scopeOptions
  adminFallbackStore.organizations = decorated
  adminFallbackStore.scopeOptions = scopeOptions

  return {
    nodes: scopedNodes.sort((a, b) => {
      const organizationCmp = (a.organization_name || '').localeCompare(b.organization_name || '')
      if (organizationCmp !== 0) return organizationCmp
      if (a.depth !== b.depth) return a.depth - b.depth
      return (a.name || '').localeCompare(b.name || '')
    }),
    scopeOptions: scopedScopeOptions,
    organizationOptions: toOrganizationOptions(scopedNodes),
    organizationTypeRecords: organizationTypeRecords,
    organizationTypeOptions: organizationTypeRecords.map(toOrganizationTypeOption),
  }
}

const buildOrganizationWritePayload = (
  input: Partial<AdminOrganizationCreateInput & AdminOrganizationUpdateInput & { ownerUserId?: string }>,
  scopeField: 'organization_id' = ORG_SCOPE_FIELD
) => {
  const payload: Record<string, unknown> = {}
  if ('organizationId' in input && input.organizationId) payload[scopeField] = input.organizationId
  if ('name' in input && input.name) payload.name = input.name
  if ('code' in input && input.code) payload.code = String(input.code).toUpperCase()
  if ('nodeType' in input && input.nodeType) payload.type = input.nodeType
  if ('parentId' in input) payload.parent_id = input.parentId || null
  if ('status' in input && input.status) payload.status = input.status
  if ('ownerUserId' in input) payload.manager_user_id = input.ownerUserId || null
  return payload
}

const mutateFallbackOrganization = (
  updater: (rows: AdminOrganizationRecord[]) => AdminOrganizationRecord[]
): AdminOrganizationRecord[] => {
  adminFallbackStore.organizations = decorateOrganizationNodes(updater(adminFallbackStore.organizations))
  return adminFallbackStore.organizations
}

const collectDescendantIds = (rows: AdminOrganizationRecord[], orgId: string): Set<string> => {
  const descendants = new Set<string>()
  const queue = [orgId]
  while (queue.length) {
    const currentId = queue.shift()
    rows.forEach((item) => {
      if (item.parent_id === currentId && !descendants.has(item.id)) {
        descendants.add(item.id)
        queue.push(item.id)
      }
    })
  }
  return descendants
}

const resolveOrganizationRowsForValidation = async (): Promise<AdminOrganizationRecord[]> => {
  if (adminFallbackStore.organizations.length) return adminFallbackStore.organizations
  try {
    const payload = await fetchAdminOrganizations()
    return payload.nodes
  } catch {
    return adminFallbackStore.organizations
  }
}

const validateOrganizationMutationInput = async (
  mode: 'create' | 'update',
  input: Partial<AdminOrganizationCreateInput & AdminOrganizationUpdateInput>,
  orgId?: string
): Promise<Partial<AdminOrganizationCreateInput & AdminOrganizationUpdateInput>> => {
  const normalizedInput = { ...input }
  const parentId = 'parentId' in input ? safeString(input.parentId).trim() : undefined
  const rows = await resolveOrganizationRowsForValidation()
  const byId = new Map(rows.map((item) => [item.id, item]))
  const parentNode = parentId ? byId.get(parentId) : undefined
  const parentOrganizationId = safeString(parentNode?.organization_id).trim()

  if (mode === 'create' && parentOrganizationId) {
    normalizedInput.organizationId = parentOrganizationId
  }
  if (parentId === undefined || !parentId) return normalizedInput
  if (!parentNode) {
    throw new Error('Invalid parentId: parent does not exist.')
  }

  const targetNode = orgId ? byId.get(orgId) : undefined
  if (mode === 'update' && orgId && !targetNode) {
    throw new Error('Invalid organizationId: target organization does not exist.')
  }

  if (!orgId) return normalizedInput
  if (parentId === orgId) {
    throw new Error('Invalid parentId: an organization cannot be its own parent.')
  }
  const descendants = collectDescendantIds(rows, orgId)
  if (descendants.has(parentId)) {
    throw new Error('Invalid parentId: an organization cannot be attached to its descendant.')
  }

  return normalizedInput
}

const submitAdminOrganizationMutation = async (
  method: 'post' | 'patch',
  path: string,
  input: Partial<AdminOrganizationCreateInput & AdminOrganizationUpdateInput & { ownerUserId?: string }>
) => {
  const payload = buildOrganizationWritePayload(input, ORG_SCOPE_FIELD)
  if (method === 'post') {
    await request.post(path, payload, { showError: false })
    return
  }
  await request.patch(path, payload, { showError: false })
}

export const createAdminOrganization = async (input: AdminOrganizationCreateInput): Promise<void> => {
  const normalizedInput = (await validateOrganizationMutationInput('create', input)) as AdminOrganizationCreateInput
  try {
    await submitAdminOrganizationMutation('post', ORG_COLLECTION_PATH, normalizedInput)
    return
  } catch (error) {
    if (isPermissionDeniedError(error) || !shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackOrganization((rows) => [
    ...rows,
    {
      id: `fallback_org_${Date.now()}`,
      organization_id: normalizedInput.organizationId || '',
      organization_name:
        adminFallbackStore.scopeOptions.find((item) => item.value === normalizedInput.organizationId)?.label ||
        normalizedInput.organizationId ||
        normalizedInput.name,
      parent_id: normalizedInput.parentId || '',
      parent_name: '',
      name: normalizedInput.name,
      code: normalizedInput.code || toRoleToken(normalizedInput.name).toUpperCase(),
      node_type: normalizedInput.nodeType || '职能部门',
      owner_user_id: normalizedInput.ownerUserId || '',
      owner_name: '-',
      status: normalizedInput.status || 'active',
      member_count: 0,
      project_count: 0,
      policy_summary: 'inheritRoleDownwardByDefault=false; inheritPermissionUpward=false',
      depth: 0,
      children_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ])
}

export const updateAdminOrganization = async (orgId: string, input: AdminOrganizationUpdateInput): Promise<void> => {
  await validateOrganizationMutationInput('update', input, orgId)
  try {
    await submitAdminOrganizationMutation('patch', `${ORG_COLLECTION_PATH}/${orgId}`, input)
    return
  } catch (error) {
    if (isPermissionDeniedError(error) || !shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackOrganization((rows) =>
    rows.map((item) =>
      item.id === orgId
        ? {
            ...item,
            name: input.name || item.name,
            code: input.code || item.code,
            parent_id: input.parentId !== undefined ? input.parentId || '' : item.parent_id,
            node_type: input.nodeType || item.node_type,
            status: input.status || item.status,
            updated_at: new Date().toISOString(),
          }
        : item
    )
  )
}

export const setAdminOrganizationOwner = async (orgId: string, ownerUserId: string): Promise<void> => {
  try {
    await request.patch(
      `${ORG_COLLECTION_PATH}/${orgId}`,
      { manager_user_id: ownerUserId || null },
      { showError: false }
    )
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackOrganization((rows) =>
    rows.map((item) =>
      item.id === orgId
        ? {
            ...item,
            owner_user_id: ownerUserId,
            updated_at: new Date().toISOString(),
          }
        : item
    )
  )
}

export const deactivateAdminOrganization = async (orgId: string): Promise<void> => {
  const rows = await resolveOrganizationRowsForValidation()
  const subtreeIds = [orgId, ...Array.from(collectDescendantIds(rows, orgId))]
  const subtreeIdSet = new Set(subtreeIds)

  try {
    await Promise.all(
      subtreeIds.map((id) => request.patch(`${ORG_COLLECTION_PATH}/${id}`, { status: 'inactive' }, { showError: false }))
    )
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackOrganization((rows) =>
    rows.map((item) =>
      subtreeIdSet.has(item.id) ? { ...item, status: 'inactive', updated_at: new Date().toISOString() } : item
    )
  )
}

export const deleteAdminOrganization = async (orgId: string): Promise<void> => {
  const rows = await resolveOrganizationRowsForValidation()
  const byId = new Map(rows.map((item) => [item.id, item]))
  const subtreeIds = [orgId, ...Array.from(collectDescendantIds(rows, orgId))]
  const orderedDeleteIds = [...subtreeIds].sort((a, b) => {
    const depthA = Number(byId.get(a)?.depth || 0)
    const depthB = Number(byId.get(b)?.depth || 0)
    return depthB - depthA
  })

  try {
    for (const id of orderedDeleteIds) {
      await request.delete(`${ORG_COLLECTION_PATH}/${id}`, {}, { showError: false })
    }
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  const descendants = new Set<string>(subtreeIds)
  mutateFallbackOrganization((rows) => rows.filter((item) => !descendants.has(item.id)))
}

const getMemberTypeOptions = (): AdminUserRoleOption[] => {
  return [
    { value: 'internal', label: 'Internal' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'partner', label: 'Partner' },
  ]
}

const buildMemberRecordFromUser = (
  user: AdminUserRecord,
  overrides?: Partial<AdminMemberRecord>
): AdminMemberRecord => {
  return withNormalizedMemberShape({
    id: overrides?.id || `member_${user.id}`,
    user_id: user.id,
    email: user.email,
    display_name: user.display_name || user.email,
    organization_id: user.organization_id,
    organization_name: user.organization_name,
    member_type: overrides?.member_type || 'internal',
    management_roles: overrides?.management_roles || [],
    primary_org_unit_id: overrides?.primary_org_unit_id || '',
    primary_org_unit_name: overrides?.primary_org_unit_name || '',
    secondary_org_units: overrides?.secondary_org_units || [],
    project_count: overrides?.project_count || 0,
    owned_project_count: overrides?.owned_project_count || 0,
    anomaly_flags: overrides?.anomaly_flags || [],
    affiliations: overrides?.affiliations || [],
    status: overrides?.status || (user.status === 'active' ? 'active' : 'inactive'),
  })
}

const fetchOrgMembershipsResponse = async (params: Record<string, any>): Promise<{ response: unknown }> => {
  const response = await request.get(ORG_MEMBERSHIP_COLLECTION_PATH, params, { showError: false })
  return { response }
}

const buildMembershipScopePayload = (
  organizationId: string,
  payload: Record<string, unknown>
): Record<string, unknown> => {
  return {
    ...payload,
    [ORG_SCOPE_FIELD]: organizationId,
  }
}

type AdminMembersPreloadedContext = {
  usersPayload?: Awaited<ReturnType<typeof fetchAdminUsers>>
  orgPayload?: AdminOrganizationsPayload
  projects?: AdminProjectRecord[]
}

export const fetchAdminMembers = async (
  options?: AdminDataScope,
  preloaded?: AdminMembersPreloadedContext
): Promise<AdminMembersPayload> => {
  const [usersPayload, orgPayload, projects, membershipsResponse] = await Promise.all([
    preloaded?.usersPayload
      ? Promise.resolve(preloaded.usersPayload)
      : safeCall(() => fetchAdminUsers(options), {
          users: [],
          roleOptions: [],
          roleRecords: [],
          scopeOptions: [],
        } as Awaited<ReturnType<typeof fetchAdminUsers>>),
    preloaded?.orgPayload
      ? Promise.resolve(preloaded.orgPayload)
      : safeCall(() => fetchAdminOrganizations(options), {
          nodes: [],
          scopeOptions: [],
          organizationOptions: [],
          organizationTypeRecords: [],
          organizationTypeOptions: [],
        } as AdminOrganizationsPayload),
    preloaded?.projects
      ? Promise.resolve(preloaded.projects)
      : safeCall(() => fetchAdminProjects(options), [] as AdminProjectRecord[]),
    safeRequest(() =>
      fetchOrgMembershipsResponse({
        limit: -1,
        fields:
          'id,user_id,user_id.id,user_id.email,user_id.first_name,user_id.last_name,organization_id,organization_id.id,organization_id.name,org_unit_id,org_unit_id.id,org_unit_id.name,org_unit_id.status,membership_type,is_primary,member_type,is_manager,management_roles,status,date_created,date_updated',
      }).then((result) => result.response)
    ),
  ])

  const scopedUsers = normalizeOrganizationScope(usersPayload.users, options)
  const orgById = new Map(orgPayload.nodes.map((item) => [item.id, item]))
  const userById = new Map(scopedUsers.map((item) => [item.id, item]))
  const projectByOrganization = new Map<string, AdminProjectRecord[]>()
  projects.forEach((item) => {
    const key = item.organization_id || item.organization_name
    if (!key) return
    if (!projectByOrganization.has(key)) projectByOrganization.set(key, [])
    projectByOrganization.get(key)?.push(item)
  })

  const relationRows = toArray<any>(membershipsResponse)
  let memberRecords: AdminMemberRecord[] = []

  if (relationRows.length === 0) {
    if (!adminFallbackStore.members.length) {
      adminFallbackStore.members = buildFallbackMembers(scopedUsers, orgPayload.nodes, projects)
    }
    memberRecords = adminFallbackStore.members
  } else {
    const grouped = new Map<string, AdminMemberRecord>()
    relationRows.forEach((row) => {
      const userRef = row?.user_id || row?.user || row?.directus_users_id
      const userId = extractId(userRef) || safeString(userRef)
      if (!userId) return

      const user = userById.get(userId)
      const organizationRef = row?.organization_id
      const organizationId = extractId(organizationRef) || safeString(organizationRef) || user?.organization_id || ''
      const organizationName =
        extractName(organizationRef) || safeString(organizationRef) || user?.organization_name || organizationId
      const memberKey = `${userId}:${organizationId || organizationName}`

      if (!grouped.has(memberKey)) {
        const baseUser = user || {
          id: userId,
          email: safeString(userRef?.email, userId),
          first_name: safeString(userRef?.first_name),
          last_name: safeString(userRef?.last_name),
          display_name: extractName(userRef) || safeString(userRef?.email, userId),
          role_id: '',
          role_code: 'user',
          role_name: 'User',
          organization_id: organizationId,
          organization_name: organizationName,
          status: 'active',
          status_raw: 'active',
          mfa_enabled: false,
          last_login_at: '-',
        }
        grouped.set(
          memberKey,
          buildMemberRecordFromUser(baseUser, {
            id: `member_${memberKey}`,
            organization_id: organizationId,
            organization_name: organizationName,
            member_type: normalizeMemberType(row?.member_type),
            management_roles: [],
            affiliations: [],
          })
        )
      }

      const orgRef = row?.org_unit_id || row?.org_unit || row?.organization
      const orgId = extractId(orgRef) || safeString(orgRef)
      const org = orgById.get(orgId)
      const relationType = normalizeMemberRelationType(
        row?.membership_type || row?.relation_type,
        Boolean(row?.is_primary)
      )
      const managementRoles = row?.management_roles
      const member = grouped.get(memberKey)
      if (!member) return

      if (Array.isArray(managementRoles)) {
        managementRoles.forEach((role) => {
          const roleToken = safeString(role)
          if (roleToken && !member.management_roles.includes(roleToken)) {
            member.management_roles.push(roleToken)
          }
        })
      } else if (typeof managementRoles === 'string' && managementRoles.trim()) {
        managementRoles
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
          .forEach((role) => {
            if (!member.management_roles.includes(role)) {
              member.management_roles.push(role)
            }
          })
      }
      if (row?.is_manager && !member.management_roles.includes('org_manager')) {
        member.management_roles.push('org_manager')
      }
      if (row?.member_type) {
        member.member_type = normalizeMemberType(row?.member_type)
      }

      if (!orgId) return

      member.affiliations.push({
        id: safeString(row?.id, `${member.user_id}:${orgId}:${relationType}`),
        org_unit_id: orgId,
        org_unit_name: org?.name || extractName(orgRef) || orgId,
        relation_type: relationType,
        status: normalizeOrganizationStatus(row?.status || org?.status),
        is_manager: Boolean(row?.is_manager),
      })
    })

    const userKeySet = new Set(grouped.keys())
    scopedUsers.forEach((user) => {
      const key = `${user.id}:${user.organization_id || user.organization_name}`
      if (!userKeySet.has(key)) {
        grouped.set(key, buildMemberRecordFromUser(user))
      }
    })

    memberRecords = Array.from(grouped.values()).map((item) => {
      const organizationProjects = projectByOrganization.get(item.organization_id || item.organization_name) || []
      const ownedProjectCount = organizationProjects.filter(
        (project) => project.owner_user === item.email || project.owner_user === item.display_name
      ).length
      return withNormalizedMemberShape({
        ...item,
        project_count: ownedProjectCount,
        owned_project_count: ownedProjectCount,
      })
    })
  }

  const scopedMembers = normalizeOrganizationScope(memberRecords, options).sort((a, b) => {
    const organizationCmp = (a.organization_name || '').localeCompare(b.organization_name || '')
    if (organizationCmp !== 0) return organizationCmp
    return (a.display_name || '').localeCompare(b.display_name || '')
  })
  adminFallbackStore.members = scopedMembers

  return {
    members: scopedMembers,
    scopeOptions: orgPayload.scopeOptions,
    organizationOptions: orgPayload.organizationOptions,
    memberTypeOptions: getMemberTypeOptions(),
  }
}

export const addAdminMemberAffiliation = async (input: AdminMemberAffiliationCreateInput): Promise<void> => {
  const basePayload = {
    user_id: input.userId,
    org_unit_id: input.orgUnitId,
    membership_type: input.relationType,
    is_primary: input.relationType === 'primary',
    member_type: normalizeMemberType(input.memberType || 'internal'),
    is_manager: Boolean(input.isManager),
    status: 'active',
  }

  try {
    const { response } = await fetchOrgMembershipsResponse({
      limit: -1,
      fields: 'id,date_created',
      sort: 'date_created',
      'filter[user_id][_eq]': input.userId,
      'filter[org_unit_id][_eq]': input.orgUnitId,
      [`filter[${ORG_SCOPE_FIELD}][_eq]`]: input.organizationId,
    })
    const existingRelationIds = toArray<any>(response)
      .map((row) => safeString(row?.id))
      .filter(Boolean)

    if (existingRelationIds.length > 0) {
      const [existingRelationId, ...duplicateRelationIds] = existingRelationIds
      await request.patch(
        `${ORG_MEMBERSHIP_COLLECTION_PATH}/${existingRelationId}`,
        {
          membership_type: basePayload.membership_type,
          is_primary: basePayload.is_primary,
          member_type: basePayload.member_type,
          is_manager: basePayload.is_manager,
          status: 'active',
        },
        { showError: false }
      )
      if (duplicateRelationIds.length > 0) {
        await Promise.all(
          duplicateRelationIds.map((relationId) =>
            request.delete(`${ORG_MEMBERSHIP_COLLECTION_PATH}/${relationId}`, {}, { showError: false }).catch(() => null)
          )
        )
      }
      return
    }
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  try {
    const payload = buildMembershipScopePayload(input.organizationId, basePayload)
    await request.post(ORG_MEMBERSHIP_COLLECTION_PATH, payload, { showError: false })
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackMembers((rows) => {
    const target = rows.find((item) => item.user_id === input.userId && item.organization_id === input.organizationId)
    const org = adminFallbackStore.organizations.find((item) => item.id === input.orgUnitId)
    const affiliation: AdminMemberAffiliationRecord = {
      id: `fallback_rel_${Date.now()}`,
      org_unit_id: input.orgUnitId,
      org_unit_name: org?.name || input.orgUnitId,
      relation_type: input.relationType,
      status: org?.status || 'active',
      is_manager: Boolean(input.isManager),
    }

    if (!target) {
      return [
        ...rows,
        withNormalizedMemberShape({
          id: `fallback_member_${input.userId}`,
          user_id: input.userId,
          email: input.userId,
          display_name: input.userId,
          organization_id: input.organizationId,
          organization_name:
            adminFallbackStore.scopeOptions.find((item) => item.value === input.organizationId)?.label ||
            input.organizationId,
          member_type: normalizeMemberType(input.memberType || 'internal'),
          management_roles: input.isManager ? ['org_manager'] : [],
          primary_org_unit_id: '',
          primary_org_unit_name: '',
          secondary_org_units: [],
          project_count: 0,
          owned_project_count: 0,
          anomaly_flags: [],
          affiliations: [affiliation],
          status: 'active',
        }),
      ]
    }

    const nextAffiliations = target.affiliations.filter((item) => item.org_unit_id !== input.orgUnitId)
    if (input.relationType === 'primary') {
      nextAffiliations.forEach((item) => {
        if (item.relation_type === 'primary') item.relation_type = 'secondary'
      })
    }
    nextAffiliations.push(affiliation)
    const nextRoles = [...target.management_roles]
    if (input.isManager && !nextRoles.includes('org_manager')) {
      nextRoles.push('org_manager')
    }

    return rows.map((item) =>
      item.user_id === input.userId && item.organization_id === input.organizationId
        ? {
            ...item,
            member_type: normalizeMemberType(input.memberType || item.member_type),
            management_roles: nextRoles,
            affiliations: nextAffiliations,
          }
        : item
    )
  })
}

export const setAdminMemberPrimaryAffiliation = async (input: AdminMemberPrimaryUpdateInput): Promise<void> => {
  try {
    const { response } = await fetchOrgMembershipsResponse({
      limit: -1,
      fields: 'id,org_unit_id,org_unit_id.id,membership_type,is_primary',
      'filter[user_id][_eq]': input.userId,
      [`filter[${ORG_SCOPE_FIELD}][_eq]`]: input.organizationId,
    })
    const rows = toArray<any>(response)
    if (rows.length > 0) {
      await Promise.all(
        rows.map((row) => {
          const orgId = extractId(row?.org_unit_id) || safeString(row?.org_unit_id)
          const relationType: AdminMemberRelationType = orgId === input.orgUnitId ? 'primary' : 'secondary'
          return request.patch(
            `${ORG_MEMBERSHIP_COLLECTION_PATH}/${safeString(row?.id)}`,
            { membership_type: relationType, is_primary: relationType === 'primary' },
            { showError: false }
          )
        })
      )
    } else {
      const payload = buildMembershipScopePayload(
        input.organizationId,
        {
          user_id: input.userId,
          org_unit_id: input.orgUnitId,
          membership_type: 'primary',
          is_primary: true,
          status: 'active',
        }
      )
      await request.post(ORG_MEMBERSHIP_COLLECTION_PATH, payload, { showError: false })
    }
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackMembers((rows) =>
    rows.map((item) => {
      if (item.user_id !== input.userId || item.organization_id !== input.organizationId) return item
      let found = false
      const nextAffiliations = item.affiliations.map((affiliation) => {
        if (affiliation.org_unit_id === input.orgUnitId) {
          found = true
          return { ...affiliation, relation_type: 'primary' as const }
        }
        return { ...affiliation, relation_type: 'secondary' as const }
      })
      if (!found) {
        const org = adminFallbackStore.organizations.find((node) => node.id === input.orgUnitId)
        nextAffiliations.push({
          id: `fallback_rel_${Date.now()}`,
          org_unit_id: input.orgUnitId,
          org_unit_name: org?.name || input.orgUnitId,
          relation_type: 'primary',
          status: org?.status || 'active',
          is_manager: false,
        })
      }
      return {
        ...item,
        affiliations: nextAffiliations,
      }
    })
  )
}

export const addAdminMemberSecondaryAffiliation = async (input: AdminMemberSecondaryCreateInput): Promise<void> => {
  await addAdminMemberAffiliation({
    userId: input.userId,
    organizationId: input.organizationId,
    orgUnitId: input.orgUnitId,
    relationType: 'secondary',
    isManager: input.isManager,
  })
}

export const removeAdminMemberAffiliation = async (affiliationId: string): Promise<void> => {
  try {
    await request.delete(`${ORG_MEMBERSHIP_COLLECTION_PATH}/${affiliationId}`, {}, { showError: false })
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackMembers((rows) =>
    rows.map((item) => ({
      ...item,
      affiliations: item.affiliations.filter((affiliation) => affiliation.id !== affiliationId),
    }))
  )
}

export const updateAdminMemberType = async (
  userId: string,
  organizationId: string,
  memberType: AdminMemberType
): Promise<void> => {
  try {
    const { response } = await fetchOrgMembershipsResponse({
      limit: -1,
      fields: 'id',
      'filter[user_id][_eq]': userId,
      [`filter[${ORG_SCOPE_FIELD}][_eq]`]: organizationId,
    })
    const rows = toArray<any>(response)
    await Promise.all(
      rows.map((row) =>
        request.patch(
          `${ORG_MEMBERSHIP_COLLECTION_PATH}/${safeString(row?.id)}`,
          { member_type: normalizeMemberType(memberType) },
          { showError: false }
        )
      )
    )
    return
  } catch (error) {
    if (!shouldUseFallbackAdapter(error)) {
      throw error
    }
  }

  mutateFallbackMembers((rows) =>
    rows.map((item) =>
      item.user_id === userId && item.organization_id === organizationId
        ? {
            ...item,
            member_type: normalizeMemberType(memberType),
          }
        : item
    )
  )
}

export const fetchAdminRoles = async (): Promise<AdminRoleRecord[]> => {
  const [rolesResponse, permissionsResponse] = await Promise.all([
    request.get(
      '/roles',
      { limit: -1, fields: 'id,name,admin_access,date_updated,date_created' },
      { showError: false }
    ),
    safeRequest(() =>
      request.get('/permissions', { limit: -1, fields: 'role,collection,action' }, { showError: false })
    ),
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

    const scope: AdminRoleRecord['scope'] = roleCode.includes('organization') ? 'organization' : 'platform'

    let riskLevel: AdminRoleRecord['risk_level'] = 'medium'
    if (adminAccess || roleCode.includes('super_admin') || roleCode === 'administrator' || roleCode === 'admin') {
      riskLevel = 'critical'
    } else if (roleCode.includes('operator') || roleCode.includes('organization_admin')) {
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

const fetchProjectBindingResponse = async (): Promise<unknown> => {
  return request.get(
    '/items/projects',
    { fields: 'id,owner_org_unit_id,owner_org_unit_id.id,organization_id,organization_id.id', limit: -1 },
    { showError: false }
  )
}

export const fetchAdminProjects = async (options?: AdminDataScope): Promise<AdminProjectRecord[]> => {
  const [projects, ownerMembersResponse, projectBindingResponse] = await Promise.all([
    getProjects(),
    safeRequest(() =>
      request.get(
        '/items/project_members',
        {
          fields: 'project_id,role,directus_users_id.email,directus_users_id.first_name,directus_users_id.last_name',
          'filter[role][_eq]': 'Owner',
          limit: -1,
        },
        { showError: false }
      )
    ),
    safeRequest(fetchProjectBindingResponse),
  ])

  const ownerMap = new Map<string, string>()
  toArray<any>(ownerMembersResponse).forEach((item) => {
    const projectId = extractId(item?.project_id) || safeString(item?.project_id)
    if (!projectId) return
    const user = item?.directus_users_id
    const ownerName = extractName(user) || safeString(user?.email) || safeString(user)
    if (ownerName) ownerMap.set(projectId, ownerName)
  })
  const ownerOrgMap = new Map<string, string>()
  toArray<any>(projectBindingResponse).forEach((item) => {
    const projectId = safeString(item?.id)
    if (!projectId) return
    const orgId = extractId(item?.owner_org_unit_id) || safeString(item?.owner_org_unit_id)
    if (orgId) ownerOrgMap.set(projectId, orgId)
  })

  const mapped = projects.map<AdminProjectRecord>((item) => {
    const organizationName = safeString((item as any)?.organization)
    return {
      id: safeString(item?.id),
      slug: safeString(item?.slug),
      name: safeString(item?.name),
      organization_id: organizationName,
      organization_name: organizationName,
      owner_org_unit_id: ownerOrgMap.get(safeString(item?.id)) || '',
      owner_user: ownerMap.get(safeString(item?.id)) || '-',
      status: safeString(item?.status, 'active'),
      member_count: Number(item?.members ?? 0),
      last_activity_at: safeString(item?.lastActive, '-'),
    }
  })

  return normalizeOrganizationScope(mapped, options)
}

export const fetchAdminPlugins = async (options?: AdminDataScope): Promise<AdminPluginsPayload> => {
  const { registry, installations } = await fetchPluginState()

  const scopedInstallations = options?.organizationScoped
    ? installations.filter((item) => !options.organizationId || safeString(item.scope_id) === options.organizationId)
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
  const directusEvents = options?.organizationScoped ? [] : await fetchDirectusActivityEvents(limit)
  const combined = sortByDateDesc([...pluginEvents, ...directusEvents])

  return combined.slice(0, limit)
}

export const fetchAdminOverview = async (options?: AdminDataScope): Promise<AdminOverviewPayload> => {
  const [projects, pluginState, auditEvents, workerHealth] = await Promise.all([
    safeCall(() => fetchAdminProjects(options), [] as AdminProjectRecord[]),
    safeCall(() => fetchAdminPlugins(options), {
      definitions: [],
      installations: [],
      audit: [],
    } as AdminPluginsPayload),
    safeCall(() => fetchAdminAudit({ ...options, limit: 8 }), [] as AdminAuditEvent[]),
    safeCall(() => getWorkerHealth(), null),
  ])
  const jobsSummary = summarizeJobsFromWorkerHealth(workerHealth)

  const activeOrganizations = new Set(projects.map((item) => item.organization_name).filter(Boolean)).size
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
      organization_id: options?.organizationId || PLATFORM_SCOPE_ID,
    })
  }
  if (jobsSummary.failed > 0) {
    alerts.push({
      id: 'alt_failed_jobs',
      level: jobsSummary.failed >= 5 ? 'critical' : 'medium',
      module: 'jobs',
      title: `${jobsSummary.failed} failed jobs detected in the current window.`,
      created_at: new Date().toISOString(),
      organization_id: options?.organizationId || PLATFORM_SCOPE_ID,
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
      organization_id: options?.organizationId || PLATFORM_SCOPE_ID,
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
      active_organizations: options?.organizationScoped ? 1 : activeOrganizations,
      active_projects: activeProjects,
      running_jobs: jobsSummary.running,
      failed_jobs: jobsSummary.failed,
      plugin_enabled_count: pluginEnabledCount,
    },
    alerts,
    recent_changes: recentChanges,
  }
}
