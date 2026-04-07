import React, { useEffect, useState } from 'react'
import {
  Typography,
  Row,
  Col,
  Card,
  Statistic,
  Avatar,
  Skeleton,
  message,
  Tag,
  Space,
  Progress,
  Divider,
  Button,
  Tooltip,
  Badge,
  Result,
} from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DatabaseOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  UserOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  LockOutlined,
  TeamOutlined,
  ReloadOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudServerOutlined,
  ApiOutlined,
  HddOutlined,
} from '@ant-design/icons'
import { getProjectBySlug } from '@src/service/api/projects'

const { Title, Text, Paragraph } = Typography

const VISIBILITY_CONFIG = {
  private: { icon: <LockOutlined />, text: '私有', color: 'default' },
  internal: { icon: <TeamOutlined />, text: '内部', color: 'blue' },
  public: { icon: <GlobalOutlined />, text: '公开', color: 'success' },
}

const STATUS_CONFIG = {
  active: { color: '#52c41a', text: '运行中', badge: 'success' },
  warning: { color: '#faad14', text: '告警', badge: 'warning' },
  archived: { color: '#8c8c8c', text: '已归档', badge: 'default' },
}

/* ── Stat card ── */
const StatCard = ({ title, value, icon, color, suffix, footer }) => (
  <Card
    bordered={false}
    style={{
      borderRadius: 12,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      border: '1px solid #e2e8f0',
      height: '100%',
    }}
    styles={{ body: { padding: '20px 24px' } }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <Statistic
        title={
          <Text type="secondary" style={{ fontSize: 13 }}>
            {title}
          </Text>
        }
        value={value}
        suffix={suffix}
        valueStyle={{ color, fontSize: 28, fontWeight: 700 }}
      />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: `${color}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
    </div>
    {footer && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>{footer}</div>}
  </Card>
)

/* ── Health metric row ── */
const HealthMetric = ({ icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: `${color}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        fontSize: 15,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }}>{value}</div>
    </div>
  </div>
)

/* ── Skeleton ── */
const OverviewSkeleton = () => (
  <div>
    {/* Header */}
    <Card
      bordered={false}
      style={{ borderRadius: 12, marginBottom: 24, border: '1px solid #e2e8f0' }}
      styles={{ body: { padding: 24 } }}
    >
      <Skeleton active paragraph={{ rows: 2 }} />
    </Card>
    {/* Stat cards */}
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {[1, 2, 3, 4].map((i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <Skeleton active paragraph={{ rows: 1 }} />
          </Card>
        </Col>
      ))}
    </Row>
    {/* Bottom row */}
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card bordered={false} style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </Col>
    </Row>
  </div>
)

/* ── Mock recent activities (placeholder until backend) ── */
const RECENT_ACTIVITIES = [
  {
    key: 1,
    icon: <DatabaseOutlined />,
    iconColor: '#3b82f6',
    title: '数据导入成功',
    desc: '销售数据_2024Q1.csv 已成功导入 Doris',
    time: '10 分钟前',
    type: 'success',
  },
  {
    key: 2,
    icon: <ApiOutlined />,
    iconColor: '#8b5cf6',
    title: '模型更新',
    desc: '张三 更新了「用户行为分析」语义模型',
    time: '2 小时前',
    type: 'info',
  },
  {
    key: 3,
    icon: <UserOutlined />,
    iconColor: '#10b981',
    title: '新成员加入',
    desc: '李四 以 Analyst 角色加入了项目',
    time: '昨天',
    type: 'info',
  },
  {
    key: 4,
    icon: <ThunderboltOutlined />,
    iconColor: '#f59e0b',
    title: 'ETL 任务完成',
    desc: '「每日增量同步」任务执行成功，处理 12,480 行',
    time: '昨天',
    type: 'success',
  },
]

/* ════════════════════════════════════════════ */

