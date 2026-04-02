import { INSTALLATION_TRANSITIONS } from './constants'
import { DirectusPluginStore, InstallationFilters } from './DirectusPluginStore'
import { PluginInstallationRecord, PluginRegistryRecord } from './entities'
import { CapabilityGuard } from './CapabilityGuard'
import { PluginForbiddenError, PluginNotFoundError } from './PluginErrors'
import { PluginRegistryService } from './PluginRegistryService'
import { PluginManifest, PluginScopeType } from './types'

type ActorContext = {
  actorId?: string | null
  actorEmail?: string | null
  requestId?: string | null
}

function extractJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

function isTransitionAllowed(fromStatus: string, toStatus: string): boolean {
  if (fromStatus === toStatus) return true
  const allowedTargets = INSTALLATION_TRANSITIONS[fromStatus]
  if (!allowedTargets) return false
  return allowedTargets.has(toStatus)
}

function normalizeScopeId(scopeType: PluginScopeType, scopeId?: string | null): string | null {
  if (scopeType === 'global') return null
  return scopeId ?? null
}

export interface CreateInstallationInput {
  pluginId: string
  version: string
  scopeType: PluginScopeType
  scopeId?: string | null
  requestedPermissions?: string[]
  config?: Record<string, unknown>
}

export interface UpgradeInstallationInput {
  targetVersion: string
}

export interface ListInstallationOptions {
  includeManifest?: boolean
  effectiveScope?: {
    scopeType: 'project' | 'tenant'
    scopeId: string
  }
}

export class PluginLifecycleService {
  private readonly capabilityGuard = new CapabilityGuard()
  private readonly registryService: PluginRegistryService

  constructor(private readonly store: DirectusPluginStore) {
    this.registryService = new PluginRegistryService(store)
  }

  private parseManifest(record: PluginRegistryRecord): PluginManifest {
    const manifest = extractJson<PluginManifest | null>(record.manifest_json, null)
    if (!manifest) {
      throw new PluginNotFoundError(`Registry manifest snapshot missing for ${record.plugin_id}@${record.version}`)
    }
    return manifest
  }

  private parseGrantedPermissions(record: PluginInstallationRecord): string[] {
    return extractJson<string[]>(record.granted_permissions_json, [])
  }

  private async writeAudit(
    payload: {
      installationId?: string | null
      pluginId: string
      version: string
      scopeType?: PluginScopeType | null
      scopeId?: string | null
      action: string
      fromStatus?: string | null
      toStatus?: string | null
      success: boolean
      errorMessage?: string | null
      detail?: Record<string, unknown>
    },
    actor: ActorContext,
  ): Promise<void> {
    await this.store.createAuditLog({
      installation_id: payload.installationId ?? null,
      plugin_id: payload.pluginId,
      version: payload.version,
      scope_type: payload.scopeType ?? null,
      scope_id: payload.scopeId ?? null,
      action: payload.action,
      from_status: payload.fromStatus ?? null,
      to_status: payload.toStatus ?? null,
      actor_id: actor.actorId ?? null,
      actor_email: actor.actorEmail ?? null,
      request_id: actor.requestId ?? null,
      success: payload.success,
      error_message: payload.errorMessage ?? null,
      detail_json: payload.detail ?? null,
    })
  }

  private async ensureRegistryValidated(pluginId: string, version: string): Promise<PluginRegistryRecord> {
    const registry = await this.registryService.get(pluginId, version)
    if (registry.status !== 'validated') {
      return this.registryService.validate(pluginId, version)
    }
    return registry
  }

  async createInstallation(input: CreateInstallationInput, actor: ActorContext = {}) {
    this.capabilityGuard.assertScope(input.scopeType, input.scopeId)

    const scopeId = normalizeScopeId(input.scopeType, input.scopeId)
    const registry = await this.registryService.get(input.pluginId, input.version)
    const manifest = this.parseManifest(registry)
    const grantedPermissions = this.capabilityGuard.resolveGrantedPermissions(
      manifest.permissions ?? [],
      input.requestedPermissions,
    )

    const existing = await this.store.listInstallations({
      pluginId: input.pluginId,
      version: input.version,
      scopeType: input.scopeType,
      ...(scopeId ? { scopeId } : {}),
    })

    const active = existing.find((record) => record.status !== 'uninstalled')
    if (active) {
      await this.writeAudit(
        {
          installationId: active.id,
          pluginId: active.plugin_id,
          version: active.version,
          scopeType: active.scope_type,
          scopeId: active.scope_id ?? null,
          action: 'install',
          fromStatus: active.status,
          toStatus: active.status,
          success: true,
          detail: { idempotent: true },
        },
        actor,
      )
      return active
    }

    const created = await this.store.createInstallation({
      plugin_registry_id: registry.id,
      plugin_id: input.pluginId,
      version: input.version,
      type: registry.type,
      scope_type: input.scopeType,
      scope_id: scopeId,
      status: 'installed',
      granted_permissions_json: grantedPermissions,
      config_json: input.config ?? null,
      last_error: null,
    })

    await this.writeAudit(
      {
        installationId: created.id,
        pluginId: created.plugin_id,
        version: created.version,
        scopeType: created.scope_type,
        scopeId: created.scope_id ?? null,
        action: 'install',
        fromStatus: null,
        toStatus: created.status,
        success: true,
      },
      actor,
    )

    return created
  }

