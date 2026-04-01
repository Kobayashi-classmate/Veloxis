import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Typography, Table, Button, Tag, Space, Modal, Form,
  Input, Select, Tooltip, Empty, message, Drawer, Divider,
} from 'antd'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ThunderboltOutlined, EyeOutlined, DatabaseOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getRecipesByProject,
  createProjectRecipe,
  updateProjectRecipe,
  deleteProjectRecipe,
  getDatasets,
} from '@src/service/api/recipes'
import { getProjectBySlug } from '@src/service/api/projects'

const { Title, Text } = Typography
const { Option } = Select

/** ─── 操作类型标签 ─────────────────────────────────────────────────────────── */

const OP_LABELS = {
  rename:    { label: '重命名', color: 'blue' },
  filter:    { label: '过滤',   color: 'orange' },
  uppercase: { label: '大写',   color: 'purple' },
  lowercase: { label: '小写',   color: 'geekblue' },
}

/** ─── 配方操作步骤预览 ──────────────────────────────────────────────────────── */
const RecipeOpsPreview = ({ config }) => {
  if (!Array.isArray(config) || config.length === 0) {
    return <Text type="secondary" style={{ fontSize: 12 }}>暂无操作步骤</Text>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {config.map((op, idx) => {
        const meta = OP_LABELS[op.type] ?? { label: op.type, color: 'default' }
        return (
          <Tag key={idx} color={meta.color} style={{ fontSize: 11 }}>
            {meta.label}: {op.from} → {op.to ?? op.from}
          </Tag>
        )
      })}
    </div>
  )
}

