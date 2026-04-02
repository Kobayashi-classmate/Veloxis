import { ALLOWED_PERMISSIONS } from './constants'
import { PluginForbiddenError } from './PluginErrors'
import { PluginScopeType } from './types'

function normalizePermissions(value: string[] | undefined): string[] {
  if (!value) return []
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}

export class CapabilityGuard {
  assertScope(scopeType: PluginScopeType, scopeId?: string | null): void {
    if (!['global', 'tenant', 'project'].includes(scopeType)) {
      throw new PluginForbiddenError(`Unsupported plugin scope: ${scopeType}`)
    }

    if (scopeType === 'global') return

    if (!scopeId || !scopeId.trim()) {
      throw new PluginForbiddenError(`scopeId is required for scope type ${scopeType}`)
    }
  }

  resolveGrantedPermissions(manifestPermissions: string[], requestedPermissions?: string[]): string[] {
    const manifestSet = new Set(normalizePermissions(manifestPermissions))
    const requested = normalizePermissions(requestedPermissions)
    const candidate = requested.length ? requested : [...manifestSet]

    const granted: string[] = []
    for (const permission of candidate) {
      if (!manifestSet.has(permission)) {
        throw new PluginForbiddenError(`Requested permission is not declared by manifest: ${permission}`)
      }
      if (!ALLOWED_PERMISSIONS.has(permission)) {
        throw new PluginForbiddenError(`Requested permission is not supported by host: ${permission}`)
      }
      granted.push(permission)
    }

    return granted
  }

  assertInstallationPermissions(manifestPermissions: string[], grantedPermissions: string[]): void {
    const manifestSet = new Set(normalizePermissions(manifestPermissions))
    for (const granted of normalizePermissions(grantedPermissions)) {
      if (!manifestSet.has(granted)) {
        throw new PluginForbiddenError(`Granted permission is outside manifest declaration: ${granted}`)
      }
      if (!ALLOWED_PERMISSIONS.has(granted)) {
        throw new PluginForbiddenError(`Granted permission is not supported by host: ${granted}`)
      }
    }
  }
}
