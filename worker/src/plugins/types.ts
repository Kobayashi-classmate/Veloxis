export type PluginType = 'operator' | 'datasource' | 'visualization' | 'ai-capability' | 'action-integration'

export type PluginLevel = 'official-built-in' | 'official-optional' | 'controlled-custom'

export type PluginRuntime = 'ui' | 'worker' | 'query'

export type PluginScopeType = 'global' | 'tenant' | 'project'

export type RegistryStatus = 'packaged' | 'installed' | 'validated' | 'error'

export type InstallationStatus =
  | 'packaged'
  | 'installed'
  | 'validated'
  | 'enabled'
  | 'suspended'
  | 'upgraded'
  | 'disabled'
  | 'uninstalled'
  | 'error'

export interface PluginManifest {
  id: string
  name: string
  version: string
  type: PluginType
  apiVersion: string
  publisher: string
  level: PluginLevel
  runtime: PluginRuntime[]
  entry: Partial<Record<PluginRuntime, string>>
  permissions: string[]
  platformVersionRange?: string
  checksum?: string
  signature?: string
  slots?: string[]
  events?: string[]
  hooks?: string[]
  configSchema?: string
  capabilities?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ValidatedPluginManifest {
  manifest: PluginManifest
  artifactRoot: string
  manifestPath: string
  artifactChecksum: string
}

export interface ManifestValidationOptions {
  platformVersion: string
}
