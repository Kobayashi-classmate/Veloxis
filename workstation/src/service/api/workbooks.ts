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
import { exportWorkbookFromWorker as exportWorkbookFromWorkerApi } from './worker'

// ─── UUID 生成 ────────────────────────────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ─── Slug 生成 ────────────────────────────────────────────────────────────────

/**
 * 将工作台名称转换为 URL-safe slug
 * 例："财务分析看板 Q1" → "wb-1698765432100-q1"
 * 使用时间戳确保唯一性，避免中文字符导致路由问题
 */
function generateWorkbookSlug(name: string): string {
  const ts = Date.now()
  // 提取 ASCII 字母数字部分（过滤中文）
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // 去除非 ASCII 字符
    .trim()
    .replace(/\s+/g, '-') // 空格转连字符
    .replace(/-+/g, '-') // 合并多连字符
    .slice(0, 20) // 最长 20 字符

  return ascii ? `wb-${ts}-${ascii}` : `wb-${ts}`
}

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area'

export interface Workbook {
  id: string
  project_id: string
  /** URL-safe slug，用作路由路径参数（如 "wb-1698765432100-sales"） */
  slug: string
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
  /**
   * 整张画布所有图表的快照（JSON.stringify(ChartSnapshot[])）
   * 主数据路径：加载时解析此字段，保存时 PATCH 此字段
   * 一次请求 = 整张画布，取代逐条操作 wb_charts
   */
  snapshot_json?: string
  /** 最近一次正式保存时间 */
  snapshot_at?: string
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
  /** 配色方案 id（对应 COLOR_THEMES） */
  color_theme?: string
  /** 是否显示图例 */
  show_legend?: boolean
  /** 是否显示数据标签 */
  show_label?: boolean
  /** 是否允许叠加到其他图表上方 */
  allow_overlap?: boolean
}

// ─── Canvas Draft（草稿）CRUD ─────────────────────────────────────────────────

/** 单张图表的快照结构（存入 snapshot_json） */
export interface ChartSnapshot {
  id: string
  canvasId: string
  type: ChartType
  title: string
  x: number
  y: number
  w: number
  h: number
  option: Record<string, any>
  colorTheme: string
  showLegend: boolean
  showLabel: boolean
  allowOverlap: boolean
  order: number
}

export interface WbCanvasDraft {
  id: string
  canvas_id: string
  /** JSON.stringify(ChartSnapshot[]) */
  snapshot_json: string
  saved_at: string
}

// ─── Workbook CRUD ────────────────────────────────────────────────────────────

export async function getWorkbooks(projectId: string): Promise<Workbook[]> {
  const res = await request.get('/items/workbooks', {
    'filter[project_id][_eq]': projectId,
    fields: 'id,slug,name,description,date_created,date_updated',
    sort: '-date_created',
  })
  return (res as any)?.data ?? res ?? []
}

/**
 * 通过 workbook UUID 获取单个工作台
 */
export async function getWorkbook(workbookId: string, projectId?: string): Promise<Workbook | null> {
  try {
    const params: Record<string, any> = { fields: 'id,slug,name,description,date_created,date_updated' }
    if (projectId) {
      params['filter[project_id][_eq]'] = projectId
    }
    const res = await request.get(`/items/workbooks/${workbookId}`, params)
    return (res as any)?.data ?? null
  } catch {
    return null
  }
}

/**
 * 通过 slug 获取单个工作台（供 VisualWorkbench 路由使用）
 */
export async function getWorkbookBySlug(slug: string, projectId?: string): Promise<Workbook | null> {
  try {
    const params: Record<string, any> = {
      'filter[slug][_eq]': slug,
      fields: 'id,slug,name,description,date_created,date_updated',
      limit: 1,
    }
    if (projectId) {
      params['filter[project_id][_eq]'] = projectId
    }
    const res = await request.get('/items/workbooks', params)
    const list = (res as any)?.data ?? res ?? []
    return list[0] ?? null
  } catch {
    return null
  }
}

export async function createWorkbook(data: {
  project_id: string
  name: string
  description?: string
  slug?: string
}): Promise<Workbook> {
  const id = generateUUID()
  const slug = data.slug?.trim() ? data.slug.trim() : generateWorkbookSlug(data.name)
  const res = await request.post('/items/workbooks', {
    id,
    slug,
    project_id: data.project_id,
    name: data.name,
    description: data.description ?? '',
  })
  return (res as any)?.data ?? res
}

