import React from 'react'
import { Typography, Tooltip } from 'antd'
import { CHART_META } from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

const ChartPalette = () => {
  const handleDragStart = (e, type) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('chartType', type)
  }

  return (
    <div className={styles.palette}>
      <Text type="secondary" className={styles.paletteTitle}>
        图表
      </Text>
      <div className={styles.paletteGrid}>
        {CHART_META.map((meta) => (
          <Tooltip key={meta.type} title={meta.label} placement="left">
            <div
              className={styles.paletteItem}
              draggable
              onDragStart={(e) => handleDragStart(e, meta.type)}
            >
              <span className={styles.paletteIcon}>{meta.icon}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

export default ChartPalette
