import { InstallationStatus, PluginManifest, PluginScopeType, RegistryStatus } from './types'

export interface PluginRegistryRecord {
  id: string
  plugin_id: string
  version: string
  type: string
  api_version: string
  publisher: string
  level: string
  runtime_json: string[] | string | null
  entry_json: Record<string, unknown> | string | null
  permissions_json: string[] | string | null
  slots_json?: string[] | string | null
  events_json?: string[] | string | null
  hooks_json?: string[] | string | null
  config_schema?: string | null
  platform_version_range?: string | null
  checksum?: string | null
  artifact_checksum?: string | null
  artifact_path: string
  manifest_json?: PluginManifest | string | null
  status: RegistryStatus
  validated_at?: string | null
  last_error?: string | null
  date_created?: string
  date_updated?: string
}

export interface PluginInstallationRecord {
  id: string
  plugin_registry_id: string | { id: string }
  plugin_id: string
  version: string
  type: string
  scope_type: PluginScopeType
  scope_id?: string | null
  status: InstallationStatus
  granted_permissions_json?: string[] | string | null
  config_json?: Record<string, unknown> | string | null
  enabled_at?: string | null
  disabled_at?: string | null
  uninstalled_at?: string | null
  last_error?: string | null
  date_created?: string
  date_updated?: string
}

export interface PluginAuditRecord {
  id?: string
  installation_id?: string | null
  plugin_id: string
  version: string
  scope_type?: PluginScopeType | null
  scope_id?: string | null
  action: string
  from_status?: string | null
  to_status?: string | null
  actor_id?: string | null
  actor_email?: string | null
  request_id?: string | null
  success: boolean
  error_message?: string | null
  detail_json?: Record<string, unknown> | string | null
}
