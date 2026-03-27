import React, { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  List,
  Avatar,
  Select,
  Button,
  Space,
  Typography,
  message,
  Empty,
  Divider,
  Input,
  Tooltip,
  Tag,
  Alert,
  Skeleton,
} from 'antd'
import { UserOutlined, DeleteOutlined, UserAddOutlined, SearchOutlined, CrownOutlined } from '@ant-design/icons'
import {
  getProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
  getUsers,
  addProjectMember,
} from '@src/service/api/projects'
import { authService } from '@/service/authService'

const { Text, Title } = Typography

const ROLE_OPTIONS = [
  { label: '项目所有者', value: 'Owner', color: '#faad14', desc: '拥有全部权限' },
  { label: '数据管理员', value: 'Data Admin', color: '#1677ff', desc: '可管理数据集' },
  { label: '数据分析师', value: 'Analyst', color: '#8b5cf6', desc: '可创建看板' },
  { label: '业务决策者', value: 'Viewer', color: '#6b7280', desc: '只读权限' },
]

const ROLE_MAP = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r]))

const RoleTag = ({ role }) => {
  const cfg = ROLE_MAP[role]
  if (!cfg) return <Tag>{role}</Tag>
  return (
    <Tag bordered={false} style={{ background: `${cfg.color}15`, color: cfg.color, fontSize: 11 }}>
      {role === 'Owner' && <CrownOutlined style={{ marginRight: 3 }} />}
      {cfg.label}
    </Tag>
  )
}

const getUserLabel = (user) => {
  if (!user) return '未知用户'
  if (typeof user === 'string') return user
  const full = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
  return full || user.email || user.id
}

