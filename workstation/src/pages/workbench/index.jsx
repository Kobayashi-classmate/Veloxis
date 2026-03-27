import React, { useState, useCallback } from 'react'
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Button,
  List,
  Space,
  theme,
  Progress,
  Avatar,
  Input,
  Checkbox,
  Empty,
  Tooltip,
  Badge,
  Divider,
} from 'antd'
import {
  FileTextOutlined,
  BarChartOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  RightOutlined,
  StarOutlined,
  StarFilled,
  SyncOutlined,
  LineChartOutlined,
  TeamOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import FixTabPanel from '@stateless/FixTabPanel'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { authService } from '@src/service/authService'
import styles from './index.module.less'

const { Title, Text, Paragraph } = Typography

// ─── 模拟数据（普通用户视角）────────────────────────────────────────────────────

const RECENT_REPORTS = [
  {
    id: 'r-001',
    name: '3月销售周报',
    type: '销售分析',
    updatedAt: '1小时前',
    status: 'ready',
    starred: true,
    progress: 100,
  },
  {
    id: 'r-002',
    name: '渠道转化漏斗 Q1',
    type: '用户行为',
    updatedAt: '昨天',
    status: 'ready',
    starred: false,
    progress: 100,
  },
  {
    id: 'r-003',
    name: '库存周转率（实时）',
    type: '供应链',
    updatedAt: '刚刚',
    status: 'syncing',
    starred: false,
    progress: 68,
  },
  {
    id: 'r-004',
    name: '新用户留存分析',
    type: '用户行为',
    updatedAt: '2天前',
    status: 'ready',
    starred: true,
    progress: 100,
  },
]

const QUICK_ACTIONS = [
  {
    id: 'new-report',
    name: '新建报表',
    icon: <FileTextOutlined />,
    color: '#1677ff',
    bg: '#e8f4ff',
    path: '/dashboard',
  },
  {
    id: 'query',
    name: '即席查询',
    icon: <ThunderboltOutlined />,
    color: '#7c3aed',
    bg: '#f3e8ff',
    path: '/dashboard',
  },
  {
    id: 'chart',
    name: '图表分析',
    icon: <BarChartOutlined />,
    color: '#059669',
    bg: '#d1fae5',
    path: '/echarts',
  },
  {
    id: 'dataset',
    name: '我的数据集',
    icon: <FolderOpenOutlined />,
    color: '#d97706',
    bg: '#fef3c7',
    path: '/dashboard',
  },
]

const MY_METRICS = [
  { id: 'm-1', name: '今日数据同步', value: '4 次', trend: 'up', delta: '+1', ok: true },
  { id: 'm-2', name: '报表浏览量', value: '128', trend: 'up', delta: '+23%', ok: true },
  { id: 'm-3', name: '待处理任务', value: '3', trend: 'neutral', delta: '', ok: false },
  { id: 'm-4', name: '本月导出次数', value: '17', trend: 'up', delta: '+5', ok: true },
]

const ANNOUNCEMENTS = [
  {
    id: 'a-1',
    level: 'info',
    title: '新功能上线',
    desc: '图表导出现支持 PNG / SVG 格式，点击报表右上角导出按钮即可使用。',
    time: '今天',
  },
  {
    id: 'a-2',
    level: 'warning',
    title: '计划维护窗口',
    desc: '3月28日 02:00–04:00 进行例行维护，期间查询服务短暂中断。',
    time: '2天前',
  },
]

const UPCOMING = [
  { id: 'ev-1', name: 'Q1 数据复盘会议', date: '3月28日 10:00', tag: '会议' },
  { id: 'ev-2', name: '月度报表提交截止', date: '3月31日 18:00', tag: '截止' },
]

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

const useTodos = () => {
  const STORAGE_KEY = 'veloxis_workbench_todos'
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  }
  const save = (list) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {}
  }

  const [todos, setTodos] = useState(() =>
    load().length > 0
      ? load()
      : [
          { id: 't-1', text: '完成 Q1 销售分析报告', done: false },
          { id: 't-2', text: '校验库存数据同步任务', done: false },
          { id: 't-3', text: '分享渠道漏斗图表给市场团队', done: true },
        ]
  )

  const update = useCallback((next) => {
    setTodos(next)
    save(next)
  }, [])

  const toggle = useCallback(
    (id) => update(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    [todos, update]
  )

  const remove = useCallback((id) => update(todos.filter((t) => t.id !== id)), [todos, update])

  const add = useCallback(
    (text) => {
      if (!text.trim()) return
      update([...todos, { id: `t-${Date.now()}`, text: text.trim(), done: false }])
    },
    [todos, update]
  )

  return { todos, toggle, remove, add }
}

// ─── 子组件：欢迎头部 ─────────────────────────────────────────────────────────

