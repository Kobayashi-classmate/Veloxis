import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Typography, Button, Tabs, Radio, Space, Switch, Divider, Input } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import useWorkbenchState, { CHART_META, COLOR_THEMES, CHART_DEFAULTS } from '../../hooks/useWorkbenchState'
import { useConfigPanelDrag } from '../../hooks/useChartDrag'
import styles from './index.module.less'

const { Text, Title } = Typography

// ── 图表类型选择 Tab ──────────────────────────────────────────────────────────
const TypeTab = ({ chart }) => {
  const { updateChartConfig } = useWorkbenchState()

  const handleChangeType = (type) => {
    updateChartConfig(chart.id, {
      type,
      title: CHART_META.find((m) => m.type === type)?.label ?? type,
      option: CHART_DEFAULTS[type],
    })
  }

  return (
    <div className={styles.tabContent}>
      <Text type="secondary" className={styles.sectionLabel}>选择图表类型</Text>
      <div className={styles.typeGrid}>
        {CHART_META.map((meta) => (
          <div
            key={meta.type}
            className={`${styles.typeCard} ${chart.type === meta.type ? styles.typeCardActive : ''}`}
            onClick={() => handleChangeType(meta.type)}
          >
            <span className={styles.typeIcon}>{meta.icon}</span>
            <Text className={styles.typeLabel}>{meta.label}</Text>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 数据配置 Tab ──────────────────────────────────────────────────────────────
const DataTab = ({ chart }) => (
  <div className={styles.tabContent}>
    <div className={styles.mockDataBanner}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        当前使用虚拟数据。数据源绑定功能开发中，后续版本将支持连接项目数据集。
      </Text>
    </div>
    <Divider style={{ margin: '12px 0' }} />
    <div className={styles.fieldRow}>
      <Text type="secondary" className={styles.fieldLabel}>X 轴 / 类别</Text>
      <Input size="small" value="自动（虚拟数据）" disabled className={styles.fieldInput} />
    </div>
    <div className={styles.fieldRow}>
      <Text type="secondary" className={styles.fieldLabel}>Y 轴 / 数值</Text>
      <Input size="small" value="自动（虚拟数据）" disabled className={styles.fieldInput} />
    </div>
    <div className={styles.fieldRow}>
      <Text type="secondary" className={styles.fieldLabel}>系列 / 分组</Text>
      <Input size="small" value="—" disabled className={styles.fieldInput} />
    </div>
  </div>
)

// ── 样式配置 Tab ──────────────────────────────────────────────────────────────
const StyleTab = ({ chart }) => {
  const { updateChartConfig } = useWorkbenchState()

  return (
    <div className={styles.tabContent}>
      <Text type="secondary" className={styles.sectionLabel}>配色方案</Text>
      <div className={styles.themeList}>
        {COLOR_THEMES.map((theme) => (
          <div
            key={theme.id}
            className={`${styles.themeItem} ${chart.colorTheme === theme.id ? styles.themeItemActive : ''}`}
            onClick={() => updateChartConfig(chart.id, { colorTheme: theme.id })}
          >
            <div className={styles.themeSwatches}>
              {theme.colors.slice(0, 5).map((c, i) => (
                <span key={i} className={styles.swatch} style={{ background: c }} />
              ))}
            </div>
            <Text style={{ fontSize: 12 }}>{theme.label}</Text>
          </div>
        ))}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div className={styles.switchRow}>
        <Text style={{ fontSize: 13 }}>显示图例</Text>
        <Switch
          size="small"
          checked={chart.showLegend !== false}
          onChange={(v) => updateChartConfig(chart.id, { showLegend: v })}
        />
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <Text type="secondary" className={styles.sectionLabel}>图表标题</Text>
      <Input
        size="small"
        value={chart.title}
        onChange={(e) => updateChartConfig(chart.id, { title: e.target.value })}
        placeholder="输入图表标题"
      />
    </div>
  )
}

// ── 主面板 ────────────────────────────────────────────────────────────────────
const ConfigPanel = () => {
  const { configPanel, charts, closeConfigPanel, moveConfigPanel } = useWorkbenchState()
  const { visible, chartId, x, y } = configPanel

  const chart = charts.find((ch) => ch.id === chartId)

  const { onDragStart } = useConfigPanelDrag({
    x,
    y,
    onMove: moveConfigPanel,
  })

  // Esc 关闭
  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeConfigPanel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, closeConfigPanel])

  if (!visible || !chart) return null

  const tabItems = [
    { key: 'type', label: '图表类型', children: <TypeTab chart={chart} /> },
    { key: 'data', label: '数据配置', children: <DataTab chart={chart} /> },
    { key: 'style', label: '样式',     children: <StyleTab chart={chart} /> },
  ]

  return ReactDOM.createPortal(
    <div
      className={styles.panel}
      style={{ left: x, top: y }}
    >
      {/* 标题栏（可拖移）*/}
      <div className={styles.panelHeader} onMouseDown={onDragStart}>
        <Title level={5} style={{ margin: 0, fontSize: 13, color: '#1e293b' }}>
          ⚙ 图表配置
        </Title>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          className={styles.closeBtn}
          onClick={closeConfigPanel}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Tab 内容 */}
      <div className={styles.panelBody}>
        <Tabs
          defaultActiveKey="type"
          size="small"
          items={tabItems}
          className={styles.tabs}
        />
      </div>
    </div>,
    document.body
  )
}

export default ConfigPanel
