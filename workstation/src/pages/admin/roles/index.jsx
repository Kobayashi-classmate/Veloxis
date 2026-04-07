import React, { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminAccessDenied from '../components/AdminAccessDenied'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { fetchAdminRoles } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const RolesPage = () => {
  const { message } = App.useApp()
  const { profile, actor } = useAdminOutlet()
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const records = await fetchAdminRoles()
      setRoles(records)
    } catch (err) {
      const errorMessage = err?.message || '角色数据加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    if (profile.capabilities.roles) {
      loadRoles()
    }
  }, [loadRoles, profile.capabilities.roles])

  if (!profile.capabilities.roles) {
    return <AdminAccessDenied message="仅 Super Admin 可管理角色与权限矩阵。" />
  }

  return (
    <AdminPageShell
      title="Roles"
      subtitle="定义角色能力边界，并对高危权限变更执行二次确认与审计。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRoles} loading={loading}>
            刷新
          </Button>
          <Button type="primary">创建角色</Button>
        </Space>
      }
    >
      {error ? (
        <Alert type="error" showIcon message="加载失败" description={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Alert
        type="warning"
        showIcon
        message="高危提醒"
        description="涉及权限提升、跨组织授权与超级角色修改的操作必须二次确认并写入审计日志。"
      />

      <Card className={styles.sectionCard} title="角色列表与风险级别">
        <Table
          loading={loading}
          rowKey="id"
          dataSource={roles}
          pagination={false}
          columns={[
            {
              title: 'Role',
              dataIndex: 'name',
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{record.name}</Text>
                  <Text type="secondary">{record.code}</Text>
                </Space>
              ),
            },
            {
              title: 'Scope',
              dataIndex: 'scope',
              render: (value) => <Tag color={value === 'platform' ? 'geekblue' : 'gold'}>{value}</Tag>,
            },
            {
              title: 'Risk',
              dataIndex: 'risk_level',
              render: (value) => <Tag color={value === 'critical' ? 'red' : 'orange'}>{value}</Tag>,
            },
            {
              title: 'Permissions',
              dataIndex: 'permissions',
              render: (value) => <Text>{value.join(', ')}</Text>,
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_, record) => (
                <Space>
                  <Button size="small">编辑策略</Button>
                  <AdminDangerAction
                    actionKey="admin.roles.elevate"
                    label="提升权限"
                    target={record.id}
                    description="角色权限提升会扩大可见数据范围，需经过二次确认。"
                    riskLevel={record.risk_level === 'critical' ? 'critical' : 'high'}
                    actor={actor}
                    onConfirm={async (payload) => {
                      message.success(`角色变更请求已提交: ${payload.target_id}`)
                    }}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Card className={styles.sectionCard} title="权限矩阵（MVP 占位）">
        <Table
          loading={loading}
          rowKey="id"
          dataSource={roles}
          pagination={false}
          columns={[
            {
              title: 'Role',
              dataIndex: 'name',
            },
            {
              title: 'Users',
              render: (_, record) => (record.permissions.some((item) => item.startsWith('users')) ? '✓' : '-'),
            },
            {
              title: 'Projects',
              render: (_, record) => (record.permissions.some((item) => item.startsWith('projects')) ? '✓' : '-'),
            },
            {
              title: 'Plugins',
              render: (_, record) => (record.permissions.some((item) => item.startsWith('plugins')) ? '✓' : '-'),
            },
            {
              title: 'Audit',
              render: (_, record) => (record.permissions.some((item) => item.startsWith('audit')) ? '✓' : '-'),
            },
          ]}
        />
      </Card>
    </AdminPageShell>
  )
}

export default RolesPage
