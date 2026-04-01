/**
 * 数据模型页面
 *
 * Tab 1「字段总览」— 展示项目内所有 ready 状态数据集的字段结构（来自 Recipe）
 * Tab 2「关联画布」— 基于 @xyflow/react 的可视化 Join 关联画布
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Table,
  Tag,
  Button,
  Space,
  Drawer,
  Tabs,
  Empty,
  Tooltip,
  Select,
  Skeleton,
  message,
} from 'antd'
import {
  DatabaseOutlined,
  EyeOutlined,
  BranchesOutlined,
  AppstoreOutlined,
  DeleteOutlined,
  FullscreenOutlined,
  CodeOutlined,
  DownOutlined,
  RightOutlined,
  DragOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { getDatasets, getRecipes } from '@src/service/api/datasets'
import { getProjectBySlug } from '@src/service/api/projects'
import styles from './index.module.less'

const { Title, Text } = Typography
const { Option } = Select

/* ── 类型推断工具 ──────────────────────────────────────────────────────────── */

/**
 * 根据存储字段名（storageName）推断字段类型
 * 字段类型未持久化到 Recipe，只能启发式推断
 */
function inferFieldType(storageName) {
  if (!storageName) return 'text'
  const name = storageName.toLowerCase()
  if (name.endsWith('_at') || name.endsWith('_date') || name.includes('date') || name.includes('time')) {
    return 'date'
  }
  if (
    name.endsWith('_id') ||
    name.endsWith('_count') ||
    name.endsWith('_num') ||
    name.endsWith('_amount') ||
    name.endsWith('_price') ||
    name.endsWith('_qty') ||
    name.endsWith('_total')
  ) {
    return 'number'
  }
  return 'text'
}

const TYPE_TAG_CONFIG = {
  text:   { color: 'blue',   label: '文本' },
  number: { color: 'green',  label: '数值' },
  date:   { color: 'orange', label: '日期' },
}

/* ── 工具函数 ──────────────────────────────────────────────────────────────── */

function formatDate(iso) {
  if (!iso) return '—'
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}

const STATUS_CONFIG = {
  ready:      { color: 'success',   label: '就绪' },
  processing: { color: 'processing', label: '处理中' },
  failed:     { color: 'error',     label: '失败' },
}

/* ════════════════════════════════════════════════════════════════════════════
   Tab 1：字段总览
══════════════════════════════════════════════════════════════════════════════ */

/** 字段 Drawer — 展示单个数据集的字段列表 */
const FieldDrawer = memo(({ open, dataset, fields, onClose }) => {
  const columns = [
    {
      title: '字段标签',
      key: 'label',
      render: (_, op) => (
        <span className={styles.fieldLabel}>{op.label || op.to}</span>
      ),
    },
    {
      title: '存储字段名',
      dataIndex: 'to',
      key: 'to',
      render: (val) => <span className={styles.fieldStorage}>{val}</span>,
    },
    {
      title: '原始字段名',
      dataIndex: 'from',
      key: 'from',
      render: (val) => <span className={styles.fieldFrom}>{val}</span>,
    },
    {
      title: '类型',
      key: 'type',
      width: 80,
      render: (_, op) => {
        const t = inferFieldType(op.to)
        const cfg = TYPE_TAG_CONFIG[t]
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
  ]

  return (
    <Drawer
      title={
        <Space size={8}>
          <DatabaseOutlined style={{ color: '#6366f1' }} />
          <span>{dataset?.name ?? '数据集字段'}</span>
          {fields.length > 0 && (
            <Tag style={{ marginLeft: 4 }}>{fields.length} 个字段</Tag>
          )}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={600}
      destroyOnHide
    >
      {fields.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无字段信息，请先在数据集页面完成字段映射配置"
        />
      ) : (
        <Table
          className={styles.drawerTable}
          columns={columns}
          dataSource={fields}
          rowKey={(op, i) => op.to || String(i)}
          pagination={false}
          size="small"
        />
      )}
    </Drawer>
  )
})

/** 字段总览主表格 */
const FieldOverviewTab = memo(({ datasets, recipesMap, loading, onGoDatasets }) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeDataset, setActiveDataset] = useState(null)

  const handleViewFields = (dataset) => {
    setActiveDataset(dataset)
    setDrawerOpen(true)
  }

  const columns = [
    {
      title: '数据集',
      key: 'name',
      render: (_, record) => {
        const cfg = STATUS_CONFIG[record.status] ?? { color: 'default', label: record.status }
        return (
          <Space size={8}>
            <DatabaseOutlined style={{ color: '#6366f1', fontSize: 15 }} />
            <span style={{ fontWeight: 600, color: '#1e293b' }}>{record.name}</span>
            <Tag color={cfg.color} style={{ marginLeft: 4 }}>{cfg.label}</Tag>
          </Space>
        )
      },
    },
    {
      title: 'Cube 模型名',
      key: 'cube_name',
      width: 220,
      render: (_, record) => (
        <span className={styles.cubeNameCell}>Dataset_{record.id}</span>
      ),
    },
    {
      title: '字段数',
      key: 'fields',
      width: 90,
      align: 'center',
      render: (_, record) => {
        const fields = recipesMap[record.id] ?? []
        return (
          <Tag color={fields.length > 0 ? 'blue' : 'default'}>
            {fields.length}
          </Tag>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'date_created',
      key: 'date_created',
      width: 160,
      render: (val) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(val)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Tooltip title="查看字段列表">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewFields(record)}
          >
            查看字段
          </Button>
        </Tooltip>
      ),
    },
  ]

  if (loading) {
    return (
      <div style={{ padding: '8px 0' }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} active paragraph={{ rows: 1 }} style={{ marginBottom: 16 }} />
        ))}
      </div>
    )
  }

  if (datasets.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无就绪的数据集，请先在数据集页面上传并处理数据"
        style={{ marginTop: 80 }}
      >
        <Button
          type="primary"
          icon={<DatabaseOutlined />}
          onClick={onGoDatasets}
        >
          前往数据集
        </Button>
      </Empty>
    )
  }

  return (
    <>
      <Table
        columns={columns}
        dataSource={datasets}
        rowKey="id"
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        size="middle"
      />
      <FieldDrawer
        open={drawerOpen}
        dataset={activeDataset}
        fields={activeDataset ? (recipesMap[activeDataset.id] ?? []) : []}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
})

