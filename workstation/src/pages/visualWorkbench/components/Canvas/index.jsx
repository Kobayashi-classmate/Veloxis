import React, { useRef, useCallback } from 'react'
import { Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import ChartItem from '../ChartItem'
import styles from './index.module.less'

const { Text } = Typography

const Canvas = () => {
  const canvasRef = useRef(null)
  const { charts, activeCanvasId, addChart } = useWorkbenchState()

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
      const x = e.clientX - rect.left - 190  // 居中偏移（图表宽 380/2）
      const y = e.clientY - rect.top - 130   // 居中偏移（图表高 260/2）
      addChart(chartType, Math.max(0, x), Math.max(0, y))
    },
    [addChart]
  )

  return (
    <div
      ref={canvasRef}
      className={styles.canvas}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 空画布引导 */}
      {activeCharts.length === 0 && (
        <div className={styles.emptyGuide}>
          <div className={styles.emptyIcon}>
            <PlusOutlined />
          </div>
          <Text type="secondary" className={styles.emptyTitle}>
            画布空空如也
          </Text>
          <Text type="secondary" className={styles.emptyDesc}>
            从左侧图表组件区拖拽图表到此处，开始构建可视化看板
          </Text>
        </div>
      )}

      {/* 图表实例 */}
      {activeCharts.map((chart) => (
        <ChartItem key={chart.id} chart={chart} canvasRef={canvasRef} />
      ))}
    </div>
  )
}

export default Canvas
