import { adminMenu, mainLayoutMenu, projectMenu } from '@src/config/menu.config'

const PROJECT_SCOPE_KEY = 'project'
const ADMIN_SCOPE_KEY = 'admin'
const MAIN_SCOPE_FALLBACK = 'main'

const ensurePathPrefix = (value) => {
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

export const normalizePath = (value = '/') => {
  const raw = String(value || '').split('?')[0].trim()
  const prefixed = ensurePathPrefix(raw || '/')
  const compact = prefixed.replace(/\/{2,}/g, '/')
  if (compact.length > 1) {
    return compact.replace(/\/+$/g, '')
  }
  return '/'
}

const escapeRegexPart = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toPatternRegex = (pattern) => {
  const normalizedPattern = normalizePath(pattern)
  if (normalizedPattern === '*') return /^.*$/

  const parts = normalizedPattern.split('/').map((part) => {
    if (part === '*') return '.*'
    if (part.startsWith(':')) return '[^/]+'
    return escapeRegexPart(part)
  })

  try {
    return new RegExp(`^${parts.join('/')}$`)
  } catch {
    return null
  }
}

const matchPatternPath = (pattern, pathToMatch) => {
  const patternPath = normalizePath(pattern)
  const targetPath = normalizePath(pathToMatch)

  if (patternPath === '*') return true
  if (patternPath === targetPath) return true
  if (targetPath.startsWith(`${patternPath}/`)) return true

  if (patternPath.includes(':') || patternPath.includes('*')) {
    const regex = toPatternRegex(patternPath)
    return !!regex?.test(targetPath)
  }

  return false
}

const menuItemPath = (item) => normalizePath(item?.path || item?.key || '/')

const findBestMenuMatch = (items, pathname) => {
  const targetPath = normalizePath(pathname)
  let best = null

  for (const item of items || []) {
    const itemPath = menuItemPath(item)
    if (!matchPatternPath(itemPath, targetPath)) continue
    if (!best || itemPath.length > menuItemPath(best).length) {
      best = item
    }
  }

  return best
}

const extractProjectSlug = (pathname) => {
  const path = normalizePath(pathname)
  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'project') return ''
  return parts[1] || ''
}

const replaceProjectParams = (pathValue, slug) => {
  const normalized = normalizePath(pathValue)
  if (!slug) return normalized
  return normalized.replace(/:id|:slug/g, slug)
}

const normalizeAllowedRoutes = (allowedRoutes = []) => {
  const routes = Array.isArray(allowedRoutes) ? allowedRoutes : []
  return Array.from(new Set(routes.filter(Boolean).map((route) => String(route).trim())))
}

export const canAccessPath = (targetPath, allowedRoutes = []) => {
  const routes = normalizeAllowedRoutes(allowedRoutes)
  if (routes.includes('*')) return true
  if (routes.length === 0) return normalizePath(targetPath) === '/'
  const normalizedTarget = normalizePath(targetPath)
  return routes.some((route) => matchPatternPath(route, normalizedTarget))
}

export const createHomeTabKey = (scopeKey = MAIN_SCOPE_FALLBACK) => `__home__:${scopeKey}`

export const resolveScopeKey = (pathname = '/') => {
  const normalizedPath = normalizePath(pathname)
  if (normalizedPath === '/project' || normalizedPath.startsWith('/project/')) {
    return PROJECT_SCOPE_KEY
  }
  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
    return ADMIN_SCOPE_KEY
  }
  return MAIN_SCOPE_FALLBACK
}

const resolveMainScopeHomePath = (_pathname, allowedRoutes) => {
  const firstAccessible = (mainLayoutMenu || [])
    .map((item) => menuItemPath(item))
    .find((path) => canAccessPath(path, allowedRoutes))

  return firstAccessible || '/'
}

const resolveProjectScopeHomePath = (pathname, allowedRoutes) => {
  const slug = extractProjectSlug(pathname)
  const resolvedPaths = (projectMenu || []).map((item) => replaceProjectParams(item?.path || item?.key, slug))
  const projectOnlyPaths = resolvedPaths.filter((path) => path.startsWith('/project/'))

  const firstProjectAccessible = projectOnlyPaths.find((path) => canAccessPath(path, allowedRoutes))
  if (firstProjectAccessible) return firstProjectAccessible

  const firstAccessible = resolvedPaths.find((path) => canAccessPath(path, allowedRoutes))
  if (firstAccessible) return firstAccessible

  return '/'
}

const resolveAdminScopeHomePath = (_pathname, allowedRoutes) => {
  const adminPaths = (adminMenu || [])
    .map((item) => menuItemPath(item))
    .filter((path) => path === '/admin' || path.startsWith('/admin/'))

  const firstAdminAccessible = adminPaths.find((path) => canAccessPath(path, allowedRoutes))
  if (firstAdminAccessible) return firstAdminAccessible

  return '/admin/overview'
}

export const resolveScopeHomePath = (pathname = '/', allowedRoutes = []) => {
  const scopeKey = resolveScopeKey(pathname)
  if (scopeKey === PROJECT_SCOPE_KEY) {
    return resolveProjectScopeHomePath(pathname, allowedRoutes)
  }
  if (scopeKey === ADMIN_SCOPE_KEY) {
    return resolveAdminScopeHomePath(pathname, allowedRoutes)
  }
  return resolveMainScopeHomePath(pathname, allowedRoutes)
}
