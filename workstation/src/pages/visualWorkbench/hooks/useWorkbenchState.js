import { create } from 'zustand'
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getCanvasGroups, createCanvasGroup, updateCanvasGroup, deleteCanvasGroup,
  getCanvases, createCanvas, updateCanvas, deleteCanvas,
  getCanvasWithSnapshot,
} from '@src/service/api/workbooks'
import { findLegalPosition } from '../utils/collisionUtils'
import { getVisualizationRendererByType } from '@src/plugins/slotRegistry'

/** ─── 图表类型默认 ECharts option ───────────────────────────────────────── */

export const CHART_DEFAULTS = {
  line: {
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额'] },
    xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
    yAxis: { type: 'value' },
    series: [{ name: '销售额', type: 'line', smooth: true, data: [820, 932, 901, 934, 1290, 1330] }],
  },
  bar: {
    tooltip: { trigger: 'axis' },
    legend: { data: ['完成量', '目标量'] },
    xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
    yAxis: { type: 'value' },
    series: [
      { name: '完成量', type: 'bar', data: [320, 480, 550, 390] },
      { name: '目标量', type: 'bar', data: [400, 500, 600, 450] },
    ],
  },
  pie: {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left' },
    series: [
      {
        name: '区域占比',
        type: 'pie',
        radius: '60%',
        data: [
          { value: 40, name: '华东' },
          { value: 25, name: '华南' },
          { value: 20, name: '华北' },
          { value: 15, name: '其他' },
        ],
      },
    ],
  },
  scatter: {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', name: '投入（万元）' },
    yAxis: { type: 'value', name: '产出（万元）' },
    series: [
      {
        type: 'scatter',
        symbolSize: 12,
        data: Array.from({ length: 30 }, () => [
          Math.round(Math.random() * 100),
          Math.round(Math.random() * 200),
        ]),
      },
    ],
  },
  area: {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', boundaryGap: false, data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' },
    series: [
      {
        name: '访问量',
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.3 },
        data: [820, 1132, 901, 1434, 1090, 1230, 1520],
      },
    ],
  },
}

export const CHART_META = [
  { type: 'line',    label: '折线图', icon: '📈', group: '趋势' },
  { type: 'bar',     label: '柱状图', icon: '📊', group: '对比' },
  { type: 'pie',     label: '饼图',   icon: '🥧', group: '占比' },
  { type: 'scatter', label: '散点图', icon: '✦',  group: '分布' },
  { type: 'area',    label: '面积图', icon: '📉', group: '趋势' },
]