const Overview = () => {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const fetchProjectData = async (silent = false) => {
    if (!slug) return
    silent ? setRefreshing(true) : setLoading(true)
    setNotFound(false)
    try {
      const data = await getProjectBySlug(slug)
      if (data === null) {
        setNotFound(true)
      } else {
        setProject(data)
      }
    } catch (err) {
      if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') return
      message.error('获取项目信息失败')
      console.error(err)
    } finally {
      silent ? setRefreshing(false) : setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!slug) return
      setLoading(true)
      setNotFound(false)
      try {
        const data = await getProjectBySlug(slug)
        if (cancelled) return
        if (data === null) {
          // getProject 返回 null 表示：404 或软删除
          setNotFound(true)
        } else {
          setProject(data)
        }
      } catch (err) {
        if (cancelled) return
        if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') return
        message.error('获取项目信息失败')
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) return <OverviewSkeleton />

  if (notFound || !project) {
    return (
      <Result
        status="404"
        title="项目不存在"
        subTitle="该项目已被删除或您没有访问权限，请返回项目大厅。"
        extra={
          <Button type="primary" onClick={() => navigate('/workspaces')}>
            返回项目大厅
          </Button>
        }
      />
    )
  }

  const vis = VISIBILITY_CONFIG[project.visibility] ?? VISIBILITY_CONFIG.private
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
  const healthColor = project.cubeHealth >= 90 ? '#52c41a' : project.cubeHealth >= 70 ? '#faad14' : '#ff4d4f'
  const healthIcon = project.cubeHealth >= 90 ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />

  return (
    <div>
      {/* ── Header banner ── */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          marginBottom: 24,
          border: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
        styles={{ body: { padding: '24px 28px' } }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Left: name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space align="center" size={10} wrap style={{ marginBottom: 8 }}>
              {/* Color dot */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: project.color ?? '#1677ff',
                  flexShrink: 0,
                }}
              />
              <Title level={3} style={{ margin: 0, lineHeight: 1.2 }}>
                {project.name}
              </Title>
              <Badge
                status={status.badge}
                text={<Text style={{ fontSize: 12, color: status.color }}>{status.text}</Text>}
              />
              <Tag color={vis.color} icon={vis.icon} style={{ marginLeft: 4 }}>
                {vis.text}
              </Tag>
              {project.organization && <Tag color="blue">{project.organization}</Tag>}
              {project.role && (
                <Tag style={{ background: '#f0f7ff', borderColor: '#bae0ff', color: '#0958d9' }}>{project.role}</Tag>
              )}
            </Space>

            <Paragraph
              type="secondary"
              style={{ margin: 0, fontSize: 14, maxWidth: 680 }}
              ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
            >
              {project.description || '暂无项目描述'}
            </Paragraph>

            {project.tags?.length > 0 && (
              <Space size={6} wrap style={{ marginTop: 10 }}>
                {project.tags.map((tag) => (
                  <Tag key={tag} style={{ borderRadius: 4, margin: 0 }}>
                    {tag}
                  </Tag>
                ))}
              </Space>
            )}
          </div>

          {/* Right: last active + refresh */}
          <Space direction="vertical" align="end" size={8} style={{ flexShrink: 0 }}>
            <Tooltip title="刷新">
              <Button
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={() => fetchProjectData(true)}
                size="small"
                type="text"
              />
            </Tooltip>
            <Space size={6}>
              <ClockCircleOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                最后活跃：{project.lastActive}
              </Text>
            </Space>
          </Space>
        </div>
      </Card>

      {/* ── Stat cards ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="已连接数据集"
            value={project.datasets}
            icon={<DatabaseOutlined />}
            color="#3b82f6"
            footer={
              <Space size={4}>
                <RiseOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  数据源已就绪
                </Text>
              </Space>
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="看板 / 工作台"
            value={project.workbooks}
            icon={<BarChartOutlined />}
            color="#8b5cf6"
            footer={
              <Text type="secondary" style={{ fontSize: 12 }}>
                可视化分析面板
              </Text>
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="ETL 任务"
            value={project.recipes}
            icon={<ThunderboltOutlined />}
            color="#f59e0b"
            footer={
              <Text type="secondary" style={{ fontSize: 12 }}>
                数据加工 Pipeline
              </Text>
            }
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            title="项目成员"
            value={project.members}
            icon={<UserOutlined />}
            color="#10b981"
            footer={
              <Text type="secondary" style={{ fontSize: 12 }}>
                协作参与人数
              </Text>
            }
          />
        </Col>
      </Row>

      {/* ── Bottom row ── */}
      <Row gutter={[16, 16]}>
        {/* Recent activities */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#1677ff' }} />
                <span>最近动态</span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              height: '100%',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {RECENT_ACTIVITIES.map((item, idx) => (
                <React.Fragment key={item.key}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0' }}>
                    <Avatar
                      icon={item.icon}
                      size={36}
                      style={{
                        background: `${item.iconColor}18`,
                        color: item.iconColor,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 14 }}>
                          {item.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12, flexShrink: 0, marginLeft: 12 }}>
                          {item.time}
                        </Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {item.desc}
                      </Text>
                    </div>
                  </div>
                  {idx < RECENT_ACTIVITIES.length - 1 && <Divider style={{ margin: 0 }} />}
                </React.Fragment>
              ))}
            </div>
          </Card>
        </Col>

        {/* Infrastructure health */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <CloudServerOutlined style={{ color: '#1677ff' }} />
                <span>基础设施健康度</span>
              </Space>
            }
            bordered={false}
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              height: '100%',
            }}
          >
            {/* Cube.js health with progress */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Space size={6}>
                  {React.cloneElement(healthIcon, { style: { color: healthColor, fontSize: 14 } })}
                  <Text style={{ fontSize: 13 }}>Cube.js 引擎健康度</Text>
                </Space>
                <Text strong style={{ color: healthColor }}>
                  {project.cubeHealth}%
                </Text>
              </div>
              <Progress
                percent={project.cubeHealth}
                size="small"
                strokeColor={healthColor}
                showInfo={false}
                strokeWidth={6}
                style={{ margin: 0 }}
              />
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <HealthMetric icon={<HddOutlined />} label="存储占用" value={project.storage} color="#8b5cf6" />
            <HealthMetric
              icon={<ApiOutlined />}
              label="Doris 查询平均延迟"
              value={project.dorisLatency}
              color="#3b82f6"
            />
            <HealthMetric
              icon={<ClockCircleOutlined />}
              label="最后活跃时间"
              value={project.lastActive}
              color="#94a3b8"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Overview
