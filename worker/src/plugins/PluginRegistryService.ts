import path from 'node:path'
import { config } from '../config'
import { DirectusPluginStore, RegistryFilters } from './DirectusPluginStore'
import { PluginNotFoundError, ManifestValidationError } from './PluginErrors'
import { PluginManifestValidator } from './PluginManifestValidator'

function isPathInside(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export interface RegistryInstallInput {
  artifactPath: string
  pluginId?: string
  version?: string
}

export class PluginRegistryService {
  private readonly validator: PluginManifestValidator

  constructor(private readonly store: DirectusPluginStore) {
    this.validator = new PluginManifestValidator({ platformVersion: config.plugins.platformVersion })
  }

  private resolveSafeArtifactPath(rawArtifactPath: string): string {
    const absolute = path.resolve(rawArtifactPath)
    const root = path.resolve(config.plugins.artifactRoot)

    if (!isPathInside(root, absolute)) {
      throw new ManifestValidationError(
        `artifactPath must be inside PLUGIN_ARTIFACT_ROOT (${root}), got ${absolute}`,
      )
    }

    return absolute
  }

  async installFromArtifact(input: RegistryInstallInput) {
    if (!input.artifactPath || !input.artifactPath.trim()) {
      throw new ManifestValidationError('artifactPath is required')
    }

    const artifactPath = this.resolveSafeArtifactPath(input.artifactPath)
    const validated = await this.validator.validateFromArtifact(artifactPath)

    if (input.pluginId && input.pluginId !== validated.manifest.id) {
      throw new ManifestValidationError(
        `registry/install pluginId mismatch: request=${input.pluginId}, manifest=${validated.manifest.id}`,
      )
    }

    if (input.version && input.version !== validated.manifest.version) {
      throw new ManifestValidationError(
        `registry/install version mismatch: request=${input.version}, manifest=${validated.manifest.version}`,
      )
    }

    const existing = await this.store.getRegistry(validated.manifest.id, validated.manifest.version)

    const payload = {
      plugin_id: validated.manifest.id,
      version: validated.manifest.version,
      type: validated.manifest.type,
      api_version: validated.manifest.apiVersion,
      publisher: validated.manifest.publisher,
      level: validated.manifest.level,
      runtime_json: validated.manifest.runtime,
      entry_json: validated.manifest.entry,
      permissions_json: validated.manifest.permissions,
      slots_json: validated.manifest.slots ?? [],
      events_json: validated.manifest.events ?? [],
      hooks_json: validated.manifest.hooks ?? [],
      config_schema: validated.manifest.configSchema ?? null,
      platform_version_range: validated.manifest.platformVersionRange ?? null,
      checksum: validated.manifest.checksum ?? null,
      artifact_checksum: validated.artifactChecksum,
      artifact_path: validated.artifactRoot,
      manifest_json: validated.manifest,
      status: 'installed',
      last_error: null,
    } as const

    if (existing) {
      return this.store.updateRegistry(existing.id, payload)
    }

    return this.store.createRegistry(payload)
  }

  async validate(pluginId: string, version: string) {
    const record = await this.store.getRegistry(pluginId, version)
    if (!record) {
      throw new PluginNotFoundError(`Plugin registry record not found: ${pluginId}@${version}`)
    }

    try {
      const validated = await this.validator.validateFromArtifact(record.artifact_path)
      if (validated.manifest.id !== pluginId || validated.manifest.version !== version) {
        throw new ManifestValidationError(
          `Registry identity mismatch after validation: expected ${pluginId}@${version}, got ${validated.manifest.id}@${validated.manifest.version}`,
        )
      }

      return this.store.updateRegistry(record.id, {
        plugin_id: validated.manifest.id,
        version: validated.manifest.version,
        type: validated.manifest.type,
        api_version: validated.manifest.apiVersion,
        publisher: validated.manifest.publisher,
        level: validated.manifest.level,
        runtime_json: validated.manifest.runtime,
        entry_json: validated.manifest.entry,
        permissions_json: validated.manifest.permissions,
        slots_json: validated.manifest.slots ?? [],
        events_json: validated.manifest.events ?? [],
        hooks_json: validated.manifest.hooks ?? [],
        config_schema: validated.manifest.configSchema ?? null,
        platform_version_range: validated.manifest.platformVersionRange ?? null,
        checksum: validated.manifest.checksum ?? null,
        artifact_checksum: validated.artifactChecksum,
        manifest_json: validated.manifest,
        status: 'validated',
        validated_at: new Date().toISOString(),
        last_error: null,
      })
    } catch (error: any) {
      await this.store.updateRegistry(record.id, {
        status: 'error',
        last_error: error?.message ?? 'Manifest validation failed',
      })
      throw error
    }
  }

  list(filters: RegistryFilters = {}) {
    return this.store.listRegistry(filters)
  }

  async get(pluginId: string, version: string) {
    const record = await this.store.getRegistry(pluginId, version)
    if (!record) {
      throw new PluginNotFoundError(`Plugin registry record not found: ${pluginId}@${version}`)
    }
    return record
  }
}