export const COLOR_THEMES = [
  { id: 'default', label: '默认', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'] },
  { id: 'warm',    label: '暖色', colors: ['#dd6b66', '#759aa0', '#e69d87', '#8dc1a9', '#ea7e53'] },
  { id: 'cool',    label: '冷色', colors: ['#516b91', '#59c4e6', '#edafda', '#93b7e3', '#a5e7f0'] },
  { id: 'mono',    label: '单色', colors: ['#1677ff', '#4096ff', '#69b1ff', '#91caff', '#bae0ff'] },
]

// ─── 纯函数工具 ───────────────────────────────────────────────────────────────

/**
 * 将 ChartSnapshot（camelCase）标准化为 Zustand store 使用的内存结构。
 * 加载 snapshot_json 时使用；snapshot 本身已是 camelCase，直接补全缺省值即可。
 * 注意：必须在 CHART_DEFAULTS 声明之后定义，避免 TDZ（暂时性死区）。
 */
function normalizeSnapshot(snap) {
  return {
    id: snap.id,
    canvasId: snap.canvasId,
    type: snap.type,
    title: snap.title,
    x: snap.x ?? 40,
    y: snap.y ?? 40,
    w: snap.w ?? 380,
    h: snap.h ?? 260,
    option: snap.option ?? (CHART_DEFAULTS[snap.type] ?? CHART_DEFAULTS.line),
    colorTheme: snap.colorTheme ?? 'default',
    showLegend: snap.showLegend ?? true,
    showLabel: snap.showLabel ?? false,
    allowOverlap: snap.allowOverlap ?? false,
    order: snap.order ?? 0,
  }
}

/**
 * 在同一类别画布中查找重名，自动添加后缀数字（最大值 + 1）。
 * 例：名称 "销售看板" 已存在时返回 "销售看板 2"，"销售看板 2" 已存在时返回 "销售看板 3"。
 */
function deduplicateCanvasName(name, canvases, categoryId) {
  const siblings = canvases.filter((cv) => cv.categoryId === categoryId)
  const existingNames = new Set(siblings.map((cv) => cv.name))
  if (!existingNames.has(name)) return name

  // 收集所有 "name N" 形式的后缀数字
  const suffixRe = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`)
  let maxN = 1
  for (const n of existingNames) {
    const m = n.match(suffixRe)
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10))
  }
  return `${name} ${maxN + 1}`
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

/**
 * 将 wb_canvases 记录的 snapshot_json 解析为 Zustand chart 列表。
 * 若 snapshot_json 为空或解析失败则返回空数组。
 *
 * 注意：Directus 可能将 TEXT 字段自动反序列化为对象（已解析），
 * 因此同时兼容 string 和 already-parsed array。
 */
function parseSnapshotJson(snapshotJson) {
  if (!snapshotJson) return []
  try {
    // Directus 有时会把 JSON TEXT 字段自动 parse 成对象，需兼容两种情况
    const arr = typeof snapshotJson === 'string' ? JSON.parse(snapshotJson) : snapshotJson
    if (!Array.isArray(arr)) return []
    return arr.map(normalizeSnapshot)
  } catch {
    return []
  }
}

/** ─── Zustand Store ─────────────────────────────────────────────────────── */

const useWorkbenchState = create((set, get) => ({
  /** ── 元数据 ── */
  workbookId: null,

  /** ── 加载状态 ── */
  bootstrapping: false,
  bootstrapped: false,

  /** ── 类别 ── */
  categories: [],
  activeCategoryId: null,

  /** ── 画布 ── */
  canvases: [],
  activeCanvasId: null,

  /** ── 画布分组 ── */
  groups: [],

  /** ── 图表（纯内存，不与 wb_charts 同步） ── */
  charts: [],

  /** ── 已加载 snapshot 的画布 id 集合（避免重复拉取） ── */
  loadedCanvasIds: new Set(),

  /** ── 浮动配置面板 ── */
  configPanel: {
    visible: false,
    chartId: null,
    x: 200,
    y: 120,
  },

  /** ── 选中图表 ── */
  selectedChartId: null,

  /** ── 类别侧边栏 ── */
  categorySidebarOpen: false,

  /** ── 保存状态 ── */
  isDirty: false,

  /** ── 画布视图 ── */
  canvasGridMode: 'dots',   // 'dots' | 'lines' | 'none'
  canvasZoom: 100,          // 50 | 75 | 100 | 125 | 150

  /** ─────────────────────────── Bootstrap ──────────────────────────────── */

  /**
   * 首次挂载时从 Directus 加载 workbook 全量数据：
   *   categories → 取第一个类别的 canvases + groups
   *   → 取第一个 canvas（含 snapshot_json）解析图表
   * 图表数据源：wb_canvases.snapshot_json（一次请求，不读 wb_charts）
   */
  bootstrap: async (workbookId) => {
    const state = get()
    if (state.bootstrapped && state.workbookId === workbookId) return
    set({ bootstrapping: true, workbookId })

    try {
      const cats = await getCategories(workbookId)
      if (!cats.length) {
        // 工作台无任何类别 → 自动创建默认类别 + 默认画布
        try {
          const newCatRaw = await createCategory({
            workbook_id: workbookId,
            name: '默认类别',
            color: '#1677ff',
            icon: '📁',
            order: 0,
          })
          const newCanvasRaw = await createCanvas({ category_id: newCatRaw.id, name: '默认画布', order: 0 })
          const newCat = {
            id: newCatRaw.id,
            workbook_id: newCatRaw.workbook_id,
            name: newCatRaw.name,
            color: newCatRaw.color ?? '#1677ff',
            icon: newCatRaw.icon ?? '📁',
            order: 0,
          }
          const newCanvas = {
            id: newCanvasRaw.id,
            categoryId: newCanvasRaw.category_id,
            groupId: null,
            name: newCanvasRaw.name,
            order: 0,
          }
          set({
            categories: [newCat],
            activeCategoryId: newCat.id,
            canvases: [newCanvas],
            activeCanvasId: newCanvas.id,
            groups: [],
            charts: [],
            loadedCanvasIds: new Set([newCanvas.id]),
            bootstrapped: true,
            bootstrapping: false,
          })
        } catch {
          // 自动创建失败，保持空态让界面引导手动创建
          set({ categories: [], activeCategoryId: null, canvases: [], activeCanvasId: null, groups: [], charts: [], bootstrapped: true, bootstrapping: false })
        }
        return
      }

      const firstCat = cats[0]

      const [canvases, groups] = await Promise.all([
        getCanvases(firstCat.id),
        getCanvasGroups(firstCat.id),
      ])

      const normalizedCats = cats.map((c) => ({
        id: c.id,
        workbook_id: c.workbook_id,
        name: c.name,
        color: c.color ?? '#1677ff',
        icon: c.icon ?? '📁',
        order: c.order ?? 0,
      }))

      const normalizedCanvases = canvases.map((cv) => ({
        id: cv.id,
        categoryId: cv.category_id,
        groupId: cv.group_id ?? null,
        name: cv.name,
        order: cv.order ?? 0,
      }))

      const normalizedGroups = groups.map((g) => ({
        id: g.id,
        categoryId: g.category_id,
        name: g.name,
        order: g.order ?? 0,
      }))

      // 该类别下没有画布时，自动创建一个默认画布
      let firstCanvas = normalizedCanvases[0] ?? null
      if (!firstCanvas) {
        try {
          const newRaw = await createCanvas({ category_id: firstCat.id, name: '默认画布', order: 0 })
          firstCanvas = {
            id: newRaw.id,
            categoryId: newRaw.category_id,
            groupId: null,
            name: newRaw.name,
            order: 0,
          }
          normalizedCanvases.push(firstCanvas)
        } catch { /* 自动创建失败时保持 null，让 SheetBar 引导手动创建 */ }
      }

      // 从 snapshot_json 读取图表（一次请求，替代逐条读 wb_charts）
      let charts = []
      const loadedCanvasIds = new Set()
      if (firstCanvas) {
        const canvasWithSnap = await getCanvasWithSnapshot(firstCanvas.id)
        charts = parseSnapshotJson(canvasWithSnap?.snapshot_json)
        // 若 snapshot_json 为空，确保 canvasId 填充
        if (charts.length === 0) {
          charts = []
        } else {
          charts = charts.map((ch) => ({ ...ch, canvasId: firstCanvas.id }))
        }
        loadedCanvasIds.add(firstCanvas.id)
      }

      set({
        categories: normalizedCats,
        activeCategoryId: firstCat.id,
        canvases: normalizedCanvases,
        activeCanvasId: firstCanvas?.id ?? null,
        groups: normalizedGroups,
        charts,
        loadedCanvasIds,
        bootstrapped: true,
        bootstrapping: false,
      })
    } catch {
      set({ bootstrapping: false, bootstrapped: true })
    }
  },

  /**
   * 切换类别时，从 API 加载该类别的画布和分组（懒加载）
   */
  loadCategory: async (categoryId) => {
    const existing = get().canvases.filter((cv) => cv.categoryId === categoryId)
    if (existing.length > 0) {
      const firstCanvas = existing.sort((a, b) => a.order - b.order)[0]
      set({ activeCategoryId: categoryId, activeCanvasId: firstCanvas.id })
      get().loadCanvas(firstCanvas.id)
      return
    }

    const [canvases, groups] = await Promise.all([
      getCanvases(categoryId),
      getCanvasGroups(categoryId),
    ])

    const normalizedCanvases = canvases.map((cv) => ({
      id: cv.id,
      categoryId: cv.category_id,
      groupId: cv.group_id ?? null,
      name: cv.name,
      order: cv.order ?? 0,
    }))

    const normalizedGroups = groups.map((g) => ({
      id: g.id,
      categoryId: g.category_id,
      name: g.name,
      order: g.order ?? 0,
    }))

    let firstCanvas = normalizedCanvases[0] ?? null
    if (!firstCanvas) {
      try {
        const newRaw = await createCanvas({ category_id: categoryId, name: '默认画布', order: 0 })
        firstCanvas = {
          id: newRaw.id,
          categoryId: newRaw.category_id,
          groupId: null,
          name: newRaw.name,
          order: 0,
        }
        normalizedCanvases.push(firstCanvas)
      } catch { /* 保持 null */ }
    }

    set((s) => ({
      canvases: [...s.canvases, ...normalizedCanvases],
      groups: [...s.groups, ...normalizedGroups],
      activeCategoryId: categoryId,
      activeCanvasId: firstCanvas?.id ?? null,
    }))

    if (firstCanvas) {
      get().loadCanvas(firstCanvas.id)
    }
  },

  /**
   * 切换画布时，从 snapshot_json 懒加载图表。
   * 已加载过的画布不重复请求（loadedCanvasIds 追踪）。
   */
  loadCanvas: async (canvasId) => {
    set({ activeCanvasId: canvasId })
    const { loadedCanvasIds } = get()
    if (loadedCanvasIds.has(canvasId)) return

    const canvasWithSnap = await getCanvasWithSnapshot(canvasId)
    const charts = parseSnapshotJson(canvasWithSnap?.snapshot_json)
      .map((ch) => ({ ...ch, canvasId }))

    set((s) => ({
      charts: [...s.charts.filter((c) => c.canvasId !== canvasId), ...charts],
      loadedCanvasIds: new Set([...s.loadedCanvasIds, canvasId]),
    }))
  },

  /** ─────────────────────────── Actions ──────────────────────────────────── */

  /** 类别 */
  addCategory: async (name, color = '#1677ff', icon = '📁') => {
    const { workbookId, categories, canvases } = get()
    if (!workbookId) return
    const raw = await createCategory({ workbook_id: workbookId, name, color, icon, order: categories.length })
    const dedupedName = deduplicateCanvasName('新画布', canvases, raw.id)
    const canvasRaw = await createCanvas({ category_id: raw.id, name: dedupedName, order: 0 })
    const cat = { id: raw.id, workbook_id: raw.workbook_id, name: raw.name, color: raw.color ?? color, icon: raw.icon ?? icon, order: raw.order ?? categories.length }
    const canvas = { id: canvasRaw.id, categoryId: canvasRaw.category_id, groupId: null, name: canvasRaw.name, order: 0 }
    set((s) => ({
      categories: [...s.categories, cat],
      canvases: [...s.canvases, canvas],
      activeCategoryId: cat.id,
      activeCanvasId: canvas.id,
      loadedCanvasIds: new Set([...s.loadedCanvasIds, canvas.id]),
    }))
  },

  renameCategory: async (id, name) => {
    await updateCategory(id, { name })
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
      isDirty: true,
    }))
  },

  updateCategory: async (id, patch) => {
    await updateCategory(id, patch)
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      isDirty: true,
    }))
  },

  removeCategory: async (id) => {
    await deleteCategory(id)
    set((s) => {
      const remaining = s.categories.filter((c) => c.id !== id)
      const canvasIds = s.canvases.filter((cv) => cv.categoryId === id).map((cv) => cv.id)
      const newLoadedIds = new Set([...s.loadedCanvasIds].filter((cid) => !canvasIds.includes(cid)))
      return {
        categories: remaining,
        canvases: s.canvases.filter((cv) => cv.categoryId !== id),
        charts: s.charts.filter((ch) => !canvasIds.includes(ch.canvasId)),
        loadedCanvasIds: newLoadedIds,
        activeCategoryId:
          s.activeCategoryId === id
            ? remaining[0]?.id ?? null
            : s.activeCategoryId,
      }
    })
  },

  setActiveCategory: (id) => {
    get().loadCategory(id)
  },

  /** 分组 */
  addGroup: async (categoryId, name) => {
    const { groups, canvases } = get()
    const topLevelCount = groups.filter((g) => g.categoryId === categoryId).length + canvases.filter((cv) => cv.categoryId === categoryId && !cv.groupId).length
    const raw = await createCanvasGroup({ category_id: categoryId, name, order: topLevelCount })
    const group = { id: raw.id, categoryId: raw.category_id ?? categoryId, name: raw.name, order: raw.order ?? topLevelCount }
    set((s) => ({ groups: [...s.groups, group] }))
    return group.id
  },

  renameGroup: async (id, name) => {
    await updateCanvasGroup(id, { name })
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
    }))
  },

  removeGroup: async (id) => {
    await deleteCanvasGroup(id)
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      canvases: s.canvases.map((cv) => (cv.groupId === id ? { ...cv, groupId: null } : cv)),
    }))
  },

  /** 画布 */
  addCanvas: async (categoryId, name = '新画布', groupId = null) => {
    const { canvases, groups } = get()
    const dedupedName = deduplicateCanvasName(name, canvases, categoryId)
    const topLevelCount = canvases.filter((cv) => cv.categoryId === categoryId && !cv.groupId).length + groups.filter((g) => g.categoryId === categoryId).length
    const raw = await createCanvas({ category_id: categoryId, name: dedupedName, group_id: groupId, order: topLevelCount })
    const canvas = { id: raw.id, categoryId: raw.category_id ?? categoryId, groupId: raw.group_id ?? null, name: raw.name, order: raw.order ?? topLevelCount }
    set((s) => ({
      canvases: [...s.canvases, canvas],
      activeCanvasId: canvas.id,
      // 新画布无图表，直接标记为已加载，避免触发 snapshot 拉取
      loadedCanvasIds: new Set([...s.loadedCanvasIds, canvas.id]),
    }))
    return canvas.id
  },

  renameCanvas: async (id, name) => {
    await updateCanvas(id, { name })
    set((s) => ({
      canvases: s.canvases.map((cv) => (cv.id === id ? { ...cv, name } : cv)),
      isDirty: true,
    }))
  },

  moveCanvasToGroup: async (canvasId, groupId) => {
    await updateCanvas(canvasId, { group_id: groupId })
    set((s) => ({
      canvases: s.canvases.map((cv) => (cv.id === canvasId ? { ...cv, groupId } : cv)),
    }))
  },

  reorderCanvas: async (categoryId, orderedCanvasIds) => {
    const { canvases } = get()
    const categoryCanvasIds = canvases.filter((cv) => cv.categoryId === categoryId).map((cv) => cv.id)
    const validOrder = orderedCanvasIds.filter((id) => categoryCanvasIds.includes(id))

    // 只更新 order 实际发生变化的画布，减少无效请求
    const oldOrderMap = new Map(
      canvases.filter((cv) => cv.categoryId === categoryId).map((cv) => [cv.id, cv.order ?? 0])
    )
    const updatedCanvases = canvases.map((cv) => {
      if (cv.categoryId !== categoryId) return cv
      const newIndex = validOrder.indexOf(cv.id)
      return newIndex >= 0 ? { ...cv, order: newIndex } : cv
    })
    set(() => ({ canvases: updatedCanvases }))

    // 仅对 order 真正变更的画布发 PATCH
    const patches = validOrder
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => oldOrderMap.get(id) !== index)
    await Promise.all(patches.map(({ id, index }) => updateCanvas(id, { order: index })))
  },

  reorderGroup: async (categoryId, orderedGroupIds) => {
    const { groups } = get()
    const categoryGroupIds = groups.filter((g) => g.categoryId === categoryId).map((g) => g.id)
    const validOrder = orderedGroupIds.filter((id) => categoryGroupIds.includes(id))

    const oldOrderMap = new Map(
      groups.filter((g) => g.categoryId === categoryId).map((g) => [g.id, g.order ?? 0])
    )
    const updatedGroups = groups.map((g) => {
      const newIndex = validOrder.indexOf(g.id)
      return newIndex >= 0 ? { ...g, order: newIndex } : g
    })
    set(() => ({ groups: updatedGroups }))

    const patches = validOrder
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => oldOrderMap.get(id) !== index)
    await Promise.all(patches.map(({ id, index }) => updateCanvasGroup(id, { order: index })))
  },

  reorderTopLevel: async (categoryId, orderedTopLevelIds) => {
    const { groups, canvases } = get()
    const categoryGroups = groups.filter((g) => g.categoryId === categoryId)
    const categoryUngroupedCanvases = canvases.filter((cv) => cv.categoryId === categoryId && !cv.groupId)

    const groupIdSet = new Set(categoryGroups.map((g) => g.id))
    const canvasIdSet = new Set(categoryUngroupedCanvases.map((cv) => cv.id))

    const seen = new Set()
    const validOrder = orderedTopLevelIds.filter((id) => {
      if (seen.has(id)) return false
      if (!groupIdSet.has(id) && !canvasIdSet.has(id)) return false
      seen.add(id)
      return true
    })

    const missing = [
      ...categoryUngroupedCanvases.map((cv) => cv.id),
      ...categoryGroups.map((g) => g.id),
    ].filter((id) => !seen.has(id))

    const finalOrder = [...validOrder, ...missing]
    const nextOrderMap = new Map(finalOrder.map((id, index) => [id, index]))

    const groupOrderMap = new Map(categoryGroups.map((g) => [g.id, g.order ?? 0]))
    const canvasOrderMap = new Map(categoryUngroupedCanvases.map((cv) => [cv.id, cv.order ?? 0]))

    const updatedGroups = groups.map((g) => {
      if (g.categoryId !== categoryId) return g
      const nextOrder = nextOrderMap.get(g.id)
      return typeof nextOrder === 'number' ? { ...g, order: nextOrder } : g
    })

    const updatedCanvases = canvases.map((cv) => {
      if (cv.categoryId !== categoryId || cv.groupId) return cv
      const nextOrder = nextOrderMap.get(cv.id)
      return typeof nextOrder === 'number' ? { ...cv, order: nextOrder } : cv
    })

    set(() => ({
      groups: updatedGroups,
      canvases: updatedCanvases,
    }))

    const groupPatches = finalOrder
      .filter((id) => groupIdSet.has(id))
      .map((id) => ({ id, order: nextOrderMap.get(id) }))
      .filter(({ id, order }) => groupOrderMap.get(id) !== order)

    const canvasPatches = finalOrder
      .filter((id) => canvasIdSet.has(id))
      .map((id) => ({ id, order: nextOrderMap.get(id) }))
      .filter(({ id, order }) => canvasOrderMap.get(id) !== order)

    await Promise.all([
      ...groupPatches.map(({ id, order }) => updateCanvasGroup(id, { order })),
      ...canvasPatches.map(({ id, order }) => updateCanvas(id, { order })),
    ])
  },

  /**
   * 复制画布：纯内存操作，克隆本地图表 + 创建新画布记录（无 snapshot_json 写入，
   * 由后续 useFormalSave 负责正式落盘）
   */
  duplicateCanvas: async (id) => {
    const { canvases, charts } = get()
    const canvas = canvases.find((cv) => cv.id === id)
    if (!canvas) return
    const baseName = canvas.name + ' (副本)'
    const dedupedName = deduplicateCanvasName(baseName, canvases, canvas.categoryId)
    const raw = await createCanvas({ category_id: canvas.categoryId, name: dedupedName, group_id: canvas.groupId, order: canvases.length })
    const newCanvas = { id: raw.id, categoryId: raw.category_id, groupId: raw.group_id ?? null, name: raw.name, order: raw.order ?? canvases.length }

    // 克隆图表：只在内存中创建新 id，不调 API
    const chartsOnCanvas = charts.filter((ch) => ch.canvasId === id)
    const clonedCharts = chartsOnCanvas.map((ch) => ({
      ...ch,
      id: uid(),
      canvasId: newCanvas.id,
      x: ch.x + 24,
      y: ch.y + 24,
    }))

    set((s) => ({
      canvases: [...s.canvases, newCanvas],
      charts: [...s.charts, ...clonedCharts],
      activeCanvasId: newCanvas.id,
      loadedCanvasIds: new Set([...s.loadedCanvasIds, newCanvas.id]),
      isDirty: true,
    }))
  },

  removeCanvas: async (id) => {
    await deleteCanvas(id)
    set((s) => {
      const remaining = s.canvases.filter((cv) => cv.id !== id)
      const sameCategory = remaining.filter(
        (cv) => cv.categoryId === s.canvases.find((c) => c.id === id)?.categoryId
      )
      const newLoadedIds = new Set([...s.loadedCanvasIds].filter((cid) => cid !== id))
      return {
        canvases: remaining,
        charts: s.charts.filter((ch) => ch.canvasId !== id),
        loadedCanvasIds: newLoadedIds,
        activeCanvasId:
          s.activeCanvasId === id ? (sameCategory[0]?.id ?? null) : s.activeCanvasId,
      }
    })
  },

  setActiveCanvas: (id) => {
    get().loadCanvas(id)
  },

  /** 图表（纯内存操作，不调 wb_charts API） */
  addChart: (type, x, y) => {
    const { activeCanvasId, charts } = get()
    if (!activeCanvasId) return
    const pluginRenderer = getVisualizationRendererByType(type)
    const option = pluginRenderer?.defaultOption ?? CHART_DEFAULTS[type] ?? CHART_DEFAULTS.line
    const meta =
      CHART_META.find((m) => m.type === type) ??
      (pluginRenderer
        ? {
            type: pluginRenderer.type,
            label: pluginRenderer.label ?? pluginRenderer.type,
          }
        : null)
    const order = charts.filter((ch) => ch.canvasId === activeCanvasId).length
    const chart = {
      id: uid(),
      canvasId: activeCanvasId,
      type,
      title: meta?.label ?? type,
      x,
      y,
      w: 380,
      h: 260,
      option,
      colorTheme: 'default',
      showLegend: true,
      showLabel: false,
      allowOverlap: false,
      order,
    }
    set((s) => ({ charts: [...s.charts, chart], isDirty: true }))
    return chart.id
  },

  /**
   * 复制图表：纯内存，生成新 id。
   * - allowOverlap=true：放置在原图偏移 (24, 24) 处
   * - allowOverlap=false：用 findLegalPosition 找到最近不重叠的位置
   * 不调任何 API（由 useFormalSave 一次性落盘）
   */
  duplicateChart: (id) => {
    const { charts } = get()
    const chart = charts.find((ch) => ch.id === id)
    if (!chart) return

    const preferX = chart.x + 24
    const preferY = chart.y + 24

    let finalX = preferX
    let finalY = preferY

    if (!chart.allowOverlap) {
      // 同画布内其他图表的矩形列表（不含自身）
      const others = charts
        .filter((ch) => ch.canvasId === chart.canvasId && ch.id !== id)
        .map((ch) => ({ x: ch.x, y: ch.y, w: ch.w, h: ch.h }))
      const pos = findLegalPosition(
        { x: preferX, y: preferY, w: chart.w, h: chart.h },
        others,
        { x: preferX, y: preferY }
      )
      finalX = pos.x
      finalY = pos.y
    }

    const dup = {
      ...chart,
      id: uid(),
      x: finalX,
      y: finalY,
      order: (chart.order ?? 0) + 1,
    }
    set((s) => ({ charts: [...s.charts, dup], isDirty: true }))
  },

  removeChart: (id) => {
    set((s) => ({
      charts: s.charts.filter((ch) => ch.id !== id),
      selectedChartId: s.selectedChartId === id ? null : s.selectedChartId,
      isDirty: true,
      configPanel:
        s.configPanel.chartId === id
          ? { ...s.configPanel, visible: false, chartId: null }
          : s.configPanel,
    }))
  },

  updateChartPosition: (id, x, y) => {
    // 纯内存更新 — mouseup 后对齐 React 状态，不发 API 请求
    set((s) => ({
      charts: s.charts.map((ch) => (ch.id === id ? { ...ch, x, y } : ch)),
      isDirty: true,
    }))
  },

  updateChartSize: (id, w, h) => {
    const nw = Math.max(200, w)
    const nh = Math.max(160, h)
    set((s) => ({
      charts: s.charts.map((ch) =>
        ch.id === id ? { ...ch, w: nw, h: nh } : ch
      ),
      isDirty: true,
    }))
  },

  updateChartOption: (id, optionPatch) => {
    const chart = get().charts.find((ch) => ch.id === id)
    if (!chart) return
    const merged = { ...chart.option, ...optionPatch }
    set((s) => ({
      charts: s.charts.map((ch) =>
        ch.id === id ? { ...ch, option: merged } : ch
      ),
      isDirty: true,
    }))
  },

  updateChartConfig: (id, patch) => {
    set((s) => ({
      charts: s.charts.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
      isDirty: true,
    }))
  },

  /**
   * 将草稿恢复时使用：用快照数组完整替换指定画布的图表列表。
   * 不触发 API 写入（由 useFormalSave 负责正式保存）。
   */
  setChartsForCanvas: (canvasId, chartSnapshots) => {
    set((s) => ({
      charts: [
        ...s.charts.filter((ch) => ch.canvasId !== canvasId),
        ...chartSnapshots.map(normalizeSnapshot),
      ],
      isDirty: true,
    }))
  },

  /** 配置面板 */
  openConfigPanel: (chartId, anchorX, anchorY) => {
    const vw = window.innerWidth
    const panelW = 340
    const x = anchorX + panelW > vw ? vw - panelW - 16 : anchorX
    set({ configPanel: { visible: true, chartId, x, y: Math.max(60, anchorY) } })
  },

  closeConfigPanel: () =>
    set((s) => ({ configPanel: { ...s.configPanel, visible: false, chartId: null } })),

  moveConfigPanel: (x, y) =>
    set((s) => ({ configPanel: { ...s.configPanel, x, y } })),

  /** 选中图表 */
  selectChart: (id) => set({ selectedChartId: id }),
  deselectChart: () => set({ selectedChartId: null }),

  /** 保存状态 */
  markDirty: () => set({ isDirty: true }),
  markSaved: () => set({ isDirty: false }),

  /** 画布视图 */
  setCanvasGridMode: (mode) => set({ canvasGridMode: mode }),
  setCanvasZoom: (zoom) => set({ canvasZoom: zoom }),

  /** 类别侧边栏 */
  toggleCategorySidebar: () =>
    set((s) => ({ categorySidebarOpen: !s.categorySidebarOpen })),

  closeCategorySidebar: () => set({ categorySidebarOpen: false }),

  /**
   * 重置工作台状态（用于重新进入工作台时清除陈旧缓存）。
   * 调用后 bootstrap 会重新从服务端拉取最新数据。
   */
  resetWorkbench: () =>
    set({
      workbookId: null,
      bootstrapped: false,
      bootstrapping: false,
      categories: [],
      activeCategoryId: null,
      canvases: [],
      activeCanvasId: null,
      groups: [],
      charts: [],
      loadedCanvasIds: new Set(),
      isDirty: false,
      selectedChartId: null,
      configPanel: { visible: false, chartId: null, x: 200, y: 120 },
    }),
}))

export default useWorkbenchState