export async function updateWorkbook(id: string, data: Partial<Pick<Workbook, 'name' | 'description'>>): Promise<void> {
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
  const res = await request.post('/items/wb_categories', { id: generateUUID(), order: 0, ...data })
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
  const res = await request.post('/items/wb_canvas_groups', { id: generateUUID(), order: 0, ...data })
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
  const res = await request.post('/items/wb_canvases', { id: generateUUID(), order: 0, group_id: null, ...data })
  return (res as any)?.data ?? res
}

export async function updateCanvas(
  id: string,
  data: Partial<Pick<WbCanvas, 'name' | 'group_id' | 'order' | 'snapshot_json' | 'snapshot_at'>>
): Promise<void> {
  await request.patch(`/items/wb_canvases/${id}`, data)
}

/**
 * 获取画布（含 snapshot_json 字段）
 * 用于 bootstrap 时加载图表数据
 */
export async function getCanvasWithSnapshot(canvasId: string): Promise<WbCanvas | null> {
  try {
    const res = await request.get(`/items/wb_canvases/${canvasId}`, {
      fields: 'id,category_id,group_id,name,order,snapshot_json,snapshot_at',
    })
    return (res as any)?.data ?? null
  } catch {
    return null
  }
}

/**
 * 将整张画布的图表快照保存到 wb_canvases.snapshot_json
 * 1 次 PATCH = 整张画布所有图表，取代逐条 wb_charts 操作
 */
export async function saveCanvasSnapshot(canvasId: string, snapshots: ChartSnapshot[]): Promise<void> {
  await request.patch(`/items/wb_canvases/${canvasId}`, {
    snapshot_json: JSON.stringify(snapshots),
    snapshot_at: new Date().toISOString(),
  })
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
  const res = await request.post('/items/wb_charts', { id: generateUUID(), ...data })
  return (res as any)?.data ?? res
}

export async function updateChart(id: string, data: Partial<Omit<WbChart, 'id' | 'canvas_id'>>): Promise<void> {
  await request.patch(`/items/wb_charts/${id}`, data)
}

export async function deleteChart(id: string): Promise<void> {
  await request.delete(`/items/wb_charts/${id}`)
}

// ─── Canvas Draft CRUD ────────────────────────────────────────────────────────

/**
 * 获取指定画布的草稿（若不存在返回 null）
 */
export async function getDraft(canvasId: string): Promise<WbCanvasDraft | null> {
  try {
    const res = await request.get('/items/wb_canvas_drafts', {
      'filter[canvas_id][_eq]': canvasId,
      fields: 'id,canvas_id,snapshot_json,saved_at',
      limit: 1,
    })
    const list = (res as any)?.data ?? res ?? []
    return list[0] ?? null
  } catch {
    return null
  }
}

/**
 * 创建或更新草稿（按 canvas_id 唯一，先查再 POST/PATCH）
 */
export async function upsertDraft(canvasId: string, snapshots: ChartSnapshot[]): Promise<WbCanvasDraft> {
  const snapshotJson = JSON.stringify(snapshots)
  const existing = await getDraft(canvasId)
  if (existing) {
    await request.patch(`/items/wb_canvas_drafts/${existing.id}`, {
      snapshot_json: snapshotJson,
      saved_at: new Date().toISOString(),
    })
    return { ...existing, snapshot_json: snapshotJson, saved_at: new Date().toISOString() }
  }
  const res = await request.post('/items/wb_canvas_drafts', {
    id: generateUUID(),
    canvas_id: canvasId,
    snapshot_json: snapshotJson,
    saved_at: new Date().toISOString(),
  })
  return (res as any)?.data ?? res
}

/**
 * 删除指定画布的草稿（按 canvas_id 查找后删除）
 */
export async function deleteDraft(canvasId: string): Promise<void> {
  const existing = await getDraft(canvasId)
  if (existing) {
    await request.delete(`/items/wb_canvas_drafts/${existing.id}`)
  }
}

/**
 * 按草稿自身 id 删除（内部用）
 */
export async function deleteDraftById(draftId: string): Promise<void> {
  await request.delete(`/items/wb_canvas_drafts/${draftId}`)
}

// ─── Worker API ───────────────────────────────────────────────────────────────

/**
 * @deprecated Prefer importing from `service/api/worker`.
 * Kept for backward compatibility with existing callers.
 */
export async function exportWorkbookFromWorker(workbookId: string): Promise<any> {
  return exportWorkbookFromWorkerApi(workbookId)
}
