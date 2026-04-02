import path from 'node:path'
import {
  ALLOWED_EVENTS,
  ALLOWED_HOOKS,
  ALLOWED_PERMISSIONS,
  ALLOWED_PLUGIN_LEVELS,
  ALLOWED_PLUGIN_TYPES,
  ALLOWED_RUNTIMES,
  ALLOWED_SLOTS,
} from './constants'
import {
  computeArtifactChecksum,
  ensureArtifactFileExists,
  resolveArtifactFilePath,
  resolveManifestFromArtifact,
} from './artifactUtils'
import { ManifestValidationError } from './PluginErrors'
import { assertSemver, isPlatformVersionCompatible } from './semverUtils'
import { ManifestValidationOptions, PluginManifest, PluginRuntime, ValidatedPluginManifest } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ManifestValidationError(`Manifest ${fieldName} must be a string array`)
  }

  const result = value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new ManifestValidationError(`Manifest ${fieldName} contains invalid value`)
    }
    return item.trim()
  })

  const deduplicated = new Set(result)
  if (deduplicated.size !== result.length) {
    throw new ManifestValidationError(`Manifest ${fieldName} contains duplicate values`)
  }

  return result
}

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ManifestValidationError(`Manifest ${fieldName} is required`)
  }
  return value.trim()
}

export class PluginManifestValidator {
  private readonly options: ManifestValidationOptions

  constructor(options: ManifestValidationOptions) {
    this.options = options
  }

  async validateFromArtifact(artifactPath: string): Promise<ValidatedPluginManifest> {
    const resolved = await resolveManifestFromArtifact(artifactPath)
    const artifactChecksum = await computeArtifactChecksum(resolved.artifactRoot)
    const manifest = await this.validateManifestObject(resolved.manifest, resolved.artifactRoot, artifactChecksum)

    return {
      manifest,
      artifactRoot: resolved.artifactRoot,
      manifestPath: resolved.manifestPath,
      artifactChecksum,
    }
  }

  async validateManifestObject(
    manifest: PluginManifest,
    artifactRoot: string,
    artifactChecksum: string,
  ): Promise<PluginManifest> {
    if (!isObject(manifest)) {
      throw new ManifestValidationError('Manifest root must be an object')
    }

    const id = assertNonEmptyString(manifest.id, 'id')
    if (!/^[a-z0-9.-]+$/.test(id)) {
      throw new ManifestValidationError(`Manifest id contains invalid characters: ${id}`)
    }
    if (!id.includes('.')) {
      throw new ManifestValidationError(`Manifest id must contain at least one dot: ${id}`)
    }

    const name = assertNonEmptyString(manifest.name, 'name')
    const version = assertNonEmptyString(manifest.version, 'version')
    assertSemver(version, 'version')

    const type = assertNonEmptyString(manifest.type, 'type')
    if (!ALLOWED_PLUGIN_TYPES.has(type)) {
      throw new ManifestValidationError(`Manifest type is not allowed: ${type}`)
    }

    const apiVersion = assertNonEmptyString(manifest.apiVersion, 'apiVersion')
    if (apiVersion !== '1') {
      throw new ManifestValidationError(`Manifest apiVersion must be "1": ${apiVersion}`)
    }

    const publisher = assertNonEmptyString(manifest.publisher, 'publisher')

    const level = assertNonEmptyString(manifest.level, 'level')
    if (!ALLOWED_PLUGIN_LEVELS.has(level)) {
      throw new ManifestValidationError(`Manifest level is not allowed: ${level}`)
    }

    const runtime = asStringArray(manifest.runtime, 'runtime') as PluginRuntime[]
    if (!runtime.length) {
      throw new ManifestValidationError('Manifest runtime must not be empty')
    }
    if (runtime.length > 3) {
      throw new ManifestValidationError('Manifest runtime contains too many entries')
    }

    runtime.forEach((item) => {
      if (!ALLOWED_RUNTIMES.has(item)) {
        throw new ManifestValidationError(`Manifest runtime is not allowed: ${item}`)
      }
    })

    if (!isObject(manifest.entry)) {
      throw new ManifestValidationError('Manifest entry is required and must be an object')
    }

    const entry = manifest.entry as Partial<Record<PluginRuntime, string>>
    const entryKeys = Object.keys(entry)

    for (const runtimeKey of runtime) {
      const entryPath = entry[runtimeKey]
      if (typeof entryPath !== 'string' || !entryPath.trim()) {
        throw new ManifestValidationError(`Manifest entry.${runtimeKey} is required when runtime includes ${runtimeKey}`)
      }
      await ensureArtifactFileExists(artifactRoot, entryPath, `entry.${runtimeKey}`)
    }

    for (const key of entryKeys) {
      if (!runtime.includes(key as PluginRuntime)) {
        throw new ManifestValidationError(`Manifest entry.${key} is not declared in runtime`)
      }
      if (!ALLOWED_RUNTIMES.has(key as PluginRuntime)) {
        throw new ManifestValidationError(`Manifest entry contains unsupported runtime key: ${key}`)
      }
    }

    const permissions = asStringArray(manifest.permissions, 'permissions')
    for (const permission of permissions) {
      if (permission.includes('*')) {
        throw new ManifestValidationError(`Manifest permission wildcard is not allowed: ${permission}`)
      }
      if (!ALLOWED_PERMISSIONS.has(permission)) {
        throw new ManifestValidationError(`Manifest permission is not supported by host: ${permission}`)
      }
    }

    const slots = manifest.slots === undefined ? undefined : asStringArray(manifest.slots, 'slots')
    if (slots) {
      for (const slot of slots) {
        if (!ALLOWED_SLOTS.has(slot)) {
          throw new ManifestValidationError(`Manifest slot is not open: ${slot}`)
        }
      }
    }

    const events = manifest.events === undefined ? undefined : asStringArray(manifest.events, 'events')
    if (events) {
      for (const event of events) {
        if (!ALLOWED_EVENTS.has(event)) {
          throw new ManifestValidationError(`Manifest event is not open: ${event}`)
        }
      }
    }

    const hooks = manifest.hooks === undefined ? undefined : asStringArray(manifest.hooks, 'hooks')
    if (hooks) {
      for (const hook of hooks) {
        if (!ALLOWED_HOOKS.has(hook)) {
          throw new ManifestValidationError(`Manifest hook is not open: ${hook}`)
        }
      }
    }

    await this.assertTypeSpecificFields(manifest, artifactRoot, runtime, slots, events)

    const platformVersionRange =
      manifest.platformVersionRange === undefined
        ? undefined
        : assertNonEmptyString(manifest.platformVersionRange, 'platformVersionRange')

    if (!isPlatformVersionCompatible(platformVersionRange, this.options.platformVersion)) {
      throw new ManifestValidationError(
        `Manifest platformVersionRange ${platformVersionRange} is incompatible with host ${this.options.platformVersion}`,
      )
    }

    const checksum = manifest.checksum === undefined ? undefined : assertNonEmptyString(manifest.checksum, 'checksum')
    if (checksum) {
      if (!/^sha256:[a-f0-9]{64}$/.test(checksum)) {
        throw new ManifestValidationError(`Manifest checksum format is invalid: ${checksum}`)
      }
      if (checksum !== artifactChecksum) {
        throw new ManifestValidationError(`Manifest checksum mismatch, expected ${checksum} but got ${artifactChecksum}`)
      }
    }

    return {
      ...manifest,
      id,
      name,
      version,
      type: type as PluginManifest['type'],
      apiVersion,
      publisher,
      level: level as PluginManifest['level'],
      runtime,
      entry,
      permissions,
      ...(slots ? { slots } : {}),
      ...(events ? { events } : {}),
      ...(hooks ? { hooks } : {}),
      ...(platformVersionRange ? { platformVersionRange } : {}),
      ...(checksum ? { checksum } : {}),
    }
  }

