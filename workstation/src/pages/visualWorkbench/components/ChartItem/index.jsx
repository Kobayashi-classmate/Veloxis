import React, { useState, useCallback, useMemo } from 'react'
import { Typography, Tooltip, Button, Dropdown, message } from 'antd'
import {
  SettingOutlined,
  CopyOutlined,
  DeleteOutlined,
  DragOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import EChartsCommon from '@stateless/EChartsCommon'
import useWorkbenchState, { COLOR_THEMES } from '../../hooks/useWorkbenchState'
import { useChartDrag } from '../../hooks/useChartDrag'
import { useUIPluginHost } from '@src/plugins/UIPluginHostProvider'
import { getVisualizationActions } from '@src/plugins/slotRegistry'
import styles from './index.module.less'

const { Text } = Typography

const ChartItem = ({ chart, canvasRef }) => {
  const [hovered, setHovered] = useState(false)
  const { registryVersion } = useUIPluginHost()

  const {
    updateChartPosition, updateChartSize, removeChart, duplicateChart,
    openConfigPanel, selectChart, deselectChart, selectedChartId,
  } = useWorkbenchState()

  const isSelected = selectedChartId === chart.id

  // mouseup 时才调一次 — 不在 mousemove 中触发
  const onMoveEnd = useCallback(
    (nx, ny) => updateChartPosition(chart.id, nx, ny),
    [chart.id, updateChartPosition]
  )

  const onResizeEnd = useCallback(
    (nw, nh) => updateChartSize(chart.id, nw, nh),
    [chart.id, updateChartSize]
  )

  // itemRef 由 hook 内部创建并返回，挂到根节点
  const { itemRef, onDragStart, onResizeStart } = useChartDrag({
    chartId: chart.id,
    x: chart.x,
    y: chart.y,
    w: chart.w,
    h: chart.h,
    allowOverlap: chart.allowOverlap ?? false,
    onMoveEnd,
    onResizeEnd,
  })

  // 应用配色方案到 option
  const resolvedOption = useMemo(() => {
    const theme = COLOR_THEMES.find((t) => t.id === (chart.colorTheme ?? 'default'))
    return {
      ...chart.option,
      color: theme?.colors,
      legend: chart.showLegend !== false ? (chart.option?.legend ?? { show: true }) : { show: false },
    }
  }, [chart.option, chart.colorTheme, chart.showLegend])

  const handleOpenConfig = (e) => {
    const rect = e.currentTarget.closest(`.${styles.chartItem}`)?.getBoundingClientRect()
    const anchorX = rect ? rect.right + 12 : e.clientX + 12
    const anchorY = rect ? rect.top : e.clientY
    openConfigPanel(chart.id, anchorX, anchorY)
  }

  const handleItemClick = (e) => {
    e.stopPropagation()
    selectChart(chart.id)
  }

  const pluginActionItems = useMemo(() => {
    const actions = getVisualizationActions().filter((action) => {
      if (!action.matchChartType) return true
      return action.matchChartType === chart.type
    })

    return actions.map((action) => ({
      key: `plugin:${action.id}`,
      label: action.label,
      onClick: () => {
        try {
          if (typeof action.run === 'function') {
            const result = action.run(chart)
            if (result?.message) {
              message.info(result.message)
              return
            }
          }
          message.info(`[Plugin Action] ${action.label}`)
        } catch (error) {
          console.error('[PluginAction] failed:', error)
          message.error(`插件动作执行失败：${action.label}`)
        }
      },
    }))
  }, [chart, registryVersion])

  const moreItems = [
    {
      key: 'config',
      label: '配置图表',
      icon: <SettingOutlined />,
      onClick: handleOpenConfig,
    },
    {
      key: 'duplicate',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: () => duplicateChart(chart.id),
    },
    ...pluginActionItems,
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => removeChart(chart.id),
    },
  ]

  return (
    <div
      ref={itemRef}
      className={`${styles.chartItem} ${isSelected ? styles.chartItemSelected : ''}`}
      style={{ left: chart.x, top: chart.y, width: chart.w, height: chart.h }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleItemClick}
    >
      {/* 标题栏（可拖移）*/}
      <div className={styles.chartHeader} onMouseDown={onDragStart}>
        <DragOutlined className={styles.dragHandle} />
        <Text className={styles.chartTitle} ellipsis>
          {chart.title}
        </Text>

        {/* 工具栏 */}
        {hovered && (
          <div className={styles.toolbar} onMouseDown={(e) => e.stopPropagation()}>
            <Tooltip title="配置">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                className={styles.toolBtn}
                onClick={handleOpenConfig}
              />
            </Tooltip>
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                className={styles.toolBtn}
                onClick={() => duplicateChart(chart.id)}
              />
            </Tooltip>
            <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                className={styles.toolBtn}
              />
            </Dropdown>
          </div>
        )}
      </div>

      {/* 图表内容 */}
      <div className={styles.chartBody}>
        <EChartsCommon option={resolvedOption} notMerge />
      </div>

      {/* 右下角缩放手柄 */}
      <div className={styles.resizeHandle} onMouseDown={onResizeStart} />
    </div>
  )
}

export default ChartItem
