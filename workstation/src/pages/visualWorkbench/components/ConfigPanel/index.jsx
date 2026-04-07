import React, { useState, useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Typography, Button, Tabs, Switch, Divider, Input, InputNumber, Table, Tooltip, Tag, Space } from 'antd'
import {
  CloseOutlined,
  PlusOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  EditOutlined,
  ApiOutlined,
  TableOutlined,
  BgColorsOutlined,
  SettingOutlined,
  DotChartOutlined,
} from '@ant-design/icons'
import useWorkbenchState, { CHART_META, COLOR_THEMES, CHART_DEFAULTS } from '../../hooks/useWorkbenchState'
import { useConfigPanelDrag } from '../../hooks/useChartDrag'
import styles from './index.module.less'

const { Text, Title } = Typography

const getChartMetaByType = (type) => CHART_META.find((item) => item.type === type) ?? null

const buildRowsFromChart = (chart) => {
  if (!chart) return []

  if (chart.type === 'pie') {
    const source = chart.option?.series?.[0]?.data
    if (Array.isArray(source) && source.length > 0) {
      return source.slice(0, 12).map((item, index) => ({
        key: String(index + 1),
        x: item?.name ?? `类别 ${index + 1}`,
        y: Number(item?.value) || 0,
      }))
    }
  } else if (chart.type === 'scatter') {
    const source = chart.option?.series?.[0]?.data
    if (Array.isArray(source) && source.length > 0) {
      return source.slice(0, 12).map((item, index) => ({
        key: String(index + 1),
        x: item?.[0] ?? 0,
        y: Number(item?.[1]) || 0,
      }))
    }
  } else {
    const xList = Array.isArray(chart.option?.xAxis?.data) ? chart.option.xAxis.data : []
    const yList = Array.isArray(chart.option?.series?.[0]?.data) ? chart.option.series[0].data : []
    const len = Math.min(Math.max(xList.length, yList.length), 12)
    if (len > 0) {
      return Array.from({ length: len }).map((_, index) => ({
        key: String(index + 1),
        x: xList[index] ?? `类别 ${index + 1}`,
        y: Number(yList[index]) || 0,
      }))
    }
  }

  return [
    { key: '1', x: '类别 A', y: 120 },
    { key: '2', x: '类别 B', y: 280 },
    { key: '3', x: '类别 C', y: 190 },
    { key: '4', x: '类别 D', y: 340 },
  ]
}

const Section = ({ title, desc, children, compact = false }) => (
  <div className={`${styles.sectionCard} ${compact ? styles.sectionCardCompact : ''}`}>
    <div className={styles.sectionHead}>
      <Text className={styles.sectionTitle}>{title}</Text>
      {desc && <Text className={styles.sectionDesc}>{desc}</Text>}
    </div>
    {children}
  </div>
)