const MembersModal = ({ open, onCancel, projectId, projectName }) => {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [userSearchLoading, setUserSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchText, setSearchText] = useState('')
  const [pendingRoles, setPendingRoles] = useState({}) // userId → role
  const [addingId, setAddingId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  const currentUser = authService.getState().user
  const currentMember = members.find((m) => {
    const uid = typeof m.directus_users_id === 'string' ? m.directus_users_id : m.directus_users_id?.id
    return uid === currentUser?.id
  })
  const isOwner = currentMember?.role === 'Owner'
  const ownerCount = members.filter((m) => m.role === 'Owner').length

  const fetchMembers = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await getProjectMembers(projectId)
      setMembers(data)
    } catch {
      message.error('获取成员列表失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const fetchUsers = useCallback(
    async (query = '') => {
      setUserSearchLoading(true)
      try {
        const users = await getUsers(query || undefined)
        const memberIds = new Set(
          members.map((m) => (typeof m.directus_users_id === 'string' ? m.directus_users_id : m.directus_users_id?.id))
        )
        setSearchResults(users.filter((u) => !memberIds.has(u.id)))
      } catch {
        // silently ignore
      } finally {
        setUserSearchLoading(false)
      }
    },
    [members]
  )

  useEffect(() => {
    if (open && projectId) {
      fetchMembers()
      setSearchText('')
      setPendingRoles({})
      setSearchResults([])
    }
  }, [open, projectId])

  useEffect(() => {
    if (open && members.length >= 0) fetchUsers()
  }, [open, members.length])

  const handleSearch = (e) => {
    const val = e.target.value
    setSearchText(val)
    fetchUsers(val)
  }

  const handleAddMember = async (userId) => {
    setAddingId(userId)
    try {
      await addProjectMember(projectId, userId, pendingRoles[userId] ?? 'Viewer')
      message.success('成员已添加')
      await fetchMembers()
      setSearchResults((prev) => prev.filter((u) => u.id !== userId))
    } catch {
      message.error('添加成员失败')
    } finally {
      setAddingId(null)
    }
  }

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await updateProjectMemberRole(memberId, newRole)
      message.success('角色已更新')
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))
    } catch {
      message.error('角色更新失败')
    }
  }

  const handleRemove = async (member) => {
    setRemovingId(member.id)
    try {
      await removeProjectMember(member.id)
      message.success('已移除成员')
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    } catch {
      message.error('移除失败')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <span>成员管理</span>
          {projectName && (
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              — {projectName}
            </Text>
          )}
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={660}
      destroyOnClose
    >
      {/* ── 添加新成员 ── */}
      <Title level={5} style={{ marginBottom: 12 }}>
        添加新成员
      </Title>

      {!isOwner && (
        <Alert
          type="warning"
          showIcon
          message="只有项目所有者可以管理成员"
          style={{ marginBottom: 12, borderRadius: 8 }}
        />
      )}

      <Input
        placeholder="输入邮箱或姓名搜索用户..."
        prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
        value={searchText}
        onChange={handleSearch}
        disabled={!isOwner}
        allowClear
      />

      {isOwner && (
        <div
          style={{
            marginTop: 8,
            maxHeight: 220,
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fff',
          }}
        >
          {userSearchLoading ? (
            <div style={{ padding: 16 }}>
              {[1, 2].map((i) => (
                <Skeleton
                  key={i}
                  active
                  avatar={{ size: 'small' }}
                  paragraph={{ rows: 0 }}
                  style={{ marginBottom: 8 }}
                />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {searchText ? '未找到匹配的用户' : '暂无可添加的用户'}
              </Text>
            </div>
          ) : (
            <List
              size="small"
              dataSource={searchResults}
              renderItem={(user) => (
                <List.Item
                  style={{ padding: '8px 16px' }}
                  actions={[
                    <Select
                      key="role"
                      size="small"
                      defaultValue="Viewer"
                      style={{ width: 120 }}
                      onChange={(val) => setPendingRoles((prev) => ({ ...prev, [user.id]: val }))}
                      options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                    />,
                    <Button
                      key="add"
                      type="primary"
                      size="small"
                      icon={<UserAddOutlined />}
                      loading={addingId === user.id}
                      onClick={() => handleAddMember(user.id)}
                    >
                      添加
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={28}
                        src={user.avatar}
                        icon={<UserOutlined />}
                        style={{ background: '#e6f4ff', color: '#1677ff' }}
                      />
                    }
                    title={
                      <Text style={{ fontSize: 13 }}>
                        {getUserLabel(user)}
                        {user.email && (
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                            {user.email}
                          </Text>
                        )}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      )}

      <Divider style={{ margin: '20px 0 16px' }} />

      {/* ── 当前成员 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Title level={5} style={{ margin: 0 }}>
          当前成员
        </Title>
        <Tag bordered={false} style={{ background: '#f1f5f9', color: '#64748b' }}>
          {members.length} 人
        </Tag>
      </div>

      <List
        loading={loading}
        dataSource={members}
        locale={{ emptyText: <Empty description="暂无成员" imageStyle={{ height: 40 }} /> }}
        renderItem={(item) => {
          const userField = item.directus_users_id
          const uid = typeof userField === 'string' ? userField : userField?.id
          const isCurrentUser = uid === currentUser?.id
          const isLastOwner = item.role === 'Owner' && ownerCount <= 1
          const canRemove = isOwner && !isLastOwner && !isCurrentUser

          return (
            <List.Item
              style={{ padding: '10px 4px' }}
              actions={[
                <Select
                  key="role"
                  size="small"
                  value={item.role}
                  style={{ width: 130 }}
                  onChange={(val) => handleRoleChange(item.id, val)}
                  disabled={!isOwner || isLastOwner}
                  options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                />,
                <Tooltip
                  key="remove"
                  title={
                    isLastOwner
                      ? '项目至少需要一名所有者'
                      : isCurrentUser
                        ? '不能移除自己'
                        : !isOwner
                          ? '无权限'
                          : '移除成员'
                  }
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={removingId === item.id}
                    disabled={!canRemove}
                    onClick={() => handleRemove(item)}
                  />
                </Tooltip>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    icon={<UserOutlined />}
                    src={userField?.avatar}
                    style={{
                      background: item.role === 'Owner' ? '#fff7e6' : '#e6f4ff',
                      color: item.role === 'Owner' ? '#faad14' : '#1677ff',
                    }}
                  />
                }
                title={
                  <Space size={6}>
                    <Text strong style={{ fontSize: 14 }}>
                      {getUserLabel(userField)}
                    </Text>
                    {isCurrentUser && (
                      <Tag color="blue" bordered={false} style={{ fontSize: 10, padding: '0 4px' }}>
                        我
                      </Tag>
                    )}
                    <RoleTag role={item.role} />
                  </Space>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {typeof userField === 'object' ? userField?.email : null}
                  </Text>
                }
              />
            </List.Item>
          )
        }}
      />
    </Modal>
  )
}

export default MembersModal
