import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Button,
  Input,
  Space,
  Avatar,
  Badge,
  Dropdown,
  Empty,
  Tooltip,
  Segmented,
  theme,
  Divider,
  Skeleton,
  message,
  Modal,
  Select,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  MoreOutlined,
  StarOutlined,
  StarFilled,
  LockOutlined,
  GlobalOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  FilterOutlined,
  LayoutOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import FixTabPanel from '@stateless/FixTabPanel'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { useAuth } from '@src/service/useAuth'
import { permissionService } from '@src/service/permissionService'
import { getProjects, toggleStarProject, createProject, updateProject, deleteProject } from '@src/service/api/projects'
import ProjectModal from './ProjectModal'
import MembersModal from './MembersModal'
import styles from './index.module.less'

/** 将项目名称转换为 URL-safe slug */
function toSlug(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, '')  // 移除非法字符（中文等）
    .replace(/[\s_]+/g, '-')          // 空格/下划线 → 连字符
    .replace(/-+/g, '-')              // 合并连续连字符
    .replace(/^-+|-+$/g, '')          // 去首尾连字符
    .slice(0, 63) || 'project'        // 最长 63 字符，空则兜底
}

/** 为项目列表中缺少 slug 的项目批量生成唯一 slug 并写入后端 */
async function backfillSlugs(projects) {
  const missing = projects.filter((p) => !p.slug)
  if (!missing.length) return

  // 收集已占用的 slug（含有 slug 的项目）
  const usedSlugs = new Set(projects.map((p) => p.slug).filter(Boolean))

  const updates = missing.map((p) => {
    let base = toSlug(p.name)
    let candidate = base
    let idx = 2
    // 碰撞处理：slug 重复则追加序号
    while (usedSlugs.has(candidate)) {
      candidate = `${base}-${idx++}`
    }
    usedSlugs.add(candidate)
    return { id: p.id, slug: candidate }
  })

  await Promise.allSettled(
    updates.map(({ id, slug }) => updateProject(id, { slug }))
  )
  console.info(`[workspaces] 已为 ${updates.length} 个项目生成 slug:`, updates)
}

const { Title, Text, Paragraph } = Typography

const STATUS_CONFIG = {
  active: { color: '#52c41a', text: '运行中', badge: 'success', icon: <CheckCircleOutlined /> },
  warning: { color: '#faad14', text: '资源告警', badge: 'warning', icon: <ExclamationCircleOutlined /> },
  archived: { color: '#8c8c8c', text: '已归档', badge: 'default', icon: <FolderOpenOutlined /> },
}

const VISIBILITY_CONFIG = {
  private: { icon: <LockOutlined />, text: '私有', color: '#6b7280', desc: '仅项目成员可见' },
  internal: { icon: <TeamOutlined />, text: '内部', color: '#1677ff', desc: '本组织成员可见' },
  public: { icon: <GlobalOutlined />, text: '公开', color: '#059669', desc: '全平台成员可见' },
}

const FILTER_OPTIONS = [
  { key: '全部', label: '全部' },
  { key: '运行中', label: '运行中' },
  { key: '资源告警', label: '告警' },
  { key: '已归档', label: '归档' },
]

// ─── TenantDashboard ──────────────────────────────────────────────────────────

const TenantDashboard = ({ totalProjects, activeCount, starredCount, onCreate }) => (
  <Card className={styles.tenantDashboard} variant="borderless" styles={{ body: { padding: '20px 28px' } }}>
    <Row align="middle" justify="space-between" wrap>
      <Col>
        <div className={styles.tenantGreeting}>
          <div className={styles.tenantIcon}>
            <LayoutOutlined />
          </div>
          <div>
            <Title level={3} style={{ margin: 0, lineHeight: 1.2 }}>
              项目大厅
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              探索并管理您有权访问的所有分析项目与数据资产
            </Text>
          </div>
        </div>
      </Col>
      <Col>
        <Space size={24} split={<Divider type="vertical" className={styles.dashboardDivider} />}>
          <div className={styles.dashboardMetric}>
            <Text type="secondary" className={styles.metricLabel}>
              可见项目
            </Text>
            <Text className={styles.metricValue}>{totalProjects}</Text>
          </div>
          <div className={styles.dashboardMetric}>
            <Text type="secondary" className={styles.metricLabel}>
              运行中
            </Text>
            <Text className={styles.metricValue} style={{ color: '#52c41a' }}>
              {activeCount}
            </Text>
          </div>
          <div className={styles.dashboardMetric}>
            <Text type="secondary" className={styles.metricLabel}>
              已收藏
            </Text>
            <Text className={styles.metricValue} style={{ color: '#faad14' }}>
              {starredCount}
            </Text>
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} className={styles.createBtn} onClick={onCreate}>
            新建项目
          </Button>
        </Space>
      </Col>
    </Row>
  </Card>
)

