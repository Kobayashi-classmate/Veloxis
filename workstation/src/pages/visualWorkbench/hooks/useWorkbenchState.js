import { create } from 'zustand'

// ─── 虚拟数据：各图表类型默认 ECharts option ─────────────────────────────────

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

// 图表类型元数据
export const CHART_META = [
  { type: 'line',    label: '折线图', icon: '📈' },
  { type: 'bar',     label: '柱状图', icon: '📊' },
  { type: 'pie',     label: '饼图',   icon: '🥧' },
  { type: 'scatter', label: '散点图', icon: '✦'  },
  { type: 'area',    label: '面积图', icon: '📉' },
]

// 样式配色方案
export const COLOR_THEMES = [
  { id: 'default', label: '默认', colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'] },
  { id: 'warm',    label: '暖色', colors: ['#dd6b66', '#759aa0', '#e69d87', '#8dc1a9', '#ea7e53'] },
  { id: 'cool',    label: '冷色', colors: ['#516b91', '#59c4e6', '#edafda', '#93b7e3', '#a5e7f0'] },
  { id: 'mono',    label: '单色', colors: ['#1677ff', '#4096ff', '#69b1ff', '#91caff', '#bae0ff'] },
]

// 生成唯一 ID
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

// 默认初始类别
const DEFAULT_CATEGORY_ID = uid()
const DEFAULT_CANVAS_ID = uid()

const INITIAL_CATEGORIES = [
  { id: DEFAULT_CATEGORY_ID, name: '财务工作台', color: '#1677ff', icon: '💰', order: 0 },
  { id: uid(), name: '绩效考核', color: '#52c41a', icon: '🏆', order: 1 },
  { id: uid(), name: '风险预警', color: '#ff4d4f', icon: '⚠️', order: 2 },
]

const INITIAL_CANVASES = [
  { id: DEFAULT_CANVAS_ID, categoryId: DEFAULT_CATEGORY_ID, groupId: null, name: '总览看板', order: 0 },
  { id: uid(), categoryId: DEFAULT_CATEGORY_ID, groupId: null, name: 'Q1 分析',   order: 1 },
]

// ─── Zustand Store ────────────────────────────────────────────────────────────

const useWorkbenchState = create((set, get) => ({
  // ── 类别 ──
  categories: INITIAL_CATEGORIES,
  activeCategoryId: DEFAULT_CATEGORY_ID,

  // ── 画布 ──
  canvases: INITIAL_CANVASES,
  activeCanvasId: DEFAULT_CANVAS_ID,

  // ── 画布分组 ──
  groups: [],

  // ── 图表 ──
  charts: [],

  // ── 浮动配置面板 ──
  configPanel: {
    visible: false,
    chartId: null,
    x: 200,
    y: 120,
  },

  // ── 类别侧边栏 ──
  categorySidebarOpen: false,

  // ─────────────────────────── Actions ──────────────────────────────────────

  // 类别
  addCategory: (name, color = '#1677ff', icon = '📁') => {
    const categories = get().categories
    const id = uid()
    const canvasId = uid()
    set((s) => ({
      categories: [...s.categories, { id, name, color, icon, order: categories.length }],
      canvases: [...s.canvases, { id: canvasId, categoryId: id, groupId: null, name: '新画布', order: 0 }],
      activeCategoryId: id,
      activeCanvasId: canvasId,
    }))
  },

  renameCategory: (id, name) =>
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
    })),

  updateCategory: (id, patch) =>
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  removeCategory: (id) =>
    set((s) => {
      const remaining = s.categories.filter((c) => c.id !== id)
      const canvasIds = s.canvases.filter((cv) => cv.categoryId === id).map((cv) => cv.id)
      return {
        categories: remaining,
        canvases: s.canvases.filter((cv) => cv.categoryId !== id),
        charts: s.charts.filter((ch) => !canvasIds.includes(ch.canvasId)),
        activeCategoryId:
          s.activeCategoryId === id
            ? remaining[0]?.id ?? null
            : s.activeCategoryId,
      }
    }),

  setActiveCategory: (id) => {
    const canvases = get().canvases.filter((cv) => cv.categoryId === id)
    const firstCanvas = canvases[0]
    set({ activeCategoryId: id, activeCanvasId: firstCanvas?.id ?? null })
  },

  // 分组
  addGroup: (categoryId, name) => {
    const id = uid()
    set((s) => ({
      groups: [...s.groups, { id, categoryId, name, order: s.groups.length }],
    }))
    return id
  },

  renameGroup: (id, name) =>
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
    })),

  removeGroup: (id) =>
    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      // 解除该分组下画布的分组关联
      canvases: s.canvases.map((cv) => (cv.groupId === id ? { ...cv, groupId: null } : cv)),
    })),

  // 画布
  addCanvas: (categoryId, name = '新画布', groupId = null) => {
    const id = uid()
    const canvases = get().canvases.filter((cv) => cv.categoryId === categoryId)
    set((s) => ({
      canvases: [...s.canvases, { id, categoryId, groupId, name, order: canvases.length }],
      activeCanvasId: id,
    }))
    return id
  },

  renameCanvas: (id, name) =>
    set((s) => ({
      canvases: s.canvases.map((cv) => (cv.id === id ? { ...cv, name } : cv)),
    })),

  moveCanvasToGroup: (canvasId, groupId) =>
    set((s) => ({
      canvases: s.canvases.map((cv) => (cv.id === canvasId ? { ...cv, groupId } : cv)),
    })),

  duplicateCanvas: (id) => {
    const canvas = get().canvases.find((cv) => cv.id === id)
    if (!canvas) return
    const newId = uid()
    const chartsOnCanvas = get().charts.filter((ch) => ch.canvasId === id)
    const clonedCharts = chartsOnCanvas.map((ch) => ({ ...ch, id: uid(), canvasId: newId }))
    set((s) => ({
      canvases: [...s.canvases, { ...canvas, id: newId, name: canvas.name + ' (副本)', order: s.canvases.length }],
      charts: [...s.charts, ...clonedCharts],
      activeCanvasId: newId,
    }))
  },

  removeCanvas: (id) =>
    set((s) => {
      const remaining = s.canvases.filter((cv) => cv.id !== id)
      const sameCategory = remaining.filter(
        (cv) => cv.categoryId === s.canvases.find((c) => c.id === id)?.categoryId
      )
      return {
        canvases: remaining,
        charts: s.charts.filter((ch) => ch.canvasId !== id),
        activeCanvasId:
          s.activeCanvasId === id ? (sameCategory[0]?.id ?? null) : s.activeCanvasId,
      }
    }),

  setActiveCanvas: (id) => set({ activeCanvasId: id }),

  // 图表
  addChart: (type, x, y) => {
    const id = uid()
    const { activeCanvasId } = get()
    if (!activeCanvasId) return
    const option = CHART_DEFAULTS[type] ?? CHART_DEFAULTS.line
    const meta = CHART_META.find((m) => m.type === type)
    set((s) => ({
      charts: [
        ...s.charts,
        {
          id,
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
        },
      ],
    }))
    return id
  },

  duplicateChart: (id) => {
    const chart = get().charts.find((ch) => ch.id === id)
    if (!chart) return
    set((s) => ({
      charts: [...s.charts, { ...chart, id: uid(), x: chart.x + 24, y: chart.y + 24 }],
    }))
  },

  removeChart: (id) =>
    set((s) => ({
      charts: s.charts.filter((ch) => ch.id !== id),
      configPanel:
        s.configPanel.chartId === id
          ? { ...s.configPanel, visible: false, chartId: null }
          : s.configPanel,
    })),

  updateChartPosition: (id, x, y) =>
    set((s) => ({
      charts: s.charts.map((ch) => (ch.id === id ? { ...ch, x, y } : ch)),
    })),

  updateChartSize: (id, w, h) =>
    set((s) => ({
      charts: s.charts.map((ch) =>
        ch.id === id ? { ...ch, w: Math.max(200, w), h: Math.max(160, h) } : ch
      ),
    })),

  updateChartOption: (id, optionPatch) =>
    set((s) => ({
      charts: s.charts.map((ch) =>
        ch.id === id ? { ...ch, option: { ...ch.option, ...optionPatch } } : ch
      ),
    })),

  updateChartConfig: (id, patch) =>
    set((s) => ({
      charts: s.charts.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)),
    })),

  // 配置面板
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

  // 类别侧边栏
  toggleCategorySidebar: () =>
    set((s) => ({ categorySidebarOpen: !s.categorySidebarOpen })),

  closeCategorySidebar: () => set({ categorySidebarOpen: false }),
}))

export default useWorkbenchState
