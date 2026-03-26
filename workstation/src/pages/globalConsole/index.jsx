import React, { useState, useEffect } from 'react'
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Button,
  Badge,
  List,
  Space,
  theme,
  Progress,
  Avatar,
  Table,
} from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  AppstoreOutlined,
  BellOutlined,
  FolderOpenOutlined,
  RightOutlined,
  ReloadOutlined,
  WarningOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  UsergroupAddOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import FixTabPanel from '@stateless/FixTabPanel'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { authService } from '@src/service/authService'
import styles from './index.module.less'

const { Title, Text } = Typography

// ─── 模拟数据 (管理员全局视角) ────────────────────────────────────────────────

// 集群节点状态 (Doris / Worker / SeaweedFS)
const MOCK_CLUSTER_NODES = [
  { id: 'node-01', name: 'Doris-FE-01', type: 'Leader', cpu: '12%', mem: '4.2GB / 16GB', status: 'healthy' },
  { id: 'node-02', name: 'Doris-BE-01', type: 'Backend', cpu: '45%', mem: '32GB / 64GB', status: 'healthy' },
  { id: 'node-03', name: 'Data-Worker-01', type: 'Executor', cpu: '88%', mem: '6GB / 8GB', status: 'busy' },
]

// 全局租户/项目资源消耗排行
const MOCK_TENANT_STATS = [
  { id: 'proj-001', name: '电商运营项目', tenant: '集团本部', storage: '1.2 TB', users: 125, health: 98 },
  { id: 'proj-002', name: '海外增长中心', tenant: '国际事业部', storage: '850 GB', users: 42, health: 95 },
  { id: 'proj-003', name: '供应链实时监控', tenant: '物流部', storage: '4.2 TB', users: 15, health: 88 },
]

// 管理员快捷管理入口
const ADMIN_QUICK_ACTIONS = [
  { id: 'manage-users', name: '用户与权限', icon: <UsergroupAddOutlined />, path: '/admin/users', color: '#1890ff' },
  { id: 'manage-datasets', name: '全局数据集', icon: <DatabaseOutlined />, path: '/admin/datasets', color: '#52c41a' },
  { id: 'cluster-config', name: '集群配置管理', icon: <ClusterOutlined />, path: '/admin/cluster', color: '#faad14' },
  { id: 'audit-logs', name: '系统安全审计', icon: <SafetyCertificateOutlined />, path: '/admin/audit', color: '#ff4d4f' },
]

// 模拟全局任务流水线 (跨项目)
const MOCK_PIPELINE_JOBS = [
  {
    id: 'job-101',
    tenant: '集团本部',
    name: '全量交易数据清洗',
    target: 'Doris.fact_sales',
    status: 'processing',
    progress: 82,
    startTime: '10分钟前',
  },
  {
    id: 'job-102',
    tenant: '物流部',
    name: '实时轨迹数据解析',
    target: 'Doris.ods_logistics',
    status: 'warning',
    progress: 15,
    startTime: '3分钟前',
  },
]

// 系统级审计日志
const MOCK_AUDIT_LOGS = [
  { id: 'log-001', level: 'info', user: 'system', action: 'Doris 自动分区扩容完成', time: '刚刚' },
  { id: 'log-002', level: 'warning', user: 'admin', action: '修改了 "海外项目" 的存储配额', time: '12分钟前' },
  { id: 'log-003', level: 'error', user: 'worker-03', action: 'Doris Stream Load 失败: 内存溢出', time: '45分钟前' },
]

// ─── 子组件：集群概览 (Architecture Health) ───────────────────────────────────

const ArchitectureHealthBar = () => {
  return (
    <div className={styles.healthBar}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <div className={styles.healthItem}>
            <Text type="secondary" style={{ fontSize: 12 }}>系统并发 (QPS)</Text>
            <div className={styles.healthValue}>
              <Text strong style={{ fontSize: 18 }}>1,250</Text>
              <Tag color="success">稳定</Tag>
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className={styles.healthItem}>
            <Text type="secondary" style={{ fontSize: 12 }}>语义层缓存率</Text>
            <div className={styles.healthValue}>
              <Text strong style={{ fontSize: 18 }}>89.4%</Text>
              <Badge status="processing" />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className={styles.healthItem}>
            <Text type="secondary" style={{ fontSize: 12 }}>集群存储水位</Text>
            <div className={styles.healthValue}>
              <Text strong style={{ fontSize: 18 }}>62%</Text>
              <Progress percent={62} size={[40, 8]} showInfo={false} strokeColor="#52c41a" />
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className={styles.healthItem}>
            <Text type="secondary" style={{ fontSize: 12 }}>活跃任务 (Job)</Text>
            <div className={styles.healthValue}>
              <Text strong style={{ fontSize: 18 }}>12</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>/ 3 正在执行</Text>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  )
}

