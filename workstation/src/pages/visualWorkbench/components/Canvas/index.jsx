import React, { useRef, useCallback } from 'react'
import { Typography, Button, Select, Tooltip } from 'antd'
import {
  PlusOutlined,
  AppstoreOutlined,
  BorderOutlined,
  EyeInvisibleOutlined,
  ZoomInOutlined,
} from '@ant-design/icons'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import { useCanvasDraft } from '../../hooks/useCanvasDraft'
import ChartItem from '../ChartItem'
import DraftBanner from '../DraftBanner'
import styles from './index.module.less'

const { Text } = Typography

const ZOOM_OPTIONS = [
  { value: 50,  label: '50%'  },
  { value: 75,  label: '75%'  },
  { value: 100, label: '100%' },
  { value: 125, label: '125%' },
  { value: 150, label: '150%' },
]

const GRID_MODES = [
  { mode: 'dots',  icon: <AppstoreOutlined />, tip: '点阵网格' },
  { mode: 'lines', icon: <BorderOutlined />,   tip: '线条网格' },
  { mode: 'none',  icon: <EyeInvisibleOutlined />, tip: '无网格' },
]

const Canvas = () => {
  const canvasRef = useRef(null)
  const {
    charts, activeCanvasId, activeCategoryId, addChart, addCanvas,
    canvasGridMode, canvasZoom,
    setCanvasGridMode, setCanvasZoom,
  } = useWorkbenchState()

  const { bannerState, restoreDraft, discardDraft } = useCanvasDraft()

  const activeCharts = charts.filter((ch) => ch.canvasId === activeCanvasId)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      const chartType = e.dataTransfer.getData('chartType')
      if (!chartType || !canvasRef.current) return

      const rect = canvasRef.current.getBoundingClientRect()
      const scale = canvasZoom / 100
      // account for zoom when computing drop position
      const x = (e.clientX - rect.left) / scale - 190
      const y = (e.clientY - rect.top) / scale - 130
      addChart(chartType, Math.max(0, x), Math.max(0, y))
    },
    [addChart, canvasZoom]
  )

  // 根据 gridMode 计算 CSS backgroundImage
  const gridStyle = (() => {
    if (canvasGridMode === 'dots') {
      return {
        backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }
    }
    if (canvasGridMode === 'lines') {
      return {
        backgroundImage:
          'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }
    }
    return { backgroundImage: 'none', backgroundSize: 'unset' }
  })()

  return (
    <div
      ref={canvasRef}
      className={styles.canvas}
      style={gridStyle}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 草稿恢复提示条 */}
      {bannerState.visible && bannerState.canvasId === activeCanvasId && (
        <DraftBanner
          savedAt={bannerState.savedAt}
          onRestore={() => restoreDraft(bannerState.canvasId)}
          onDiscard={() => discardDraft(bannerState.canvasId)}
        />
      )}

      {/* 无画布时的引导（优先级高于空图表引导）*/}
      {!activeCanvasId ? (
        <div className={styles.emptyGuide}>
          <div className={styles.emptyIcon}>
            <PlusOutlined />
          </div>
          <Text type="secondary" className={styles.emptyTitle}>
            当前类别下还没有画布
          </Text>
          <Text type="secondary" className={styles.emptyDesc}>
            请点击底部「+」按钮新建一个画布，然后从右侧拖入图表
          </Text>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            style={{ pointerEvents: 'auto', marginTop: 4 }}
            onClick={() => activeCategoryId && addCanvas(activeCategoryId)}
          >
            新建画布
          </Button>
        </div>
      ) : null}
      {/* 画布控制条（右上角浮层，banner 显示时下移避免遮盖）*/}
      <div
        className={styles.canvasControls}
        style={{ top: bannerState.visible && bannerState.canvasId === activeCanvasId ? 50 : 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 网格模式切换 */}
        <div className={styles.gridToggleGroup}>
          {GRID_MODES.map(({ mode, icon, tip }) => (
            <Tooltip key={mode} title={tip}>
              <Button
                type={canvasGridMode === mode ? 'primary' : 'text'}
                size="small"
                icon={icon}
                className={`${styles.controlBtn} ${canvasGridMode === mode ? styles.controlBtnActive : ''}`}
                onClick={() => setCanvasGridMode(mode)}
              />
            </Tooltip>
          ))}
        </div>

        {/* 缩放选择器 */}
        <div className={styles.zoomGroup}>
          <ZoomInOutlined className={styles.zoomIcon} />
          <Select
            value={canvasZoom}
            options={ZOOM_OPTIONS}
            size="small"
            className={styles.zoomSelect}
            onChange={(v) => setCanvasZoom(v)}
            popupMatchSelectWidth={false}
          />
        </div>
      </div>

      {/* 空图表引导（有画布但无图表时）*/}
      {activeCanvasId && activeCharts.length === 0 && (
        <div className={styles.emptyGuide}>
          <div className={styles.emptyIcon}>
            <PlusOutlined />
          </div>
          <Text type="secondary" className={styles.emptyTitle}>
            画布空空如也
          </Text>
          <Text type="secondary" className={styles.emptyDesc}>
            从右侧图表组件区拖拽图表到此处，开始构建可视化看板
          </Text>
        </div>
      )}

      {/* 缩放容器 */}
      <div
        className={styles.zoomLayer}
        style={{ transform: `scale(${canvasZoom / 100})`, transformOrigin: '0 0' }}
      >
        {activeCharts.map((chart) => (
          <ChartItem key={chart.id} chart={chart} canvasRef={canvasRef} />
        ))}
      </div>
    </div>
  )
}

export default Canvas
