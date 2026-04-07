import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
} from 'antd'
import {
  AlertOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  UpOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminAccessDenied from '../components/AdminAccessDenied'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import {
  addAdminMemberAffiliation,
  createAdminOrganization,
  createAdminOrganizationType,
  deactivateAdminOrganization,
  deleteAdminOrganizationType,
  deleteAdminOrganization,
  fetchAdminMembers,
  fetchAdminOrganizations,
  fetchAdminProjects,
  fetchAdminUsers,
  reorderAdminOrganizationTypes,
  setAdminOrganizationOwner,
  updateAdminOrganization,
  updateAdminOrganizationType,
} from '@src/service/api/admin'
import { buildCreateOrganizationPayload } from './createPayload'
import styles from './index.module.less'

const { Text } = Typography

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
]

const memberTypeOptions = [
  { label: 'Internal', value: 'internal' },
  { label: 'Contractor', value: 'contractor' },
  { label: 'Partner', value: 'partner' },
]

const statusColorMap = {
  active: 'success',
  inactive: 'default',
}

const buildNodeRiskFlags = (node) => {
  if (!node) return []
  const riskFlags = []
  const hasOperationalLoad =
    Number(node.member_count || 0) > 0 || Number(node.project_count || 0) > 0 || Number(node.children_count || 0) > 0

  if (node.status === 'inactive' && hasOperationalLoad) {
    riskFlags.push('节点已停用但仍承载成员/项目/子节点，可能影响归属与策略。')
  }
  if (!node.owner_user_id && hasOperationalLoad) {
    riskFlags.push('未设置负责人，责任归属不明确。')
  }
  if (node.project_count > 0 && node.member_count === 0) {
    riskFlags.push('存在挂靠项目但无成员，可能存在执行风险。')
  }

  return riskFlags
}

const toTypeOption = (record) => ({
  label: record.name,
  value: record.code,
  disabled: record.status !== 'active',
})

const buildNodeHierarchyLabel = (node, nodeMap) => {
  if (!node) return '-'
  const chain = []
  let cursor = node
  let guard = 0

  while (cursor && guard < 20) {
    chain.unshift(cursor.name || cursor.code || cursor.id)
    if (!cursor.parent_id) break
    cursor = nodeMap.get(cursor.parent_id)
    guard += 1
  }

  const organizationName = node.organization_name || node.organization_id || '-'
  const code = node.code || node.id || '-'
  const path = chain.join(' / ')
  return `${organizationName} ｜ ${path} (${code})`
}

const isNodeUsingOrganizationType = (node, typeRecord) => {
  if (!node || !typeRecord) return false
  const nodeType = String(node.node_type || '')
    .trim()
    .toLowerCase()
  const code = String(typeRecord.code || '')
    .trim()
    .toLowerCase()
  const name = String(typeRecord.name || '')
    .trim()
    .toLowerCase()
  return Boolean(nodeType && (nodeType === code || nodeType === name))
}

const isCanceledError = (error) => error?.message === 'canceled' || error?.code === 'ERR_CANCELED'

