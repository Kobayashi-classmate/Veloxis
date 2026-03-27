/**
 * Projects API — Directus v11 Items API
 *
 * Collections:
 *   projects              — core project records
 *   project_members       — junction: user ↔ project with role
 *   project_starred       — junction: user ↔ starred project
 */

import request from '../request'
import { authService } from '../authService'

/** ─── Directus raw shapes ─────────────────────────────────────────────── */

export type ProjectStatus = 'active' | 'warning' | 'archived'
export type ProjectVisibility = 'private' | 'internal' | 'public'

/** Raw Directus project record (as returned from /items/projects) */
export interface DirectusProject {
  id: string
  name: string
  description: string
  status: ProjectStatus
  visibility: ProjectVisibility
  /** Human-readable tenant / org name */
  tenant: string
  /** Hex accent color for the card, e.g. "#1677ff" */
  color: string
  /** JSON array of tag strings */
  tags: string[] | string
  /** Storage summary label, e.g. "1.2 TB" */
  storage_label: string
  /** Cube.js semantic layer health percentage 0–100 */
  cube_health: number
  /** Apache Doris query latency label, e.g. "12ms" */
  doris_latency: string
  /** ISO timestamp or relative label for last activity */
  last_active: string | null
  /** Resolved from project_members junction via Directus deep query */
  members_count?: number
  datasets_count?: number
  workbooks_count?: number
  recipes_count?: number
}

/** Junction record used only for member/role lookups */
export interface ProjectMember {
  id: string
  project_id: string
  directus_users_id: any
  role: 'Owner' | 'Data Admin' | 'Analyst' | 'Viewer'
}

/** ─── Normalized shape used by UI components ──────────────────────────── */

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  visibility: ProjectVisibility
  tenant: string
  color: string
  tags: string[]
  storage: string
  cubeHealth: number
  dorisLatency: string
  lastActive: string
  /** Current user's role in this project (resolved from project_members) */
  role: string
  /** Number of project members */
  members: number
  datasets: number
  workbooks: number
  recipes: number
  /** Whether the current user has starred this project */
  starred: boolean
}

/** ─── Helpers ──────────────────────────────────────────────────────────── */

function parseTags(raw: string[] | string | null | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function relativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 30) return `${days}天前`
  return new Date(isoDate).toLocaleDateString('zh-CN')
}

/** Merge raw Directus record + membership + starred info into a UI Project */
function normalize(raw: DirectusProject, memberRecord: ProjectMember | undefined, starred: boolean): Project {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? '',
    status: raw.status ?? 'active',
    visibility: raw.visibility ?? 'private',
    tenant: raw.tenant ?? '',
    color: raw.color ?? '#1677ff',
    tags: parseTags(raw.tags),
    storage: raw.storage_label ?? '—',
    cubeHealth: raw.cube_health ?? 100,
    dorisLatency: raw.doris_latency ?? '—',
    lastActive: relativeTime(raw.last_active),
    role: memberRecord?.role as string, // Might be undefined if not a member
    members: raw.members_count ?? 0,
    datasets: raw.datasets_count ?? 0,
    workbooks: raw.workbooks_count ?? 0,
    recipes: raw.recipes_count ?? 0,
    starred,
  }
}

/** ─── API methods ─────────────────────────────────────────────────────── */

/**
 * Safe wrapper: returns an empty array instead of throwing when a secondary
 * collection (project_members / project_starred) is inaccessible or missing.
 */
async function safeList<T>(fn: () => Promise<unknown>, label: string): Promise<T[]> {
  try {
    const res = await fn()
    const data = (res as any)?.data ?? res
    return Array.isArray(data) ? data : []
  } catch (err: any) {
    /** Ignore Axios dedup cancellations — they are not real errors */
    if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') return []
    console.warn(`[projects] ${label} unavailable — ${err?.message ?? err}`)
    return []
  }
}

/**
 * Fetch all projects the current user can access.
 */
