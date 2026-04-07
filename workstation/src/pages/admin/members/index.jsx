import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminAccessDenied from '../components/AdminAccessDenied'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import {
  addAdminMemberAffiliation,
  addAdminMemberSecondaryAffiliation,
  fetchAdminMembers,
  fetchAdminUsers,
  removeAdminMemberAffiliation,
  setAdminMemberPrimaryAffiliation,
  updateAdminMemberType,
} from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const anomalyTagMap = {
  no_primary_org: { color: 'error', text: '无主归属' },
  multi_primary_conflict: { color: 'warning', text: '多主归属冲突' },
  inactive_org_binding: { color: 'default', text: '归属节点已停用' },
}

const relationTypeOptions = [
  { label: '全部归属', value: 'all' },
  { label: '主归属', value: 'primary' },
  { label: '兼职归属', value: 'secondary' },
]

const MembersPage = () => {
  const { message } = App.useApp()
  const { profile, organizationId, actor } = useAdminOutlet()
  const [addForm] = Form.useForm()
  const [primaryForm] = Form.useForm()
  const [secondaryForm] = Form.useForm()

  const [members, setMembers] = useState([])
  const [organizationOptions, setOrganizationOptions] = useState([])
  const [memberTypeOptions, setMemberTypeOptions] = useState([])
  const [userOptions, setUserOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [orgFilter, setOrgFilter] = useState('all')
  const [relationFilter, setRelationFilter] = useState('all')
  const [memberTypeFilter, setMemberTypeFilter] = useState('all')
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberTypeDraft, setMemberTypeDraft] = useState('internal')
  const [addOpen, setAddOpen] = useState(false)
  const [primaryOpen, setPrimaryOpen] = useState(false)
  const [secondaryOpen, setSecondaryOpen] = useState(false)

  const loadMembers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const scope = {
        organizationScoped: profile.organizationScoped,
        organizationId,
      }
      const [memberPayload, userPayload] = await Promise.all([fetchAdminMembers(scope), fetchAdminUsers(scope)])
      setMembers(memberPayload.members)
      setOrganizationOptions(memberPayload.organizationOptions)
      setMemberTypeOptions(memberPayload.memberTypeOptions)
      setUserOptions(
        userPayload.users.map((item) => ({
          value: item.id,
          label: `${item.display_name || item.email} (${item.email})`,
          organization_id: item.organization_id || item.organization_name,
        }))
      )
      setSelectedMember((current) => {
        if (!current) return null
        return memberPayload.members.find((item) => item.id === current.id) || null
      })
    } catch (err) {
      const errorMessage = err?.message || '成员关系数据加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [message, profile.organizationScoped, organizationId])

  useEffect(() => {
    if (profile.capabilities.members) {
      loadMembers()
    }
  }, [loadMembers, profile.capabilities.members])

  useEffect(() => {
    if (!selectedMember) return
    setMemberTypeDraft(selectedMember.member_type || 'internal')
  }, [selectedMember])

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const orgMatch =
        orgFilter === 'all' ||
        member.primary_org_unit_id === orgFilter ||
        member.secondary_org_units.some((item) => item.id === orgFilter)
      const relationMatch =
        relationFilter === 'all' ||
        (relationFilter === 'primary' && Boolean(member.primary_org_unit_id)) ||
        (relationFilter === 'secondary' && member.secondary_org_units.length > 0)
      const memberTypeMatch = memberTypeFilter === 'all' || member.member_type === memberTypeFilter

      const keywordValue = keyword.trim().toLowerCase()
      const keywordMatch =
        !keywordValue ||
        member.email.toLowerCase().includes(keywordValue) ||
        member.display_name.toLowerCase().includes(keywordValue) ||
        member.primary_org_unit_name.toLowerCase().includes(keywordValue)

      return orgMatch && relationMatch && memberTypeMatch && keywordMatch
    })
  }, [keyword, memberTypeFilter, members, orgFilter, relationFilter])

  const orgOptionsBySelectedMember = useMemo(() => {
    if (!selectedMember) return organizationOptions
    return organizationOptions.filter(
      (item) =>
        item.organization_id === selectedMember.organization_id ||
        item.organization_id === selectedMember.organization_name
    )
  }, [organizationOptions, selectedMember])

  const userOptionsByScope = useMemo(() => {
    if (profile.organizationScoped) {
      return userOptions.filter((item) => item.organization_id === organizationId)
    }
    return userOptions
  }, [profile.organizationScoped, organizationId, userOptions])

  const handleResetFilter = useCallback(() => {
    setKeyword('')
    setOrgFilter('all')
    setRelationFilter('all')
    setMemberTypeFilter('all')
  }, [])

  const openAddModal = useCallback(() => {
    addForm.setFieldsValue({
      user_id: selectedMember?.user_id || undefined,
      org_unit_id: selectedMember?.primary_org_unit_id || undefined,
      relation_type: 'primary',
      member_type: selectedMember?.member_type || 'internal',
      is_manager: false,
    })
    setAddOpen(true)
  }, [addForm, selectedMember])

  const openPrimaryModal = useCallback(() => {
    if (!selectedMember) return
    primaryForm.setFieldsValue({
      org_unit_id: selectedMember.primary_org_unit_id || undefined,
    })
    setPrimaryOpen(true)
  }, [primaryForm, selectedMember])

  const openSecondaryModal = useCallback(() => {
    if (!selectedMember) return
    secondaryForm.setFieldsValue({
      org_unit_id: undefined,
      is_manager: false,
    })
    setSecondaryOpen(true)
  }, [secondaryForm, selectedMember])

  const handleAddAffiliation = useCallback(async () => {
    const values = await addForm.validateFields()
    const targetOrgNode = organizationOptions.find((item) => item.value === values.org_unit_id)
    const resolvedOrganizationId = targetOrgNode?.organization_id
    if (!resolvedOrganizationId) {
      message.error('未能识别所选节点的归属，请检查组织节点数据。')
      return
    }
    setSaving(true)
    try {
      await addAdminMemberAffiliation({
        userId: values.user_id,
        organizationId: resolvedOrganizationId,
        orgUnitId: values.org_unit_id,
        relationType: values.relation_type,
        memberType: values.member_type,
        isManager: values.is_manager,
      })
      message.success('成员归属已新增。')
      setAddOpen(false)
      await loadMembers()
    } catch (err) {
      message.error(err?.message || '新增成员归属失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }, [addForm, loadMembers, message, organizationOptions])

  const handleSetPrimary = useCallback(async () => {
    if (!selectedMember) return
    const values = await primaryForm.validateFields()
    setSaving(true)
    try {
      await setAdminMemberPrimaryAffiliation({
        userId: selectedMember.user_id,
        organizationId: selectedMember.organization_id,
        orgUnitId: values.org_unit_id,
      })
      message.success('主归属已更新。')
      setPrimaryOpen(false)
      await loadMembers()
    } catch (err) {
      message.error(err?.message || '主归属设置失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }, [loadMembers, message, primaryForm, selectedMember])

  const handleAddSecondary = useCallback(async () => {
    if (!selectedMember) return
    const values = await secondaryForm.validateFields()
    setSaving(true)
    try {
      await addAdminMemberSecondaryAffiliation({
        userId: selectedMember.user_id,
        organizationId: selectedMember.organization_id,
        orgUnitId: values.org_unit_id,
        isManager: values.is_manager,
      })
      message.success('兼职归属已新增。')
      setSecondaryOpen(false)
      await loadMembers()
    } catch (err) {
      message.error(err?.message || '新增兼职归属失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }, [loadMembers, message, secondaryForm, selectedMember])

  const handleUpdateMemberType = useCallback(async () => {
    if (!selectedMember) return
    setSaving(true)
    try {
      await updateAdminMemberType(selectedMember.user_id, selectedMember.organization_id, memberTypeDraft)
      message.success('成员类型已更新。')
      await loadMembers()
    } catch (err) {
      message.error(err?.message || '成员类型更新失败，请稍后重试。')
    } finally {
      setSaving(false)
    }
  }, [loadMembers, memberTypeDraft, message, selectedMember])

  if (!profile.capabilities.members) {
    return <AdminAccessDenied message="当前角色无权访问成员关系治理页。" />
  }

  return (
    <AdminPageShell
      title="Members"
      subtitle="成员关系治理页：管理主归属、兼职归属、成员类型和归属异常。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadMembers} loading={loading}>
            刷新
          </Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={openAddModal}>
            新增成员归属
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
            placeholder="关键词（账号 / 姓名 / 主归属）"
            allowClear
          />
          <Select
            value={orgFilter}
            onChange={setOrgFilter}
            options={[{ label: '全部组织节点', value: 'all' }, ...organizationOptions]}
          />
          <Select value={relationFilter} onChange={setRelationFilter} options={relationTypeOptions} />
          <Select
            value={memberTypeFilter}
            onChange={setMemberTypeFilter}
            options={[{ label: '全部成员类型', value: 'all' }, ...memberTypeOptions]}
          />
          <Button onClick={handleResetFilter}>重置筛选</Button>
        </div>
      </Card>

      <Card className={styles.sectionCard}>
        <div className={styles.tableWrap}>
          <Table
            rowKey="id"
            loading={loading}
            dataSource={filteredMembers}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: '账号摘要',
                dataIndex: 'display_name',
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{record.display_name}</Text>
                    <Text type="secondary">{record.email}</Text>
                  </Space>
                ),
              },
              {
                title: '主归属节点',
                dataIndex: 'primary_org_unit_name',
                render: (value) => value || <Text type="secondary">-</Text>,
              },
              {
                title: '兼职归属',
                dataIndex: 'secondary_org_units',
                render: (value) => <Tag>{value.length}</Tag>,
              },
              {
                title: '成员类型',
                dataIndex: 'member_type',
                render: (value) => <Tag color="geekblue">{value}</Tag>,
              },
              {
                title: '组织管理职责',
                dataIndex: 'management_roles',
                render: (value) =>
                  value.length > 0 ? (
                    value.map((item) => <Tag key={item}>{item}</Tag>)
                  ) : (
                    <Text type="secondary">-</Text>
                  ),
              },
              {
                title: '异常状态',
                dataIndex: 'anomaly_flags',
                render: (value) =>
                  value.length > 0 ? (
                    value.map((flag) => (
                      <Tag key={flag} color={anomalyTagMap[flag]?.color || 'default'}>
                        {anomalyTagMap[flag]?.text || flag}
                      </Tag>
                    ))
                  ) : (
                    <Tag color="success">正常</Tag>
                  ),
              },
              {
                title: '操作',
                key: 'actions',
                render: (_, record) => (
                  <Button size="small" onClick={() => setSelectedMember(record)}>
                    详情
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Card>

      <Drawer
        title="成员关系详情"
        open={Boolean(selectedMember)}
        width={520}
        onClose={() => setSelectedMember(null)}
        destroyOnClose
      >
        {selectedMember ? (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Card size="small" title="账号摘要">
              <Space direction="vertical" size={2}>
                <Text strong>{selectedMember.display_name}</Text>
                <Text>{selectedMember.email}</Text>
                <Text type="secondary">
                  组织：{selectedMember.organization_name || selectedMember.organization_id} | 项目关系：
                  {selectedMember.project_count}（拥有 {selectedMember.owned_project_count}）
                </Text>
              </Space>
            </Card>

            <Card
              size="small"
              title="归属关系"
              extra={
                <Space>
                  <Button size="small" onClick={openPrimaryModal}>
                    设置主归属
                  </Button>
                  <Button size="small" onClick={openSecondaryModal}>
                    新增兼职归属
                  </Button>
                </Space>
              }
            >
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={selectedMember.affiliations}
                locale={{ emptyText: '暂无归属记录' }}
                columns={[
                  {
                    title: '组织节点',
                    dataIndex: 'org_unit_name',
                  },
                  {
                    title: '归属类型',
                    dataIndex: 'relation_type',
                    render: (value) => <Tag color={value === 'primary' ? 'blue' : 'default'}>{value}</Tag>,
                  },
                  {
                    title: '节点状态',
                    dataIndex: 'status',
                    render: (value) => <Tag color={value === 'active' ? 'success' : 'default'}>{value}</Tag>,
                  },
                  {
                    title: '管理职责',
                    dataIndex: 'is_manager',
                    render: (value) => (value ? <Tag color="purple">manager</Tag> : '-'),
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    render: (_, affiliation) => (
                      <AdminDangerAction
                        actionKey="admin.members.remove_affiliation"
                        label="移除归属"
                        target={affiliation.id}
                        description="移除归属会影响该成员的组织可见范围和管理职责。"
                        riskLevel="high"
                        actor={actor}
                        disabled={selectedMember.affiliations.length <= 1 && affiliation.relation_type === 'primary'}
                        disabledReason="至少保留一条主归属，避免成员失去组织边界。"
                        onConfirm={async () => {
                          await removeAdminMemberAffiliation(affiliation.id)
                          await loadMembers()
                        }}
                      />
                    ),
                  },
                ]}
              />
            </Card>

            <Card size="small" title="成员类型">
              <Space style={{ width: '100%' }}>
                <Select
                  value={memberTypeDraft}
                  onChange={setMemberTypeDraft}
                  options={memberTypeOptions}
                  style={{ width: 220 }}
                />
                <Button type="primary" loading={saving} onClick={handleUpdateMemberType}>
                  调整成员类型
                </Button>
              </Space>
            </Card>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="新增成员归属"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={handleAddAffiliation}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={addForm} layout="vertical">
          <Form.Item label="账号" name="user_id" rules={[{ required: true, message: '请选择账号' }]}>
            <Select showSearch options={userOptionsByScope} />
          </Form.Item>
          <Form.Item label="组织节点" name="org_unit_id" rules={[{ required: true, message: '请选择组织节点' }]}>
            <Select options={organizationOptions} />
          </Form.Item>
          <Form.Item label="归属类型" name="relation_type" rules={[{ required: true, message: '请选择归属类型' }]}>
            <Select
              options={[
                { label: '主归属', value: 'primary' },
                { label: '兼职归属', value: 'secondary' },
              ]}
            />
          </Form.Item>
          <Form.Item label="成员类型" name="member_type" rules={[{ required: true, message: '请选择成员类型' }]}>
            <Select options={memberTypeOptions} />
          </Form.Item>
          <Form.Item label="组织管理职责" name="is_manager">
            <Select
              options={[
                { label: '普通成员', value: false },
                { label: '组织管理者', value: true },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置主归属"
        open={primaryOpen}
        onCancel={() => setPrimaryOpen(false)}
        onOk={handleSetPrimary}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={primaryForm} layout="vertical">
          <Form.Item label="主归属节点" name="org_unit_id" rules={[{ required: true, message: '请选择节点' }]}>
            <Select options={orgOptionsBySelectedMember} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增兼职归属"
        open={secondaryOpen}
        onCancel={() => setSecondaryOpen(false)}
        onOk={handleAddSecondary}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={secondaryForm} layout="vertical">
          <Form.Item label="兼职归属节点" name="org_unit_id" rules={[{ required: true, message: '请选择节点' }]}>
            <Select
              options={orgOptionsBySelectedMember.filter((item) => item.value !== selectedMember?.primary_org_unit_id)}
            />
          </Form.Item>
          <Form.Item label="组织管理职责" name="is_manager">
            <Select
              options={[
                { label: '普通成员', value: false },
                { label: '组织管理者', value: true },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AdminPageShell>
  )
}

export default MembersPage
