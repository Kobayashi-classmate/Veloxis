import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Typography,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Select,
  Avatar,
  Tooltip,
  Empty,
  message,
  AutoComplete,
  Input,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  CrownOutlined,
  TeamOutlined,
  EditOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  getUsers,
  getProjectBySlug,
} from '@src/service/api/projects'
import { authService } from '@src/service/authService'

const { Title, Text } = Typography
const { Option } = Select

const ROLE_CONFIG = {
  Owner: { color: 'gold', icon: <CrownOutlined />, label: '所有者' },
  'Data Admin': { color: 'purple', icon: <TeamOutlined />, label: '数据管理员' },
  Analyst: { color: 'blue', icon: <UserOutlined />, label: '分析师' },
  Viewer: { color: 'default', icon: <UserOutlined />, label: '观察者' },
}

const ROLE_OPTIONS = ['Owner', 'Data Admin', 'Analyst', 'Viewer']

/** ─── 添加成员弹窗 ───────────────────────────────────────────────────────────── */
const AddMemberModal = ({ open, onClose, onAdded, projectId }) => {
  const [searchValue, setSearchValue] = useState('')
  const [userOptions, setUserOptions] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [role, setRole] = useState('Analyst')
  const [adding, setAdding] = useState(false)

  const handleSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setUserOptions([])
      return
    }
    try {
      const users = await getUsers(query)
      setUserOptions(
        users.map((u) => ({
          value: u.id,
          label: (
            <Space size={8}>
              <Avatar
                size={24}
                icon={<UserOutlined />}
                src={u.avatar ? `${window.__APP_CONFIG__?.APP_BASE_URL}/assets/${u.avatar}` : undefined}
              />
              <span>
                {u.first_name} {u.last_name}
              </span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {u.email}
              </Text>
            </Space>
          ),
          raw: u,
        }))
      )
    } catch {
      setUserOptions([])
    }
  }, [])

  const handleSelect = (value, option) => {
    setSelectedUser(option.raw)
    setSearchValue(`${option.raw.first_name ?? ''} ${option.raw.last_name ?? ''}`.trim() || option.raw.email)
  }

  const handleOk = async () => {
    if (!selectedUser) {
      message.warning('请先搜索并选择一位用户')
      return
    }
    setAdding(true)
    try {
      await addProjectMember(projectId, selectedUser.id, role)
      message.success(`已添加 ${selectedUser.first_name ?? selectedUser.email} 为 ${ROLE_CONFIG[role]?.label ?? role}`)
      onAdded()
      onClose()
      setSearchValue('')
      setSelectedUser(null)
      setRole('Analyst')
      setUserOptions([])
    } catch {
      message.error('添加成员失败，该用户可能已是成员')
    } finally {
      setAdding(false)
    }
  }

  const handleClose = () => {
    setSearchValue('')
    setSelectedUser(null)
    setRole('Analyst')
    setUserOptions([])
    onClose()
  }

  return (
    <Modal
      title="添加项目成员"
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      okText="添加"
      cancelText="取消"
      confirmLoading={adding}
      width={480}
      destroyOnHide
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            搜索用户（输入姓名或邮箱）
          </Text>
          <AutoComplete
            style={{ width: '100%' }}
            options={userOptions}
            value={searchValue}
            onSearch={(v) => {
              setSearchValue(v)
              handleSearch(v)
            }}
            onSelect={handleSelect}
            placeholder="输入至少 2 个字符进行搜索..."
            notFoundContent={
              searchValue.length >= 2 ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  未找到匹配用户
                </Text>
              ) : null
            }
          >
            <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} />
          </AutoComplete>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            分配角色
          </Text>
          <Select value={role} onChange={setRole} style={{ width: '100%' }}>
            {ROLE_OPTIONS.map((r) => (
              <Option key={r} value={r}>
                <Space size={6}>
                  {ROLE_CONFIG[r]?.icon}
                  {ROLE_CONFIG[r]?.label ?? r}
                </Space>
              </Option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  )
}

/** ─── 主组件 ────────────────────────────────────────────────────────────────── */
const Members = () => {
  const { slug } = useParams()

  /** slug → UUID 解析 */
  const [projectId, setProjectId] = useState(null)
  useEffect(() => {
    if (!slug) return
    getProjectBySlug(slug).then((p) => {
      if (p?.id) setProjectId(p.id)
    })
  }, [slug])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState({})

  const currentUserId = authService.getState().user?.id

  const fetchMembers = useCallback(
    async (silent = false) => {
      if (!projectId) return
      if (!silent) setLoading(true)
      try {
        const data = await getProjectMembers(projectId)
        setMembers(data ?? [])
      } catch {
        if (!silent) message.error('获取成员列表失败')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleRoleChange = async (memberId, role) => {
    setEditingRole((prev) => ({ ...prev, [memberId]: true }))
    try {
      await updateProjectMemberRole(memberId, role)
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)))
      message.success('角色已更新')
    } catch {
      message.error('更新角色失败')
    } finally {
      setEditingRole((prev) => ({ ...prev, [memberId]: false }))
    }
  }

  const handleRemove = (member) => {
    const user = member.directus_users_id
    const displayName =
      typeof user === 'object' ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.email : user
    Modal.confirm({
      title: `确认移除「${displayName}」？`,
      content: '移除后该成员将无法访问此项目。',
      okText: '移除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await removeProjectMember(member.id)
          message.success('成员已移除')
          fetchMembers(true)
        } catch {
          message.error('移除失败')
        }
      },
    })
  }

  const columns = [
    {
      title: '成员',
      key: 'member',
      render: (_, record) => {
        const user = typeof record.directus_users_id === 'object' ? record.directus_users_id : null
        const fullName = user
          ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || '未命名'
          : (record.directus_users_id ?? '—')
        const email = user?.email ?? ''
        const avatarSrc = user?.avatar ? `${window.__APP_CONFIG__?.APP_BASE_URL}/assets/${user.avatar}` : undefined

        return (
          <Space size={10}>
            <Avatar icon={<UserOutlined />} src={avatarSrc} style={{ background: '#e0e7ff', color: '#1677ff' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                {fullName}
                {user?.id === currentUserId && (
                  <Tag style={{ marginLeft: 8, fontSize: 10, padding: '0 4px' }} color="blue">
                    我
                  </Tag>
                )}
              </div>
              {email && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {email}
                </Text>
              )}
            </div>
          </Space>
        )
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 220,
      render: (role, record) => {
        const cfg = ROLE_CONFIG[role] ?? { color: 'default', label: role }
        const isOwner = role === 'Owner'
        const isSelf =
          typeof record.directus_users_id === 'object' ? record.directus_users_id?.id === currentUserId : false

        if (isOwner || isSelf) {
          return (
            <Tag color={cfg.color} icon={cfg.icon}>
              {cfg.label ?? role}
            </Tag>
          )
        }

        return (
          <Select
            value={role}
            onChange={(val) => handleRoleChange(record.id, val)}
            loading={!!editingRole[record.id]}
            style={{ width: 160 }}
            size="small"
            suffixIcon={<EditOutlined style={{ fontSize: 11 }} />}
          >
            {ROLE_OPTIONS.map((r) => (
              <Option key={r} value={r}>
                <Space size={6}>
                  {ROLE_CONFIG[r]?.icon}
                  {ROLE_CONFIG[r]?.label ?? r}
                </Space>
              </Option>
            ))}
          </Select>
        )
      },
    },
    {
      title: '加入时间',
      dataIndex: 'date_created',
      key: 'date_created',
      width: 180,
      render: (val, record) => {
        const joinText = val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '—'
        const updatedText = record.date_updated
          ? `角色最后更新：${dayjs(record.date_updated).format('YYYY-MM-DD HH:mm')}`
          : null
        if (!updatedText) return <span>{joinText}</span>
        return (
          <Tooltip title={updatedText}>
            <span style={{ cursor: 'default', borderBottom: '1px dashed #d1d5db' }}>{joinText}</span>
          </Tooltip>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => {
        const isOwner = record.role === 'Owner'
        const isSelf =
          typeof record.directus_users_id === 'object' ? record.directus_users_id?.id === currentUserId : false

        if (isOwner || isSelf) {
          return (
            <Tooltip title={isOwner ? '所有者不可移除' : '不能移除自己'}>
              <Button type="link" size="small" danger disabled icon={<DeleteOutlined />} />
            </Tooltip>
          )
        }

        return (
          <Tooltip title="移除成员">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleRemove(record)} />
          </Tooltip>
        )
      },
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/** 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            成员管理
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            管理项目成员与角色权限。Owner 拥有全部权限；Analyst 可读写数据；Viewer 仅查看
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          添加成员
        </Button>
      </div>

      {/** 成员列表 */}
      {!loading && members.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无成员，点击「添加成员」邀请协作者"
          style={{ marginTop: 80 }}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
            添加第一个成员
          </Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
        />
      )}

      {/** 添加成员弹窗 */}
      <AddMemberModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={() => fetchMembers(true)}
        projectId={projectId}
      />
    </div>
  )
}

export default Members