const WelcomeHeader = ({ user }) => {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'
  const displayName = user?.name || user?.email || '同学'

  return (
    <div className={styles.welcomeHeader}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <div className={styles.greetingBox}>
            <Title level={2} style={{ margin: 0 }}>
              {greeting}，{displayName} 👋
            </Title>
            <Text type="secondary">欢迎回到 Veloxis 工作台，今天有 3 条待办等待处理。</Text>
          </div>
        </Col>
        <Col xs={24} md={10}>
          <Row gutter={[12, 12]}>
            {MY_METRICS.map((m) => (
              <Col xs={12} key={m.id}>
                <div className={styles.metricChip}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {m.name}
                  </Text>
                  <div className={styles.metricValue}>
                    <Text strong style={{ fontSize: 20 }}>
                      {m.value}
                    </Text>
                    {m.delta ? (
                      <Text style={{ fontSize: 11, color: m.ok ? '#52c41a' : '#faad14' }}>{m.delta}</Text>
                    ) : null}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
    </div>
  )
}

// ─── 子组件：快捷入口 ─────────────────────────────────────────────────────────

const QuickActions = ({ onNavigate }) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
    {QUICK_ACTIONS.map((action) => (
      <Col xs={12} sm={6} key={action.id}>
        <div className={styles.quickCard} onClick={() => onNavigate(action.path)}>
          <div className={styles.quickIcon} style={{ background: action.bg, color: action.color }}>
            {action.icon}
          </div>
          <Text strong style={{ fontSize: 13 }}>
            {action.name}
          </Text>
        </div>
      </Col>
    ))}
  </Row>
)

// ─── 子组件：最近报表 ─────────────────────────────────────────────────────────

const RecentReports = ({ onNavigate }) => {
  const [reports, setReports] = useState(RECENT_REPORTS)

  const toggleStar = (id) => setReports((prev) => prev.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r)))

  const typeColorMap = {
    销售分析: 'blue',
    用户行为: 'purple',
    供应链: 'orange',
  }

  return (
    <Card
      title={
        <Space>
          <LineChartOutlined />
          最近报表
        </Space>
      }
      variant="borderless"
      className={styles.sectionCard}
      extra={
        <Button type="link" size="small" icon={<RightOutlined />} onClick={() => onNavigate('/dashboard')}>
          全部
        </Button>
      }
    >
      <List
        dataSource={reports}
        renderItem={(item) => (
          <List.Item
            className={styles.reportItem}
            actions={[
              <Tooltip title={item.starred ? '取消收藏' : '收藏'} key="star">
                <Button
                  type="text"
                  size="small"
                  icon={item.starred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
                  onClick={() => toggleStar(item.id)}
                />
              </Tooltip>,
              <Button key="open" type="link" size="small" onClick={() => onNavigate('/dashboard')}>
                打开
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar
                  shape="square"
                  style={{ background: '#f0f5ff', color: '#1677ff', borderRadius: 8 }}
                  icon={<BarChartOutlined />}
                />
              }
              title={
                <Space size={4}>
                  <Text strong style={{ fontSize: 13 }}>
                    {item.name}
                  </Text>
                  <Tag color={typeColorMap[item.type] || 'default'} style={{ fontSize: 11 }}>
                    {item.type}
                  </Tag>
                  {item.status === 'syncing' && (
                    <Badge status="processing" text={<Text style={{ fontSize: 11 }}>同步中</Text>} />
                  )}
                </Space>
              }
              description={
                item.status === 'syncing' ? (
                  <Progress
                    percent={item.progress}
                    size="small"
                    strokeColor="#1677ff"
                    showInfo={false}
                    style={{ marginTop: 4, maxWidth: 180 }}
                  />
                ) : (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {item.updatedAt}更新
                  </Text>
                )
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )
}

// ─── 子组件：我的待办 ─────────────────────────────────────────────────────────

const MyTodos = () => {
  const { todos, toggle, remove, add } = useTodos()
  const [inputVal, setInputVal] = useState('')

  const handleAdd = () => {
    add(inputVal)
    setInputVal('')
  }

  const pending = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  return (
    <Card
      title={
        <Space>
          <CheckCircleFilled style={{ color: '#52c41a' }} />
          我的待办
          {pending.length > 0 && <Badge count={pending.length} size="small" />}
        </Space>
      }
      variant="borderless"
      className={styles.sectionCard}
    >
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          placeholder="添加新待办..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onPressEnter={handleAdd}
          maxLength={60}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加
        </Button>
      </Space.Compact>

      {pending.length === 0 && done.length === 0 ? (
        <Empty description="暂无待办" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          {pending.length > 0 && (
            <List
              size="small"
              dataSource={pending}
              renderItem={(item) => (
                <List.Item
                  className={styles.todoItem}
                  actions={[
                    <Button
                      key="del"
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => remove(item.id)}
                    />,
                  ]}
                >
                  <Checkbox onChange={() => toggle(item.id)}>{item.text}</Checkbox>
                </List.Item>
              )}
            />
          )}
          {done.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0', fontSize: 12 }}>已完成 ({done.length})</Divider>
              <List
                size="small"
                dataSource={done}
                renderItem={(item) => (
                  <List.Item
                    className={styles.todoItemDone}
                    actions={[
                      <Button
                        key="del"
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(item.id)}
                      />,
                    ]}
                  >
                    <Checkbox checked onChange={() => toggle(item.id)}>
                      <Text delete type="secondary">
                        {item.text}
                      </Text>
                    </Checkbox>
                  </List.Item>
                )}
              />
            </>
          )}
        </>
      )}
    </Card>
  )
}

// ─── 子组件：通知公告 ─────────────────────────────────────────────────────────

const AnnouncementsCard = () => {
  const levelStyle = {
    info: { color: '#1677ff', icon: '📢' },
    warning: { color: '#faad14', icon: '⚠️' },
  }

  return (
    <Card
      title={
        <Space>
          <CalendarOutlined />
          通知公告
        </Space>
      }
      variant="borderless"
      className={styles.sectionCard}
    >
      <List
        size="small"
        dataSource={ANNOUNCEMENTS}
        renderItem={(item) => {
          const s = levelStyle[item.level] || levelStyle.info
          return (
            <List.Item className={styles.announcementItem}>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Space size={6}>
                    <span>{s.icon}</span>
                    <Text strong style={{ fontSize: 13, color: s.color }}>
                      {item.title}
                    </Text>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {item.time}
                  </Text>
                </div>
                <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 2 }}>
                  {item.desc}
                </Paragraph>
              </div>
            </List.Item>
          )
        }}
      />

      <Divider style={{ margin: '12px 0 8px' }} />

      <List
        size="small"
        header={
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined style={{ marginRight: 6 }} />
            即将到来
          </Text>
        }
        dataSource={UPCOMING}
        renderItem={(ev) => (
          <List.Item style={{ padding: '6px 0' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size={6}>
                <Tag color="blue" style={{ fontSize: 11 }}>
                  {ev.tag}
                </Tag>
                <Text style={{ fontSize: 13 }}>{ev.name}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {ev.date}
              </Text>
            </Space>
          </List.Item>
        )}
      />
    </Card>
  )
}

// ─── 子组件：个人数据概览迷你图（进度条模拟） ──────────────────────────────────

const PersonalDataSummary = () => {
  const { token } = theme.useToken()

  const datasets = [
    { name: '销售数据集', rows: '2.4M', sync: '5分钟前', quota: 42 },
    { name: '用户行为日志', rows: '18.7M', sync: '1小时前', quota: 78 },
    { name: '库存快照', rows: '320K', sync: '刚刚', quota: 15 },
  ]

  return (
    <Card
      title={
        <Space>
          <TeamOutlined />
          我的数据集
        </Space>
      }
      variant="borderless"
      className={styles.sectionCard}
      extra={
        <Button type="link" size="small" icon={<SyncOutlined />}>
          刷新
        </Button>
      }
    >
      {datasets.map((ds) => (
        <div key={ds.name} className={styles.datasetRow}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text strong style={{ fontSize: 13 }}>
              {ds.name}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              <SyncOutlined spin={ds.sync === '刚刚'} style={{ marginRight: 4 }} />
              {ds.sync}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {ds.rows} 行
            </Text>
            <Text style={{ fontSize: 11, color: ds.quota > 70 ? token.colorWarning : token.colorSuccess }}>
              配额 {ds.quota}%
            </Text>
          </div>
          <Progress
            percent={ds.quota}
            size="small"
            showInfo={false}
            strokeColor={ds.quota > 70 ? token.colorWarning : token.colorSuccess}
          />
        </div>
      ))}
    </Card>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const Workbench = () => {
  const { redirectTo } = useSafeNavigate()
  const { user } = authService.getState()

  return (
    <FixTabPanel>
      <div className={styles.container}>
        <WelcomeHeader user={user} />
        <QuickActions onNavigate={redirectTo} />

        <Row gutter={[24, 24]}>
          {/* 左侧主区域 */}
          <Col xs={24} lg={16}>
            <Space direction="vertical" style={{ width: '100%' }} size={24}>
              <RecentReports onNavigate={redirectTo} />
              <MyTodos />
            </Space>
          </Col>

          {/* 右侧辅助区域 */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" style={{ width: '100%' }} size={24}>
              <PersonalDataSummary />
              <AnnouncementsCard />
            </Space>
          </Col>
        </Row>
      </div>
    </FixTabPanel>
  )
}

export default Workbench