// ─── ProjectCard ──────────────────────────────────────────────────────────────

const ProjectCard = ({ project, onEnter, onNavigate, onToggleStar, onSettings, onMembers, onDelete }) => {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
  const vis = VISIBILITY_CONFIG[project.visibility] ?? VISIBILITY_CONFIG.private
  const isGuest = project.role === 'Guest'
  const healthColor = project.cubeHealth >= 90 ? '#52c41a' : project.cubeHealth >= 70 ? '#faad14' : '#ff4d4f'

  const menuItems = [
    { key: 'settings', label: '项目设置', disabled: isGuest },
    { key: 'members', label: '成员管理', disabled: isGuest },
    { type: 'divider' },
    { key: 'delete', label: '删除项目', danger: true, disabled: isGuest },
  ]

  const handleMenuClick = ({ key, domEvent }) => {
    domEvent.stopPropagation()
    if (isGuest) return
    if (key === 'settings') onSettings(project)
    if (key === 'members') onMembers(project)
    if (key === 'delete') {
      Modal.confirm({
        title: '确认删除项目？',
        content: (
          <span>
            删除后，项目 <strong>{project.name}</strong> 的所有相关数据集和配置将无法恢复。
          </span>
        ),
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        onOk: () => onDelete(project.id),
      })
    }
  }

  return (
    <Card
      className={`${styles.projectCard} ${isGuest ? styles.guestCard : ''}`}
      variant="borderless"
      styles={{ body: { padding: 0 } }}
      onClick={() => onEnter(project.slug)}
    >
      {/* 顶部色条 */}
      <div className={styles.cardAccent} style={{ background: project.color }} />

      <div className={styles.cardBody}>
        {/* 标题行 */}
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleRow}>
            <Avatar
              size={38}
              style={{
                background: project.color,
                flexShrink: 0,
                fontWeight: 700,
                fontSize: 16,
                boxShadow: `0 2px 8px ${project.color}55`,
              }}
            >
              {project.name[0]}
            </Avatar>
            <div className={styles.cardTitleText}>
              <Text
                strong
                style={{ fontSize: 15, lineHeight: 1.4, display: 'block' }}
                ellipsis={{ tooltip: project.name }}
              >
                {project.name}
              </Text>
              <Space size={4}>
                <Badge status={status.badge} />
                <Text style={{ fontSize: 11, color: status.color }}>{status.text}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ·
                </Text>
                <Tag
                  bordered={false}
                  style={{
                    margin: 0,
                    padding: '0 5px',
                    fontSize: 10,
                    lineHeight: '18px',
                    background: isGuest ? '#f5f5f5' : '#e6f4ff',
                    color: isGuest ? '#8c8c8c' : '#0958d9',
                  }}
                >
                  {isGuest ? '只读' : project.role}
                </Tag>
              </Space>
            </div>
          </div>

          <Space size={2}>
            <Tooltip title={project.starred ? '取消收藏' : '收藏项目'}>
              <Button
                type="text"
                size="small"
                icon={
                  project.starred ? (
                    <StarFilled style={{ color: '#faad14' }} />
                  ) : (
                    <StarOutlined style={{ color: '#9ca3af' }} />
                  )
                }
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStar(project.id)
                }}
              />
            </Tooltip>
            {!isGuest && (
              <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['click']}>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined style={{ color: '#9ca3af' }} />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            )}
          </Space>
        </div>

        {/* 描述 */}
        <Paragraph
          className={styles.cardDesc}
          ellipsis={{ rows: 2 }}
          style={!project.description ? { color: '#d1d5db', fontStyle: 'italic', fontSize: 13 } : { fontSize: 13 }}
          type={project.description ? 'secondary' : undefined}
        >
          {project.description || '该项目暂无描述信息...'}
        </Paragraph>

        {/* 标签 */}
        <Space size={4} wrap className={styles.cardTags}>
          <Tooltip title={vis.desc}>
            <Tag
              icon={vis.icon}
              bordered={false}
              style={{ fontSize: 11, color: vis.color, background: `${vis.color}12` }}
            >
              {vis.text}
            </Tag>
          </Tooltip>
          {project.tenant && (
            <Tag bordered={false} style={{ fontSize: 11, background: '#f8fafc' }}>
              <FolderOpenOutlined style={{ marginRight: 3 }} />
              {project.tenant}
            </Tag>
          )}
          {project.tags?.slice(0, 2).map((t) => (
            <Tag key={t} bordered={false} style={{ fontSize: 11, background: '#f8fafc' }}>
              {t}
            </Tag>
          ))}
        </Space>

        {/* 核心指标 */}
        <Row gutter={[8, 8]} className={styles.metricRow}>
          {[
            { icon: <DatabaseOutlined />, value: project.datasets, label: '数据集', color: '#3b82f6' },
            { icon: <BarChartOutlined />, value: project.workbooks, label: '工作台', color: '#8b5cf6' },
            { icon: <ThunderboltOutlined />, value: project.recipes, label: 'ETL', color: '#f59e0b' },
            { icon: <TeamOutlined />, value: project.members, label: '成员', color: '#10b981' },
          ].map((m) => (
            <Col span={6} key={m.label}>
              <div className={styles.metricItem}>
                <Text strong className={styles.metricNum} style={{ color: '#1e293b' }}>
                  {m.value}
                </Text>
                <Text type="secondary" className={styles.metricName}>
                  {m.label}
                </Text>
              </div>
            </Col>
          ))}
        </Row>

        {/* 底部 */}
        <div className={styles.cardFooter}>
          <Space size={4}>
            <ClockCircleOutlined style={{ fontSize: 11, color: '#9ca3af' }} />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {project.lastActive}
            </Text>
          </Space>
          <div className={styles.quickActions}>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onNavigate(project.slug, 'models')
              }}
            >
              数据
            </Button>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onNavigate(project.slug, 'workbooks')
              }}
            >
              视图
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                onEnter(project.slug)
              }}
            >
              进入
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── ProjectRow ───────────────────────────────────────────────────────────────

