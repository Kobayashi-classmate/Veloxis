import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Row,
  Col,
  Card,
  Button,
  Space,
  Modal,
  Input,
  Tag,
  Dropdown,
  Empty,
  message,
} from 'antd'
import {
  PlusOutlined,
  BarChartOutlined,
  MoreOutlined,
  EditOutlined,
  DeleteOutlined,
  EnterOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Title, Text, Paragraph } = Typography

// ── 虚拟工作台数据（后续替换为真实 API）────────────────────────────────────────
const MOCK_WORKBOOKS = [
  {
    id: 'wb-001',
    name: '财务分析看板',
    description: '涵盖营收趋势、成本结构、利润率等核心财务指标的综合看板',
    canvasCount: 4,
    categoryCount: 2,
    updatedAt: dayjs().subtract(2, 'hour').toISOString(),
    color: '#1677ff',
  },
  {
    id: 'wb-002',
    name: 'Q1 绩效复盘',
    description: '一季度各部门 KPI 完成情况、同比对比与趋势预测',
    canvasCount: 3,
    categoryCount: 1,
    updatedAt: dayjs().subtract(1, 'day').toISOString(),
    color: '#52c41a',
  },
  {
    id: 'wb-003',
    name: '风险预警监控',
    description: '实时风险指标监控，包含阈值告警、历史异常记录',
    canvasCount: 2,
    categoryCount: 3,
    updatedAt: dayjs().subtract(3, 'day').toISOString(),
    color: '#ff4d4f',
  },
]

// ── 工作台卡片 ────────────────────────────────────────────────────────────────
const WorkbookCard = ({ workbook, onEnter, onRename, onDelete }) => {
  const menuItems = [
    {
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: () => onRename(workbook),
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => onDelete(workbook),
    },
  ]

  return (
    <Card
      hoverable
      style={{
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}
      styles={{ body: { padding: 0 } }}
      onClick={() => onEnter(workbook)}
    >
      {/* 顶部色条 */}
      <div style={{ height: 6, background: workbook.color, borderRadius: '12px 12px 0 0' }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* 标题行 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: `${workbook.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: workbook.color,
              }}
            >
              <BarChartOutlined />
            </div>
            <Text strong style={{ fontSize: 14, color: '#1e293b' }} ellipsis>
              {workbook.name}
            </Text>
          </div>

          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined />}
              onClick={(e) => e.stopPropagation()}
              style={{ color: '#94a3b8', width: 28, height: 28, padding: 0 }}
            />
          </Dropdown>
        </div>

        {/* 描述 */}
        <Paragraph
          type="secondary"
          ellipsis={{ rows: 2 }}
          style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.5, minHeight: 36 }}
        >
          {workbook.description || '暂无描述'}
        </Paragraph>

        {/* 统计标签 */}
        <Space size={6} wrap style={{ marginBottom: 12 }}>
          <Tag style={{ fontSize: 11, margin: 0 }}>
            <AppstoreOutlined style={{ marginRight: 4 }} />
            {workbook.categoryCount} 个类别
          </Tag>
          <Tag style={{ fontSize: 11, margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 4 }} />
            {workbook.canvasCount} 张画布
          </Tag>
        </Space>

        {/* 底部：时间 + 进入按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {dayjs(workbook.updatedAt).fromNow()}更新
          </Text>
          <Button
            type="primary"
            size="small"
            icon={<EnterOutlined />}
            style={{ fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); onEnter(workbook) }}
          >
            进入
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
const Workbooks = () => {
  const { id: projectId } = useParams()
  const navigate = useNavigate()

  const [workbooks, setWorkbooks] = useState(MOCK_WORKBOOKS)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameModal, setRenameModal] = useState({ open: false, workbook: null })
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const handleEnter = (wb) => {
    navigate(`/project/${projectId}/workbooks/${wb.id}`)
  }

  const handleCreate = () => {
    if (!newName.trim()) { message.warning('请输入工作台名称'); return }
    const id = `wb-${Date.now()}`
    const newWb = {
      id,
      name: newName.trim(),
      description: newDesc.trim(),
      canvasCount: 1,
      categoryCount: 1,
      updatedAt: new Date().toISOString(),
      color: '#1677ff',
    }
    setWorkbooks((prev) => [newWb, ...prev])
    message.success('工作台创建成功')
    setCreateModalOpen(false)
    setNewName('')
    setNewDesc('')
    navigate(`/project/${projectId}/workbooks/${id}`)
  }

  const handleRename = (wb) => {
    setRenameModal({ open: true, workbook: wb })
    setNewName(wb.name)
  }

  const handleRenameConfirm = () => {
    if (!newName.trim()) return
    setWorkbooks((prev) =>
      prev.map((wb) =>
        wb.id === renameModal.workbook?.id ? { ...wb, name: newName.trim() } : wb
      )
    )
    setRenameModal({ open: false, workbook: null })
    setNewName('')
  }

  const handleDelete = (wb) => {
    Modal.confirm({
      title: `确认删除"${wb.name}"？`,
      content: '该工作台及其所有画布、图表将被删除，此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setWorkbooks((prev) => prev.filter((w) => w.id !== wb.id))
        message.success('已删除')
      },
    })
  }

  return (
    <div style={{ padding: 24 }}>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            可视化工作台
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            创建并管理分析看板，通过图表组合呈现数据洞察
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          新建工作台
        </Button>
      </div>

      {/* 工作台卡片网格 */}
      {workbooks.length === 0 ? (
        <Empty
          description="暂无工作台，点击「新建工作台」开始创建"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 80 }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建工作台
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {workbooks.map((wb) => (
            <Col key={wb.id} xs={24} sm={12} lg={8} xl={6}>
              <WorkbookCard
                workbook={wb}
                onEnter={handleEnter}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </Col>
          ))}
        </Row>
      )}

      {/* 新建工作台弹窗 */}
      <Modal
        title="新建工作台"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateModalOpen(false); setNewName(''); setNewDesc('') }}
        okText="创建并进入"
        cancelText="取消"
        width={400}
        destroyOnHide
      >
        <Space style={{ width: '100%', marginTop: 16, display: 'flex', flexDirection: 'column' }} size={12}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              工作台名称 <span style={{ color: '#ef4444' }}>*</span>
            </Text>
            <Input
              placeholder="如：财务分析看板、Q1 绩效复盘..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onPressEnter={handleCreate}
              autoFocus
              maxLength={30}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              描述（可选）
            </Text>
            <Input.TextArea
              placeholder="简要描述该工作台的用途..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
              maxLength={100}
            />
          </div>
        </Space>
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名工作台"
        open={renameModal.open}
        onOk={handleRenameConfirm}
        onCancel={() => { setRenameModal({ open: false, workbook: null }); setNewName('') }}
        okText="确定"
        cancelText="取消"
        width={360}
        destroyOnHide
      >
        <Input
          style={{ marginTop: 16 }}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleRenameConfirm}
          autoFocus
          maxLength={30}
        />
      </Modal>
    </div>
  )
}

export default Workbooks