export async function getProjects(): Promise<Project[]> {
  const userId = authService.getState().user?.id

  const PROJECT_FIELDS = [
    'id',
    'name',
    'description',
    'status',
    'visibility',
    'tenant',
    'color',
    'tags',
    'storage_label',
    'cube_health',
    'doris_latency',
    'last_active',
    'members_count',
    'datasets_count',
    'workbooks_count',
    'recipes_count',
  ].join(',')

  /** Step 1 — core project list (must succeed) */
  const projectsRes = await request.get('/items/projects', {
    fields: PROJECT_FIELDS,
    limit: -1,
    sort: '-last_active',
  })

  const rawProjects: DirectusProject[] = (projectsRes as any)?.data ?? projectsRes ?? []
  if (!rawProjects.length) return []

  /** Steps 2 & 3 — membership + starred (degradable, run in parallel) */
  const [memberList, starredList] = await Promise.all([
    userId
      ? safeList<ProjectMember>(
          () =>
            request.get('/items/project_members', {
              'filter[directus_users_id][_eq]': userId,
              fields: 'project_id,role',
              limit: -1,
            }),
          'project_members'
        )
      : Promise.resolve([] as ProjectMember[]),
    userId
      ? safeList<{ project_id: string }>(
          () =>
            request.get('/items/project_starred', {
              'filter[directus_users_id][_eq]': userId,
              fields: 'project_id',
              limit: -1,
            }),
          'project_starred'
        )
      : Promise.resolve([] as { project_id: string }[]),
  ])

  // Improved map lookup: handle project_id as string or object
  const memberMap = new Map<string, ProjectMember>()
  memberList.forEach((m) => {
    const pid = typeof m.project_id === 'string' ? m.project_id : (m.project_id as any)?.id
    if (pid) memberMap.set(pid, m)
  })

  const starredSet = new Set(
    starredList.map((s: any) => {
      return typeof s.project_id === 'string' ? s.project_id : s.project_id?.id
    })
  )

  return rawProjects.map((raw) => normalize(raw, memberMap.get(raw.id), starredSet.has(raw.id)))
}

/**
 * Fetch a single project by ID.
 */
export async function getProject(id: string): Promise<Project | null> {
  const userId = authService.getState().user?.id
  console.log('[getProject] Fetching project:', id, 'for user:', userId)

  const PROJECT_FIELDS = [
    'id',
    'name',
    'description',
    'status',
    'visibility',
    'tenant',
    'color',
    'tags',
    'storage_label',
    'cube_health',
    'doris_latency',
    'last_active',
    'members_count',
    'datasets_count',
    'workbooks_count',
    'recipes_count',
  ].join(',')

  try {
    const projectRes = await request.get(`/items/projects/${id}`, { fields: PROJECT_FIELDS })
    console.log('[getProject] Raw response:', projectRes)

    const raw: DirectusProject = (projectRes as any)?.data ?? projectRes
    if (!raw?.id) {
      console.warn('[getProject] Project not found or invalid format:', raw)
      return null
    }

    const [memberList, starredList] = await Promise.all([
      userId
        ? safeList<ProjectMember>(
            () =>
              request.get('/items/project_members', {
                'filter[project_id][_eq]': id,
                'filter[directus_users_id][_eq]': userId,
                fields: 'project_id,role',
                limit: 1,
              }),
            'project_members'
          )
        : Promise.resolve([] as ProjectMember[]),
      userId
        ? safeList<{ id: string }>(
            () =>
              request.get('/items/project_starred', {
                'filter[project_id][_eq]': id,
                'filter[directus_users_id][_eq]': userId,
                fields: 'id',
                limit: 1,
              }),
            'project_starred'
          )
        : Promise.resolve([] as { id: string }[]),
    ])

    const normalized = normalize(raw, memberList[0], starredList.length > 0)
    console.log('[getProject] Normalized project:', normalized)
    return normalized
  } catch (err: any) {
    /** Ignore Axios dedup cancellations — they are not real errors */
    if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') return null
    console.error('[getProject] Critical error:', err)
    throw err
  }
}

