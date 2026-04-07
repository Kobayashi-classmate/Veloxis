import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Form,
  Input,
  Select,
  Button,
  Card,
  Space,
  Tag,
  ColorPicker,
  Divider,
  Skeleton,
  message,
  Modal,
  Alert,
  Row,
  Col,
  Tooltip,
  Popconfirm,
} from 'antd'
import {
  SaveOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
  GlobalOutlined,
  LockOutlined,
  TeamOutlined,
  ReloadOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { getProject, updateProject, deleteProject, getProjectBySlug } from '@src/service/api/projects'
import styles from './index.module.less'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

/* ── 静态常量 ─────────────────────────────────────────────────────────────── */

const VISIBILITY_OPTIONS = [
  { value: 'private', label: '私有', icon: <LockOutlined />, desc: '仅项目成员可见' },
  { value: 'internal', label: '内部', icon: <TeamOutlined />, desc: '组织内所有成员可见' },
  { value: 'public', label: '公开', icon: <GlobalOutlined />, desc: '任何人均可查看' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: '运行中', color: '#52c41a' },
  { value: 'warning', label: '告警中', color: '#faad14' },
  { value: 'archived', label: '已归档', color: '#8c8c8c' },
]

const COLOR_PRESETS = [
  { label: '品牌蓝', colors: ['#1677ff', '#0958d9', '#4096ff', '#69b1ff'] },
  { label: '活力色', colors: ['#52c41a', '#ff4d4f', '#fa8c16', '#722ed1'] },
  { label: '中性色', colors: ['#13c2c2', '#eb2f96', '#8c8c8c', '#1e293b'] },
]

/* ── 工具函数 ─────────────────────────────────────────────────────────────── */

/** 将 ColorPicker 返回值统一转为 hex 字符串 */
function toHex(color) {
  if (!color) return '#1677ff'
  if (typeof color === 'string') return color
  return color?.toHexString?.() ?? color?.toString?.() ?? '#1677ff'
}

/* ════════════════════════════════════════════════════════════════════════════
   子组件
══════════════════════════════════════════════════════════════════════════════ */

/**
 * SectionCard
 * 带左侧彩色竖线的卡片容器。
 * accentColor — 竖线颜色，默认 #1677ff；danger 时用 #ff4d4f
 */
const SectionCard = ({ title, desc, children, danger = false, accentColor }) => {
  const lineColor = danger ? '#ff4d4f' : (accentColor ?? '#1677ff')

  return (
    <Card bordered={false} className={`${styles.sectionCard} ${danger ? styles.sectionCardDanger : ''}`}>
      <div className={styles.sectionHeader}>
        {/* 竖线 */}
        <div className={styles.sectionAccent} style={{ background: lineColor }} />
        {/* 标题 + 描述 */}
        <div className={styles.sectionHeaderContent}>
          <Title level={5} className={`${styles.sectionTitle} ${danger ? styles.sectionTitleDanger : ''}`}>
            {title}
          </Title>
          {desc && (
            <Text type="secondary" className={styles.sectionDesc}>
              {desc}
            </Text>
          )}
        </div>
      </div>
      {children}
    </Card>
  )
}

/**
 * TagEditor
 * 标签编辑器：tag 列表 + 输入框 + 添加按钮
 */
const TagEditor = ({ tags, onAdd, onRemove, messageApi }) => {
  const [input, setInput] = useState('')

  const handleAdd = () => {
    const t = input.trim()
    if (!t) return
    if (tags.includes(t)) {
      messageApi.warning(`标签「${t}」已存在`)
      return
    }
    if (tags.length >= 10) return
    onAdd(t)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <>
      <div className={styles.tagList}>
        {tags.map((tag) => (
          <Tag key={tag} closable onClose={() => onRemove(tag)} className={styles.tagItem}>
            {tag}
          </Tag>
        ))}
        {tags.length === 0 && <span className={styles.tagEmpty}>暂无标签</span>}
      </div>
      <div className={styles.tagInputRow}>
        <Input
          size="small"
          placeholder="输入后按回车添加"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className={styles.tagInput}
          maxLength={20}
          disabled={tags.length >= 10}
        />
        <Button size="small" onClick={handleAdd} disabled={!input.trim() || tags.length >= 10}>
          添加
        </Button>
        {tags.length >= 10 && <span className={styles.tagLimit}>最多 10 个</span>}
      </div>
    </>
  )
}

/**
 * StickyActionBar
 * 底部粘性操作栏，有变动时才渲染（带淡入上滑动画）
 */
const StickyActionBar = ({ dirty, saving, onSave, onDiscard }) => {
  if (!dirty) return null

  return (
    <div className={styles.stickyBar}>
      <span className={styles.stickyBarHint}>您有未保存的更改</span>
      <Button size="middle" icon={<UndoOutlined />} onClick={onDiscard} disabled={saving}>
        放弃更改
      </Button>
      <Button type="primary" size="middle" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
        保存更改
      </Button>
    </div>
  )
}

const ProjectSummary = ({ project, tags, colorHex }) => {
  const status = STATUS_OPTIONS.find((item) => item.value === project?.status) ?? { label: '未知', color: '#8c8c8c' }

  return (
    <Card bordered={false} className={styles.summaryCard} bodyStyle={{ padding: '24px 28px' }}>
      <div className={styles.summaryHeader}>
        <div className={styles.summaryTitle}>
          <div className={styles.summaryAccent} style={{ background: colorHex }} />
          <div>
            <div className={styles.summaryNameRow}>
              <Title level={5} className={styles.summaryName}>
                {project?.name}
              </Title>
              <Tag color={status.color}>{status.label}</Tag>
            </div>
            <Text type="secondary" className={styles.summarySubtitle}>
              {project?.description || '暂无项目描述，建议补充一段项目目标或数据范围，让团队快速了解此项目。'}
            </Text>
          </div>
        </div>
        <div className={styles.summaryExtras}>
          <Tag color="default">可见性：{project?.visibility || 'private'}</Tag>
          <Tag color={colorHex} style={{ color: '#111' }}>
            主题色
          </Tag>
        </div>
      </div>

      <div className={styles.summaryMeta}>
        <Text strong>项目标签</Text>
        <div className={styles.summaryTags}>
          {tags.length ? tags.map((tag) => <Tag key={tag}>{tag}</Tag>) : <Text type="secondary">暂无标签</Text>}
        </div>
      </div>
    </Card>
  )
}

/** 加载骨架屏 */
const SettingsSkeleton = () => (
  <div>
    {[1, 2, 3].map((i) => (
      <Card key={i} bordered={false} className={styles.skeletonCard}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    ))}
  </div>
)

/* ════════════════════════════════════════════════════════════════════════════
   主组件
══════════════════════════════════════════════════════════════════════════════ */

const Settings = () => {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [form] = Form.useForm()

  /* Ant Design v5+ 推荐：hooks 模式 */
  const [messageApi, contextHolder] = message.useMessage()
  const [modal, modalContextHolder] = Modal.useModal()

  /* messageApi ref：避免将 messageApi 加入 useCallback 依赖导致 loadProject 频繁重建 */
  const messageApiRef = useRef(messageApi)
  useEffect(() => {
    messageApiRef.current = messageApi
  }, [messageApi])

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tags, setTags] = useState([])
  const [color, setColor] = useState('#1677ff')
  const [dirty, setDirty] = useState(false)

  /* 当前 hex 值（用于色块显示 & 标题竖线联动） */
  const colorHex = toHex(color)

  /* ── 加载项目 ──────────────────────────────────────────────────────────── */
  const loadProject = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const data = await getProjectBySlug(slug)
      if (!data) {
        // 返回 null 通常是请求被取消，直接忽略，不跳转
        return
      }
      setProject(data)
      setTags(data.tags ?? [])
      setColor(data.color ?? '#1677ff')
      form.setFieldsValue({
        name: data.name,
        description: data.description,
        visibility: data.visibility,
      })
      setDirty(false)
    } catch (err) {
      if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') return
      messageApiRef.current.error('加载项目信息失败')
    } finally {
      setLoading(false)
    }
  }, [slug, form])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  /* ── 标签操作 ──────────────────────────────────────────────────────────── */
  const handleAddTag = (t) => {
    setTags((prev) => [...prev, t])
    setDirty(true)
  }

  const handleRemoveTag = (t) => {
    setTags((prev) => prev.filter((x) => x !== t))
    setDirty(true)
  }

  /* ── 颜色变更 ──────────────────────────────────────────────────────────── */
  const handleColorChange = (val) => {
    setColor(val)
    setDirty(true)
  }

  /* ── 保存 ──────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const hex = toHex(color)
      await updateProject(project.id, {
        name: values.name,
        description: values.description,
        visibility: values.visibility,
        color: hex,
        tags,
      })
      messageApi.success('项目设置已保存')
      setDirty(false)
      setProject((prev) => ({
        ...prev,
        name: values.name,
        description: values.description,
        visibility: values.visibility,
        color: hex,
        tags,
      }))
      /* 通知父组件（proHeader）更新项目名称 */
      window.dispatchEvent(new CustomEvent('project:updated', { detail: { name: values.name } }))
    } catch {
      messageApi.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  /* ── 归档 / 取消归档 ───────────────────────────────────────────────────── */
  const handleArchive = async () => {
    const isArchived = project?.status === 'archived'
    const nextStatus = isArchived ? 'active' : 'archived'
    setSaving(true)
    try {
      await updateProject(project.id, { status: nextStatus })
      messageApi.success(isArchived ? '项目已恢复为运行中' : '项目已归档')
      setProject((prev) => ({ ...prev, status: nextStatus }))
      setDirty(false)
    } catch {
      messageApi.error('操作失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  /* ── 删除 ──────────────────────────────────────────────────────────────── */
  const handleDelete = () => {
    modal.confirm({
      title: '确认删除项目？',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      width: 480,
      content: (
        <div>
          <Paragraph style={{ margin: 0 }}>
            此操作将<Text strong> 永久删除</Text>项目「{project?.name}」，包含：
          </Paragraph>
          <ul style={{ marginTop: 8, paddingLeft: 20, color: '#64748b' }}>
            <li>所有成员关联关系</li>
            <li>项目元数据配置</li>
          </ul>
          <Alert
            type="warning"
            showIcon
            message="数据源、工作台、Doris 表不会自动删除，如需清理请前往对应管理页面操作。"
            style={{ marginTop: 8 }}
          />
        </div>
      ),
      okText: '确认删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setDeleting(true)
        try {
          await deleteProject(project.id)
          messageApi.success('项目已删除')
          navigate('/workspaces')
        } catch {
          messageApi.error('删除失败，请重试')
        } finally {
          setDeleting(false)
        }
      },
    })
  }

  /* ── 渲染 ──────────────────────────────────────────────────────────────── */

  if (loading) return <SettingsSkeleton />

  const isArchived = project?.status === 'archived'

  return (
    <div className={styles.page}>
      {/* message / modal context */}
      {contextHolder}
      {modalContextHolder}

      {/* ── 页头 ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <Title level={4} style={{ margin: 0 }}>
            项目设置
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            管理项目的基本信息与访问配置
          </Text>
        </div>
        <Tooltip title="重新加载">
          <Button icon={<ReloadOutlined />} size="small" type="text" onClick={loadProject} />
        </Tooltip>
      </div>

      <ProjectSummary project={project} tags={tags} colorHex={colorHex} />

      {/* ══ 基本信息 & 访问与状态 共用一个 Form 实例 ══ */}
      <Form form={form} layout="vertical" onValuesChange={() => setDirty(true)}>
        {/* ── 基本信息 ── */}
        <SectionCard title="基本信息" desc="修改项目名称、描述及展示配置" accentColor={colorHex}>
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item
                label="项目名称"
                name="name"
                rules={[
                  { required: true, message: '请输入项目名称' },
                  { max: 50, message: '不超过 50 个字符' },
                ]}
              >
                <Input placeholder="输入项目名称" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="项目颜色">
                <div className={styles.colorRow}>
                  <ColorPicker value={color} presets={COLOR_PRESETS} onChange={handleColorChange} size="large" />
                  <div className={styles.colorSwatch} style={{ background: colorHex }} />
                  <span className={styles.colorHex}>{colorHex}</span>
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="项目描述" name="description">
            <TextArea placeholder="描述这个项目的用途、数据范围或分析目标…" rows={3} maxLength={300} showCount />
          </Form.Item>

          {/* 标签 */}
          <Form.Item label="标签" style={{ marginBottom: 0 }}>
            <TagEditor tags={tags} onAdd={handleAddTag} onRemove={handleRemoveTag} messageApi={messageApi} />
          </Form.Item>
        </SectionCard>

        {/* ── 访问与状态 ── */}
        <SectionCard title="访问与状态" desc="控制项目可见性与当前运行状态">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="可见性" name="visibility" style={{ marginBottom: 0 }}>
                <Select size="large">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <Select.Option key={opt.value} value={opt.value}>
                      <Space size={6}>
                        {opt.icon}
                        <span>{opt.label}</span>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          — {opt.desc}
                        </Text>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="项目状态" style={{ marginBottom: 0 }}>
                {(() => {
                  const cur = STATUS_OPTIONS.find((o) => o.value === project?.status)
                  return cur ? (
                    <Space size={8} style={{ height: 40, display: 'inline-flex', alignItems: 'center' }}>
                      <span className={styles.statusDot} style={{ background: cur.color }} />
                      <Text style={{ fontSize: 14, color: cur.color, fontWeight: 500 }}>{cur.label}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        （可在下方危险区修改）
                      </Text>
                    </Space>
                  ) : null
                })()}
              </Form.Item>
            </Col>
          </Row>
        </SectionCard>
      </Form>

      {/* ── 底部粘性操作栏 ── */}
      <StickyActionBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={loadProject} />

      <Divider style={{ margin: '24px 0' }} />

      {/* ── 危险区 ── */}
      <SectionCard title="危险区" desc="以下操作不可撤销，请谨慎操作" danger>
        {/* 归档 */}
        <div className={styles.dangerRow}>
          <div className={styles.dangerRowLabel}>
            <span className={`${styles.dangerRowTitle} ${styles.dangerRowTitleArchive}`}>
              <InboxOutlined style={{ marginRight: 6 }} />
              {isArchived ? '取消归档' : '归档项目'}
            </span>
            <span className={styles.dangerRowDesc}>
              {isArchived
                ? '将项目恢复为活跃状态，重新出现在项目列表中。'
                : '将项目标记为「已归档」，隐藏于活跃列表，数据不受影响。'}
            </span>
          </div>
          <Popconfirm
            title={isArchived ? '确认取消归档？' : '确认归档此项目？'}
            description={isArchived ? '项目将重新出现在活跃列表中。' : '项目将被隐藏，但数据不会丢失。'}
            okText="确认"
            cancelText="取消"
            onConfirm={handleArchive}
            placement="topRight"
          >
            <Button icon={<InboxOutlined />} loading={saving}>
              {isArchived ? '取消归档' : '归档项目'}
            </Button>
          </Popconfirm>
        </div>

        <Divider className={styles.dangerDivider} />

        {/* 删除 */}
        <div className={styles.dangerRow}>
          <div className={styles.dangerRowLabel}>
            <span className={`${styles.dangerRowTitle} ${styles.dangerRowTitleDelete}`}>
              <DeleteOutlined style={{ marginRight: 6 }} />
              删除此项目
            </span>
            <span className={styles.dangerRowDesc}>永久删除项目元数据及成员关联关系。数据源和工作台不会自动删除。</span>
          </div>
          <Button danger icon={<DeleteOutlined />} onClick={handleDelete} loading={deleting}>
            删除项目
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}

export default Settings
