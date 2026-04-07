import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminAccessDenied from '../components/AdminAccessDenied'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { createAdminUser, fetchAdminUsers, resetAdminUserMfa, updateAdminUser } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const statusColor = {
  active: 'success',
  locked: 'error',
  pending: 'warning',
}

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Locked', value: 'locked' },
  { label: 'Pending', value: 'pending' },
]

const isCanceledError = (error) => error?.message === 'canceled' || error?.code === 'ERR_CANCELED'

const UsersPage = () => {
  const { message } = App.useApp()
  const { profile, organizationId, actor } = useAdminOutlet()
  const requestIdRef = useRef(0)
  const [detailForm] = Form.useForm()
  const [createForm] = Form.useForm()

  const [users, setUsers] = useState([])
  const [roleOptions, setRoleOptions] = useState([])
  const [roleRecords, setRoleRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [detailSubmitting, setDetailSubmitting] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)

  const loadUsers = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setLoading(true)
    setError('')
    try {
      const response = await fetchAdminUsers({
        organizationScoped: profile.organizationScoped,
        organizationId,
      })
      if (requestId !== requestIdRef.current) return
      setUsers(response.users)
      setRoleOptions(response.roleOptions)
      setRoleRecords(response.roleRecords)
      setSelectedUser((current) => {
        if (!current) return current
        return response.users.find((item) => item.id === current.id) || null
      })
    } catch (err) {
      if (isCanceledError(err)) {
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
  }, [message, profile.organizationScoped, organizationId])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!selectedUser) return
    detailForm.setFieldsValue({
      email: selectedUser.email,
      first_name: selectedUser.first_name,
      last_name: selectedUser.last_name,
      role_id: selectedUser.role_id || undefined,
      status: selectedUser.status,
    })
  }, [detailForm, selectedUser])

  const getMutationBlockReason = useCallback(
    (user) => {
      if (!profile.capabilities.users) {
        return '当前角色无权管理用户。'
      }
      if (
        profile.organizationScoped &&
        organizationId &&
        user &&
        user.organization_id !== organizationId &&
        user.organization_name !== organizationId
      ) {
        return 'Organization Admin 只能管理本组织账号。'
      }
      if (user?.role_code === 'super_admin' && !profile.capabilities.highRiskMutation) {
        return '当前角色无权操作 Super Admin 账号。'
      }
      return ''
    },
    [profile.capabilities.highRiskMutation, profile.capabilities.users, profile.organizationScoped, organizationId]
  )

  const scopedUsers = useMemo(() => {
    const organizationScopedUsers = users.filter(
      (item) => item.organization_id === organizationId || item.organization_name === organizationId
    )
    let base = users
    if (profile.organizationScoped) {
      base = organizationScopedUsers
    }

    return base.filter((item) => {
      const keywordMatch =
        !keyword ||
        item.email.toLowerCase().includes(keyword.toLowerCase()) ||
        item.display_name.toLowerCase().includes(keyword.toLowerCase())
      const statusMatch = status === 'all' || item.status === status
      const roleMatch = roleFilter === 'all' || item.role_code === roleFilter
      return keywordMatch && statusMatch && roleMatch
    })
  }, [keyword, profile.organizationScoped, roleFilter, status, organizationId, users])

  const resetFilters = useCallback(() => {
    setKeyword('')
    setStatus('all')
    setRoleFilter('all')
  }, [])

  const handleToggleStatus = useCallback(
    async (record) => {
      const blockedReason = getMutationBlockReason(record)
      if (blockedReason) {
        message.warning(blockedReason)
        return
      }

      const nextStatus = record.status === 'locked' ? 'active' : 'locked'
      await updateAdminUser(record.id, { status: nextStatus })
      await loadUsers()
    },
    [getMutationBlockReason, loadUsers, message]
  )

  const handleSaveDetail = useCallback(async () => {
    if (!selectedUser) return
    const blockedReason = getMutationBlockReason(selectedUser)
    if (blockedReason) {
      message.warning(blockedReason)
      return
    }

    const values = await detailForm.validateFields()

    setDetailSubmitting(true)
    try {
      await updateAdminUser(selectedUser.id, {
        firstName: values.first_name,
        lastName: values.last_name,
        roleId: values.role_id,
        status: values.status,
      })
      message.success('用户信息已更新。')
      await loadUsers()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '用户更新失败，请稍后重试。')
      }
    } finally {
      setDetailSubmitting(false)
    }
  }, [detailForm, getMutationBlockReason, loadUsers, message, selectedUser])

  const handleResetMfa = useCallback(
    async (record) => {
      const blockedReason = getMutationBlockReason(record)
      if (blockedReason) {
        message.warning(blockedReason)
        return
      }
      await resetAdminUserMfa(record.id)
      await loadUsers()
    },
    [getMutationBlockReason, loadUsers, message]
  )

  const handleOpenCreate = useCallback(() => {
    setCreateOpen(true)
    createForm.setFieldsValue({
      first_name: '',
      last_name: '',
      status: 'active',
      role_id: roleRecords[0]?.id,
    })
  }, [createForm, roleRecords])

  const handleCreateUser = useCallback(async () => {
    const values = await createForm.validateFields()

    setCreateSubmitting(true)
    try {
      await createAdminUser({
        email: values.email,
        password: values.password,
        firstName: values.first_name,
        lastName: values.last_name,
        roleId: values.role_id,
        status: values.status,
      })
      message.success('用户创建成功。')
      setCreateOpen(false)
      createForm.resetFields()
      await loadUsers()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '用户创建失败，请稍后重试。')
      }
    } finally {
      setCreateSubmitting(false)
    }
  }, [createForm, loadUsers, message])

  if (!profile.capabilities.users) {
    return <AdminAccessDenied message="当前角色无权访问用户管理。" />
  }

  return (
    <AdminPageShell
      title="Users"
      subtitle="按组织与角色管理账号状态、角色绑定和账号安全。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>
            刷新
          </Button>
          <Button type="primary" onClick={handleOpenCreate}>
            新建用户
          </Button>
        </Space>
      }
    >
      {error ? (
        <Alert showIcon type="error" message="加载失败" description={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Card className={styles.sectionCard}>
        <div className={styles.filterBar}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="关键词（姓名 / 邮箱）"
            allowClear
          />
          <Select
            value={status}
            onChange={setStatus}
            options={[{ label: '全部状态', value: 'all' }, ...statusOptions]}
          />
          <Select
            value={roleFilter}
            onChange={setRoleFilter}
            options={[{ label: '全部角色', value: 'all' }, ...roleOptions]}
          />
          <Button onClick={resetFilters}>重置筛选</Button>
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
                title: 'Organization',
                dataIndex: 'organization_name',
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
                      actionKey={record.status === 'locked' ? 'admin.users.enable' : 'admin.users.disable'}
                      label={record.status === 'locked' ? '启用' : '禁用'}
                      target={record.id}
                      description={
                        record.status === 'locked'
                          ? '启用账号后用户可重新登录并访问授权资源。'
                          : '禁用账号会立即中断该用户会话并阻断后续访问。'
                      }
                      riskLevel="high"
                      actor={actor}
                      disabled={Boolean(getMutationBlockReason(record))}
                      disabledReason={getMutationBlockReason(record)}
                      onConfirm={async (payload) => {
                        await handleToggleStatus(record)
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
            <Text strong>{selectedUser.display_name || selectedUser.email}</Text>
            <Text type="secondary">{selectedUser.email}</Text>
            <Card size="small" title="基础信息">
              <Form form={detailForm} layout="vertical">
                <Form.Item label="Email" name="email">
                  <Input disabled />
                </Form.Item>
                <Form.Item label="First Name" name="first_name">
                  <Input />
                </Form.Item>
                <Form.Item label="Last Name" name="last_name">
                  <Input />
                </Form.Item>
                <Form.Item label="Role" name="role_id" rules={[{ required: true, message: '请选择角色' }]}>
                  <Select options={roleRecords.map((item) => ({ value: item.id, label: item.name }))} />
                </Form.Item>
                <Form.Item label="Status" name="status" rules={[{ required: true, message: '请选择状态' }]}>
                  <Select options={statusOptions} />
                </Form.Item>
                <Button type="primary" block loading={detailSubmitting} onClick={handleSaveDetail}>
                  保存变更
                </Button>
              </Form>
            </Card>
            <Card size="small" title="账号安全">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>MFA: {selectedUser.mfa_enabled ? 'Enabled' : 'Disabled'}</Text>
                <AdminDangerAction
                  actionKey="admin.users.reset_mfa"
                  label="重置 MFA"
                  target={selectedUser.id}
                  description="重置 MFA 后用户需要重新完成安全验证绑定。"
                  riskLevel="medium"
                  actor={actor}
                  disabled={Boolean(getMutationBlockReason(selectedUser))}
                  disabledReason={getMutationBlockReason(selectedUser)}
                  onConfirm={async () => {
                    await handleResetMfa(selectedUser)
                  }}
                />
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="新建用户"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreateUser}
        okText="创建用户"
        cancelText="取消"
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="Email" name="email" rules={[{ required: true, message: '请输入邮箱' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, message: '请输入初始密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item label="First Name" name="first_name">
            <Input />
          </Form.Item>
          <Form.Item label="Last Name" name="last_name">
            <Input />
          </Form.Item>
          <Form.Item label="Role" name="role_id" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={roleRecords.map((item) => ({ value: item.id, label: item.name }))} />
          </Form.Item>
          <Form.Item label="Status" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageShell>
  )
}

export default UsersPage