const ProjectRow = ({ project, onEnter, onNavigate, onToggleStar, onSettings, onMembers, onDelete }) => {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
  const vis = VISIBILITY_CONFIG[project.visibility] ?? VISIBILITY_CONFIG.private
  const isGuest = project.role === 'Guest'
  const healthColor = project.cubeHealth >= 90 ? '#52c41a' : project.cubeHealth >= 70 ? '#faad14' : '#ff4d4f'

  const menuItems = [
    { key: 'settings', label: '项目设置', disabled: isGuest },
    { key: 'members', label: '成员管理', disabled: isGuest },
    { type: 'divider' },
    { key: 'delete', label: '删除项目', danger: true, disabled: isGuest },
  ]

  const handleMenuClick = ({ key, domEvent }) => {
    domEvent.stopPropagation()
    if (isGuest) return
    if (key === 'settings') onSettings(project)
    if (key === 'members') onMembers(project)
    if (key === 'delete') {
      Modal.confirm({
        title: '确认删除项目？',
        content: (
          <span>
            删除后，项目 <strong>{project.name}</strong> 的数据将无法恢复。
          </span>
        ),
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        onOk: () => onDelete(project.id),
      })
    }
  }

  return (
    <div className={`${styles.projectRow} ${isGuest ? styles.guestRow : ''}`} onClick={() => onEnter(project.slug)}>
      <div className={styles.rowAccent} style={{ background: project.color }} />
      <div className={styles.rowMain}>
        {/* 名称列 */}
        <div className={styles.rowNameCol}>
          <Avatar
            size={34}
            style={{
              background: project.color,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: `0 2px 6px ${project.color}44`,
            }}
          >
            {project.name[0]}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Space size={6} wrap={false}>
              <Text strong style={{ fontSize: 14 }} ellipsis>
                {project.name}
              </Text>
              {isGuest && <Tag style={{ fontSize: 10, margin: 0 }}>只读</Tag>}
            </Space>
            <Space size={6}>
              <Badge
                status={status.badge}
                text={<Text style={{ fontSize: 11, color: status.color }}>{status.text}</Text>}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                · {project.tenant}
              </Text>
            </Space>
          </div>
        </div>

        {/* 指标列 */}
        <div className={styles.rowMetrics}>
          <div className={styles.rowMetricItem}>
            <Text strong style={{ fontSize: 14 }}>
              {project.datasets}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              数据集
            </Text>
          </div>
          <div className={styles.rowMetricItem}>
            <Text strong style={{ fontSize: 14 }}>
              {project.workbooks}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              工作台
            </Text>
          </div>
          <div className={styles.rowMetricItem}>
            <Text strong style={{ fontSize: 14 }}>
              {project.storage}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              存储
            </Text>
          </div>
          <div className={styles.rowMetricItem}>
            <Text strong style={{ fontSize: 14, color: healthColor }}>
              {project.cubeHealth}%
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              引擎健康
            </Text>
          </div>
          <Tooltip title={vis.desc}>
            <Tag
              icon={vis.icon}
              bordered={false}
              style={{ fontSize: 11, color: vis.color, background: `${vis.color}12`, alignSelf: 'center' }}
            >
              {vis.text}
            </Tag>
          </Tooltip>
        </div>

        {/* 操作列 */}
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={project.starred ? '取消收藏' : '收藏'}>
            <Button
              type="text"
              size="small"
              icon={project.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
              onClick={() => onToggleStar(project.id)}
            />
          </Tooltip>
          <Button size="small" onClick={() => onNavigate(project.slug, 'models')}>
            数据字典
          </Button>
          <Button type="primary" size="small" onClick={() => onEnter(project.slug)}>
            {isGuest ? '查看详情' : '进入工作区'}
          </Button>
          {!isGuest && (
            <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['click']}>
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ProjectCardSkeleton = () => (
  <Card className={styles.projectCard} variant="borderless" styles={{ body: { padding: 0 } }}>
    <div className={styles.cardAccent} style={{ background: '#e2e8f0' }} />
    <div className={styles.cardBody}>
      <Skeleton active avatar={{ size: 38 }} paragraph={{ rows: 3 }} />
    </div>
  </Card>
)

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = ({ error, onRetry, onCreate, hasFilters }) => (
  <Empty
    image={<RocketOutlined style={{ fontSize: 64, color: '#d1d5db' }} />}
    imageStyle={{ height: 80 }}
    description={
      error ? (
        <Text style={{ color: '#ef4444' }}>{error}</Text>
      ) : hasFilters ? (
        <Text type="secondary">没有找到匹配的项目，请尝试调整筛选条件</Text>
      ) : (
        <Text type="secondary">暂无项目，点击「新建项目」创建您的第一个分析空间</Text>
      )
    }
    style={{ margin: '60px 0' }}
  >
    {error ? (
      <Button type="primary" onClick={onRetry}>
        重新加载
      </Button>
    ) : (
      !hasFilters && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          新建项目
        </Button>
      )
    )}
  </Empty>
)

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, count }) => (
  <div className={styles.sectionTitle}>
    {icon}
    <Text strong style={{ fontSize: 15 }}>
      {title}
    </Text>
    <Tag bordered={false} style={{ background: '#f1f5f9', color: '#64748b', fontSize: 11 }}>
      {count}
    </Tag>
  </div>
)

// ─── Main ─────────────────────────────────────────────────────────────────────

const Workspaces = () => {
  const { redirectTo } = useSafeNavigate()
  // 响应式订阅 auth 状态，确保刷新后 user 数据恢复时能重新获取
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  const [viewMode, setViewMode] = useState('grid')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [sortBy, setSortBy] = useState('lastActive')
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [currentProject, setCurrentProject] = useState(null)

  const fetchProjects = useCallback(async (adminOverride) => {
    setLoading(true)
    setError(null)
    // 支持调用方直接传入最新的 isAdmin 值，避免闭包捕获旧值
    const adminFlag = adminOverride !== undefined ? adminOverride : isAdmin
    let canceled = false
    try {
      const list = await getProjects()
      if (canceled) return

      // 为没有 slug 的老项目自动生成并写入（静默处理，不阻塞渲染）
      backfillSlugs(list).catch((err) => console.warn('[workspaces] backfillSlugs 失败:', err))

      const visibleList = list
        .filter((p) => {
          // 管理员可见全部项目
          if (adminFlag) return true
          // 项目成员（非 Guest）始终可见
          if (p.role && p.role !== 'Guest') return true
          // 公开项目对所有人可见
          if (p.visibility === 'public') return true
          // 内部项目：同租户可见（tenant 为空时跳过，避免误过滤）
          if (p.visibility === 'internal' && user?.tenant && p.tenant === user.tenant) return true
          return false
        })
        .map((p) => ({ ...p, role: p.role || (adminFlag ? 'Admin' : 'Guest') }))
      setProjects(visibleList)
    } catch (err) {
      if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') {
        canceled = true
        return
      }
      if (canceled) return
      const errMsg = err?.response?.data?.errors?.[0]?.message ?? err?.message ?? '加载失败，请稍后重试'
      console.error('[Workspaces] fetch failed:', errMsg, err)
      setError(errMsg)
      message.error(`项目列表加载失败：${errMsg}`)
    } finally {
      if (!canceled) setLoading(false)
    }
  }, [user?.tenant, isAdmin])

  // 初始化管理员状态：权限缓存就绪后检查一次，之后由 fetchProjects 的 dep 驱动刷新
  useEffect(() => {
    let alive = true
    permissionService.hasPermission('*:*').then((result) => {
      if (!alive) return
      setIsAdmin(result)
      // 直接将权限结果传入 fetchProjects，避免等待 setIsAdmin re-render 后再触发
      fetchProjects(result)
    }).catch(() => {
      if (alive) fetchProjects(false)
    })
    return () => { alive = false }
  }, [user?.id]) // user.id 变化意味着切换了账号，重新检查

  const handleEnter = (slug) => redirectTo(`/project/${slug}`)
  const handleNavigate = (slug, mod) => redirectTo(`/project/${slug}/${mod}`)

  const handleToggleStar = useCallback(
    async (id) => {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, starred: !p.starred } : p)))
      const project = projects.find((p) => p.id === id)
      const nextStarred = !project?.starred
      try {
        await toggleStarProject(id, nextStarred)
      } catch {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, starred: project?.starred } : p)))
        message.error(nextStarred ? '收藏失败' : '取消收藏失败')
      }
    },
    [projects]
  )

  const handleCreate = () => {
    setEditingProject(null)
    setProjectModalOpen(true)
  }
  const handleSettings = (p) => {
    setEditingProject(p)
    setProjectModalOpen(true)
  }
  const handleMembers = (p) => {
    setCurrentProject(p)
    setMembersModalOpen(true)
  }

  const handleDelete = async (id) => {
    // 乐观更新：先从本地列表移除，给用户即时反馈
    setProjects((prev) => prev.filter((p) => p.id !== id))
    try {
      await deleteProject(id)
      message.success('项目已删除')
      // 删除完成后重新从服务端拉取，确保软删除场景下列表一致
      fetchProjects(isAdmin)
    } catch {
      // 回滚乐观更新，重新加载完整列表
      message.error('删除项目失败')
      fetchProjects(isAdmin)
    }
  }

  const handleProjectModalOk = async (values) => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, values)
        message.success('项目更新成功')
      } else {
        await createProject(values)
        message.success('项目创建成功')
      }
      setProjectModalOpen(false)
      fetchProjects()
    } catch {
      message.error(editingProject ? '更新失败' : '创建失败')
    }
  }

  const filtered = useMemo(() => {
    let list = projects.filter((p) => {
      const q = searchText.trim().toLowerCase()
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.tenant ?? '').toLowerCase().includes(q)
      const matchStatus = statusFilter === '全部' || STATUS_CONFIG[p.status]?.text === statusFilter
      return matchSearch && matchStatus
    })

    const sorters = {
      lastActive: (a, b) => (b.lastActive ?? '').localeCompare(a.lastActive ?? ''),
      name: (a, b) => a.name.localeCompare(b.name),
      datasets: (a, b) => (b.datasets ?? 0) - (a.datasets ?? 0),
    }
    return list.sort(sorters[sortBy] ?? sorters.lastActive)
  }, [projects, searchText, statusFilter, sortBy])

  const starred = filtered.filter((p) => p.starred)
  const nonStarred = filtered.filter((p) => !p.starred)
  const hasFilters = !!searchText || statusFilter !== '全部'

  const cardProps = {
    onEnter: handleEnter,
    onNavigate: handleNavigate,
    onToggleStar: handleToggleStar,
    onSettings: handleSettings,
    onMembers: handleMembers,
    onDelete: handleDelete,
  }

  const renderProjects = (list) =>
    viewMode === 'grid' ? (
      <Row gutter={[20, 20]}>
        {list.map((p) => (
          <Col key={p.id} xs={24} sm={12} lg={8} xl={6}>
            <ProjectCard project={p} {...cardProps} />
          </Col>
        ))}
      </Row>
    ) : (
      <div className={styles.listView}>
        {list.map((p) => (
          <ProjectRow key={p.id} project={p} {...cardProps} />
        ))}
      </div>
    )

  return (
    <FixTabPanel>
      <div className={styles.container}>
        {/* 大盘头部 */}
        <TenantDashboard
          totalProjects={projects.length}
          activeCount={projects.filter((p) => p.status === 'active').length}
          starredCount={projects.filter((p) => p.starred).length}
          onCreate={handleCreate}
        />

        {/* 工具栏 */}
        <div className={styles.toolbar}>
          <Space size={12} wrap>
            <Input
              placeholder="搜索项目名称、描述或租户..."
              allowClear
              style={{ width: 300 }}
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              onChange={(e) => setSearchText(e.target.value)}
              value={searchText}
            />
            <Space size={6}>
              <FilterOutlined style={{ color: '#9ca3af' }} />
              {FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  size="small"
                  type={statusFilter === opt.key ? 'primary' : 'default'}
                  onClick={() => setStatusFilter(opt.key)}
                  style={{ borderRadius: 20 }}
                >
                  {opt.label}
                </Button>
              ))}
            </Space>
          </Space>

          <Space size={8}>
            <Select
              size="small"
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 110 }}
              options={[
                { value: 'lastActive', label: '最近活跃' },
                { value: 'name', label: '名称排序' },
                { value: 'datasets', label: '数据集数' },
              ]}
            />
            <Tooltip title="刷新列表">
              <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchProjects} />
            </Tooltip>
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
          </Space>
        </div>

        {/* 骨架屏 */}
        {loading && projects.length === 0 && (
          <Row gutter={[20, 20]}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} lg={8} xl={6}>
                <ProjectCardSkeleton />
              </Col>
            ))}
          </Row>
        )}

        {/* 空态 */}
        {!loading && filtered.length === 0 && (
          <EmptyState error={error} onRetry={fetchProjects} onCreate={handleCreate} hasFilters={hasFilters} />
        )}

        {/* 收藏区 */}
        {starred.length > 0 && (
          <section className={styles.section}>
            <SectionHeader
              icon={<StarFilled style={{ color: '#faad14', fontSize: 15 }} />}
              title="我的收藏"
              count={starred.length}
            />
            {renderProjects(starred)}
          </section>
        )}

        {/* 项目区 */}
        {nonStarred.length > 0 && (
          <section className={styles.section}>
            <SectionHeader
              icon={<FolderOpenOutlined style={{ color: '#64748b', fontSize: 15 }} />}
              title={starred.length > 0 ? '全部项目' : '我的项目'}
              count={nonStarred.length}
            />
            {renderProjects(nonStarred)}
          </section>
        )}

        {/* Modals */}
        <ProjectModal
          open={projectModalOpen}
          onCancel={() => setProjectModalOpen(false)}
          onOk={handleProjectModalOk}
          initialValues={editingProject}
          title={editingProject ? '编辑项目' : '新建项目'}
        />
        <MembersModal
          open={membersModalOpen}
          onCancel={() => setMembersModalOpen(false)}
          projectId={currentProject?.id}
          projectName={currentProject?.name}
        />
      </div>
    </FixTabPanel>
  )
}

export default Workspaces