/**
 * Toggle the starred status of a project for the current user.
 */
export async function toggleStarProject(projectId: string, starred: boolean): Promise<void> {
  const userId = authService.getState().user?.id
  if (!userId) return

  if (starred) {
    await request.post('/items/project_starred', {
      project_id: projectId,
      directus_users_id: userId,
    })
  } else {
    const res = await request.get('/items/project_starred', {
      'filter[project_id][_eq]': projectId,
      'filter[directus_users_id][_eq]': userId,
      fields: 'id',
      limit: 1,
    })
    const records = res?.data ?? res ?? []
    if (records.length > 0) {
      await request.delete(`/items/project_starred/${records[0].id}`)
    }
  }
}

/**
 * Update project metadata.
 */
export async function updateProject(
  id: string,
  data: Partial<Pick<DirectusProject, 'name' | 'description' | 'status' | 'visibility' | 'color' | 'tags'>>
): Promise<void> {
  await request.patch(`/items/projects/${id}`, data)
}

/**
 * Create a new project.
 * Automatically adds the current user as an 'Owner'.
 */
export async function createProject(data: {
  name: string
  description?: string
  tenant?: string
  visibility?: ProjectVisibility
  color?: string
}): Promise<Project> {
  const res = await request.post('/items/projects', data)
  const raw: DirectusProject = (res as any)?.data ?? res

  const userId = authService.getState().user?.id
  if (userId && raw?.id) {
    await request.post('/items/project_members', {
      project_id: raw.id,
      directus_users_id: userId,
      role: 'Owner',
    })
  }

  return normalize(raw, { id: 'tmp', project_id: raw.id, directus_users_id: userId || '', role: 'Owner' }, false)
}

/**
 * Fetch unique tenant names from projects.
 * In a real scenario, this might come from a dedicated 'tenants' collection.
 */
export async function getTenants(): Promise<string[]> {
  const res = await request.get('/items/projects', {
    fields: 'tenant',
    groupBy: 'tenant',
    limit: -1,
  })
  const data = (res as any)?.data ?? res ?? []
  return data.map((t: any) => t.tenant).filter(Boolean)
}

/**
 * Fetch all users (for member management).
 */
export async function getUsers(query?: string): Promise<any[]> {
  const params: any = {
    fields: 'id,email,first_name,last_name,avatar',
    limit: 20,
  }
  if (query) {
    params['filter[_or][0][email][_icontains]'] = query
    params['filter[_or][1][first_name][_icontains]'] = query
    params['filter[_or][2][last_name][_icontains]'] = query
  }
  const res = await request.get('/users', params)
  return (res as any)?.data ?? res ?? []
}

/**
 * Delete a project by ID.
 */
export async function deleteProject(id: string): Promise<void> {
  await request.delete(`/items/projects/${id}`)
}

/**
 * Get project members.
 */
export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const res = await request.get('/items/project_members', {
    'filter[project_id][_eq]': projectId,
    fields:
      'id,project_id,role,directus_users_id.id,directus_users_id.first_name,directus_users_id.last_name,directus_users_id.email',
    limit: -1,
  })
  return (res as any)?.data ?? res ?? []
}

/**
 * Add a member to a project.
 */
export async function addProjectMember(projectId: string, userId: string, role: string): Promise<any> {
  return request.post('/items/project_members', {
    project_id: projectId,
    directus_users_id: userId,
    role: role,
  })
}

/**
 * Remove a member from a project.
 */
export async function removeProjectMember(memberId: string): Promise<void> {
  await request.delete(`/items/project_members/${memberId}`)
}

/**
 * Update a member's role.
 */
export async function updateProjectMemberRole(memberId: string, role: string): Promise<void> {
  await request.patch(`/items/project_members/${memberId}`, { role })
}
