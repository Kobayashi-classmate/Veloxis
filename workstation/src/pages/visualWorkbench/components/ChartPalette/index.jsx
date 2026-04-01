import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Typography, Input, Collapse, Tooltip } from 'antd'
import { SearchOutlined, MenuFoldOutlined, MenuUnfoldOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons'
import { CHART_META } from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

const STORAGE_KEY = 'vb_palette_state'
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 420

/** 内联 SVG 图表预览 — 每种类型一个迷你 sparkline */
const CHART_SVG_PREVIEWS = {
  line: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <polyline
        points="4,30 14,18 24,22 34,8 44,14 56,4"
        fill="none"
        stroke="#1677ff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="30" r="2" fill="#1677ff" />
      <circle cx="34" cy="8" r="2" fill="#1677ff" />
      <circle cx="56" cy="4" r="2" fill="#1677ff" />
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <rect x="4" y="14" width="8" height="22" rx="1" fill="#1677ff" opacity="0.85" />
      <rect x="16" y="8" width="8" height="28" rx="1" fill="#1677ff" opacity="0.85" />
      <rect x="28" y="18" width="8" height="18" rx="1" fill="#91cc75" opacity="0.85" />
      <rect x="40" y="10" width="8" height="26" rx="1" fill="#91cc75" opacity="0.85" />
      <rect x="52" y="20" width="6" height="16" rx="1" fill="#1677ff" opacity="0.85" />
    </svg>
  ),
  pie: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <circle cx="30" cy="19" r="16" fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="30" cy="19" r="16"
        fill="none"
        stroke="#1677ff"
        strokeWidth="10"
        strokeDasharray="40 61"
        strokeDashoffset="0"
      />
      <circle
        cx="30" cy="19" r="16"
        fill="none"
        stroke="#91cc75"
        strokeWidth="10"
        strokeDasharray="25 76"
        strokeDashoffset="-40"
      />
      <circle
        cx="30" cy="19" r="16"
        fill="none"
        stroke="#fac858"
        strokeWidth="10"
        strokeDasharray="20 81"
        strokeDashoffset="-65"
      />
    </svg>
  ),
  scatter: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      {[
        [8, 28], [16, 14], [22, 32], [30, 10], [36, 22],
        [44, 6], [50, 18], [12, 20], [40, 30], [26, 16],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="#1677ff" opacity="0.7" />
      ))}
    </svg>
  ),
  area: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1677ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1677ff" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points="4,34 4,26 14,16 24,20 34,8 44,14 56,6 56,34"
        fill="url(#areaGrad)"
      />
      <polyline
        points="4,26 14,16 24,20 34,8 44,14 56,6"
        fill="none"
        stroke="#1677ff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

function loadPaletteState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

function savePaletteState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

const clampWidth = (value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))