/** ─── 创建 / 编辑配方弹窗 ──────────────────────────────────────────────────── */
const RecipeFormModal = ({ open, editingRecipe, datasets, projectId, onClose, onSaved }) => {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      if (editingRecipe) {
        form.setFieldsValue({
          name: editingRecipe.name,
          dataset_id: editingRecipe.dataset_id,
          description: editingRecipe.description ?? '',
        })
      } else {
        form.resetFields()
      }
    }
  }, [open, editingRecipe, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editingRecipe) {
        await updateProjectRecipe(editingRecipe.id, {
          name: values.name,
          description: values.description,
        })
        message.success('配方已更新')
      } else {
        await createProjectRecipe({
          project_id: projectId,
          dataset_id: values.dataset_id,
          name: values.name,
          description: values.description,
          config: [],
        })
        message.success('配方创建成功')
      }
      onSaved()
      onClose()
    } catch {
      message.error('操作失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={editingRecipe ? '编辑配方' : '新建 ETL 配方'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText={editingRecipe ? '保存' : '创建'}
      cancelText="取消"
      confirmLoading={saving}
      width={480}
      destroyOnHide
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="配方名称"
          rules={[{ required: true, message: '请输入配方名称' }]}
        >
          <Input placeholder="如：销售数据清洗规则" maxLength={60} />
        </Form.Item>

        {!editingRecipe && (
          <Form.Item
            name="dataset_id"
            label="关联数据源"
            rules={[{ required: true, message: '请选择数据源' }]}
          >
            <Select placeholder="选择该配方所作用的数据源" showSearch optionFilterProp="children">
              {datasets.map((ds) => (
                <Option key={ds.id} value={ds.id}>
                  <DatabaseOutlined style={{ marginRight: 6, color: '#1677ff' }} />
                  {ds.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item name="description" label="描述（可选）">
          <Input.TextArea
            placeholder="简要描述该配方的用途与处理逻辑..."
            rows={3}
            maxLength={200}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

/** ─── 配方详情 Drawer ───────────────────────────────────────────────────────── */
const RecipeDetailDrawer = ({ open, recipe, onClose }) => {
  if (!recipe) return null
  const config = Array.isArray(recipe.config) ? recipe.config : []

  return (
    <Drawer
      title={`配方详情 — ${recipe.name}`}
      open={open}
      onClose={onClose}
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>关联数据源</Text>
          <div style={{ marginTop: 4 }}>
            <Tag color="blue">{recipe.dataset_name ?? recipe.dataset_id}</Tag>
          </div>
        </div>

        {recipe.description && (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>描述</Text>
            <div style={{ marginTop: 4, fontSize: 13 }}>{recipe.description}</div>
          </div>
        )}

        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
          <div style={{ marginTop: 4, fontSize: 13 }}>
            {recipe.date_created ? dayjs(recipe.date_created).format('YYYY-MM-DD HH:mm:ss') : '—'}
          </div>
        </div>

        <Divider style={{ margin: '4px 0' }} />

        <div>
          <Text strong style={{ fontSize: 13 }}>
            <ThunderboltOutlined style={{ color: '#1677ff', marginRight: 6 }} />
            操作步骤（{config.length} 条）
          </Text>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {config.length === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>暂无操作步骤</Text>
            )}
            {config.map((op, idx) => {
              const meta = OP_LABELS[op.type] ?? { label: op.type, color: 'default' }
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11, width: 24, flexShrink: 0 }}>
                    {idx + 1}.
                  </Text>
                  <Tag color={meta.color} style={{ margin: 0, flexShrink: 0 }}>{meta.label}</Tag>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{op.from}</Text>
                  {op.to && op.to !== op.from && (
                    <>
                      <Text type="secondary">→</Text>
                      <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{op.to}</Text>
                    </>
                  )}
                  {op.label && (
                    <Text type="secondary" style={{ fontSize: 11 }}>（展示: {op.label}）</Text>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Drawer>
  )
}

/** ─── 主组件 ────────────────────────────────────────────────────────────────── */
const Recipes = () => {
  const { slug } = useParams()

  /** slug → UUID 解析 */
  const [projectId, setProjectId] = useState(null)
  useEffect(() => {
    if (!slug) return
    getProjectBySlug(slug).then((p) => { if (p?.id) setProjectId(p.id) })
  }, [slug])
  const [recipes, setRecipes] = useState([])
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [detailDrawer, setDetailDrawer] = useState({ open: false, recipe: null })

  const fetchData = useCallback(async (silent = false) => {
    if (!projectId) return
    if (!silent) setLoading(true)
    try {
      const [rList, dList] = await Promise.all([
        getRecipesByProject(projectId),
        getDatasets(projectId),
      ])
      const dsMap = Object.fromEntries((dList ?? []).map((d) => [d.id, d.name]))
      const enriched = (rList ?? []).map((r) => ({
        ...r,
        dataset_name: dsMap[r.dataset_id] ?? r.dataset_id,
      }))
      setRecipes(enriched)
      setDatasets(dList ?? [])
    } catch {
      if (!silent) message.error('获取配方列表失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = (record) => {
    Modal.confirm({
      title: `确认删除「${record.name}」？`,
      content: '该配方及其所有处理步骤将被删除，此操作不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteProjectRecipe(record.id)
          message.success('配方已删除')
          fetchData(true)
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const columns = [
    {
      title: '配方名称',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space size={6}>
          <ThunderboltOutlined style={{ color: '#1677ff' }} />
          <Text strong>{name}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>— {record.description}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '关联数据源',
      dataIndex: 'dataset_name',
      key: 'dataset_name',
      width: 180,
      render: (name) => <Tag color="blue">{name ?? '—'}</Tag>,
    },
    {
      title: '操作步骤',
      key: 'config',
      render: (_, record) => <RecipeOpsPreview config={record.config} />,
    },
    {
      title: '创建时间',
      dataIndex: 'date_created',
      key: 'date_created',
      width: 180,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailDrawer({ open: true, recipe: record })}
            >
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑配方">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => { setEditingRecipe(record); setFormOpen(true) }}
            >
              编辑
            </Button>
          </Tooltip>
          <Tooltip title="删除配方">
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/** 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>ETL 配方管理</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            配置数据处理规则，定义字段映射、过滤、转换等操作，持续应用于数据更新流程
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingRecipe(null); setFormOpen(true) }}
        >
          新建配方
        </Button>
      </div>

      {/** 列表 */}
      {!loading && recipes.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无 ETL 配方，点击「新建配方」开始配置"
          style={{ marginTop: 80 }}
        >
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingRecipe(null); setFormOpen(true) }}
          >
            新建第一个配方
          </Button>
        </Empty>
      ) : (
        <Table
          columns={columns}
          dataSource={recipes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
        />
      )}

      {/** 创建 / 编辑弹窗 */}
      <RecipeFormModal
        open={formOpen}
        editingRecipe={editingRecipe}
        datasets={datasets}
        projectId={projectId}
        onClose={() => setFormOpen(false)}
        onSaved={() => fetchData(true)}
      />

      {/** 详情 Drawer */}
      <RecipeDetailDrawer
        open={detailDrawer.open}
        recipe={detailDrawer.recipe}
        onClose={() => setDetailDrawer({ open: false, recipe: null })}
      />
    </div>
  )
}

export default Recipes