  async enableInstallation(installationId: string, actor: ActorContext = {}) {
    const installation = await this.store.getInstallationById(installationId)
    if (!installation) {
      throw new PluginNotFoundError(`Installation not found: ${installationId}`)
    }

    const fromStatus = installation.status
    if (fromStatus === 'enabled') {
      await this.writeAudit(
        {
          installationId: installation.id,
          pluginId: installation.plugin_id,
          version: installation.version,
          scopeType: installation.scope_type,
          scopeId: installation.scope_id ?? null,
          action: 'enable',
          fromStatus,
          toStatus: fromStatus,
          success: true,
          detail: { idempotent: true },
        },
        actor,
      )
      return installation
    }

    if (!isTransitionAllowed(fromStatus, 'enabled')) {
      throw new PluginForbiddenError(`Illegal status transition for enable: ${fromStatus} -> enabled`)
    }

    const registry = await this.ensureRegistryValidated(installation.plugin_id, installation.version)
    const manifest = this.parseManifest(registry)

    const grantedPermissions = this.parseGrantedPermissions(installation)
    this.capabilityGuard.assertInstallationPermissions(manifest.permissions ?? [], grantedPermissions)

    const updated = await this.store.updateInstallation(installation.id, {
      status: 'enabled',
      enabled_at: new Date().toISOString(),
      last_error: null,
    })

    await this.writeAudit(
      {
        installationId: updated.id,
        pluginId: updated.plugin_id,
        version: updated.version,
        scopeType: updated.scope_type,
        scopeId: updated.scope_id ?? null,
        action: 'enable',
        fromStatus,
        toStatus: updated.status,
        success: true,
      },
      actor,
    )

    return updated
  }

  async disableInstallation(installationId: string, actor: ActorContext = {}) {
    const installation = await this.store.getInstallationById(installationId)
    if (!installation) {
      throw new PluginNotFoundError(`Installation not found: ${installationId}`)
    }

    const fromStatus = installation.status
    if (fromStatus === 'disabled') {
      await this.writeAudit(
        {
          installationId: installation.id,
          pluginId: installation.plugin_id,
          version: installation.version,
          scopeType: installation.scope_type,
          scopeId: installation.scope_id ?? null,
          action: 'disable',
          fromStatus,
          toStatus: fromStatus,
          success: true,
          detail: { idempotent: true },
        },
        actor,
      )
      return installation
    }

    if (!isTransitionAllowed(fromStatus, 'disabled')) {
      throw new PluginForbiddenError(`Illegal status transition for disable: ${fromStatus} -> disabled`)
    }

    const updated = await this.store.updateInstallation(installation.id, {
      status: 'disabled',
      disabled_at: new Date().toISOString(),
      last_error: null,
    })

    await this.writeAudit(
      {
        installationId: updated.id,
        pluginId: updated.plugin_id,
        version: updated.version,
        scopeType: updated.scope_type,
        scopeId: updated.scope_id ?? null,
        action: 'disable',
        fromStatus,
        toStatus: updated.status,
        success: true,
      },
      actor,
    )

    return updated
  }

