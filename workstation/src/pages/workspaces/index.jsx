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
  Progress,
  theme,
  Divider,
  Skeleton,
  message,
  Modal,
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
  ControlOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import FixTabPanel from '@stateless/FixTabPanel'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { authService } from '@src/service/authService'
import {
  getProjects,
  toggleStarProject,
  createProject,
  updateProject,
  deleteProject,
} from '@src/service/api/projects'
import ProjectModal from './ProjectModal'
import MembersModal from './MembersModal'
import styles from './index.module.less'

const { Title, Text, Paragraph } = Typography
const { Search } = Input

const STATUS_CONFIG = {
  active:   { color: 'success',  text: '运行中',  badge: 'success' },
  warning:  { color: 'warning',  text: '资源告警', badge: 'warning' },
  archived: { color: 'default',  text: '已归档',  badge: 'default' },
}

const VISIBILITY_CONFIG = {
  private:  { icon: <LockOutlined />,   text: '私有',   color: '#6b7280', desc: '仅项目成员可见' },
  internal: { icon: <TeamOutlined />,   text: '内部',   color: '#1677ff', desc: '本组织成员可见' },
  public:   { icon: <GlobalOutlined />, text: '公开',   color: '#059669', desc: '全平台成员可见' },
}

const FILTER_OPTIONS = ['全部', '运行中', '资源告警', '已归档']

// ─── 子组件：租户全局大盘 (Tenant Dashboard) ──────────────────────────────────

const TenantDashboard = ({ totalProjects, totalStorage, activePipelines, onCreate }) => {
  return (
    <Card className={styles.tenantDashboard} variant="borderless">
      <Row align="middle" justify="space-between">
        <Col>
          <div className={styles.tenantGreeting}>
            <LayoutOutlined className={styles.tenantIcon} />
            <div>
              <Title level={3} style={{ margin: 0 }}>项目大厅</Title>
              <Text type="secondary">探索并管理您有权访问的所有分析项目与数据资产。</Text>
            </div>
          </div>
        </Col>
        <Col>
          <Space size={32} split={<Divider type="vertical" className={styles.dashboardDivider} />}>
            <div className={styles.dashboardMetric}>
              <Text type="secondary" className={styles.metricLabel}>可见项目</Text>
              <Text className={styles.metricValue}>{totalProjects}</Text>
            </div>
            <div className={styles.dashboardMetric}>
              <Text type="secondary" className={styles.metricLabel}>运行中</Text>
              <Text className={styles.metricValue} style={{ color: '#059669' }}>{activePipelines}</Text>
            </div>
            <Button 
              type="primary" 
              size="large" 
              icon={<PlusOutlined />} 
              className={styles.createBtn}
              onClick={() => onCreate?.()}
            >
              新建项目
            </Button>
          </Space>
        </Col>
      </Row>
    </Card>
  )
}

// ─── 子组件：智能项目卡片（网格视图）─────────────────────────────────────────