const TypeTab = ({ chart }) => {
  const { updateChartConfig } = useWorkbenchState()
  const currentMeta = getChartMetaByType(chart.type)

  const handleChangeType = (type) => {
    updateChartConfig(chart.id, {
      type,
      title: getChartMetaByType(type)?.label ?? type,
      option: CHART_DEFAULTS[type],
    })
  }

  return (
    <div className={styles.tabContent}>
      <Section
        title="图表类型"
        desc={currentMeta ? `当前：${currentMeta.label} · ${currentMeta.group}` : '选择一种图表类型'}
      >
        <div className={styles.typeGrid}>
          {CHART_META.map((meta) => (
            <button
              key={meta.type}
              type="button"
              className={`${styles.typeCard} ${chart.type === meta.type ? styles.typeCardActive : ''}`}
              onClick={() => handleChangeType(meta.type)}
            >
              <span className={styles.typeIcon}>{meta.icon}</span>
              <span className={styles.typeTextWrap}>
                <Text className={styles.typeLabel}>{meta.label}</Text>
                <Text className={styles.typeGroup}>{meta.group}</Text>
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

const DATA_SOURCES = [
  { value: 'mock', label: '虚拟数据', icon: <DatabaseOutlined /> },
  { value: 'manual', label: '手动输入', icon: <EditOutlined /> },
  { value: 'api', label: 'API 接口', icon: <ApiOutlined />, disabled: true },
  { value: 'dataset', label: '项目数据集', icon: <TableOutlined />, disabled: true },
]

const DataTab = ({ chart }) => {
  const { updateChartOption } = useWorkbenchState()
  const [dataSource, setDataSource] = useState('manual')
  const [manualRows, setManualRows] = useState(() => buildRowsFromChart(chart))

  const applyManualData = (rows) => {
    const nextRows = rows.length > 0 ? rows : [{ key: String(Date.now()), x: '类别 A', y: 0 }]
    const xData = nextRows.map((row) => row.x)
    const yData = nextRows.map((row) => Number(row.y) || 0)

    if (chart.type === 'pie') {
      updateChartOption(chart.id, {
        series: [
          {
            ...chart.option?.series?.[0],
            data: nextRows.map((row) => ({ name: row.x, value: Number(row.y) || 0 })),
          },
        ],
      })
      return
    }

    if (chart.type === 'scatter') {
      updateChartOption(chart.id, {
        series: [
          {
            ...chart.option?.series?.[0],
            data: nextRows.map((row) => [Number(row.x) || 0, Number(row.y) || 0]),
          },
        ],
      })
      return
    }

    updateChartOption(chart.id, {
      xAxis: { ...chart.option?.xAxis, data: xData },
      series: chart.option?.series?.map((series, index) => (index === 0 ? { ...series, data: yData } : series)) ?? [
        { type: chart.type === 'area' ? 'line' : chart.type, data: yData },
      ],
    })
  }

  const handleRowChange = (key, field, value) => {
    const updated = manualRows.map((row) => (row.key === key ? { ...row, [field]: value } : row))
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
    if (manualRows.length <= 1) return
    const updated = manualRows.filter((row) => row.key !== key)
    setManualRows(updated)
    applyManualData(updated)
  }

  const isScatter = chart.type === 'scatter'

  const columns = [
    {
      title: isScatter ? 'X 值' : '类别 / X 轴',
      dataIndex: 'x',
      key: 'x',
      render: (value, record) => (
        <Input
          size="small"
          value={value}
          onChange={(event) => handleRowChange(record.key, 'x', event.target.value)}
          className={styles.tableCell}
        />
      ),
    },
    {
      title: isScatter ? 'Y 值' : '数值 / Y 轴',
      dataIndex: 'y',
      key: 'y',
      render: (value, record) => (
        <InputNumber
          size="small"
          value={value}
          onChange={(nextValue) => handleRowChange(record.key, 'y', nextValue ?? 0)}
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
      <Section title="数据来源" desc="优先支持虚拟数据和手动输入">
        <div className={styles.dataSourceGrid}>
          {DATA_SOURCES.map((source) => (
            <Tooltip key={source.value} title={source.disabled ? '即将推出' : source.label}>
              <button
                type="button"
                className={[
                  styles.dataSourceCard,
                  dataSource === source.value ? styles.dataSourceCardActive : '',
                  source.disabled ? styles.dataSourceCardDisabled : '',
                ].join(' ')}
                onClick={() => !source.disabled && setDataSource(source.value)}
              >
                <span className={styles.dataSourceIcon}>{source.icon}</span>
                <Text className={styles.dataSourceLabel}>{source.label}</Text>
                {source.disabled && <Tag className={styles.comingTag}>即将</Tag>}
              </button>
            </Tooltip>
          ))}
        </div>
      </Section>

      {dataSource === 'mock' && (
        <Section compact title="虚拟数据模式" desc="当前使用默认演示数据，适合快速预览布局">
          <div className={styles.mockDataBanner}>
            <DatabaseOutlined />
            <Text type="secondary">切换到「手动输入」后可实时编辑图表数据。</Text>
          </div>
        </Section>
      )}

      {dataSource === 'manual' && (
        <Section title="手动数据输入" desc={`共 ${manualRows.length} 行，最多 12 行。改动会实时同步到图表。`}>
          <Table
            dataSource={manualRows}
            columns={columns}
            size="small"
            pagination={false}
            className={styles.dataTable}
            rowKey="key"
            scroll={{ y: 216 }}
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
            添加数据行 ({manualRows.length}/12)
          </Button>
        </Section>
      )}

      {(dataSource === 'api' || dataSource === 'dataset') && (
        <Section compact title="敬请期待">
          <div className={styles.comingSoonBox}>
            <Text type="secondary">该数据接入方式将在后续版本开放。</Text>
          </div>
        </Section>
      )}
    </div>
  )
}

const StyleTab = ({ chart }) => {
  const { updateChartConfig } = useWorkbenchState()

  return (
    <div className={styles.tabContent}>
      <Section title="配色主题" desc="切换当前图表的调色方案">
        <div className={styles.themeList}>
          {COLOR_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`${styles.themeItem} ${chart.colorTheme === theme.id ? styles.themeItemActive : ''}`}
              onClick={() => updateChartConfig(chart.id, { colorTheme: theme.id })}
            >
              <div className={styles.themeSwatches}>
                {theme.colors.slice(0, 5).map((color, index) => (
                  <span key={index} className={styles.swatch} style={{ background: color }} />
                ))}
              </div>
              <Text className={styles.themeLabel}>{theme.label}</Text>
            </button>
          ))}
        </div>
      </Section>

      <Section title="显示与布局">
        <div className={styles.switchRow}>
          <div className={styles.switchLabelBlock}>
            <Text className={styles.switchLabel}>显示图例</Text>
            <Text className={styles.switchHint}>控制图例区域展示</Text>
          </div>
          <Switch
            size="small"
            checked={chart.showLegend !== false}
            onChange={(value) => updateChartConfig(chart.id, { showLegend: value })}
          />
        </div>

        <Divider className={styles.inlineDivider} />

        <div className={styles.switchRow}>
          <div className={styles.switchLabelBlock}>
            <Text className={styles.switchLabel}>允许叠加</Text>
            <Text className={styles.switchHint}>允许当前图表覆盖在其他图表上层</Text>
          </div>
          <Switch
            size="small"
            checked={chart.allowOverlap === true}
            onChange={(value) => updateChartConfig(chart.id, { allowOverlap: value })}
          />
        </div>
      </Section>

      <Section title="图表标题">
        <Input
          size="small"
          value={chart.title}
          onChange={(event) => updateChartConfig(chart.id, { title: event.target.value })}
          placeholder="输入图表标题"
          className={styles.titleInput}
        />
      </Section>
    </div>
  )
}

const ConfigPanel = () => {
  const { configPanel, charts, closeConfigPanel, moveConfigPanel } = useWorkbenchState()
  const { visible, chartId, x, y } = configPanel

  const chart = charts.find((item) => item.id === chartId)
  const chartMeta = useMemo(() => getChartMetaByType(chart?.type), [chart?.type])

  const { onDragStart } = useConfigPanelDrag({
    x,
    y,
    onMove: moveConfigPanel,
  })

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeConfigPanel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [visible, closeConfigPanel])

  if (!visible || !chart) return null

  const tabItems = [
    {
      key: 'type',
      label: (
        <Space size={6}>
          <DotChartOutlined />
          <span>类型</span>
        </Space>
      ),
      children: <TypeTab chart={chart} />,
    },
    {
      key: 'data',
      label: (
        <Space size={6}>
          <DatabaseOutlined />
          <span>数据</span>
        </Space>
      ),
      children: <DataTab chart={chart} />,
    },
    {
      key: 'style',
      label: (
        <Space size={6}>
          <BgColorsOutlined />
          <span>样式</span>
        </Space>
      ),
      children: <StyleTab chart={chart} />,
    },
  ]

  return ReactDOM.createPortal(
    <div className={styles.panel} style={{ left: x, top: y }}>
      <div className={styles.panelHeader} onMouseDown={onDragStart}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <SettingOutlined />
          </div>
          <div className={styles.headerText}>
            <Title level={5} className={styles.headerTitle}>
              图表配置
            </Title>
            <Text className={styles.headerSub}>
              {chartMeta ? `${chartMeta.icon} ${chartMeta.label} · ${chartMeta.group}` : chart.type}
            </Text>
          </div>
        </div>

        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          className={styles.closeBtn}
          onClick={closeConfigPanel}
          onMouseDown={(event) => event.stopPropagation()}
        />
      </div>

      <div className={styles.panelBody}>
        <Tabs
          key={`${chart.id}-${chart.type}`}
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