const OrganizationsPage = () => {
  const { message } = App.useApp()
  const { profile, organizationId, actor } = useAdminOutlet()
  const requestIdRef = useRef(0)
  const [createForm] = Form.useForm()
  const [editForm] = Form.useForm()
  const [ownerForm] = Form.useForm()
  const [addMemberForm] = Form.useForm()
  const [typeForm] = Form.useForm()
  const editParentId = Form.useWatch('parent_id', editForm)

  const [nodes, setNodes] = useState([])
  const [organizationOptions, setOrganizationOptions] = useState([])
  const [organizationTypeRecords, setOrganizationTypeRecords] = useState([])
  const [organizationTypeOptions, setOrganizationTypeOptions] = useState([])
  const [userOptions, setUserOptions] = useState([])
  const [memberRecords, setMemberRecords] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [typeSaving, setTypeSaving] = useState(false)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [riskOnly, setRiskOnly] = useState(false)
  const [viewMode, setViewMode] = useState('tree')
  const [selectedNodeId, setSelectedNodeId] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addMemberUserKeyword, setAddMemberUserKeyword] = useState('')
  const [typeManageOpen, setTypeManageOpen] = useState(false)
  const [typeKeyword, setTypeKeyword] = useState('')
  const [typeStatusFilter, setTypeStatusFilter] = useState('all')
  const [riskCenterOpen, setRiskCenterOpen] = useState(false)
  const [insightOpen, setInsightOpen] = useState(false)

  const scopeParams = useMemo(
    () => ({
      organizationScoped: profile.organizationScoped,
      organizationId,
    }),
    [profile.organizationScoped, organizationId]
  )

  const loadOrganizations = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setLoading(true)
    setError('')
    try {
      const [orgPayload, usersPayload, projectRows] = await Promise.all([
        fetchAdminOrganizations(scopeParams),
        fetchAdminUsers(scopeParams),
        fetchAdminProjects(scopeParams),
      ])
      const memberPayload = await fetchAdminMembers(scopeParams, {
        usersPayload,
        orgPayload,
        projects: projectRows,
      })

      const normalizedTypeRows = orgPayload.organizationTypeRecords.length
        ? orgPayload.organizationTypeRecords
        : orgPayload.organizationTypeOptions.map((item, index) => ({
            id: `${item.code}_${index}`,
            code: item.code,
            name: item.label,
            status: item.disabled ? 'inactive' : 'active',
            sort_order: index + 1,
          }))

      if (requestId !== requestIdRef.current) return

      setNodes(orgPayload.nodes)
      setOrganizationOptions(orgPayload.organizationOptions)
      setOrganizationTypeRecords(normalizedTypeRows)
      setOrganizationTypeOptions(
        orgPayload.organizationTypeOptions.length
          ? orgPayload.organizationTypeOptions
          : normalizedTypeRows.map(toTypeOption)
      )
      setMemberRecords(memberPayload.members)
      setProjects(projectRows)
      setUserOptions(
        usersPayload.users.map((item) => ({
          value: item.id,
          label: `${item.display_name || item.email} (${item.email})`,
          organizationId: item.organization_id || item.organization_name,
          organizationName: item.organization_name || item.organization_id,
        }))
      )
      setSelectedNodeId((current) => {
        if (current && orgPayload.nodes.some((item) => item.id === current)) {
          return current
        }
        return orgPayload.nodes[0]?.id || ''
      })
    } catch (err) {
      if (isCanceledError(err)) {
        return
      }
      if (requestId !== requestIdRef.current) return
      const errorMessage = err?.message || '组织数据加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [message, scopeParams])

  useEffect(() => {
    if (profile.capabilities.organizations) {
      loadOrganizations()
    }
  }, [loadOrganizations, profile.capabilities.organizations])

  const filteredNodes = useMemo(() => {
    return nodes.filter((item) => {
      const keywordValue = keyword.trim().toLowerCase()
      const keywordMatch =
        !keywordValue ||
        item.name.toLowerCase().includes(keywordValue) ||
        item.code.toLowerCase().includes(keywordValue)
      const riskMatch = !riskOnly || buildNodeRiskFlags(item).length > 0
      return keywordMatch && riskMatch
    })
  }, [keyword, nodes, riskOnly])

  useEffect(() => {
    if (!filteredNodes.length) {
      setSelectedNodeId('')
      return
    }
    if (!filteredNodes.some((item) => item.id === selectedNodeId)) {
      setSelectedNodeId(filteredNodes[0].id)
    }
  }, [filteredNodes, selectedNodeId])

  const nodeById = useMemo(() => new Map(filteredNodes.map((item) => [item.id, item])), [filteredNodes])
  const fullNodeById = useMemo(() => new Map(nodes.map((item) => [item.id, item])), [nodes])
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : null

  const governanceOverview = useMemo(() => {
    const total = nodes.length
    const active = nodes.filter((item) => item.status === 'active').length
    const inactive = nodes.filter((item) => item.status === 'inactive').length
    const rootCount = nodes.filter((item) => !item.parent_id).length
    const highRisk = nodes.filter((item) => buildNodeRiskFlags(item).length > 0).length

    return {
      total,
      active,
      inactive,
      rootCount,
      highRisk,
    }
  }, [nodes])

  const treeData = useMemo(() => {
    const nodeMap = new Map()
    filteredNodes.forEach((item) => {
      nodeMap.set(item.id, {
        key: item.id,
        title: (
          <div className={styles.treeNodeTitle}>
            <div className={styles.treeNodeName}>{item.name}</div>
            <Space size={4} wrap>
              <Tag>{item.code}</Tag>
              <Tag color={statusColorMap[item.status] || 'default'}>{item.status}</Tag>
              <Tag>{item.member_count} 人</Tag>
            </Space>
          </div>
        ),
        children: [],
      })
    })

    const roots = []
    filteredNodes.forEach((item) => {
      const current = nodeMap.get(item.id)
      if (item.parent_id && nodeMap.has(item.parent_id)) {
        nodeMap.get(item.parent_id).children.push(current)
      } else {
        roots.push(current)
      }
    })
    return roots
  }, [filteredNodes])

  const scopedNodeUserOptions = useMemo(() => {
    if (!selectedNode) return userOptions
    const filtered = userOptions.filter(
      (item) =>
        item.organizationId === selectedNode.organization_id ||
        item.organizationId === selectedNode.organization_name ||
        item.organizationName === selectedNode.organization_id ||
        item.organizationName === selectedNode.organization_name
    )
    return filtered.length ? filtered : userOptions
  }, [selectedNode, userOptions])

  const selectedNodeMemberUserIdSet = useMemo(() => {
    if (!selectedNode) return new Set()
    const idSet = new Set()
    memberRecords.forEach((member) => {
      if (!member?.user_id) return
      if (member.affiliations.some((affiliation) => affiliation.org_unit_id === selectedNode.id)) {
        idSet.add(member.user_id)
      }
    })
    return idSet
  }, [memberRecords, selectedNode])

  const addMemberSearchOptions = useMemo(() => {
    const keywordValue = addMemberUserKeyword.trim().toLowerCase()
    if (!keywordValue) return []
    return scopedNodeUserOptions
      .filter(
        (item) =>
          !selectedNodeMemberUserIdSet.has(item.value) && (item.label || '').toLowerCase().includes(keywordValue)
      )
      .slice(0, 30)
  }, [addMemberUserKeyword, scopedNodeUserOptions, selectedNodeMemberUserIdSet])

  const organizationTypeUsageMap = useMemo(() => {
    const usageMap = new Map()
    organizationTypeRecords.forEach((record) => {
      const count = nodes.filter((node) => isNodeUsingOrganizationType(node, record)).length
      usageMap.set(record.id, count)
    })
    return usageMap
  }, [nodes, organizationTypeRecords])

  const typeOverview = useMemo(() => {
    const total = organizationTypeRecords.length
    const active = organizationTypeRecords.filter((item) => item.status === 'active').length
    const inactive = total - active
    const inUse = organizationTypeRecords.filter((item) => (organizationTypeUsageMap.get(item.id) || 0) > 0).length
    return {
      total,
      active,
      inactive,
      inUse,
    }
  }, [organizationTypeRecords, organizationTypeUsageMap])

  const filteredTypeRecords = useMemo(() => {
    const normalizedKeyword = typeKeyword.trim().toLowerCase()
    return organizationTypeRecords.filter((item) => {
      const statusMatch = typeStatusFilter === 'all' ? true : item.status === typeStatusFilter
      const keywordMatch =
        !normalizedKeyword ||
        String(item.name || '')
          .toLowerCase()
          .includes(normalizedKeyword) ||
        String(item.code || '')
          .toLowerCase()
          .includes(normalizedKeyword)
      return statusMatch && keywordMatch
    })
  }, [organizationTypeRecords, typeKeyword, typeStatusFilter])

  const typeRecordIndexMap = useMemo(() => {
    return new Map(organizationTypeRecords.map((item, index) => [item.id, index]))
  }, [organizationTypeRecords])

  const projectSummary = useMemo(() => {
    if (!selectedNode) return []
    return projects.filter((item) => item.owner_org_unit_id === selectedNode.id).slice(0, 8)
  }, [projects, selectedNode])

  const nodeMemberRecords = useMemo(() => {
    if (!selectedNode) return []
    return memberRecords.filter((member) =>
      member.affiliations.some((affiliation) => affiliation.org_unit_id === selectedNode.id)
    )
  }, [memberRecords, selectedNode])

  const memberSummary = useMemo(() => nodeMemberRecords.slice(0, 12), [nodeMemberRecords])

  const ownerMemberOptions = useMemo(() => {
    const map = new Map()
    nodeMemberRecords.forEach((member) => {
      if (!member.user_id) return
      if (map.has(member.user_id)) return
      map.set(member.user_id, {
        value: member.user_id,
        label: `${member.display_name || member.email} (${member.email})`,
      })
    })
    return Array.from(map.values())
  }, [nodeMemberRecords])

  const selectedNodeRiskFlags = useMemo(() => buildNodeRiskFlags(selectedNode), [selectedNode])
  const riskNodeRows = useMemo(() => {
    return filteredNodes
      .map((item) => ({
        ...item,
        riskFlags: buildNodeRiskFlags(item),
      }))
      .filter((item) => item.riskFlags.length > 0)
      .sort((a, b) => b.riskFlags.length - a.riskFlags.length)
  }, [filteredNodes])

  const activeNodeTypeOptions = useMemo(() => {
    const base = organizationTypeOptions.length ? organizationTypeOptions : organizationTypeRecords.map(toTypeOption)
    return base.filter((item) => !item.disabled)
  }, [organizationTypeOptions, organizationTypeRecords])

  const editNodeTypeOptions = useMemo(() => {
    const base = organizationTypeOptions.length ? organizationTypeOptions : organizationTypeRecords.map(toTypeOption)
    if (!selectedNode?.node_type) return base
    if (base.some((item) => item.value === selectedNode.node_type)) {
      return base
    }
    return [{ label: selectedNode.node_type, value: selectedNode.node_type }, ...base]
  }, [organizationTypeOptions, organizationTypeRecords, selectedNode])

  const createParentOptions = useMemo(() => {
    const toReadableOption = (item) => {
      const candidateNode = fullNodeById.get(item.value)
      return {
        ...item,
        label: buildNodeHierarchyLabel(candidateNode, fullNodeById),
      }
    }
    return organizationOptions.map(toReadableOption)
  }, [organizationOptions, fullNodeById])

  const nodeChildrenMap = useMemo(() => {
    const childrenMap = new Map()
    nodes.forEach((item) => {
      if (!item.parent_id) return
      const children = childrenMap.get(item.parent_id) || []
      children.push(item.id)
      childrenMap.set(item.parent_id, children)
    })
    return childrenMap
  }, [nodes])

  const selectedNodeDescendantIds = useMemo(() => {
    if (!selectedNode) return new Set()
    const result = new Set()
    const queue = [...(nodeChildrenMap.get(selectedNode.id) || [])]
    while (queue.length) {
      const nextId = queue.shift()
      if (!nextId || result.has(nextId)) continue
      result.add(nextId)
      const nextChildren = nodeChildrenMap.get(nextId) || []
      queue.push(...nextChildren)
    }
    return result
  }, [nodeChildrenMap, selectedNode])

  const selectedNodeSubtreeIds = useMemo(() => {
    if (!selectedNode) return new Set()
    return new Set([selectedNode.id, ...Array.from(selectedNodeDescendantIds)])
  }, [selectedNode, selectedNodeDescendantIds])

  const selectedNodeImpactMemberCount = useMemo(() => {
    if (!selectedNodeSubtreeIds.size) return 0
    const memberIdSet = new Set()
    memberRecords.forEach((member) => {
      if (member.affiliations.some((affiliation) => selectedNodeSubtreeIds.has(affiliation.org_unit_id))) {
        memberIdSet.add(member.user_id || member.id)
      }
    })
    return memberIdSet.size
  }, [memberRecords, selectedNodeSubtreeIds])

  const editParentOptions = useMemo(() => {
    if (!selectedNode) return []
    return organizationOptions
      .filter((item) => {
        const candidateId = item.value
        if (!candidateId) return false
        if (candidateId === selectedNode.id || selectedNodeDescendantIds.has(candidateId)) {
          return false
        }
        return fullNodeById.has(candidateId)
      })
      .map((item) => {
        const candidateNode = fullNodeById.get(item.value)
        return {
          ...item,
          label: buildNodeHierarchyLabel(candidateNode, fullNodeById),
        }
      })
  }, [fullNodeById, organizationOptions, selectedNode, selectedNodeDescendantIds])

  const editParentInvalid = useMemo(() => {
    if (!selectedNode || !editParentId) return false
    if (editParentId === selectedNode.id || selectedNodeDescendantIds.has(editParentId)) {
      return true
    }
    const parentNode = fullNodeById.get(editParentId)
    return !parentNode
  }, [editParentId, fullNodeById, selectedNode, selectedNodeDescendantIds])

  const editSubmitDisabled = useMemo(() => saving || editParentInvalid, [saving, editParentInvalid])

  const resetFilter = useCallback(() => {
    setKeyword('')
    setRiskOnly(false)
  }, [])

  const openCreateModal = useCallback(() => {
    createForm.setFieldsValue({
      name: '',
      code: '',
      node_type: activeNodeTypeOptions[0]?.value,
      parent_id: selectedNode?.id || undefined,
      status: 'active',
    })
    setCreateOpen(true)
  }, [createForm, activeNodeTypeOptions, selectedNode])

  const openEditModal = useCallback(() => {
    if (!selectedNode) return
    editForm.setFieldsValue({
      name: selectedNode.name,
      code: selectedNode.code,
      node_type: selectedNode.node_type,
      parent_id: selectedNode.parent_id || undefined,
      status: selectedNode.status,
    })
    setEditOpen(true)
  }, [editForm, selectedNode])

  const openOwnerModal = useCallback(() => {
    if (!selectedNode) return
    if (!ownerMemberOptions.length) {
      message.warning('当前节点暂无已添加成员，请先通过“添加成员”将账号绑定到该节点。')
      return
    }
    ownerForm.setFieldsValue({
      owner_user_id: selectedNode.owner_user_id || undefined,
    })
    setOwnerOpen(true)
  }, [message, ownerForm, ownerMemberOptions.length, selectedNode])

  const openAddMemberModal = useCallback(() => {
    if (!selectedNode) return
    setAddMemberUserKeyword('')
    addMemberForm.setFieldsValue({
      user_id: undefined,
      relation_type: 'primary',
      member_type: 'internal',
      is_manager: false,
    })
    setAddMemberOpen(true)
  }, [addMemberForm, selectedNode])

  const openInsightDrawer = useCallback(() => {
    if (!selectedNode) {
      message.warning('请先选择一个组织节点。')
      return
    }
    setInsightOpen(true)
  }, [message, selectedNode])

  const handleCreate = useCallback(async () => {
    const values = await createForm.validateFields()
    const payload = buildCreateOrganizationPayload({
      values,
      fullNodeById,
    })

    if (!payload.parentNodeFound) {
      message.error('所选上级节点不存在，请刷新后重试。')
      return
    }

    setSaving(true)
    try {
      await createAdminOrganization({
        organizationId: payload.organizationId,
        name: payload.name,
        code: payload.code,
        nodeType: payload.nodeType,
        parentId: payload.parentId,
        status: payload.status,
      })
      message.success(values.parent_id ? '组织节点已作为所选上级的直接子级创建。' : '顶级组织节点创建成功。')
      setCreateOpen(false)
      await loadOrganizations()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '创建失败，请稍后重试。')
      }
    } finally {
      setSaving(false)
    }
  }, [createForm, fullNodeById, loadOrganizations, message])

  const handleUpdate = useCallback(async () => {
    if (!selectedNode) return
    const values = await editForm.validateFields()
    const parentNode = values.parent_id ? fullNodeById.get(values.parent_id) : null

    if (values.parent_id) {
      if (!parentNode) {
        message.error('所选上级节点不存在，请刷新后重试。')
        return
      }
      if (values.parent_id === selectedNode.id || selectedNodeDescendantIds.has(values.parent_id)) {
        message.error('不能将节点挂接到自身或其子孙节点。')
        return
      }
    }

    setSaving(true)
    try {
      await updateAdminOrganization(selectedNode.id, {
        name: values.name,
        code: values.code,
        nodeType: values.node_type,
        parentId: values.parent_id,
        status: values.status,
      })
      message.success('组织节点已更新。')
      setEditOpen(false)
      await loadOrganizations()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '更新失败，请稍后重试。')
      }
    } finally {
      setSaving(false)
    }
  }, [
    editForm,
    fullNodeById,
    loadOrganizations,
    message,
    selectedNode,
    selectedNodeDescendantIds,
  ])

  const handleSetOwner = useCallback(async () => {
    if (!selectedNode) return
    const values = await ownerForm.validateFields()
    setSaving(true)
    try {
      await setAdminOrganizationOwner(selectedNode.id, values.owner_user_id)
      message.success('负责人已更新。')
      setOwnerOpen(false)
      await loadOrganizations()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '负责人更新失败，请稍后重试。')
      }
    } finally {
      setSaving(false)
    }
  }, [loadOrganizations, message, ownerForm, selectedNode])

  const handleAddMemberToNode = useCallback(async () => {
    if (!selectedNode) return
    const values = await addMemberForm.validateFields()
    if (nodeMemberRecords.some((member) => member.user_id === values.user_id)) {
      message.warning('该成员已添加到当前节点，请勿重复添加。')
      return
    }
    const organizationScopeId = selectedNode.organization_id || selectedNode.organization_name
    if (!organizationScopeId) {
      message.error('当前节点缺少组织归属，无法新增成员。')
      return
    }

    setSaving(true)
    try {
      await addAdminMemberAffiliation({
        userId: values.user_id,
        organizationId: organizationScopeId,
        orgUnitId: selectedNode.id,
        relationType: values.relation_type,
        memberType: values.member_type,
        isManager: values.is_manager,
      })
      message.success('成员已添加到当前节点。')
      setAddMemberOpen(false)
      await loadOrganizations()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '新增成员失败，请稍后重试。')
      }
    } finally {
      setSaving(false)
    }
  }, [addMemberForm, loadOrganizations, message, nodeMemberRecords, selectedNode])

  const handleCreateType = useCallback(async () => {
    const values = await typeForm.validateFields()
    setTypeSaving(true)
    try {
      await createAdminOrganizationType({
        name: values.name,
        code: values.code,
        status: 'active',
      })
      typeForm.resetFields()
      message.success('组织类型已新增。')
      await loadOrganizations()
    } catch (err) {
      if (!isCanceledError(err)) {
        message.error(err?.message || '组织类型新增失败。')
      }
    } finally {
      setTypeSaving(false)
    }
  }, [loadOrganizations, message, typeForm])

  const handleToggleTypeStatus = useCallback(
    async (record) => {
      setTypeSaving(true)
      try {
        await updateAdminOrganizationType(record.id, {
          status: record.status === 'active' ? 'inactive' : 'active',
        })
        message.success(record.status === 'active' ? '组织类型已停用。' : '组织类型已启用。')
        await loadOrganizations()
      } catch (err) {
        if (!isCanceledError(err)) {
          message.error(err?.message || '组织类型状态更新失败。')
        }
      } finally {
        setTypeSaving(false)
      }
    },
    [loadOrganizations, message]
  )

  const handleMoveType = useCallback(
    async (record, direction) => {
      const currentIndex = organizationTypeRecords.findIndex((item) => item.id === record.id)
      if (currentIndex < 0) return
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (swapIndex < 0 || swapIndex >= organizationTypeRecords.length) return

      const nextRows = [...organizationTypeRecords]
      ;[nextRows[currentIndex], nextRows[swapIndex]] = [nextRows[swapIndex], nextRows[currentIndex]]
      const orderedIds = nextRows.map((item) => item.id)

      setTypeSaving(true)
      try {
        await reorderAdminOrganizationTypes(orderedIds)
        message.success('组织类型排序已更新。')
        await loadOrganizations()
      } catch (err) {
        if (!isCanceledError(err)) {
          message.error(err?.message || '组织类型排序更新失败。')
        }
      } finally {
        setTypeSaving(false)
      }
    },
    [loadOrganizations, message, organizationTypeRecords]
  )

  const handleDeleteType = useCallback(
    (record) => {
      const usageCount = organizationTypeUsageMap.get(record.id) || 0

      if (usageCount > 0) {
        Modal.warning({
          title: '无法删除组织类型',
          content: `当前有 ${usageCount} 个组织节点正在使用类型「${record.name}」，请先将这些节点切换为其他类型后再删除。`,
          okText: '我知道了',
        })
        return
      }

      Modal.confirm({
        title: '确认删除组织类型',
        content: `将删除类型「${record.name} (${record.code})」，该操作不可恢复。`,
        okText: '确认删除',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          setTypeSaving(true)
          try {
            await deleteAdminOrganizationType(record.id)
            message.success('组织类型已删除。')
            await loadOrganizations()
          } catch (err) {
            if (!isCanceledError(err)) {
              message.error(err?.message || '组织类型删除失败。')
            }
          } finally {
            setTypeSaving(false)
          }
        },
      })
    },
    [deleteAdminOrganizationType, loadOrganizations, message, organizationTypeUsageMap]
  )

  if (!profile.capabilities.organizations) {
    return <AdminAccessDenied message="当前角色无权访问组织管理。" />
  }

  return (
    <AdminPageShell
      title="组织治理"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      hideHeader
    >
      {error ? <Alert showIcon type="error" message="加载失败" description={error} /> : null}

      <div className={styles.pageStack}>
        <Card className={styles.heroCard} bordered={false}>
          <div className={styles.heroRow}>
            <div className={styles.heroInfo}>
              <Text className={styles.heroEyebrow}>Org Control Center</Text>
              <div className={styles.heroTitle}>组织治理指挥舱</div>
              <Text className={styles.heroSubtitle}>将高频操作、风险处置与节点编排整合到单一工作流。</Text>
            </div>
            <Space wrap className={styles.heroActions}>
              <Button icon={<ReloadOutlined />} onClick={loadOrganizations} loading={loading}>
                刷新数据
              </Button>
              <Button icon={<AlertOutlined />} onClick={() => setRiskCenterOpen(true)}>
                风险中心 ({riskNodeRows.length})
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => {
                  setTypeKeyword('')
                  setTypeStatusFilter('all')
                  setTypeManageOpen(true)
                }}
              >
                类型配置
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                新建节点
              </Button>
            </Space>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.heroStatItem}>
              <Text className={styles.heroStatLabel}>组织节点</Text>
              <div className={styles.heroStatValue}>{governanceOverview.total}</div>
            </div>
            <div className={styles.heroStatItem}>
              <Text className={styles.heroStatLabel}>活跃节点</Text>
              <div className={styles.heroStatValue}>{governanceOverview.active}</div>
            </div>
            <div className={styles.heroStatItem}>
              <Text className={styles.heroStatLabel}>停用节点</Text>
              <div className={styles.heroStatValue}>{governanceOverview.inactive}</div>
            </div>
            <div className={styles.heroStatItem}>
              <Text className={styles.heroStatLabel}>根节点</Text>
              <div className={styles.heroStatValue}>{governanceOverview.rootCount}</div>
            </div>
            <div className={`${styles.heroStatItem} ${styles.heroStatDanger}`}>
              <Text className={styles.heroStatLabel}>风险节点</Text>
              <div className={styles.heroStatValue}>{governanceOverview.highRisk}</div>
            </div>
          </div>
        </Card>

        <Card className={styles.filterCard}>
          <div className={styles.filterGrid}>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索组织名称 / 编码"
              allowClear
            />
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { label: '树形视图', value: 'tree' },
                { label: '列表视图', value: 'list' },
              ]}
            />
            <Button type={riskOnly ? 'primary' : 'default'} onClick={() => setRiskOnly((value) => !value)}>
              {riskOnly ? '仅看风险中' : '仅看风险'}
            </Button>
            <Button onClick={resetFilter}>重置筛选</Button>
          </div>
        </Card>

        <div className={styles.workspaceGrid}>
          <Card
            className={styles.sectionCard}
            title="组织结构导航"
            extra={<Tag>{viewMode === 'tree' ? 'TREE' : 'LIST'}</Tag>}
          >
            <div className={styles.structurePanel}>
              {viewMode === 'tree' ? (
                <div className={styles.treeWrap}>
                  <Tree
                    showLine
                    selectedKeys={selectedNodeId ? [selectedNodeId] : []}
                    treeData={treeData}
                    onSelect={(keys) => setSelectedNodeId(keys?.[0] || '')}
                    defaultExpandAll
                  />
                </div>
              ) : (
                <div className={styles.listTable}>
                  <Table
                    size="small"
                    rowKey="id"
                    loading={loading}
                    dataSource={filteredNodes}
                    pagination={{ pageSize: 8 }}
                    rowClassName={(record) => (record.id === selectedNodeId ? 'admin-org-row-active' : '')}
                    onRow={(record) => ({
                      onClick: () => setSelectedNodeId(record.id),
                    })}
                    columns={[
                      {
                        title: '组织节点',
                        dataIndex: 'name',
                        render: (_, record) => (
                          <Space direction="vertical" size={0}>
                            <Text strong>{record.name}</Text>
                            <Text type="secondary">{record.code}</Text>
                          </Space>
                        ),
                      },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        width: 92,
                        render: (value) => <Tag color={statusColorMap[value] || 'default'}>{value}</Tag>,
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          </Card>

          <Card
            className={`${styles.sectionCard} ${styles.workbenchCard}`}
            title={selectedNode ? `节点工作台 · ${selectedNode.name}` : '节点工作台'}
            extra={
              <Space wrap size={6}>
                <Button size="small" onClick={openEditModal} disabled={!selectedNode}>
                  编辑节点
                </Button>
                <Button size="small" icon={<PlusOutlined />} onClick={openAddMemberModal} disabled={!selectedNode}>
                  添加成员
                </Button>
                <Button size="small" icon={<UserSwitchOutlined />} onClick={openOwnerModal} disabled={!selectedNode}>
                  设置负责人
                </Button>
                <Button size="small" onClick={openInsightDrawer} disabled={!selectedNode}>
                  节点情报
                </Button>
              </Space>
            }
          >
            {!selectedNode ? (
              <div className={styles.emptyWrap}>
                <Empty description="请先在左侧选择组织节点" />
              </div>
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div className={styles.nodeMetaBar}>
                  <Space size={8} wrap>
                    <Tag color="blue">{selectedNode.node_type || '-'}</Tag>
                    <Tag color={statusColorMap[selectedNode.status] || 'default'}>{selectedNode.status}</Tag>
                    <Tag>{selectedNode.organization_name || '-'}</Tag>
                  </Space>
                </div>

                {selectedNodeRiskFlags.length ? (
                  <Alert
                    showIcon
                    type="warning"
                    message="当前节点存在风险提示"
                    icon={<AlertOutlined />}
                    description={
                      <Space direction="vertical" size={2}>
                        {selectedNodeRiskFlags.map((item) => (
                          <Text key={item}>{item}</Text>
                        ))}
                      </Space>
                    }
                  />
                ) : null}

                <div className={styles.quickStatsGrid}>
                  <div className={styles.quickStatItem}>
                    <Text className={styles.quickStatLabel}>直属子节点</Text>
                    <div className={styles.quickStatValue}>{selectedNode.children_count}</div>
                  </div>
                  <div className={styles.quickStatItem}>
                    <Text className={styles.quickStatLabel}>节点成员</Text>
                    <div className={styles.quickStatValue}>{selectedNode.member_count}</div>
                  </div>
                  <div className={styles.quickStatItem}>
                    <Text className={styles.quickStatLabel}>挂靠项目</Text>
                    <div className={styles.quickStatValue}>{selectedNode.project_count}</div>
                  </div>
                  <div className={styles.quickStatItem}>
                    <Text className={styles.quickStatLabel}>影响成员范围</Text>
                    <div className={styles.quickStatValue}>{selectedNodeImpactMemberCount}</div>
                  </div>
                </div>

                <div className={styles.previewGrid}>
                  <Card
                    size="small"
                    className={styles.previewCard}
                    title={`成员预览 (${memberSummary.length})`}
                    extra={
                      <Button type="link" size="small" onClick={openInsightDrawer}>
                        查看完整详情
                      </Button>
                    }
                  >
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={memberSummary.slice(0, 6)}
                      locale={{ emptyText: '当前节点暂无成员数据' }}
                      columns={[
                        {
                          title: '成员',
                          dataIndex: 'display_name',
                          render: (_, record) => (
                            <Space direction="vertical" size={0}>
                              <Text>{record.display_name}</Text>
                              <Text type="secondary">{record.email}</Text>
                            </Space>
                          ),
                        },
                        {
                          title: '类型',
                          dataIndex: 'member_type',
                          width: 110,
                          render: (value) => <Tag color="geekblue">{value}</Tag>,
                        },
                      ]}
                    />
                  </Card>

                  <Card
                    size="small"
                    className={styles.previewCard}
                    title={`项目预览 (${projectSummary.length})`}
                    extra={
                      <Button type="link" size="small" onClick={openInsightDrawer}>
                        查看完整详情
                      </Button>
                    }
                  >
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={projectSummary.slice(0, 6)}
                      locale={{ emptyText: '当前节点暂无挂靠项目' }}
                      columns={[
                        {
                          title: '项目',
                          dataIndex: 'name',
                          render: (_, record) => (
                            <Space direction="vertical" size={0}>
                              <Text>{record.name}</Text>
                              <Text type="secondary">{record.slug}</Text>
                            </Space>
                          ),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          width: 110,
                          render: (value) => <Tag>{value}</Tag>,
                        },
                      ]}
                    />
                  </Card>
                </div>

                <div className={styles.dangerDock}>
                  <AdminDangerAction
                    actionKey="admin.organizations.deactivate"
                    label="停用节点"
                    target={selectedNode?.id}
                    description="停用组织节点会级联停用其子节点，请先确认业务影响。"
                    riskLevel="high"
                    actor={actor}
                    auditPreviewItems={[
                      { label: '附属子节点数', value: selectedNodeDescendantIds.size },
                      { label: '影响成员数', value: selectedNodeImpactMemberCount },
                    ]}
                    disabled={!selectedNode || selectedNode.status === 'inactive'}
                    disabledReason="当前节点不可执行停用操作"
                    onConfirm={async () => {
                      if (!selectedNode) return
                      await deactivateAdminOrganization(selectedNode.id)
                      await loadOrganizations()
                    }}
                  />
                  <AdminDangerAction
                    actionKey="admin.organizations.delete"
                    label="删除节点"
                    target={selectedNode?.id}
                    description="删除组织节点会级联删除其子节点，属于高危不可逆操作。"
                    riskLevel="critical"
                    actor={actor}
                    auditPreviewItems={[
                      { label: '附属子节点数', value: selectedNodeDescendantIds.size },
                      { label: '影响成员数', value: selectedNodeImpactMemberCount },
                    ]}
                    disabled={!selectedNode || !profile.capabilities.highRiskMutation}
                    disabledReason="仅 Super Admin 可删除组织节点"
                    onConfirm={async () => {
                      if (!selectedNode) return
                      await deleteAdminOrganization(selectedNode.id)
                      await loadOrganizations()
                    }}
                  />
                </div>
              </Space>
            )}
          </Card>
        </div>
      </div>

      <Modal
        title="风险中心"
        open={riskCenterOpen}
        onCancel={() => setRiskCenterOpen(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Table
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          dataSource={riskNodeRows}
          locale={{ emptyText: '当前无风险节点' }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedNodeId(record.id)
              setRiskCenterOpen(false)
            },
          })}
          columns={[
            {
              title: '节点',
              dataIndex: 'name',
              render: (_, record) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{record.name}</Text>
                  <Text type="secondary">{record.code}</Text>
                </Space>
              ),
            },
            {
              title: '组织',
              dataIndex: 'organization_name',
            },
            {
              title: '风险摘要',
              key: 'risk',
              render: (_, record) => <Text type="danger">{record.riskFlags.join('；')}</Text>,
            },
          ]}
        />
      </Modal>

      <Drawer
        title={`节点情报面板｜${selectedNode?.name || '-'}`}
        open={insightOpen}
        onClose={() => setInsightOpen(false)}
        width={760}
        destroyOnClose
      >
        {!selectedNode ? (
          <Empty description="未选择节点" />
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div className={styles.nodeMetaBar}>
              <Space size={8} wrap>
                <Tag color="blue">{selectedNode.node_type || '-'}</Tag>
                <Tag color={statusColorMap[selectedNode.status] || 'default'}>{selectedNode.status}</Tag>
                <Tag>{selectedNode.member_count} 成员</Tag>
                <Tag>{selectedNode.project_count} 项目</Tag>
                <Tag>深度 {selectedNode.depth}</Tag>
              </Space>
            </div>

            <Tabs
              size="small"
              items={[
                {
                  key: 'basic',
                  label: '基础信息',
                  children: (
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="节点名称">{selectedNode.name}</Descriptions.Item>
                      <Descriptions.Item label="节点编码">{selectedNode.code}</Descriptions.Item>
                      <Descriptions.Item label="节点类型">{selectedNode.node_type}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <Tag color={statusColorMap[selectedNode.status] || 'default'}>{selectedNode.status}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="组织">{selectedNode.organization_name || '-'}</Descriptions.Item>
                      <Descriptions.Item label="上级节点">{selectedNode.parent_name || '-'}</Descriptions.Item>
                      <Descriptions.Item label="负责人">{selectedNode.owner_name || '-'}</Descriptions.Item>
                      <Descriptions.Item label="子节点数">{selectedNode.children_count}</Descriptions.Item>
                      <Descriptions.Item label="成员概览">{selectedNode.member_count}</Descriptions.Item>
                      <Descriptions.Item label="挂靠项目概览">{selectedNode.project_count}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'members',
                  label: `成员概览 (${memberSummary.length})`,
                  children: (
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={memberSummary}
                      locale={{ emptyText: '当前节点暂无成员数据' }}
                      columns={[
                        {
                          title: '成员',
                          dataIndex: 'display_name',
                          render: (_, record) => (
                            <Space direction="vertical" size={0}>
                              <Space size={6}>
                                <Text>{record.display_name}</Text>
                                {record.user_id === selectedNode.owner_user_id ? <Tag color="magenta">负责人</Tag> : null}
                              </Space>
                              <Text type="secondary">{record.email}</Text>
                            </Space>
                          ),
                        },
                        {
                          title: '归属类型',
                          render: (_, record) => {
                            const affiliation = record.affiliations.find((item) => item.org_unit_id === selectedNode.id)
                            return (
                              <Tag color={affiliation?.relation_type === 'primary' ? 'blue' : 'default'}>
                                {affiliation?.relation_type || '-'}
                              </Tag>
                            )
                          },
                        },
                        {
                          title: '成员类型',
                          dataIndex: 'member_type',
                          render: (value) => <Tag color="geekblue">{value}</Tag>,
                        },
                      ]}
                    />
                  ),
                },
                {
                  key: 'projects',
                  label: `挂靠项目 (${projectSummary.length})`,
                  children: (
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={projectSummary}
                      locale={{ emptyText: '当前节点暂无挂靠项目' }}
                      columns={[
                        {
                          title: '项目',
                          dataIndex: 'name',
                          render: (_, record) => (
                            <Space direction="vertical" size={0}>
                              <Text>{record.name}</Text>
                              <Text type="secondary">{record.slug}</Text>
                            </Space>
                          ),
                        },
                        {
                          title: '负责人',
                          dataIndex: 'owner_user',
                          render: (value) => (
                            <Space size={4}>
                              <TeamOutlined />
                              <Text>{value || '-'}</Text>
                            </Space>
                          ),
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          render: (value) => <Tag>{value}</Tag>,
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title="新建组织节点"
        open={createOpen}
        className={styles.editorModal}
        width={680}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ disabled: saving }}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <div className={styles.modalHint}>创建后可在节点工作台继续补充成员、负责人和项目挂靠关系。</div>
          <Form.Item label="节点名称" name="name" rules={[{ required: true, message: '请输入节点名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="节点编码" name="code" rules={[{ required: true, message: '请输入节点编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="节点类型" name="node_type" rules={[{ required: true, message: '请选择节点类型' }]}>
            <Select options={activeNodeTypeOptions} />
          </Form.Item>
          <Form.Item
            label="上级节点"
            name="parent_id"
            extra="可不选；不选即创建顶级节点。选择后，新节点将成为该上级节点的直接子级。"
          >
            <Select showSearch optionFilterProp="label" allowClear options={createParentOptions} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑组织节点"
        open={editOpen}
        className={styles.editorModal}
        width={680}
        onCancel={() => setEditOpen(false)}
        onOk={handleUpdate}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        okButtonProps={{ disabled: editSubmitDisabled }}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <div className={styles.modalHint}>组织节点调整会影响结构路径与治理归属，请谨慎修改上级节点。</div>
          <Form.Item label="节点名称" name="name" rules={[{ required: true, message: '请输入节点名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="节点编码" name="code" rules={[{ required: true, message: '请输入节点编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="节点类型" name="node_type" rules={[{ required: true, message: '请选择节点类型' }]}>
            <Select options={editNodeTypeOptions} />
          </Form.Item>
          <Form.Item
            label="上级节点"
            name="parent_id"
            validateStatus={editParentInvalid ? 'error' : undefined}
            help={editParentInvalid ? '不能选择自身或子孙节点。' : undefined}
          >
            <Select showSearch optionFilterProp="label" allowClear options={editParentOptions} />
          </Form.Item>
          <Form.Item label="状态" name="status" rules={[{ required: true, message: '请选择状态' }]}>
            <Select options={statusOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="设置负责人"
        open={ownerOpen}
        className={styles.editorModal}
        width={560}
        onCancel={() => setOwnerOpen(false)}
        onOk={handleSetOwner}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={ownerForm} layout="vertical">
          <div className={styles.modalHint}>负责人仅可从当前节点已添加成员中选择，成员概览会显示负责人标识。</div>
          <Form.Item label="负责人账号" name="owner_user_id" rules={[{ required: true, message: '请选择负责人账号' }]}>
            <Select showSearch optionFilterProp="label" options={ownerMemberOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="为节点添加成员"
        open={addMemberOpen}
        className={styles.editorModal}
        width={620}
        onCancel={() => setAddMemberOpen(false)}
        onOk={handleAddMemberToNode}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={addMemberForm} layout="vertical">
          <div className={styles.modalHint}>使用姓名或邮箱搜索用户后添加，系统会自动过滤当前节点已存在成员。</div>
          <Form.Item label="节点名称">
            <Input value={selectedNode?.name || '-'} disabled />
          </Form.Item>
          <Form.Item label="成员账号" name="user_id" rules={[{ required: true, message: '请选择成员账号' }]}>
            <Select
              showSearch
              filterOption={false}
              onSearch={setAddMemberUserKeyword}
              options={addMemberSearchOptions}
              notFoundContent={addMemberUserKeyword.trim() ? '未找到匹配用户' : '请输入姓名或邮箱搜索用户'}
            />
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
        title="组织类型维护"
        open={typeManageOpen}
        className={styles.editorModal}
        onCancel={() => setTypeManageOpen(false)}
        footer={null}
        width={960}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12} className={styles.typeManagerWrap}>
          <Alert
            showIcon
            type="info"
            message="组织类型用于节点创建和编辑。停用后不会用于新建节点，已使用节点不受影响。"
          />

          <div className={styles.typeOverviewGrid}>
            <div className={styles.typeOverviewItem}>
              <Text className={styles.typeOverviewLabel}>类型总数</Text>
              <div className={styles.typeOverviewValue}>{typeOverview.total}</div>
            </div>
            <div className={styles.typeOverviewItem}>
              <Text className={styles.typeOverviewLabel}>启用中</Text>
              <div className={styles.typeOverviewValue}>{typeOverview.active}</div>
            </div>
            <div className={styles.typeOverviewItem}>
              <Text className={styles.typeOverviewLabel}>已停用</Text>
              <div className={styles.typeOverviewValue}>{typeOverview.inactive}</div>
            </div>
            <div className={`${styles.typeOverviewItem} ${styles.typeOverviewWarn}`}>
              <Text className={styles.typeOverviewLabel}>正在被使用</Text>
              <div className={styles.typeOverviewValue}>{typeOverview.inUse}</div>
            </div>
          </div>

          <Card size="small" title="新增组织类型" className={styles.typeCreatorCard}>
            <Form form={typeForm} layout="vertical" className={styles.typeCreateForm}>
              <div className={styles.typeCreateGrid}>
                <Form.Item label="类型名称" name="name" rules={[{ required: true, message: '请输入类型名称' }]}>
                  <Input placeholder="例如：事业部" />
                </Form.Item>
                <Form.Item
                  label="类型编码"
                  name="code"
                  rules={[{ required: true, message: '请输入类型编码' }]}
                  extra="建议使用英文下划线，如 business_unit"
                >
                  <Input placeholder="business_unit" />
                </Form.Item>
              </div>
              <div className={styles.typeCreateActions}>
                <Text type="secondary">新增后将立即出现在创建/编辑节点的“节点类型”选项中。</Text>
                <Button type="primary" loading={typeSaving} onClick={handleCreateType}>
                  新增类型
                </Button>
              </div>
            </Form>
          </Card>

          <Card size="small" title="类型列表" className={styles.typeListCard}>
            <div className={styles.typeToolbar}>
              <Input
                allowClear
                value={typeKeyword}
                onChange={(event) => setTypeKeyword(event.target.value)}
                placeholder="搜索类型名称 / 编码"
              />
              <Segmented
                value={typeStatusFilter}
                onChange={setTypeStatusFilter}
                options={[
                  { label: `全部 (${typeOverview.total})`, value: 'all' },
                  { label: `启用 (${typeOverview.active})`, value: 'active' },
                  { label: `停用 (${typeOverview.inactive})`, value: 'inactive' },
                ]}
              />
            </div>

            <Table
              rowKey="id"
              loading={typeSaving}
              dataSource={filteredTypeRecords}
              pagination={{ pageSize: 8 }}
              locale={{
                emptyText:
                  typeKeyword.trim() || typeStatusFilter !== 'all' ? '未找到匹配的组织类型' : '暂未配置组织类型',
              }}
              columns={[
                {
                  title: '类型',
                  key: 'type',
                  render: (_, record) => (
                    <div className={styles.typeNameCell}>
                      <Text strong>{record.name}</Text>
                      <Text type="secondary">{record.code}</Text>
                    </div>
                  ),
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 140,
                  render: (value) => (
                    <Space direction="vertical" size={0}>
                      <Tag color={value === 'active' ? 'success' : 'default'}>{value === 'active' ? '启用' : '停用'}</Tag>
                      <Text type="secondary">{value === 'active' ? '可用于新建节点' : '仅保留历史使用'}</Text>
                    </Space>
                  ),
                },
                {
                  title: '排序',
                  key: 'sort',
                  width: 86,
                  align: 'center',
                  render: (_, record) => (typeRecordIndexMap.get(record.id) || 0) + 1,
                },
                {
                  title: '使用节点',
                  key: 'usage',
                  width: 130,
                  render: (_, record) => {
                    const usageCount = organizationTypeUsageMap.get(record.id) || 0
                    return <Tag color={usageCount > 0 ? 'gold' : 'default'}>{usageCount}</Tag>
                  },
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 280,
                  render: (_, record) => {
                    const realIndex = typeRecordIndexMap.get(record.id) ?? -1
                    const isFirst = realIndex <= 0
                    const isLast = realIndex === organizationTypeRecords.length - 1

                    return (
                      <Space size={6} wrap>
                        <Button size="small" icon={<UpOutlined />} disabled={isFirst} onClick={() => handleMoveType(record, 'up')}>
                          上移
                        </Button>
                        <Button
                          size="small"
                          icon={<DownOutlined />}
                          disabled={isLast}
                          onClick={() => handleMoveType(record, 'down')}
                        >
                          下移
                        </Button>
                        <Button size="small" onClick={() => handleToggleTypeStatus(record)}>
                          {record.status === 'active' ? '停用' : '启用'}
                        </Button>
                        <Button size="small" danger onClick={() => handleDeleteType(record)}>
                          删除
                        </Button>
                      </Space>
                    )
                  },
                },
              ]}
            />
          </Card>
        </Space>
      </Modal>
    </AdminPageShell>
  )
}

export default OrganizationsPage
