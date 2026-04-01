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
