import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Typography, Input, Collapse, Tooltip } from 'antd'
import {
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons'
import { CHART_META } from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

const STORAGE_KEY = 'vb_palette_state'
const DEFAULT_WIDTH = 320
const MIN_WIDTH = 240
const MAX_WIDTH = 420

const CHART_SVG_PREVIEWS = {
  line: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <polyline
        points="4,30 14,18 24,22 34,8 44,14 56,4"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="30" r="2" fill="#0ea5e9" />
      <circle cx="34" cy="8" r="2" fill="#0ea5e9" />
      <circle cx="56" cy="4" r="2" fill="#0ea5e9" />
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <rect x="4" y="14" width="8" height="22" rx="1" fill="#0ea5e9" opacity="0.9" />
      <rect x="16" y="8" width="8" height="28" rx="1" fill="#0ea5e9" opacity="0.9" />
      <rect x="28" y="18" width="8" height="18" rx="1" fill="#22c55e" opacity="0.9" />
      <rect x="40" y="10" width="8" height="26" rx="1" fill="#22c55e" opacity="0.9" />
      <rect x="52" y="20" width="6" height="16" rx="1" fill="#0ea5e9" opacity="0.9" />
    </svg>
  ),
  pie: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <circle cx="30" cy="19" r="16" fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="30"
        cy="19"
        r="16"
        fill="none"
        stroke="#0ea5e9"
        strokeWidth="10"
        strokeDasharray="40 61"
        strokeDashoffset="0"
      />
      <circle
        cx="30"
        cy="19"
        r="16"
        fill="none"
        stroke="#22c55e"
        strokeWidth="10"
        strokeDasharray="25 76"
        strokeDashoffset="-40"
      />
      <circle
        cx="30"
        cy="19"
        r="16"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="10"
        strokeDasharray="20 81"
        strokeDashoffset="-65"
      />
    </svg>
  ),
  scatter: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      {[
        [8, 28],
        [16, 14],
        [22, 32],
        [30, 10],
        [36, 22],
        [44, 6],
        [50, 18],
        [12, 20],
        [40, 30],
        [26, 16],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.5" fill="#0ea5e9" opacity="0.75" />
      ))}
    </svg>
  ),
  area: (
    <svg viewBox="0 0 60 38" className={styles.previewSvg}>
      <defs>
        <linearGradient id="paletteAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points="4,34 4,26 14,16 24,20 34,8 44,14 56,6 56,34" fill="url(#paletteAreaGrad)" />
      <polyline
        points="4,26 14,16 24,20 34,8 44,14 56,6"
        fill="none"
        stroke="#0ea5e9"
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
  } catch {
    // ignore persisted state errors
  }
  return null
}

function savePaletteState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore persisted state errors
  }
}

const clampWidth = (value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value))

