/**
 * Workbooks API — Directus v11 Items API
 *
 * Collections:
 *   workbooks        — 可视化工作台记录（属于某个 project）
 *   wb_categories    — 工作台内的类别（如"财务分析"、"风险预警"）
 *   wb_canvases      — 画布（属于某 category，可分组）
 *   wb_canvas_groups — 画布分组（属于某 category）
 *   wb_charts        — 图表实例（属于某 canvas）
 */

import request from '../request'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area'

export interface Workbook {
  id: string
  project_id: string
  name: string
  description?: string
  date_created?: string
  date_updated?: string
  canvas_count?: number
}

export interface WbCategory {
  id: string
  workbook_id: string
  name: string
  color?: string
  icon?: string
  order: number
}

export interface WbCanvasGroup {
  id: string
  category_id: string
  name: string
  order: number
}

export interface WbCanvas {
  id: string
  category_id: string
  group_id?: string | null
  name: string
  order: number
}

export interface WbChart {
  id: string
  canvas_id: string
  type: ChartType
  title: string
  x: number
  y: number
  w: number
  h: number
  /** JSON stringified ECharts option */
  option_json: string
  order: number
}

// ─── Workbook CRUD ────────────────────────────────────────────────────────────

export async function getWorkbooks(projectId: string): Promise<Workbook[]> {
  const res = await request.get('/items/workbooks', {
    'filter[project_id][_eq]': projectId,
    fields: 'id,name,description,date_created,date_updated',
    sort: '-date_created',
  })
  return (res as any)?.data ?? res ?? []
}

export async function getWorkbook(workbookId: string, projectId?: string): Promise<Workbook | null> {
  try {
    const params: Record<string, any> = {}
    if (projectId) {
      params['filter[project_id][_eq]'] = projectId
    }
    const res = await request.get(`/items/workbooks/${workbookId}`, { params })
    return (res as any)?.data ?? null
  } catch {
    return null
  }
}

export async function createWorkbook(data: {
  project_id: string
  name: string
  description?: string
}): Promise<Workbook> {
  const res = await request.post('/items/workbooks', data)
  return (res as any)?.data ?? res
}

export async function updateWorkbook(
  id: string,
  data: Partial<Pick<Workbook, 'name' | 'description'>>
): Promise<void> {
  await request.patch(`/items/workbooks/${id}`, data)
}

export async function deleteWorkbook(id: string): Promise<void> {
  await request.delete(`/items/workbooks/${id}`)
}

// ─── Category CRUD ────────────────────────────────────────────────────────────

export async function getCategories(workbookId: string): Promise<WbCategory[]> {
  const res = await request.get('/items/wb_categories', {
    'filter[workbook_id][_eq]': workbookId,
    sort: 'order',
  })
  return (res as any)?.data ?? res ?? []
}

export async function createCategory(data: {
  workbook_id: string
  name: string
  color?: string
  icon?: string
  order?: number
}): Promise<WbCategory> {
  const res = await request.post('/items/wb_categories', { order: 0, ...data })
  return (res as any)?.data ?? res
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<WbCategory, 'name' | 'color' | 'icon' | 'order'>>
): Promise<void> {
  await request.patch(`/items/wb_categories/${id}`, data)
}

export async function deleteCategory(id: string): Promise<void> {
  await request.delete(`/items/wb_categories/${id}`)
}

// ─── Canvas Group CRUD ────────────────────────────────────────────────────────

export async function getCanvasGroups(categoryId: string): Promise<WbCanvasGroup[]> {
  const res = await request.get('/items/wb_canvas_groups', {
    'filter[category_id][_eq]': categoryId,
    sort: 'order',
  })
  return (res as any)?.data ?? res ?? []
}

export async function createCanvasGroup(data: {
  category_id: string
  name: string
  order?: number
}): Promise<WbCanvasGroup> {
  const res = await request.post('/items/wb_canvas_groups', { order: 0, ...data })
  return (res as any)?.data ?? res
}

export async function updateCanvasGroup(
  id: string,
  data: Partial<Pick<WbCanvasGroup, 'name' | 'order'>>
): Promise<void> {
  await request.patch(`/items/wb_canvas_groups/${id}`, data)
}

export async function deleteCanvasGroup(id: string): Promise<void> {
  await request.delete(`/items/wb_canvas_groups/${id}`)
}

// ─── Canvas CRUD ──────────────────────────────────────────────────────────────

export async function getCanvases(categoryId: string): Promise<WbCanvas[]> {
  const res = await request.get('/items/wb_canvases', {
    'filter[category_id][_eq]': categoryId,
    sort: 'order',
  })
  return (res as any)?.data ?? res ?? []
}

export async function createCanvas(data: {
  category_id: string
  name: string
  group_id?: string | null
  order?: number
}): Promise<WbCanvas> {
  const res = await request.post('/items/wb_canvases', { order: 0, group_id: null, ...data })
  return (res as any)?.data ?? res
}

export async function updateCanvas(
  id: string,
  data: Partial<Pick<WbCanvas, 'name' | 'group_id' | 'order'>>
): Promise<void> {
  await request.patch(`/items/wb_canvases/${id}`, data)
}

export async function deleteCanvas(id: string): Promise<void> {
  await request.delete(`/items/wb_canvases/${id}`)
}

// ─── Chart CRUD ───────────────────────────────────────────────────────────────

export async function getCharts(canvasId: string): Promise<WbChart[]> {
  const res = await request.get('/items/wb_charts', {
    'filter[canvas_id][_eq]': canvasId,
    sort: 'order',
  })
  return (res as any)?.data ?? res ?? []
}

export async function createChart(data: Omit<WbChart, 'id'>): Promise<WbChart> {
  const res = await request.post('/items/wb_charts', data)
  return (res as any)?.data ?? res
}

export async function updateChart(
  id: string,
  data: Partial<Omit<WbChart, 'id' | 'canvas_id'>>
): Promise<void> {
  await request.patch(`/items/wb_charts/${id}`, data)
}

export async function deleteChart(id: string): Promise<void> {
  await request.delete(`/items/wb_charts/${id}`)
}