const OverviewHeader = ({ user }) => {
  return (
    <div className={styles.overviewHeader}>
      <Row justify="space-between" align="middle" gutter={[16, 24]}>
        <Col xs={24} md={8}>
          <div className={styles.welcomeBox}>
            <Title level={2} style={{ margin: 0 }}>
              系统管理中心
            </Title>
            <Text type="secondary">
              管理员：{user?.name || 'Admin'} | 权限：超级管理员
            </Text>
          </div>
        </Col>
        <Col xs={24} md={16}>
          <ArchitectureHealthBar />
        </Col>
      </Row>
    </div>
  )
}

// ─── 子组件：节点监控列表 ─────────────────────────────────────────────────────

const ClusterNodeList = () => {
  return (
    <Card 
      title={<Space><ClusterOutlined /> 集群节点实时状态</Space>} 
      variant="borderless"
      className={styles.sectionCard}
    >
      <Table 
        dataSource={MOCK_CLUSTER_NODES}
        pagination={false}
        size="small"
        columns={[
          { title: '节点名称', dataIndex: 'name', key: 'name', render: (t) => <Text strong>{t}</Text> },
          { title: '角色', dataIndex: 'type', key: 'type', render: (t) => <Tag>{t}</Tag> },
          { title: 'CPU', dataIndex: 'cpu', key: 'cpu' },
          { title: '内存', dataIndex: 'mem', key: 'mem' },
          { title: '状态', dataIndex: 'status', key: 'status', render: (s) => (
            <Badge status={s === 'healthy' ? 'success' : 'processing'} text={s === 'healthy' ? '健康' : '繁忙'} />
          )},
        ]}
      />
    </Card>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

const GlobalConsole = () => {
  const { redirectTo } = useSafeNavigate()
  const { user } = authService.getState()
  const { token } = theme.useToken()

  const [pipelineJobs, setPipelineJobs] = useState(MOCK_PIPELINE_JOBS)

  useEffect(() => {
    const timer = setInterval(() => {
      setPipelineJobs(prev => prev.map(job => 
        job.status === 'processing' 
          ? { ...job, progress: Math.min(99, job.progress + Math.floor(Math.random() * 3)) } 
          : job
      ))
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  return (
    <FixTabPanel>
      <div className={styles.container}>
        <OverviewHeader user={user} />

        {/* 快捷管理入口 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {ADMIN_QUICK_ACTIONS.map(action => (
            <Col xs={12} sm={6} key={action.id}>
              <div 
                className={styles.actionCard} 
                onClick={() => redirectTo(action.path)}
              >
                <div className={styles.actionIcon} style={{ color: action.color }}>
                  {action.icon}
                </div>
                <Text strong>{action.name}</Text>
              </div>
            </Col>
          ))}
        </Row>

        <Row gutter={[24, 24]}>
          {/* 左侧：系统监控 */}
          <Col xs={24} lg={16}>
            <Space direction="vertical" style={{ width: '100%' }} size={24}>
              <ClusterNodeList />
              
              <Card title={<Space><AppstoreOutlined /> 全局任务流水线 (Data Worker)</Space>} variant="borderless">
                <List
                  dataSource={pipelineJobs}
                  renderItem={item => (
                    <List.Item className={styles.jobItem}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Space>
                            <Text strong>{item.name}</Text>
                            <Tag color="blue">{item.tenant}</Tag>
                          </Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>{item.startTime}</Text>
                        </div>
                        <Progress percent={item.progress} status={item.status === 'warning' ? 'exception' : 'active'} />
                        <Text type="secondary" style={{ fontSize: 12 }}>目标: {item.target}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            </Space>
          </Col>

          {/* 右侧：资源排行与审计 */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" style={{ width: '100%' }} size={24}>
              <Card title={<Space><DatabaseOutlined /> 租户资源消耗排行</Space>} variant="borderless">
                <List
                  dataSource={MOCK_TENANT_STATS}
                  renderItem={(item, index) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar style={{ backgroundColor: index === 0 ? '#f5222d' : '#bfbfbf' }}>{index + 1}</Avatar>}
                        title={<Text strong>{item.name}</Text>}
                        description={
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{item.tenant}</Text>
                            <Text strong style={{ color: token.colorPrimary }}>{item.storage}</Text>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>

              <Card title={<Space><SafetyCertificateOutlined /> 系统审计日志</Space>} variant="borderless">
                <List
                  size="small"
                  dataSource={MOCK_AUDIT_LOGS}
                  renderItem={log => (
                    <List.Item>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Badge status={log.level === 'error' ? 'error' : 'default'} text={log.action} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>操作员: {log.user}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{log.time}</Text>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            </Space>
          </Col>
        </Row>
      </div>
    </FixTabPanel>
  )
}

export default GlobalConsole
