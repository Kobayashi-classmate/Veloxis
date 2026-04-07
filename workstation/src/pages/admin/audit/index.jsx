import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminAccessDenied from '../components/AdminAccessDenied'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { fetchAdminAudit } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const riskColorMap = {
  low: 'blue',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
}

const AuditPage = () => {
  const { message } = App.useApp()
  const { profile, organizationId } = useAdminOutlet()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [actorKeyword, setActorKeyword] = useState('')
  const [moduleFilter, setModuleFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const loadAuditEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const records = await fetchAdminAudit({
        organizationScoped: profile.organizationScoped,
        organizationId,
        limit: 200,
      })
      setEvents(records)
    } catch (err) {
      const errorMessage = err?.message || '审计事件加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [message, profile.organizationScoped, organizationId])

  useEffect(() => {
    if (profile.capabilities.audit) {
      loadAuditEvents()
    }
  }, [loadAuditEvents, profile.capabilities.audit])

  const filteredEvents = useMemo(() => {
    const organizationFiltered = events.filter((item) => item.scope_id === organizationId)
    const base = profile.organizationScoped && organizationFiltered.length > 0 ? organizationFiltered : events

    return base.filter((item) => {
      const actorMatch = !actorKeyword || item.actor.toLowerCase().includes(actorKeyword.toLowerCase())
      const moduleMatch = moduleFilter === 'all' || item.module === moduleFilter
      const riskMatch = riskFilter === 'all' || item.risk_level === riskFilter
      return actorMatch && moduleMatch && riskMatch
    })
  }, [actorKeyword, events, moduleFilter, profile.organizationScoped, riskFilter, organizationId])

  const moduleOptions = useMemo(() => {
    const values = Array.from(new Set(events.map((item) => item.module).filter(Boolean)))
    return values.map((value) => ({ label: value, value }))
  }, [events])

  if (!profile.capabilities.audit) {
    return <AdminAccessDenied message="当前角色不可访问平台审计视图。" />
  }

  return (
    <AdminPageShell
      title="Audit"
      subtitle="集中查看高危与关键操作事件，支持按模块、风险等级和操作者检索。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadAuditEvents} loading={loading}>
          刷新
        </Button>
      }
    >
      {error ? (
        <Alert showIcon type="error" message="加载失败" description={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Card className={styles.sectionCard}>
        <div className={styles.filterBar}>
          <Input
            value={actorKeyword}
            onChange={(event) => setActorKeyword(event.target.value.trim())}
            placeholder="操作者关键词"
            allowClear
          />
          <Select
            value={moduleFilter}
            onChange={setModuleFilter}
            options={[{ label: '全部模块', value: 'all' }, ...moduleOptions]}
          />
          <Select
            value={riskFilter}
            onChange={setRiskFilter}
            options={[
              { label: '全部风险', value: 'all' },
              { label: 'medium', value: 'medium' },
              { label: 'high', value: 'high' },
              { label: 'critical', value: 'critical' },
            ]}
          />
          <Button
            onClick={() => {
              setActorKeyword('')
              setModuleFilter('all')
              setRiskFilter('all')
            }}
          >
            重置筛选
          </Button>
        </div>
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.tableWrap}>
          <Table
            loading={loading}
            rowKey="id"
            dataSource={filteredEvents}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: 'Time',
                dataIndex: 'created_at',
              },
              {
                title: 'Actor',
                dataIndex: 'actor',
              },
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
                title: 'Target',
                dataIndex: 'target',
              },
              {
                title: 'Risk',
                dataIndex: 'risk_level',
                render: (value) => <Tag color={riskColorMap[value] || 'default'}>{value}</Tag>,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (value) => <Tag color={value === 'success' ? 'success' : 'warning'}>{value}</Tag>,
              },
              {
                title: 'Detail',
                key: 'detail',
                render: (_, record) => (
                  <Button size="small" onClick={() => setSelectedEvent(record)}>
                    事件详情
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Card>

      <Drawer
        open={Boolean(selectedEvent)}
        width={460}
        title="审计事件详情"
        onClose={() => setSelectedEvent(null)}
        destroyOnClose
      >
        {selectedEvent ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>{selectedEvent.id}</Text>
            <Text>Actor: {selectedEvent.actor}</Text>
            <Text>Module: {selectedEvent.module}</Text>
            <Text>Action: {selectedEvent.action}</Text>
            <Text>Target: {selectedEvent.target}</Text>
            <Text>
              Scope: {selectedEvent.scope_type}:{selectedEvent.scope_id}
            </Text>
            <Text>Risk: {selectedEvent.risk_level}</Text>
            <Text>Status: {selectedEvent.status}</Text>
            <Text>Created At: {selectedEvent.created_at}</Text>
          </Space>
        ) : null}
      </Drawer>
    </AdminPageShell>
  )
}

export default AuditPage
