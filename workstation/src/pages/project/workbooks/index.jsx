import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Row, Col, Card, Button, Modal, Input, Tag, Dropdown, Empty, message, Skeleton } from 'antd'
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
import { getWorkbooks, createWorkbook, updateWorkbook, deleteWorkbook } from '@src/service/api/workbooks'
import { getProjectBySlug } from '@src/service/api/projects'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

const { Title, Text, Paragraph } = Typography

/** ─── 随机色卡（新建工作台时轮换） ──────────────────────────────────────────── */
const CARD_COLORS = ['#1677ff', '#52c41a', '#ff4d4f', '#fa8c16', '#722ed1', '#13c2c2']
const pickColor = (idx) => CARD_COLORS[idx % CARD_COLORS.length]

function toSlug(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

function normalizeWorkbookSlug(raw) {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^wb[-_]?/, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
  return cleaned
}

function formatWorkbookSlug(slug) {
  return `wb-${slug}`
}

function validateWorkbookSlug(slug) {
  if (!slug) return '请输入工作台标识符'
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return '只能包含小写字母、数字和连字符，且不能以连字符开头或结尾'
  }
  if (slug.length < 2) return '至少 2 个字符'
  if (slug.length > 58) return 'Slug 不超过 58 个字符'
  return null
}

/** ─── 工作台卡片 ──────────────────────────────────────────────────────────────── */
const WorkbookCard = ({ workbook, colorHint, onEnter, onRename, onDelete }) => {
  const color = colorHint ?? '#1677ff'

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
      {/** 顶部色条 */}
      <div style={{ height: 6, background: color, borderRadius: '12px 12px 0 0' }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/** 标题行 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                flexShrink: 0,
                background: `${color}18`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color,
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

        {/** 描述 */}
        <Paragraph
          type="secondary"
          ellipsis={{ rows: 2 }}
          style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.5, minHeight: 36 }}
        >
          {workbook.description || '暂无描述'}
        </Paragraph>

        {/** 底部：时间 + 进入按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {workbook.date_updated
              ? dayjs(workbook.date_updated).fromNow() + '更新'
              : workbook.date_created
                ? dayjs(workbook.date_created).fromNow() + '创建'
                : '—'}
          </Text>
          <Button
            type="primary"
            size="small"
            icon={<EnterOutlined />}
            style={{ fontSize: 12 }}
            onClick={(e) => {
              e.stopPropagation()
              onEnter(workbook)
            }}
          >
            进入
          </Button>
        </div>
      </div>
    </Card>
  )
}

/** ─── 骨架屏 ─────────────────────────────────────────────────────────────────── */
const WorkbooksSkeleton = () => (
  <Row gutter={[16, 16]}>
    {[1, 2, 3].map((i) => (
      <Col key={i} xs={24} sm={12} lg={8} xl={6}>
        <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
      </Col>
    ))}
  </Row>
)

/** ─── 主组件 ──────────────────────────────────────────────────────────────────── */
const Workbooks = () => {
  const { slug } = useParams()
  const navigate = useNavigate()

  /** slug → UUID 解析（API 仍使用 UUID） */
  const [projectId, setProjectId] = useState(null)
  useEffect(() => {
    if (!slug) return
    getProjectBySlug(slug).then((p) => {
      if (p?.id) setProjectId(p.id)
    })
  }, [slug])

  const [workbooks, setWorkbooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [renameModal, setRenameModal] = useState({ open: false, workbook: null })
  const [newName, setNewName] = useState('')
  const [newSlug, setNewSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const handleNameChange = (value) => {
    setNewName(value)
    if (slugManuallyEdited) return
    setNewSlug(normalizeWorkbookSlug(value))
  }

  const handleSlugChange = (value) => {
    setNewSlug(normalizeWorkbookSlug(value))
    setSlugManuallyEdited(true)
  }

  const fetchWorkbooks = useCallback(
    async (silent = false) => {
      if (!projectId) return
      if (!silent) setLoading(true)
      try {
        const data = await getWorkbooks(projectId)
        setWorkbooks(data ?? [])
      } catch {
        if (!silent) message.error('获取工作台列表失败')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    fetchWorkbooks()
  }, [fetchWorkbooks])

  const handleEnter = (wb) => {
    navigate(`/project/${slug}/workbooks/${wb.slug ?? wb.id}`)
  }

  const handleCreate = async () => {
    if (!newName.trim()) {
      message.warning('请输入工作台名称')
      return
    }
    const workbookSlug = newSlug.trim()
    if (!workbookSlug) {
      message.warning('请输入工作台标识符')
      return
    }
    const error = validateWorkbookSlug(workbookSlug)
    if (error) {
      message.warning(error)
      return
    }
    setSaving(true)
    try {
      const wb = await createWorkbook({
        project_id: projectId,
        name: newName.trim(),
        description: newDesc.trim(),
        slug: formatWorkbookSlug(workbookSlug),
      })
      message.success('工作台创建成功')
      setCreateModalOpen(false)
      setNewName('')
      setNewSlug('')
      setSlugManuallyEdited(false)
      setNewDesc('')
      navigate(`/project/${slug}/workbooks/${wb.slug ?? wb.id}`)
    } catch {
      message.error('创建工作台失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleRename = (wb) => {
    setRenameModal({ open: true, workbook: wb })
    setNewName(wb.name)
  }

  const handleRenameConfirm = async () => {
    if (!newName.trim() || !renameModal.workbook) return
    setSaving(true)
    try {
      await updateWorkbook(renameModal.workbook.id, { name: newName.trim() })
      setWorkbooks((prev) =>
        prev.map((wb) => (wb.id === renameModal.workbook?.id ? { ...wb, name: newName.trim() } : wb))
      )
      message.success('重命名成功')
      setRenameModal({ open: false, workbook: null })
      setNewName('')
    } catch {
      message.error('重命名失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (wb) => {
    Modal.confirm({
      title: `确认删除「${wb.name}」？`,
      content: '该工作台及其所有类别、画布、图表将被删除，此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteWorkbook(wb.id)
          setWorkbooks((prev) => prev.filter((w) => w.id !== wb.id))
          message.success('已删除')
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  return (
    <div style={{ padding: 24 }}>
      {/** 页头 */}
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

      {/** 工作台卡片网格 */}
      {loading ? (
        <WorkbooksSkeleton />
      ) : workbooks.length === 0 ? (
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
          {workbooks.map((wb, idx) => (
            <Col key={wb.id} xs={24} sm={12} lg={8} xl={6}>
              <WorkbookCard
                workbook={wb}
                colorHint={pickColor(idx)}
                onEnter={handleEnter}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </Col>
          ))}
        </Row>
      )}

      {/** 新建工作台弹窗 */}
      <Modal
        title="新建工作台"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false)
          setNewName('')
          setNewSlug('')
          setSlugManuallyEdited(false)
          setNewDesc('')
        }}
        okText="创建并进入"
        cancelText="取消"
        confirmLoading={saving}
        width={400}
        destroyOnHide
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              工作台名称 <span style={{ color: '#ef4444' }}>*</span>
            </Text>
            <Input
              placeholder="如：财务分析看板、Q1 绩效复盘..."
              value={newName}
              onChange={(e) => handleNameChange(e.target.value)}
              onPressEnter={handleCreate}
              autoFocus
              maxLength={30}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
              工作台标识符（Slug） <span style={{ color: '#ef4444' }}>*</span>
            </Text>
            <Input
              placeholder="例如：sales-q1"
              addonBefore="wb-"
              value={newSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              onPressEnter={handleCreate}
              maxLength={58}
            />
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              用于 URL 路径，如
              <Text code style={{ fontSize: 11, marginLeft: 4 }}>
                /workbooks/{`wb-${newSlug || 'sales-q1'}`}
              </Text>
            </Text>
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
        </div>
      </Modal>

      {/** 重命名弹窗 */}
      <Modal
        title="重命名工作台"
        open={renameModal.open}
        onOk={handleRenameConfirm}
        onCancel={() => {
          setRenameModal({ open: false, workbook: null })
          setNewName('')
        }}
        okText="确定"
        cancelText="取消"
        confirmLoading={saving}
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