const ChartPalette = () => {
  const [search, setSearch] = useState('')

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

  const groupCountMap = useMemo(() => {
    return CHART_META.reduce((acc, meta) => {
      acc[meta.group] = (acc[meta.group] ?? 0) + 1
      return acc
    }, {})
  }, [])

  const savedState = useMemo(() => loadPaletteState(), [])
  const [openKeys, setOpenKeys] = useState(() => savedState?.openKeys ?? allGroups)
  const [collapsed, setCollapsed] = useState(() => savedState?.collapsed ?? false)
  const [width, setWidth] = useState(() => savedState?.width ?? DEFAULT_WIDTH)
  const [activeGroup, setActiveGroup] = useState(() => savedState?.activeGroup ?? 'all')

  useEffect(() => {
    savePaletteState({ openKeys, collapsed, width, activeGroup })
  }, [openKeys, collapsed, width, activeGroup])

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

  const handleDragStart = useCallback((event, type) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('chartType', type)
  }, [])

  const handleToggle = () => setCollapsed((prev) => !prev)

  const widthState = useMemo(() => {
    if (width >= MAX_WIDTH) return 'wide'
    if (width <= MIN_WIDTH) return 'compact'
    return 'normal'
  }, [width])

  const handleToggleWidth = () => {
    setWidth((prevWidth) => (prevWidth >= (MIN_WIDTH + MAX_WIDTH) / 2 ? MIN_WIDTH : MAX_WIDTH))
  }

  const effectiveGroup = collapsed ? 'all' : activeGroup

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return CHART_META.filter((m) => {
      const matchedGroup = effectiveGroup === 'all' || m.group === effectiveGroup
      if (!matchedGroup) return false
      if (!q) return true
      return (
        m.label.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.group.toLowerCase().includes(q)
      )
    })
  }, [search, effectiveGroup])

  const filteredCount = filtered.length
  const totalCount = CHART_META.length
  const effectiveOpenKeys = search.trim() || effectiveGroup !== 'all' ? allGroups : openKeys
  const showFlat = collapsed || search.trim().length > 0 || effectiveGroup !== 'all'

  const handleOpenKeysChange = (keys) => {
    if (Array.isArray(keys)) {
      setOpenKeys(keys)
      return
    }
    if (keys) {
      setOpenKeys([keys])
      return
    }
    setOpenKeys([])
  }

  const renderPaletteItem = useCallback(
    (meta) => (
      <Tooltip key={meta.type} title={`拖拽到画布添加${meta.label}`} placement="left">
        <div
          className={styles.paletteItem}
          draggable
          onDragStart={(event) => handleDragStart(event, meta.type)}
        >
          <div className={styles.palettePreview}>
            <div className={styles.paletteSymbol}>{meta.icon}</div>
            {CHART_SVG_PREVIEWS[meta.type]}
          </div>
          <div className={styles.paletteMeta}>
            <Text className={styles.paletteLabel}>{meta.label}</Text>
            <Text className={styles.paletteType}>{meta.type.toUpperCase()}</Text>
          </div>
        </div>
      </Tooltip>
    ),
    [handleDragStart]
  )

  const collapseItems = useMemo(() => {
    return allGroups
      .map((group) => {
        const items = filtered.filter((m) => m.group === group)
        if (items.length === 0) return null
        return {
          key: group,
          label: (
            <div className={styles.groupLabel}>
              <span>{group}</span>
              <span className={styles.groupCount}>{items.length}</span>
            </div>
          ),
          children: <div className={styles.paletteGrid}>{items.map((meta) => renderPaletteItem(meta))}</div>,
        }
      })
      .filter(Boolean)
  }, [allGroups, filtered, renderPaletteItem])

  const handleResetFilters = () => {
    setSearch('')
    setActiveGroup('all')
  }

  const paletteClassNames = [styles.palette, collapsed ? styles.collapsed : ''].join(' ')

  return (
    <div className={paletteClassNames} style={{ width: collapsed ? 56 : width }}>
      <div className={styles.paletteHeader}>
        <div className={styles.paletteHeaderMain}>
          <div className={styles.paletteTitleRow}>
            <Text className={styles.paletteTitle}>图表库</Text>
            <span className={styles.paletteBadge}>{filteredCount}</span>
          </div>
          <div className={styles.paletteSummary}>拖拽到画布添加 · 共 {totalCount} 种图表</div>
        </div>

        <div className={styles.headerActions}>
          {!collapsed && (
            <Tooltip title={widthState === 'wide' ? '收窄面板' : '展开面板'} placement="left">
              <button type="button" className={styles.widthButton} onClick={handleToggleWidth}>
                {widthState === 'wide' ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              </button>
            </Tooltip>
          )}
          <Tooltip title={collapsed ? '展开面板' : '收起面板'} placement="left">
            <button type="button" className={styles.collapseButton} onClick={handleToggle}>
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
          </Tooltip>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className={styles.searchWrap}>
            <Input
              size="small"
              placeholder="搜索图表、类型或分组"
              prefix={<SearchOutlined style={{ color: '#64748b', fontSize: 12 }} />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
              className={styles.searchInput}
            />
          </div>

          <div className={styles.groupTabs}>
            <button
              type="button"
              className={`${styles.groupTab} ${activeGroup === 'all' ? styles.groupTabActive : ''}`}
              onClick={() => setActiveGroup('all')}
            >
              全部
              <span>{totalCount}</span>
            </button>
            {allGroups.map((group) => (
              <button
                key={group}
                type="button"
                className={`${styles.groupTab} ${activeGroup === group ? styles.groupTabActive : ''}`}
                onClick={() => setActiveGroup(group)}
              >
                {group}
                <span>{groupCountMap[group] ?? 0}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className={styles.listWrap}>
        {showFlat ? (
          filtered.length > 0 ? (
            <div className={styles.paletteGrid}>{filtered.map((meta) => renderPaletteItem(meta))}</div>
          ) : (
            <div className={styles.emptyHint}>
              <div>没有匹配的图表</div>
              <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
                清除筛选
              </button>
            </div>
          )
        ) : (
          <Collapse
            activeKey={effectiveOpenKeys}
            onChange={handleOpenKeysChange}
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
