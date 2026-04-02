import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Input, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { fetchAdminUsers } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const statusColor = {
  active: 'success',
  locked: 'error',
  pending: 'warning',
}

const UsersPage = () => {
  const { message } = App.useApp()
  const { profile, tenantId, actor } = useAdminOutlet()
  const requestIdRef = useRef(0)

  const [users, setUsers] = useState([])
  const [roleOptions, setRoleOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)

  const loadUsers = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setLoading(true)
    setError('')
    try {
      const response = await fetchAdminUsers({
        tenantScoped: profile.tenantScoped,
        tenantId,
      })
      if (requestId !== requestIdRef.current) return
      setUsers(response.users)
      setRoleOptions(response.roleOptions)
    } catch (err) {
      if (err?.message === 'canceled' || err?.code === 'ERR_CANCELED') {
        return
      }
      if (requestId !== requestIdRef.current) return
      const errorMessage = err?.message || '用户数据加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [message, profile.tenantScoped, tenantId])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const scopedUsers = useMemo(() => {
    const tenantFiltered = users.filter((item) => item.tenant_id === tenantId || item.tenant_name === tenantId)
    const base = profile.tenantScoped && tenantFiltered.length > 0 ? tenantFiltered : users

    return base.filter((item) => {
      const keywordMatch =
        !keyword ||
        item.email.toLowerCase().includes(keyword.toLowerCase()) ||
        item.display_name.toLowerCase().includes(keyword.toLowerCase())
      const statusMatch = status === 'all' || item.status === status
      const roleMatch = roleFilter === 'all' || item.role_code === roleFilter
      return keywordMatch && statusMatch && roleMatch
    })
  }, [keyword, profile.tenantScoped, roleFilter, status, tenantId, users])

  return (
    <AdminPageShell
      title="Users"
      subtitle="按租户与角色管理账号状态、角色绑定和账号安全。"
      roleLabel={profile.roleLabel}
      tenantScoped={profile.tenantScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>
            刷新
          </Button>
          <Button type="primary">新建用户</Button>
        </Space>
      }
    >
      {error ? (
        <Alert
          showIcon
          type="error"
          message="加载失败"
          description={error}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <Card className={styles.sectionCard}>
        <div className={styles.filterBar}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value.trim())}
            placeholder="关键词（姓名 / 邮箱）"
            allowClear
          />
          <Select
            value={status}
            onChange={setStatus}
            options={[
              { label: '全部状态', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Locked', value: 'locked' },
            ]}
          />
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            options={[{ label: '全部角色', value: 'all' }, ...roleOptions]}
          />
          <Button
            onClick={() => {
              setKeyword('')
              setStatus('all')
              setRoleFilter('all')
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
            dataSource={scopedUsers}
            pagination={{ pageSize: 8 }}
            columns={[
              {
                title: 'User',
                dataIndex: 'display_name',
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{record.display_name}</Text>
                    <Text type="secondary">{record.email}</Text>
                  </Space>
                ),
              },
              {
                title: 'Role',
                dataIndex: 'role_name',
                render: (value) => <Tag>{value}</Tag>,
              },
              {
                title: 'Tenant',
                dataIndex: 'tenant_name',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (value) => <Tag color={statusColor[value] || 'default'}>{value}</Tag>,
              },
              {
                title: 'MFA',
                dataIndex: 'mfa_enabled',
                render: (value) => (value ? <Tag color="success">Enabled</Tag> : <Tag color="warning">Disabled</Tag>),
              },
              {
                title: 'Last Login',
                dataIndex: 'last_login_at',
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_, record) => (
                  <Space wrap>
                    <Button size="small" onClick={() => setSelectedUser(record)}>
                      详情
                    </Button>
                    <AdminDangerAction
                      actionKey="admin.users.disable"
                      label="禁用"
                      target={record.id}
                      description="禁用账号会立即中断该用户会话并阻断后续访问。"
                      riskLevel="high"
                      actor={actor}
                      disabled={!profile.capabilities.highRiskMutation && record.role_code === 'super_admin'}
                      disabledReason="当前角色无权禁用此账号"
                      onConfirm={async (payload) => {
                        message.success(`已提交禁用请求: ${payload.target_id}`)
                      }}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Card>

      <Drawer
        open={Boolean(selectedUser)}
        width={420}
        title="用户详情"
        onClose={() => setSelectedUser(null)}
        destroyOnClose
      >
        {selectedUser ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>{selectedUser.display_name}</Text>
            <Text>{selectedUser.email}</Text>
            <Text>Role: {selectedUser.role_name}</Text>
            <Text>Tenant: {selectedUser.tenant_name}</Text>
            <Text>Status: {selectedUser.status}</Text>
            <Text>MFA: {selectedUser.mfa_enabled ? 'Enabled' : 'Disabled'}</Text>
            <Card size="small" title="角色绑定与状态操作">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block>调整角色绑定（占位）</Button>
                <Button block>重置 MFA（占位）</Button>
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </AdminPageShell>
  )
}

export default UsersPage
