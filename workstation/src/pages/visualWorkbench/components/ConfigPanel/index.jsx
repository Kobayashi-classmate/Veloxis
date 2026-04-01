import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import {
  Typography, Button, Tabs, Switch, Divider, Input,
  InputNumber, Table, Tooltip, Tag,
} from 'antd'
import {
  CloseOutlined, PlusOutlined, DeleteOutlined, DatabaseOutlined,
  EditOutlined, ApiOutlined, TableOutlined,
} from '@ant-design/icons'
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
const DATA_SOURCES = [
  { value: 'mock',   label: '虚拟数据',    icon: <DatabaseOutlined /> },
  { value: 'manual', label: '手动输入',    icon: <EditOutlined /> },
  { value: 'api',    label: 'API 接口',    icon: <ApiOutlined />, disabled: true },
  { value: 'dataset', label: '项目数据集', icon: <TableOutlined />, disabled: true },
]

const DEFAULT_MANUAL_ROWS = [
  { key: '1', x: '类别 A', y: 120 },
  { key: '2', x: '类别 B', y: 280 },
  { key: '3', x: '类别 C', y: 190 },
  { key: '4', x: '类别 D', y: 340 },
]

const DataTab = ({ chart }) => {
  const { updateChartOption } = useWorkbenchState()
  const [dataSource, setDataSource] = useState('mock')
  const [manualRows, setManualRows] = useState(DEFAULT_MANUAL_ROWS)

  // 手动数据变更时实时更新图表 option
  const applyManualData = (rows) => {
    const xData = rows.map((r) => r.x)
    const yData = rows.map((r) => Number(r.y) || 0)

    if (chart.type === 'pie') {
      updateChartOption(chart.id, {
        series: [{ ...chart.option?.series?.[0], data: rows.map((r) => ({ name: r.x, value: Number(r.y) || 0 })) }],
      })
    } else if (chart.type === 'scatter') {
      updateChartOption(chart.id, {
        series: [{ ...chart.option?.series?.[0], data: rows.map((r) => [Number(r.x) || 0, Number(r.y) || 0]) }],
      })
    } else {
      updateChartOption(chart.id, {
        xAxis: { ...chart.option?.xAxis, data: xData },
        series: chart.option?.series?.map((s, i) =>
          i === 0 ? { ...s, data: yData } : s
        ) ?? [{ type: chart.type === 'area' ? 'line' : chart.type, data: yData }],
      })
    }
  }

  const handleRowChange = (key, field, value) => {
    const updated = manualRows.map((r) => r.key === key ? { ...r, [field]: value } : r)
    setManualRows(updated)
    applyManualData(updated)
  }

  const handleAddRow = () => {
    if (manualRows.length >= 12) return
    const newRow = { key: String(Date.now()), x: `类别 ${manualRows.length + 1}`, y: 0 }
    const updated = [...manualRows, newRow]
    setManualRows(updated)
    applyManualData(updated)
  }

  const handleDeleteRow = (key) => {
    const updated = manualRows.filter((r) => r.key !== key)
    setManualRows(updated)
    applyManualData(updated)
  }

  const isScatter = chart.type === 'scatter'

  const columns = [
    {
      title: isScatter ? 'X 值' : '类别 / X 轴',
      dataIndex: 'x',
      key: 'x',
      render: (val, record) => (
        <Input
          size="small"
          value={val}
          onChange={(e) => handleRowChange(record.key, 'x', e.target.value)}
          className={styles.tableCell}
        />
      ),
    },
    {
      title: isScatter ? 'Y 值' : '数值 / Y 轴',
      dataIndex: 'y',
      key: 'y',
      render: (val, record) => (
        <InputNumber
          size="small"
          value={val}
          onChange={(v) => handleRowChange(record.key, 'y', v ?? 0)}
          className={styles.tableCell}
          controls={false}
        />
      ),
    },
    {
      title: '',
      key: 'del',
      width: 28,
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          danger
          className={styles.delRowBtn}
          onClick={() => handleDeleteRow(record.key)}
          disabled={manualRows.length <= 1}
        />
      ),
    },
  ]

  return (
    <div className={styles.tabContent}>
      {/* 数据源选择 */}
      <Text type="secondary" className={styles.sectionLabel}>数据来源</Text>
      <div className={styles.dataSourceGrid}>
        {DATA_SOURCES.map((ds) => (
          <Tooltip key={ds.value} title={ds.disabled ? '即将推出' : ds.label}>
            <div
              className={`${styles.dataSourceCard} ${dataSource === ds.value ? styles.dataSourceCardActive : ''} ${ds.disabled ? styles.dataSourceCardDisabled : ''}`}
              onClick={() => !ds.disabled && setDataSource(ds.value)}
            >
              <span className={styles.dataSourceIcon}>{ds.icon}</span>
              <Text className={styles.dataSourceLabel}>{ds.label}</Text>
              {ds.disabled && <Tag className={styles.comingTag}>即将</Tag>}
            </div>
          </Tooltip>
        ))}
      </div>

      <Divider style={{ margin: '10px 0' }} />

      {/* 虚拟数据模式 */}
      {dataSource === 'mock' && (
        <div className={styles.mockDataBanner}>
          <DatabaseOutlined style={{ color: '#f59e0b', marginRight: 6 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            当前使用内置虚拟数据。切换「手动输入」可自定义数据。
          </Text>
        </div>
      )}

      {/* 手动输入模式 */}
      {dataSource === 'manual' && (
        <div className={styles.manualDataSection}>
          <div className={styles.manualHeader}>
            <Text className={styles.sectionLabel}>数据输入</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {manualRows.length} 行
            </Text>
          </div>
          <Table
            dataSource={manualRows}
            columns={columns}
            size="small"
            pagination={false}
            className={styles.dataTable}
            rowKey="key"
            scroll={{ y: 200 }}
          />
          <Button
            type="dashed"
            size="small"
            block
            icon={<PlusOutlined />}
            onClick={handleAddRow}
            disabled={manualRows.length >= 12}
            className={styles.addRowBtn}
          >
            添加行 ({manualRows.length}/12)
          </Button>
        </div>
      )}

      {/* API / Dataset 占位 */}
      {(dataSource === 'api' || dataSource === 'dataset') && (
        <div className={styles.comingSoonBox}>
          <Text type="secondary" style={{ fontSize: 12 }}>此功能将在后续版本中支持</Text>
        </div>
      )}
    </div>
  )
}

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

      <div className={styles.switchRow}>
        <div>
          <Text style={{ fontSize: 13 }}>允许叠加</Text>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            允许本图表叠加在其他图表上方
          </Text>
        </div>
        <Switch
          size="small"
          checked={chart.allowOverlap !== false}
          onChange={(v) => updateChartConfig(chart.id, { allowOverlap: v })}
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