  async upgradeInstallation(installationId: string, input: UpgradeInstallationInput, actor: ActorContext = {}) {
    const installation = await this.store.getInstallationById(installationId)
    if (!installation) {
      throw new PluginNotFoundError(`Installation not found: ${installationId}`)
    }

    const targetVersion = input.targetVersion?.trim()
    if (!targetVersion) {
      throw new PluginForbiddenError('targetVersion is required')
    }

    const fromStatus = installation.status
    if (!isTransitionAllowed(fromStatus, 'upgraded')) {
      throw new PluginForbiddenError(`Illegal status transition for upgrade: ${fromStatus} -> upgraded`)
    }

    if (targetVersion === installation.version) {
      await this.writeAudit(
        {
          installationId: installation.id,
          pluginId: installation.plugin_id,
          version: installation.version,
          scopeType: installation.scope_type,
          scopeId: installation.scope_id ?? null,
          action: 'upgrade',
          fromStatus,
          toStatus: fromStatus,
          success: true,
          detail: { idempotent: true, targetVersion },
        },
        actor,
      )
      return installation
    }

    const targetRegistry = await this.ensureRegistryValidated(installation.plugin_id, targetVersion)
    const targetManifest = this.parseManifest(targetRegistry)

    const currentGranted = this.parseGrantedPermissions(installation)
    const targetPermissionSet = new Set(targetManifest.permissions ?? [])
    const nextGranted = currentGranted.filter((permission) => targetPermissionSet.has(permission))

    const updated = await this.store.updateInstallation(installation.id, {
      plugin_registry_id: targetRegistry.id,
      version: targetVersion,
      type: targetRegistry.type,
      status: 'upgraded',
      granted_permissions_json: nextGranted,
      last_error: null,
    })

    await this.writeAudit(
      {
        installationId: updated.id,
        pluginId: updated.plugin_id,
        version: updated.version,
        scopeType: updated.scope_type,
        scopeId: updated.scope_id ?? null,
        action: 'upgrade',
        fromStatus,
        toStatus: updated.status,
        success: true,
        detail: {
          previousVersion: installation.version,
          targetVersion,
          droppedPermissions: currentGranted.filter((item) => !nextGranted.includes(item)),
        },
      },
      actor,
    )

    return updated
  }

  async uninstallInstallation(installationId: string, actor: ActorContext = {}) {
    const installation = await this.store.getInstallationById(installationId)
    if (!installation) {
      throw new PluginNotFoundError(`Installation not found: ${installationId}`)
    }

    const fromStatus = installation.status
    if (fromStatus === 'uninstalled') {
      await this.writeAudit(
        {
          installationId: installation.id,
          pluginId: installation.plugin_id,
          version: installation.version,
          scopeType: installation.scope_type,
          scopeId: installation.scope_id ?? null,
          action: 'uninstall',
          fromStatus,
          toStatus: fromStatus,
          success: true,
          detail: { idempotent: true },
        },
        actor,
      )
      return installation
    }

    if (!isTransitionAllowed(fromStatus, 'uninstalled')) {
      throw new PluginForbiddenError(`Illegal status transition for uninstall: ${fromStatus} -> uninstalled`)
    }

    const updated = await this.store.updateInstallation(installation.id, {
      status: 'uninstalled',
      uninstalled_at: new Date().toISOString(),
      last_error: null,
    })

    await this.writeAudit(
      {
        installationId: updated.id,
        pluginId: updated.plugin_id,
        version: updated.version,
        scopeType: updated.scope_type,
        scopeId: updated.scope_id ?? null,
        action: 'uninstall',
        fromStatus,
        toStatus: updated.status,
        success: true,
      },
      actor,
    )

    return updated
  }

  async getInstallation(installationId: string, includeManifest = false) {
    const installation = await this.store.getInstallationById(installationId)
    if (!installation) {
      throw new PluginNotFoundError(`Installation not found: ${installationId}`)
    }

    if (!includeManifest) return installation

    const registry = await this.store.resolveRegistryByInstallation(installation)
    return {
      ...installation,
      manifest: this.parseManifest(registry),
      granted_permissions: this.parseGrantedPermissions(installation),
    }
  }

  async listInstallations(
    filters: InstallationFilters = {},
    options: ListInstallationOptions = {},
  ) {
    let installations = await this.store.listInstallations(filters)

    if (options.effectiveScope) {
      installations = installations.filter((installation) => {
        if (installation.scope_type === 'global') return true
        return (
          installation.scope_type === options.effectiveScope?.scopeType &&
          installation.scope_id === options.effectiveScope.scopeId
        )
      })
    }

    if (!options.includeManifest) {
      return installations.map((installation) => ({
        ...installation,
        granted_permissions: this.parseGrantedPermissions(installation),
      }))
    }

    const registryMap = new Map<string, PluginRegistryRecord>()
    const output: Array<Record<string, unknown>> = []

    for (const installation of installations) {
      const key = `${installation.plugin_id}@${installation.version}`
      if (!registryMap.has(key)) {
        const registry = await this.store.resolveRegistryByInstallation(installation)
        registryMap.set(key, registry)
      }

      const registry = registryMap.get(key)!
      output.push({
        ...installation,
        granted_permissions: this.parseGrantedPermissions(installation),
        manifest: this.parseManifest(registry),
      })
    }

    return output
  }

  async listAuditLogs(installationId: string) {
    const installation = await this.store.getInstallationById(installationId)
    if (!installation) {
      throw new PluginNotFoundError(`Installation not found: ${installationId}`)
    }

    return this.store.listAuditLogs(installationId)
  }
}
