import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, List, Row, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import AdminPageShell from '../components/AdminPageShell'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { fetchAdminOverview } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const statusColor = {
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
}

const OverviewPage = () => {
  const { message } = App.useApp()
  const { redirectTo } = useSafeNavigate()
  const { profile, organizationId } = useAdminOutlet()
  const [overview, setOverview] = useState({
    health: {
      platform_status: 'healthy',
      active_organizations: 0,
      active_projects: 0,
      running_jobs: 0,
      failed_jobs: 0,
      plugin_enabled_count: 0,
    },
    alerts: [],
    recent_changes: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminOverview({
        organizationScoped: profile.organizationScoped,
        organizationId,
      })
      setOverview(data)
    } catch (err) {
      const errorMessage = err?.message || '管理总览加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [message, profile.organizationScoped, organizationId])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const healthCards = useMemo(() => {
    const health = overview.health
    return [
      {
        key: 'organizations',
        label: profile.organizationScoped ? 'Organization Projects' : 'Active Organizations',
        value: profile.organizationScoped ? health.active_projects : health.active_organizations,
      },
      {
        key: 'jobs',
        label: 'Running Jobs',
        value: health.running_jobs,
      },
      {
        key: 'failed_jobs',
        label: 'Failed Jobs',
        value: health.failed_jobs,
      },
      {
        key: 'plugins',
        label: 'Enabled Plugins',
        value: health.plugin_enabled_count,
      },
    ]
  }, [overview.health, profile.organizationScoped])

  const scopedChanges = useMemo(() => {
    return profile.organizationScoped
      ? overview.recent_changes.filter((item) => item.target.includes('project') || item.module === 'projects')
      : overview.recent_changes
  }, [overview.recent_changes, profile.organizationScoped])

  return (
    <AdminPageShell
      title="Overview"
      subtitle="30 秒内判断平台与组织状态，并进入高频管理操作。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadOverview} loading={loading}>
            刷新状态
          </Button>
          <Button type="primary" onClick={() => redirectTo('/admin/audit')} disabled={!profile.capabilities.audit}>
            查看审计
          </Button>
        </Space>
      }
    >
      {error ? (
        <Alert showIcon type="error" message="加载失败" description={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Alert
        showIcon
        type={statusColor[overview.health.platform_status] || 'info'}
        message={`Platform Status: ${overview.health.platform_status}`}
        description={
          profile.organizationScoped
            ? `当前组织范围：${organizationId || 'organization_scope'}`
            : '当前为平台级总览视图'
        }
      />

      <Row gutter={[12, 12]} className={styles.gridCards}>
        {healthCards.map((card) => (
          <Col xs={12} lg={6} key={card.key}>
            <Card className={styles.metricCard}>
              <div className={styles.metricLabel}>{card.label}</div>
              <div className={styles.metricValue}>{card.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="异常与告警" className={styles.sectionCard}>
            <List
              loading={loading}
              dataSource={overview.alerts}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space>
                      <Tag color={item.level === 'high' ? 'red' : 'gold'}>{item.level.toUpperCase()}</Tag>
                      <Text strong>{item.title}</Text>
                    </Space>
                    <Text type="secondary">
                      {item.module} | {item.created_at}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card title="最近配置变更" className={styles.sectionCard}>
            <Table
              loading={loading}
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={scopedChanges}
              columns={[
                {
                  title: 'Module',
                  dataIndex: 'module',
                  render: (value) => <Tag>{value}</Tag>,
                },
                {
                  title: 'Action',
                  dataIndex: 'action',
                },
                {
                  title: 'Actor',
                  dataIndex: 'actor',
                },
                {
                  title: 'Risk',
                  dataIndex: 'risk_level',
                  render: (value) => <Tag color={value === 'high' ? 'red' : 'gold'}>{value}</Tag>,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </AdminPageShell>
  )
}

export default OverviewPage