/* ════════════════════════════════════════════════════════════════════════════
   Tab 2：关联画布
══════════════════════════════════════════════════════════════════════════════ */

/** DatasetNode — React Flow 自定义节点，展示数据集 + 字段列表 */
const DatasetNode = memo(({ data }) => {
  const { dataset, fields } = data

  return (
    <div className={styles.datasetNode}>
      {/* 节点 Header */}
      <div className={styles.datasetNodeHeader}>
        <DatabaseOutlined style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, flexShrink: 0 }} />
        <span className={styles.datasetNodeTitle}>{dataset.name}</span>
      </div>

      {/* 字段行 */}
      <div className={styles.datasetNodeBody}>
        {fields.length === 0 ? (
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8' }}>
            暂无字段信息
          </div>
        ) : (
          fields.map((op, idx) => {
            const fieldId = op.to || String(idx)
            const label = op.label || op.to
            return (
              <div key={fieldId} className={styles.datasetNodeField}>
                {/* 左侧 Handle（target — 接受连线） */}
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`target-${fieldId}`}
                  className={styles.fieldHandle}
                  style={{ top: '50%', left: 4 }}
                />

                <span className={styles.datasetNodeFieldLabel}>{label}</span>
                <span className={styles.datasetNodeFieldStorage}>{op.to}</span>

                {/* 右侧 Handle（source — 发出连线） */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`source-${fieldId}`}
                  className={styles.fieldHandle}
                  style={{ top: '50%', right: 4 }}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})

const nodeTypes = { datasetNode: DatasetNode }

/** 从 edges 生成 JOIN 配置 JSON */
function buildJoinConfig(edges, nodes, joinType) {
  return edges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)
    const leftField  = edge.sourceHandle?.replace(/^source-/, '') ?? ''
    const rightField = edge.targetHandle?.replace(/^target-/, '') ?? ''
    return {
      left:  { dataset: `Dataset_${sourceNode?.data?.dataset?.id ?? ''}`, field: leftField },
      right: { dataset: `Dataset_${targetNode?.data?.dataset?.id ?? ''}`, field: rightField },
      type:  joinType,
    }
  })
}

