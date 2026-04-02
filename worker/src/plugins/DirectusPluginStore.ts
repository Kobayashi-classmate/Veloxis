import axios, { AxiosInstance } from 'axios'
import { config } from '../config'
import { PluginAuditRecord, PluginInstallationRecord, PluginRegistryRecord } from './entities'
import { PluginNotFoundError } from './PluginErrors'
import { PluginScopeType } from './types'

function extractId(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'id' in value && typeof (value as any).id === 'string') {
    return (value as any).id
  }
  return null
}

function parseJsonField<T>(value: unknown, fallback: T): T {
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

export interface InstallationFilters {
  pluginId?: string
  version?: string
  type?: string
  status?: string
  scopeType?: PluginScopeType
  scopeId?: string
}

export interface RegistryFilters {
  pluginId?: string
  version?: string
  type?: string
  status?: string
}

export class DirectusPluginStore {
  private readonly client: AxiosInstance

  constructor(accessToken: string) {
    this.client = axios.create({
      baseURL: config.directus.url,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  }

  async listRegistry(filters: RegistryFilters = {}): Promise<PluginRegistryRecord[]> {
    const response = await this.client.get('/items/plugins_registry', {
      params: { limit: -1, sort: '-date_updated' },
    })

    const records = (response.data?.data ?? []) as PluginRegistryRecord[]
    return records.filter((record) => {
      if (filters.pluginId && record.plugin_id !== filters.pluginId) return false
      if (filters.version && record.version !== filters.version) return false
      if (filters.type && record.type !== filters.type) return false
      if (filters.status && record.status !== filters.status) return false
      return true
    })
  }

  async getRegistry(pluginId: string, version: string): Promise<PluginRegistryRecord | null> {
    const records = await this.listRegistry({ pluginId, version })
    return records.find((item) => item.plugin_id === pluginId && item.version === version) ?? null
  }

  async createRegistry(payload: Partial<PluginRegistryRecord>): Promise<PluginRegistryRecord> {
    const response = await this.client.post('/items/plugins_registry', payload)
    return response.data?.data as PluginRegistryRecord
  }

  async updateRegistry(id: string, payload: Partial<PluginRegistryRecord>): Promise<PluginRegistryRecord> {
    const response = await this.client.patch(`/items/plugins_registry/${id}`, payload)
    return response.data?.data as PluginRegistryRecord
  }

  async listInstallations(filters: InstallationFilters = {}): Promise<PluginInstallationRecord[]> {
    const response = await this.client.get('/items/plugin_installations', {
      params: { limit: -1, sort: '-date_updated' },
    })

    const records = (response.data?.data ?? []) as PluginInstallationRecord[]
    return records.filter((record) => {
      if (filters.pluginId && record.plugin_id !== filters.pluginId) return false
      if (filters.version && record.version !== filters.version) return false
      if (filters.type && record.type !== filters.type) return false
      if (filters.status && record.status !== filters.status) return false
      if (filters.scopeType && record.scope_type !== filters.scopeType) return false
      if (filters.scopeType && filters.scopeType === 'global') return true
      if (filters.scopeId && record.scope_id !== filters.scopeId) return false
      return true
    })
  }

  async getInstallationById(installationId: string): Promise<PluginInstallationRecord | null> {
    try {
      const response = await this.client.get(`/items/plugin_installations/${installationId}`)
      return response.data?.data as PluginInstallationRecord
    } catch (error: any) {
      if (error?.response?.status === 404) return null
      throw error
    }
  }

  async createInstallation(payload: Partial<PluginInstallationRecord>): Promise<PluginInstallationRecord> {
    const response = await this.client.post('/items/plugin_installations', payload)
    return response.data?.data as PluginInstallationRecord
  }

  async updateInstallation(id: string, payload: Partial<PluginInstallationRecord>): Promise<PluginInstallationRecord> {
    const response = await this.client.patch(`/items/plugin_installations/${id}`, payload)
    return response.data?.data as PluginInstallationRecord
  }

  async createAuditLog(payload: PluginAuditRecord): Promise<void> {
    await this.client.post('/items/plugin_audit_logs', payload)
  }

  async listAuditLogs(installationId: string): Promise<PluginAuditRecord[]> {
    const response = await this.client.get('/items/plugin_audit_logs', {
      params: { limit: -1, sort: '-date_created' },
    })

    const records = (response.data?.data ?? []) as PluginAuditRecord[]
    return records.filter((record) => record.installation_id === installationId)
  }

  async resolveRegistryByInstallation(installation: PluginInstallationRecord): Promise<PluginRegistryRecord> {
    const registryId = extractId(installation.plugin_registry_id)
    if (registryId) {
      try {
        const response = await this.client.get(`/items/plugins_registry/${registryId}`)
        return response.data?.data as PluginRegistryRecord
      } catch (error: any) {
        if (error?.response?.status !== 404) throw error
      }
    }

    const fallback = await this.getRegistry(installation.plugin_id, installation.version)
    if (!fallback) {
      throw new PluginNotFoundError(
        `Plugin registry not found for installation ${installation.id} (${installation.plugin_id}@${installation.version})`,
      )
    }
    return fallback
  }

  parseManifest(record: PluginRegistryRecord) {
    return parseJsonField(record.manifest_json, null as any)
  }

  parseGrantedPermissions(record: PluginInstallationRecord): string[] {
    return parseJsonField(record.granted_permissions_json, [] as string[])
  }
}