const ProjectCard = ({ project, onEnter, onNavigate, onToggleStar, onSettings, onMembers, onDelete }) => {
  const { token } = theme.useToken()
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.active
  const vis    = VISIBILITY_CONFIG[project.visibility] || VISIBILITY_CONFIG.private
  const isGuest = project.role === 'Guest'

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
        title: '确定删除该项目吗?',
        content: '删除后，所有相关数据集和配置将无法恢复。',
        okText: '确定删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: () => onDelete(project.id)
      })
    }
  }

  return (
    <Card
      className={`${styles.projectCard} ${isGuest ? styles.guestCard : ''}`}
      variant="borderless"
      styles={{ body: { padding: 0 } }}
      onClick={() => onEnter(project.id)}
    >
      <div className={styles.cardAccent} style={{ background: project.color }} />

      <div className={styles.cardBody}>
        {/* 头部：标题 + 操作 */}
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleRow}>
            <Avatar size={36} style={{ background: project.color, flexShrink: 0, fontWeight: 700 }}>
              {project.name[0]}
            </Avatar>
            <div className={styles.cardTitleText}>
              <Text strong style={{ fontSize: 15, lineHeight: 1.4 }} ellipsis={{ tooltip: project.name }}>
                {project.name}
              </Text>
              <Space size={6}>
                <Badge status={status.badge} />
                <Text style={{ fontSize: 11, color: status.badge === 'success' ? '#059669' : '#f59e0b' }}>
                  {status.text}
                </Text>
                <Tag color={isGuest ? 'default' : 'blue'} bordered={false} style={{ margin: 0, padding: '0 4px', fontSize: 10 }}>
                  {isGuest ? '只读' : project.role}
                </Tag>
              </Space>
            </div>
          </div>
          <Space size={4}>
            <Tooltip title={project.starred ? '取消收藏' : '收藏'}>
              <Button
                type="text"
                size="small"
                icon={project.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                onClick={(e) => { e.stopPropagation(); onToggleStar(project.id); }}
              />
            </Tooltip>
            {!isGuest && (
              <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['click']}>
                <Button type="text" size="small" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
              </Dropdown>
            )}
          </Space>
        </div>

        <Paragraph
          type={project.description ? 'secondary' : undefined}
          className={styles.cardDesc}
          ellipsis={{ rows: 2 }}
          style={!project.description ? { color: '#d1d5db', fontStyle: 'italic' } : undefined}
        >
          {project.description || '该项目暂无描述信息...'}
        </Paragraph>

        <Space size={4} wrap className={styles.cardTags}>
          <Tooltip title={vis.desc}>
            <Tag icon={vis.icon} color="default" bordered={false}>{vis.text}</Tag>
          </Tooltip>
          <Tag bordered={false}><FolderOpenOutlined /> {project.tenant}</Tag>
        </Space>

        {/* 核心数据指标 */}
        <Row gutter={[8, 8]} className={styles.metricRow}>
          {[
            { icon: <DatabaseOutlined />, value: project.datasets,  label: '数据集' },
            { icon: <BarChartOutlined />, value: project.workbooks, label: '工作台' },
            { icon: <ThunderboltOutlined />, value: project.recipes, label: '配方' },
            { icon: <TeamOutlined />,     value: project.members,   label: '成员' },
          ].map((m) => (
            <Col span={6} key={m.label}>
              <div className={styles.metricItem}>
                <Text strong className={styles.metricNum}>{m.value}</Text>
                <Text type="secondary" className={styles.metricName}>{m.label}</Text>
              </div>
            </Col>
          ))}
        </Row>

        {/* 底部悬停快捷操作 */}
        <div className={styles.cardFooter}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />最后活跃: {project.lastActive}
          </Text>
          <div className={styles.quickActions}>
            <Button size="small" onClick={() => onNavigate(project.id, 'models')}>数据</Button>
            <Button size="small" onClick={() => onNavigate(project.id, 'workbooks')}>视图</Button>
            <Button type="primary" size="small" onClick={() => onEnter(project.id)}>进入</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── 子组件：项目行（列表视图）───────────────────────────────────────────────

const ProjectRow = ({ project, onEnter, onNavigate, onToggleStar }) => {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.active
  const isGuest = project.role === 'Guest'

  return (
    <div className={`${styles.projectRow} ${isGuest ? styles.guestRow : ''}`}>
      <div className={styles.rowAccent} style={{ background: project.color }} />
      <div className={styles.rowMain}>
        <div className={styles.rowNameCol}>
          <Avatar size={32} style={{ background: project.color, fontWeight: 700, flexShrink: 0 }}>
            {project.name[0]}
          </Avatar>
          <div>
            <Space>
              <Text strong>{project.name}</Text>
              {isGuest && <Tag size="small">只读</Tag>}
            </Space>
            <div>
              <Space size={6}>
                <Badge status={status.badge} text={<Text style={{ fontSize: 11 }}>{status.text}</Text>} />
                <Text type="secondary" style={{ fontSize: 11 }}>| {project.tenant}</Text>
              </Space>
            </div>
          </div>
        </div>

        <div className={styles.rowMetrics}>
          <div className={styles.rowMetricItem}><Text strong>{project.datasets}</Text><Text type="secondary" style={{ fontSize: 11 }}>数据集</Text></div>
          <div className={styles.rowMetricItem}><Text strong>{project.workbooks}</Text><Text type="secondary" style={{ fontSize: 11 }}>工作台</Text></div>
          <div className={styles.rowMetricItem}><Text strong>{project.storage}</Text><Text type="secondary" style={{ fontSize: 11 }}>存储</Text></div>
          <div className={styles.rowMetricItem}>
            <Text strong style={{ color: project.cubeHealth >= 90 ? '#059669' : '#f59e0b' }}>{project.cubeHealth}%</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>引擎健康</Text>
          </div>
        </div>

        <div className={styles.rowActions}>
          <Button type="text" size="small" onClick={() => onNavigate(project.id, 'models')}>数据字典</Button>
          <Button type="primary" size="small" onClick={() => onEnter(project.id)}>{isGuest ? '查看详情' : '进入工作区'}</Button>
        </div>
      </div>
    </div>
  )
}