  private async assertTypeSpecificFields(
    manifest: PluginManifest,
    artifactRoot: string,
    runtime: PluginRuntime[],
    slots?: string[],
    events?: string[],
  ): Promise<void> {
    const configSchema = manifest.configSchema

    if (manifest.type === 'operator' || manifest.type === 'datasource') {
      if (!configSchema) {
        throw new ManifestValidationError(`Manifest ${manifest.type} requires configSchema`)
      }
    }

    if (manifest.type === 'visualization') {
      if (!slots || slots.length === 0) {
        throw new ManifestValidationError('Manifest visualization requires slots')
      }
      if (!configSchema) {
        throw new ManifestValidationError('Manifest visualization requires configSchema')
      }

      const hasRenderer = slots.includes('workbook.chart.renderer')
      const hasAction = slots.includes('workbook.chart.action')
      if (!hasRenderer && !hasAction) {
        throw new ManifestValidationError(
          'Manifest visualization must declare workbook.chart.renderer or workbook.chart.action',
        )
      }
      if ((hasRenderer || hasAction) && !runtime.includes('ui')) {
        throw new ManifestValidationError('Manifest visualization chart slots require ui runtime')
      }
    }

    if (manifest.type === 'ai-capability') {
      if (!slots || slots.length === 0) {
        throw new ManifestValidationError('Manifest ai-capability requires slots')
      }
      if (!events || events.length === 0) {
        throw new ManifestValidationError('Manifest ai-capability requires events')
      }
      if (!configSchema) {
        throw new ManifestValidationError('Manifest ai-capability requires configSchema')
      }
    }

    if (manifest.type === 'action-integration') {
      if (!events || events.length === 0) {
        throw new ManifestValidationError('Manifest action-integration requires events')
      }
      if (!configSchema) {
        throw new ManifestValidationError('Manifest action-integration requires configSchema')
      }
    }

    if (configSchema) {
      await ensureArtifactFileExists(artifactRoot, configSchema, 'configSchema')
    }

    for (const runtimeKey of runtime) {
      const runtimeEntry = manifest.entry[runtimeKey]
      if (runtimeEntry && path.extname(resolveArtifactFilePath(artifactRoot, runtimeEntry)) === '') {
        throw new ManifestValidationError(`Manifest entry.${runtimeKey} must include a file extension`)
      }
    }
  }
}