/** 左侧数据集侧边栏 */
const CanvasSidebar = memo(({ datasets, addedIds, onDragStart, joinConfig, jsonExpanded, onToggleJson }) => {
  return (
    <div className={styles.canvasSidebar}>
      <div className={styles.sidebarHeader}>数据集</div>
      <div className={styles.sidebarList}>
        {datasets.length === 0 && (
          <div style={{ padding: '12px 10px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
            暂无就绪数据集
          </div>
        )}
        {datasets.map((ds) => {
          const added = addedIds.has(ds.id)
          return (
            <Tooltip key={ds.id} title={added ? '已在画布中' : '拖拽到画布'} placement="right">
              <div
                className={`${styles.sidebarItem} ${added ? styles.sidebarItemAdded : ''}`}
                draggable={!added}
                onDragStart={added ? undefined : (e) => onDragStart(e, ds)}
              >
                <DatabaseOutlined className={styles.sidebarItemIcon} />
                <span className={styles.sidebarItemName}>{ds.name}</span>
                {added && <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>已添加</Tag>}
              </div>
            </Tooltip>
          )
        })}
      </div>

      {/* JOIN JSON 预览面板 */}
      <div className={styles.jsonPreview}>
        <div className={styles.jsonPreviewHeader} onClick={onToggleJson}>
          <Space size={5}>
            <CodeOutlined />
            <span>JOIN 配置预览</span>
            {joinConfig.length > 0 && (
              <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0 }} color="blue">
                {joinConfig.length}
              </Tag>
            )}
          </Space>
          {jsonExpanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
        </div>
        {jsonExpanded && (
          <div className={styles.jsonPreviewBody}>
            {joinConfig.length === 0 ? (
              <pre className={styles.jsonCode} style={{ color: '#475569' }}>
                {'// 连接两个节点的字段\n// 以生成 JOIN 配置'}
              </pre>
            ) : (
              <pre className={styles.jsonCode}>
                {JSON.stringify(joinConfig, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

/** 画布工具栏 */
const CanvasToolbar = memo(({ joinType, onJoinTypeChange, onClear, onFitView }) => (
  <div className={styles.toolbar}>
    <span className={styles.toolbarLabel}>JOIN 类型</span>
    <Select
      size="small"
      value={joinType}
      onChange={onJoinTypeChange}
      style={{ width: 100 }}
    >
      <Option value="INNER">INNER</Option>
      <Option value="LEFT">LEFT</Option>
      <Option value="RIGHT">RIGHT</Option>
      <Option value="FULL">FULL</Option>
    </Select>
    <Button size="small" icon={<FullscreenOutlined />} onClick={onFitView}>
      适应视图
    </Button>
    <Button size="small" danger icon={<DeleteOutlined />} onClick={onClear}>
      清空画布
    </Button>
  </div>
))

/** React Flow 内部组件（需要在 ReactFlowProvider 内才能使用 useReactFlow） */
const JoinCanvasInner = memo(({ datasets, recipesMap }) => {
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [joinType, setJoinType] = useState('LEFT')
  const [jsonExpanded, setJsonExpanded] = useState(true)
  const reactFlowWrapper = useRef(null)

  const addedIds = new Set(nodes.map((n) => n.data?.dataset?.id))
  const joinConfig = buildJoinConfig(edges, nodes, joinType)

  /* 拖拽侧边栏数据集到画布 */
  const handleDragStart = useCallback((e, dataset) => {
    e.dataTransfer.setData('application/veloxis-dataset', JSON.stringify({ id: dataset.id }))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData('application/veloxis-dataset')
      if (!raw) return

      let parsed
      try { parsed = JSON.parse(raw) } catch { return }

      const dataset = datasets.find((d) => d.id === parsed.id)
      if (!dataset) return

      // 转换为 Flow 坐标
      const position = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      })

      const newNode = {
        id: `node-${dataset.id}`,
        type: 'datasetNode',
        position,
        data: {
          dataset,
          fields: recipesMap[dataset.id] ?? [],
        },
      }
      setNodes((prev) => [...prev, newNode])
    },
    [datasets, recipesMap, screenToFlowPosition, setNodes]
  )

  /* 连线 */
  const handleConnect = useCallback(
    (params) => {
      setEdges((prev) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
            label: joinType,
            labelStyle: { fontSize: 10, fill: '#6366f1' },
            labelBgStyle: { fill: '#eef2ff' },
          },
          prev
        )
      )
    },
    [joinType, setEdges]
  )

  /* 清空画布 */
  const handleClear = useCallback(() => {
    setNodes([])
    setEdges([])
  }, [setNodes, setEdges])

  /* 适应视图 */
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 })
  }, [fitView])

  return (
    <div className={styles.canvasWrap}>
      {/* 左侧侧边栏 */}
      <CanvasSidebar
        datasets={datasets}
        addedIds={addedIds}
        onDragStart={handleDragStart}
        joinConfig={joinConfig}
        jsonExpanded={jsonExpanded}
        onToggleJson={() => setJsonExpanded((v) => !v)}
      />

      {/* 右侧画布区 */}
      <div
        ref={reactFlowWrapper}
        className={styles.canvasArea}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 工具栏 */}
        <CanvasToolbar
          joinType={joinType}
          onJoinTypeChange={setJoinType}
          onClear={handleClear}
          onFitView={handleFitView}
        />

        <ReactFlow
          style={{ width: '100%', height: '100%' }}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background color="#c7d2fe" gap={20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor="#6366f1"
            maskColor="rgba(248, 250, 252, 0.7)"
            style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}
          />
        </ReactFlow>

        {/* 画布为空时的提示 */}
        {nodes.length === 0 && (
          <div className={styles.canvasEmpty}>
            <DragOutlined style={{ fontSize: 40, color: '#c7d2fe', marginBottom: 12 }} />
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              将左侧数据集拖拽到此处，连接字段以建立 JOIN 关联
            </Text>
          </div>
        )}
      </div>
    </div>
  )
})

/** 关联画布 Tab — 包裹 ReactFlowProvider */
const JoinCanvasTab = memo(({ datasets, recipesMap, loading }) => {
  if (loading) {
    return (
      <div style={{ padding: '8px 0' }}>
        {[1, 2].map((i) => (
          <Skeleton key={i} active paragraph={{ rows: 2 }} style={{ marginBottom: 16 }} />
        ))}
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <JoinCanvasInner datasets={datasets} recipesMap={recipesMap} />
    </ReactFlowProvider>
  )
})

/* ════════════════════════════════════════════════════════════════════════════
   主组件
══════════════════════════════════════════════════════════════════════════════ */

const Models = () => {
  const { slug } = useParams()
  const navigate = useNavigate()

  /** slug → UUID 解析（API 使用 UUID，navigate 使用 slug） */
  const [projectId, setProjectId] = useState(null)
  useEffect(() => {
    if (!slug) return
    getProjectBySlug(slug).then((p) => { if (p?.id) setProjectId(p.id) })
  }, [slug])

  /** 所有 ready 状态的数据集 */
  const [datasets, setDatasets] = useState([])
  /** { datasetId: RecipeOperator[] } */
  const [recipesMap, setRecipesMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  /* ── 数据加载 ──────────────────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      // Step 1: 获取所有数据集，筛选 ready 状态
      const all = await getDatasets(projectId)
      const ready = (all ?? []).filter((d) => d.status === 'ready')
      setDatasets(ready)

      if (ready.length === 0) {
        setRecipesMap({})
        return
      }

      // Step 2: 并行获取每个数据集的 Recipe
      const recipeResults = await Promise.allSettled(
        ready.map((ds) => getRecipes(ds.id))
      )

      const map = {}
      recipeResults.forEach((result, idx) => {
        const dsId = ready[idx].id
        if (result.status === 'fulfilled') {
          const recipes = result.value ?? []
          // 取第一条 Recipe 的 config（最新一条），无 recipe 则空数组
          map[dsId] = recipes[0]?.config ?? []
        } else {
          map[dsId] = []
        }
      })
      setRecipesMap(map)
    } catch (err) {
      if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') return
      message.error('加载数据模型失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { loadData() }, [loadData])

  /* ── Tab 配置 ──────────────────────────────────────────────────────────── */
  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space size={6}>
          <AppstoreOutlined />
          字段总览
        </Space>
      ),
      children: (
        <FieldOverviewTab
          datasets={datasets}
          recipesMap={recipesMap}
          loading={loading}
          onGoDatasets={() => navigate(`/project/${slug}/datasets`)}
        />
      ),
    },
    {
      key: 'canvas',
      label: (
        <Space size={6}>
          <BranchesOutlined />
          关联画布
        </Space>
      ),
      children: (
        <JoinCanvasTab
          datasets={datasets}
          recipesMap={recipesMap}
          loading={loading}
        />
      ),
    },
  ]

  return (
    <div className={styles.page}>
      {/* ── 页头 ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Title level={4} style={{ margin: 0 }}>数据模型</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            查看数据集字段结构，并通过关联画布定义数据集间的 JOIN 关系
          </Text>
        </div>
        <Button icon={<DatabaseOutlined />} onClick={() => navigate(`/project/${slug}/datasets`)}>
          管理数据集
        </Button>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className={styles.tabsWrap}
        destroyInactiveTabPane={false}
      />
    </div>
  )
}

export default Models