const ChartPalette = () => {
  const [search, setSearch] = useState('')

  // 收集所有分组
  const allGroups = useMemo(() => {
    const seen = new Set()
    const groups = []
    CHART_META.forEach((m) => {
      if (!seen.has(m.group)) {
        seen.add(m.group)
        groups.push(m.group)
      }
    })
    return groups
  }, [])

  const savedState = useMemo(() => loadPaletteState(), [])
  const [openKeys, setOpenKeys] = useState(() => savedState?.openKeys ?? allGroups)
  const [collapsed, setCollapsed] = useState(() => savedState?.collapsed ?? false)
  const [width, setWidth] = useState(() => savedState?.width ?? DEFAULT_WIDTH)

  useEffect(() => {
    savePaletteState({ openKeys, collapsed, width })
  }, [openKeys, collapsed, width])

  const startX = useRef(0)
  const startWidth = useRef(width)
  const resizing = useRef(false)
  const stopResizeRef = useRef(null)

  const handleResizeMove = useCallback((event) => {
    if (!resizing.current) return
    const delta = startX.current - event.clientX
    setWidth(() => clampWidth(startWidth.current + delta))
  }, [])

  const stopResize = useCallback(() => {
    if (!resizing.current) return
    resizing.current = false
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', stopResizeRef.current)
  }, [handleResizeMove])

  useEffect(() => {
    stopResizeRef.current = stopResize
  }, [stopResize])

  const handleResizeStart = (event) => {
    event.preventDefault()
    resizing.current = true
    startX.current = event.clientX
    startWidth.current = width
    document.body.style.cursor = 'ew-resize'
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', stopResizeRef.current)
  }

  useEffect(() => {
    return () => {
      if (resizing.current) stopResize()
    }
  }, [stopResize])

  const handleDragStart = (e, type) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('chartType', type)
  }

  const handleToggle = () => setCollapsed((prev) => !prev)

  const widthState = useMemo(() => {
    if (width >= MAX_WIDTH) return 'wide'
    if (width <= MIN_WIDTH) return 'compact'
    return 'normal'
  }, [width])

  const handleToggleWidth = () => {
    setWidth((prevWidth) => (prevWidth >= (MIN_WIDTH + MAX_WIDTH) / 2 ? MIN_WIDTH : MAX_WIDTH))
  }

  // 过滤后的 meta
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CHART_META
    return CHART_META.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.group.toLowerCase().includes(q)
    )
  }, [search])

  const effectiveOpenKeys = search.trim() ? allGroups : openKeys

  // 分组化（搜索时保留所有有结果的分组）
  const collapseItems = useMemo(() => {
    return allGroups
      .map((group) => {
        const items = filtered.filter((m) => m.group === group)
        if (items.length === 0) return null
        return {
          key: group,
          label: <span className={styles.groupLabel}>{group}</span>,
          children: (
            <div className={styles.paletteGrid}>
              {items.map((meta) => (
                <Tooltip key={meta.type} title={`拖拽添加${meta.label}`} placement="left">
                  <div
                    className={styles.paletteItem}
                    draggable
                    onDragStart={(e) => handleDragStart(e, meta.type)}
                  >
                    <div className={styles.palettePreview}>
                      <div className={styles.paletteSymbol}>{meta.icon}</div>
                      {CHART_SVG_PREVIEWS[meta.type]}
                    </div>
                    <Text className={styles.paletteLabel}>{meta.label}</Text>
                  </div>
                </Tooltip>
              ))}
            </div>
          ),
        }
      })
      .filter(Boolean)
  }, [filtered, allGroups])

  // 搜索时平铺显示（不分组折叠）
  const showFlat = collapsed || search.trim().length > 0

  const paletteClassNames = [styles.palette, collapsed ? styles.collapsed : ''].join(' ')
  const countLabel = `${filtered.length} 个图表`

  return (
    <div className={paletteClassNames} style={{ width: collapsed ? 56 : width }}>
      <div className={styles.paletteHeader}>
        <div>
          <div className={styles.paletteTitleRow}>
            <Text className={styles.paletteTitle}>图表库</Text>
            <span className={styles.paletteBadge}>{filtered.length}</span>
          </div>
          <div className={styles.paletteSummary}>{countLabel}</div>
        </div>

        <div className={styles.headerActions}>
          {!collapsed && (
            <Tooltip
              title={widthState === 'wide' ? '收窄面板' : '展开面板'}
              placement="left"
            >
              <div className={styles.widthButton} onClick={handleToggleWidth}>
                {widthState === 'wide' ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              </div>
            </Tooltip>
          )}
          <Tooltip title={collapsed ? '展开面板' : '收起面板'} placement="left">
            <div className={styles.collapseButton} onClick={handleToggle}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </div>
          </Tooltip>
        </div>
      </div>

      {!collapsed && (
        <div className={styles.searchWrap}>
          <Input
            size="small"
            placeholder="搜索图表"
            prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 11 }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className={styles.searchInput}
          />
        </div>
      )}

      <div className={styles.listWrap}>
        {showFlat ? (
          filtered.length > 0 ? (
            <div className={styles.paletteGrid}>
              {filtered.map((meta) => (
                <Tooltip key={meta.type} title={`拖拽添加${meta.label}`} placement="left">
                  <div
                    className={styles.paletteItem}
                    draggable
                    onDragStart={(e) => handleDragStart(e, meta.type)}
                  >
                    <div className={styles.palettePreview}>
                      <div className={styles.paletteSymbol}>{meta.icon}</div>
                      {CHART_SVG_PREVIEWS[meta.type]}
                    </div>
                    <Text className={styles.paletteLabel}>{meta.label}</Text>
                  </div>
                </Tooltip>
              ))}
            </div>
          ) : (
            <div className={styles.emptyHint}>无匹配</div>
          )
        ) : (
          <Collapse
            activeKey={effectiveOpenKeys}
            onChange={setOpenKeys}
            ghost
            size="small"
            items={collapseItems}
            className={styles.collapse}
          />
        )}
      </div>

      <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
    </div>
  )
}

export default ChartPalette