// ─── 骨架屏：项目卡片占位 ────────────────────────────────────────────────────

const ProjectCardSkeleton = () => (
  <Card className={styles.projectCard} variant="borderless" styles={{ body: { padding: 0 } }}>
    <div className={styles.cardAccent} style={{ background: '#e2e8f0' }} />
    <div className={styles.cardBody}>
      <Skeleton active avatar paragraph={{ rows: 4 }} />
    </div>
  </Card>
)

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const Workspaces = () => {
  const { redirectTo } = useSafeNavigate()
  const { user } = authService.getState()

  const [viewMode,     setViewMode]     = useState('grid')
  const [searchText,   setSearchText]   = useState('')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [projects,     setProjects]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  /** 拉取项目列表 */
  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    let canceled = false
    try {
      const list = await getProjects()
      
      // 前端可见性过滤逻辑
      // 1. 私有 (private): 只有项目成员可见 (role !== 'Guest')
      // 2. 内部 (internal): 本组织成员可见 (tenant 匹配)
      // 3. 公开 (public): 全员可见
      const visibleList = list.filter(p => {
        const isMember = p.role && p.role !== 'Guest'
        if (isMember) return true // 成员总是可见
        
        if (p.visibility === 'public') return true
        if (p.visibility === 'internal' && p.tenant === user?.tenant) return true
        
        return false
      }).map(p => ({
        ...p,
        // 如果不是明确定义的成员，标记为 Guest (只读)
        role: p.role || 'Guest'
      }))

      setProjects(visibleList)
    } catch (err) {
      /** request.js dedup 在 React StrictMode 二次 effect 时取消第一个请求，
       *  err.message === 'canceled'（Axios ERR_CANCELED），忽略即可，
       *  第二次未被取消的请求会正常完成。 */
      if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') {
        canceled = true
        return
      }
      const errMsg = err?.response?.data?.errors?.[0]?.message
        ?? err?.message
        ?? '加载失败，请稍后重试'
      console.error('[Workspaces] fetch failed:', errMsg, err)
      setError(errMsg)
      message.error(`项目列表加载失败：${errMsg}`)
    } finally {
      /** canceled 时保持 loading=true，让第二次请求自己收尾 */
      if (!canceled) setLoading(false)
    }
  }, [user?.tenant])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // 核心导航逻辑：进入项目根目录
  const handleEnter = (id) => redirectTo(`/project/${id}`)

  // 快捷导航逻辑：进入项目特定模块
  const handleNavigate = (id, module) => redirectTo(`/project/${id}/${module}`)

  const handleToggleStar = useCallback(async (id) => {
    /** Optimistic update: 立即翻转 starred 状态，失败时回滚 */
    setProjects((prev) => prev.map((p) => p.id === id ? { ...p, starred: !p.starred } : p))
    const project = projects.find((p) => p.id === id)
    if (!project) return
    const nextStarred = !project.starred
    try {
      await toggleStarProject(id, nextStarred)
    } catch (err) {
      /** 回滚 */
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, starred: project.starred } : p))
      message.error(nextStarred ? '收藏失败' : '取消收藏失败')
    }
  }, [projects])

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch = !searchText ||
        p.name.includes(searchText) ||
        p.description.includes(searchText) ||
        p.tenant.includes(searchText)
      const matchStatus = statusFilter === '全部' || STATUS_CONFIG[p.status]?.text === statusFilter
      return matchSearch && matchStatus
    })
  }, [projects, searchText, statusFilter])

  const starred    = filtered.filter((p) => p.starred)
  const nonStarred = filtered.filter((p) => !p.starred)

  const [projectModalOpen, setProjectModalOpen] = useState(false)
  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [currentProject, setCurrentProject] = useState(null)

  const handleCreate = () => {
    setEditingProject(null)
    setProjectModalOpen(true)
  }

  const handleSettings = (project) => {
    setEditingProject(project)
    setProjectModalOpen(true)
  }

  const handleMembers = (project) => {
    setCurrentProject(project)
    setMembersModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      await deleteProject(id)
      message.success('项目已删除')
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      message.error('删除项目失败')
    }
  }

  const handleProjectModalOk = async (values) => {
    try {
      if (editingProject) {
        await updateProject(editingProject.id, values)
        message.success('项目更新成功')
      } else {
        const newProject = await createProject(values)
        message.success('项目创建成功')
      }
      setProjectModalOpen(false)
      fetchProjects()
    } catch (err) {
      message.error(editingProject ? '更新失败' : '创建失败')
    }
  }

  const renderProjects = (list) =>
    viewMode === 'grid' ? (
      <Row gutter={[20, 20]}>
        {list.map((p) => (
          <Col key={p.id} xs={24} sm={12} lg={8} xl={6}>
            <ProjectCard
              project={p}
              onEnter={handleEnter}
              onNavigate={handleNavigate}
              onToggleStar={handleToggleStar}
              onSettings={handleSettings}
              onMembers={handleMembers}
              onDelete={handleDelete}
            />
          </Col>
        ))}
      </Row>
    ) : (
      <div className={styles.listView}>
        {list.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            onEnter={handleEnter}
            onNavigate={handleNavigate}
            onToggleStar={handleToggleStar}
          />
        ))}
      </div>
    )

  /** 骨架屏：首次加载时显示 */
  const renderSkeleton = () => (
    <Row gutter={[20, 20]}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Col key={i} xs={24} sm={12} lg={8} xl={6}>
          <ProjectCardSkeleton />
        </Col>
      ))}
    </Row>
  )

  return (
    <FixTabPanel>
      <div className={styles.container}>

        <TenantDashboard
          totalProjects={projects.length}
          totalStorage={
            loading
              ? '—'
              : (() => {
                  /** 汇总显示：简单地拼接各项目 storage 标签，或用固定汇总值 */
                  const count = projects.filter((p) => p.status === 'active').length
                  return `${projects.length} 个项目 / ${count} 运行中`
                })()
          }
          activePipelines={projects.filter((p) => p.status === 'active').length}
          onCreate={handleCreate}
        />

        {/* ... existing toolbar ... */}

        {/* Modals */}
        <ProjectModal
            open={projectModalOpen}
            onCancel={() => setProjectModalOpen(false)}
            onOk={handleProjectModalOk}
            initialValues={editingProject}
            title={editingProject ? '编辑项目' : '新建空间'}
        />

        <MembersModal
            open={membersModalOpen}
            onCancel={() => setMembersModalOpen(false)}
            projectId={currentProject?.id}
            projectName={currentProject?.name}
        />

        {/* 工具栏 */}
        <div className={styles.toolbar}>
          <Space size={16} wrap>
            <Search
              placeholder="搜索项目、描述或租户..."
              allowClear
              style={{ width: 320 }}
              prefix={<SearchOutlined />}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Space size={4}>
              <FilterOutlined style={{ color: '#9ca3af' }} />
              {FILTER_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  size="small"
                  type={statusFilter === opt ? 'primary' : 'default'}
                  onClick={() => setStatusFilter(opt)}
                  style={{ borderRadius: 20 }}
                >
                  {opt}
                </Button>
              ))}
            </Space>
          </Space>

          <Space>
            <Tooltip title="刷新项目列表">
              <Button
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={fetchProjects}
              />
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

        {/* 首次加载骨架屏 */}
        {loading && projects.length === 0 && renderSkeleton()}

        {/* 无匹配结果 */}
        {!loading && filtered.length === 0 && (
          <Empty
            description={
              error
                ? <span style={{ color: '#ef4444' }}>{error}</span>
                : '没有找到匹配的项目'
            }
            style={{ margin: '60px 0' }}
          >
            {error && (
              <Button type="primary" onClick={fetchProjects} loading={loading}>
                重新加载
              </Button>
            )}
          </Empty>
        )}

        {starred.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <StarFilled style={{ color: '#faad14', fontSize: 16 }} />
              <Text strong style={{ fontSize: 16 }}>我的收藏</Text>
            </div>
            {renderProjects(starred)}
          </section>
        )}

        {nonStarred.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <FolderOpenOutlined style={{ color: '#6b7280', fontSize: 16 }} />
              <Text strong style={{ fontSize: 16 }}>{starred.length > 0 ? '所有项目' : '我的项目'}</Text>
            </div>
            {renderProjects(nonStarred)}
          </section>
        )}
      </div>
    </FixTabPanel>
  )
}

export default Workspaces