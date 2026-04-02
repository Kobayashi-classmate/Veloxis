import request from '../request'

export interface WorkerHealth {
  status: 'ok' | 'degraded'
  uptime: number
  timestamp: string
  queues: {
    ingestion: 'connected' | 'disconnected'
    workbench: 'connected' | 'disconnected'
  }
  version: string
}

export interface WorkerDatasetColumn {
  name: string
  type: string
  nullable: boolean
}

export interface WorkerDatasetQueryPayload {
  /** @deprecated Server now resolves project context from datasetId; this field is ignored and not sent. */
  projectId?: string
  xColumn: string
  yColumn?: string
  seriesColumn?: string
  aggregation?: 'sum' | 'count' | 'avg' | 'max' | 'min'
  limit?: number
  filters?: Record<string, string>
}

export interface WorkerDatasetQueryResult {
  rows: Record<string, unknown>[]
  total: number
}

export interface WorkerChartBinding {
  dataset_id: string
  x_column: string
  y_column?: string
  series_column?: string
  aggregation?: 'sum' | 'count' | 'avg' | 'max' | 'min'
}

export interface WorkerPluginManifest {
  id: string
  name: string
  version: string
  type: 'operator' | 'datasource' | 'visualization' | 'ai-capability' | 'action-integration'
  apiVersion: string
  publisher: string
  level: 'official-built-in' | 'official-optional' | 'controlled-custom'
  runtime: Array<'ui' | 'worker' | 'query'>
  entry: Record<string, string>
  permissions: string[]
  slots?: string[]
  events?: string[]
  hooks?: string[]
  configSchema?: string
  platformVersionRange?: string
  checksum?: string
  metadata?: Record<string, unknown>
}

export interface WorkerPluginRegistryRecord {
  id: string
  plugin_id: string
  version: string
  type: string
  status: string
  artifact_path: string
  artifact_checksum?: string
  manifest_json?: WorkerPluginManifest
  last_error?: string
}

export interface WorkerPluginInstallationRecord {
  id: string
  plugin_id: string
  version: string
  type: string
  scope_type: 'global' | 'tenant' | 'project'
  scope_id?: string | null
  status: string
  granted_permissions?: string[]
  manifest?: WorkerPluginManifest
}

export interface WorkerPluginAuditLog {
  id: string
  installation_id?: string | null
  action: string
  from_status?: string | null
  to_status?: string | null
  success: boolean
  error_message?: string | null
  request_id?: string | null
  date_created?: string
}

export async function getWorkerHealth(): Promise<WorkerHealth> {
  const res = await request.get('/worker-api/health')
  return (res as any)?.data ?? res
}

export async function getDatasetColumnsFromWorker(datasetId: string): Promise<WorkerDatasetColumn[]> {
  const res = await request.get(`/worker-api/datasets/${datasetId}/columns`)
  const payload = (res as any)?.data ?? res ?? {}
  return payload.columns ?? []
}

export async function queryDatasetFromWorker(
  datasetId: string,
  payload: WorkerDatasetQueryPayload
): Promise<WorkerDatasetQueryResult> {
  const { projectId: _deprecatedProjectId, ...queryPayload } = payload
  const res = await request.post(`/worker-api/datasets/${datasetId}/query`, queryPayload)
  return (res as any)?.data ?? res
}

export async function saveChartBindingFromWorker(
  chartId: string,
  binding: WorkerChartBinding
): Promise<WorkerChartBinding> {
  const res = await request.put(`/worker-api/charts/${chartId}/binding`, binding)
  const payload = (res as any)?.data ?? res ?? {}
  return payload.binding
}

export async function getChartBindingDataFromWorker(chartId: string): Promise<any> {
  const res = await request.get(`/worker-api/charts/${chartId}/binding/data`)
  return (res as any)?.data ?? res
}

export async function enqueueSchemaRegeneration(
  datasetId: string,
  _deprecatedTableName?: string
): Promise<any> {
  const res = await request.post('/worker-api/jobs/regenerate-schema', { datasetId })
  return (res as any)?.data ?? res
}

export async function exportWorkbookFromWorker(workbookId: string): Promise<any> {
  const res = await request.get(`/worker-api/workbooks/${workbookId}/export`)
  return (res as any)?.data ?? res
}

export async function installPluginRegistry(payload: {
  artifactPath: string
  pluginId?: string
  version?: string
}): Promise<WorkerPluginRegistryRecord> {
  const res = await request.post('/worker-api/plugins/registry/install', payload)
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function validatePluginRegistry(pluginId: string, version: string): Promise<WorkerPluginRegistryRecord> {
  const res = await request.post(`/worker-api/plugins/registry/${pluginId}/${version}/validate`, {})
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function getPluginRegistryList(params?: {
  pluginId?: string
  version?: string
  type?: string
  status?: string
}): Promise<WorkerPluginRegistryRecord[]> {
  const res = await request.get('/worker-api/plugins/registry', { params })
  const data = (res as any)?.data ?? res ?? {}
  return data.data ?? []
}

export async function getPluginRegistryDetail(pluginId: string, version: string): Promise<WorkerPluginRegistryRecord> {
  const res = await request.get(`/worker-api/plugins/registry/${pluginId}/${version}`)
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function createPluginInstallation(payload: {
  pluginId: string
  version: string
  scopeType: 'global' | 'tenant' | 'project'
  scopeId?: string
  requestedPermissions?: string[]
  config?: Record<string, unknown>
}): Promise<WorkerPluginInstallationRecord> {
  const res = await request.post('/worker-api/plugins/installations', payload)
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function enablePluginInstallation(installationId: string): Promise<WorkerPluginInstallationRecord> {
  const res = await request.post(`/worker-api/plugins/installations/${installationId}/enable`, {})
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function disablePluginInstallation(installationId: string): Promise<WorkerPluginInstallationRecord> {
  const res = await request.post(`/worker-api/plugins/installations/${installationId}/disable`, {})
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function upgradePluginInstallation(
  installationId: string,
  targetVersion: string
): Promise<WorkerPluginInstallationRecord> {
  const res = await request.post(`/worker-api/plugins/installations/${installationId}/upgrade`, { targetVersion })
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function uninstallPluginInstallation(installationId: string): Promise<WorkerPluginInstallationRecord> {
  const res = await request.delete(`/worker-api/plugins/installations/${installationId}/uninstall`)
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function getPluginInstallations(params?: {
  pluginId?: string
  version?: string
  type?: string
  status?: string
  scopeType?: 'global' | 'tenant' | 'project'
  scopeId?: string
  includeManifest?: boolean
  effectiveScopeType?: 'tenant' | 'project'
  effectiveScopeId?: string
}): Promise<WorkerPluginInstallationRecord[]> {
  const res = await request.get('/worker-api/plugins/installations', { params })
  const data = (res as any)?.data ?? res ?? {}
  return data.data ?? []
}

export async function getPluginInstallationDetail(
  installationId: string,
  includeManifest = false
): Promise<WorkerPluginInstallationRecord> {
  const res = await request.get(`/worker-api/plugins/installations/${installationId}`, {
    params: { includeManifest },
  })
  const data = (res as any)?.data ?? res ?? {}
  return data.data
}

export async function getPluginInstallationAuditLogs(installationId: string): Promise<WorkerPluginAuditLog[]> {
  const res = await request.get(`/worker-api/plugins/installations/${installationId}/audit-logs`)
  const data = (res as any)?.data ?? res ?? {}
  return data.data ?? []
}
