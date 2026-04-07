import React, { useEffect, useState, useCallback } from 'react'
import { Modal, Form, Input, Select, ColorPicker, Alert, Space, Typography } from 'antd'
import { ProjectOutlined, LockOutlined, TeamOutlined, GlobalOutlined, LinkOutlined } from '@ant-design/icons'
import { authService } from '@/service/authService'
import { getOrganizations } from '@/service/api/projects'
import { getUserPermissions } from '@/service/api/permission'

const { TextArea } = Input
const { Text } = Typography

const VISIBILITY_OPTIONS = [
  {
    value: 'private',
    label: (
      <Space size={8}>
        <LockOutlined style={{ color: '#6b7280' }} />
        <span>私有</span>
        <Text type="secondary" style={{ fontSize: 12 }}>
          仅项目成员可见
        </Text>
      </Space>
    ),
  },
  {
    value: 'internal',
    label: (
      <Space size={8}>
        <TeamOutlined style={{ color: '#1677ff' }} />
        <span>内部</span>
        <Text type="secondary" style={{ fontSize: 12 }}>
          本组织成员可见
        </Text>
      </Space>
    ),
  },
  {
    value: 'public',
    label: (
      <Space size={8}>
        <GlobalOutlined style={{ color: '#059669' }} />
        <span>公开</span>
        <Text type="secondary" style={{ fontSize: 12 }}>
          全平台成员可见
        </Text>
      </Space>
    ),
  },
]

/**
 * 将任意字符串转换为 URL-safe slug：
 *   - 中文/特殊字符转为拼音首字母或直接移除
 *   - 小写、空格/下划线 → 连字符
 *   - 去掉首尾连字符、合并连续连字符
 */
function toSlug(str) {
  return (
    str
      .trim()
      .toLowerCase()
      // 保留字母、数字、空格、连字符；中文等直接移除
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s_]+/g, '-') // 空格/下划线 → 连字符
      .replace(/-+/g, '-') // 合并连续连字符
      .replace(/^-+|-+$/g, '') // 去首尾连字符
      .slice(0, 63)
  ) // 最长 63 字符
}

/** 验证 slug 格式 */
function validateSlug(slug) {
  if (!slug) return '请输入项目标识符'
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]$/.test(slug)) {
    return '只能包含小写字母、数字和连字符，且不能以连字符开头或结尾'
  }
  if (slug.length < 2) return '至少 2 个字符'
  if (slug.length > 63) return '不超过 63 个字符'
  return null
}

const ProjectModal = ({ open, onCancel, onOk, initialValues, title }) => {
  const [form] = Form.useForm()
  const [organizations, setOrganizations] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  /** 是否由用户手动编辑过 slug（手动后不再自动同步） */
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const user = authService.getState().user

  const isEditing = !!initialValues

  useEffect(() => {
    if (!open) return
    const checkAdmin = async () => {
      try {
        const perms = await getUserPermissions()
        const admin = perms.permissions.includes('*:*')
        setIsAdmin(admin)
        if (admin) {
          try {
            const list = await getOrganizations()
            setOrganizations(Array.from(new Set([...list, user?.organization].filter(Boolean))))
          } catch {
            if (user?.organization) setOrganizations([user.organization])
          }
        }
      } catch {
        // non-admin, silently ignore
      }
    }
    checkAdmin()
  }, [open, user?.organization])

  useEffect(() => {
    if (!open) return
    setSlugManuallyEdited(false)
    if (initialValues) {
      form.setFieldsValue({
        ...initialValues,
        color: initialValues.color ?? '#1677ff',
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        visibility: 'private',
        color: '#1677ff',
        organization: user?.organization,
      })
    }
  }, [open, initialValues, form, user?.organization])

  /** 当名称变化时，自动同步 slug（仅在用户未手动编辑过 slug 时） */
  const handleNameChange = useCallback(
    (e) => {
      if (isEditing) return
      if (slugManuallyEdited) return
      const generated = toSlug(e.target.value)
      form.setFieldValue('slug', generated)
      // 触发 slug 字段的校验提示同步
      if (generated) form.validateFields(['slug']).catch(() => {})
    },
    [form, isEditing, slugManuallyEdited]
  )

  const handleSlugChange = useCallback(
    (e) => {
      // 用户手动输入 slug 时，只保留合法字符、强制小写
      const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
      form.setFieldValue('slug', cleaned)
      setSlugManuallyEdited(true)
    },
    [form]
  )

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const colorValue =
        typeof values.color === 'string' ? values.color : (values.color?.toHexString?.() ?? values.color)
      setSubmitting(true)
      await onOk({ ...values, color: colorValue })
    } catch {
      // validation error — form will display messages
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={
        <Space size={10}>
          <ProjectOutlined style={{ color: '#1677ff' }} />
          <span>{title ?? '项目'}</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={isEditing ? '保存更改' : '创建项目'}
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnClose
      width={520}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="项目名称"
          rules={[
            { required: true, message: '请输入项目名称' },
            { max: 64, message: '名称不超过 64 个字符' },
          ]}
        >
          <Input placeholder="例如：电商运营数据中台" maxLength={64} showCount onChange={handleNameChange} />
        </Form.Item>

        <Form.Item
          name="slug"
          label={
            <Space size={6}>
              <LinkOutlined style={{ color: '#6b7280' }} />
              <span>项目标识符（Slug）</span>
            </Space>
          }
          tooltip={
            isEditing
              ? 'Slug 是项目的唯一 URL 标识，创建后不可修改'
              : '用于 URL 路径的唯一标识符，只能包含小写字母、数字和连字符'
          }
          rules={[
            { required: true, message: '请输入项目标识符' },
            {
              validator: (_, value) => {
                const err = validateSlug(value)
                return err ? Promise.reject(err) : Promise.resolve()
              },
            },
          ]}
          extra={
            isEditing ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Slug 创建后不可修改，当前值：
                <Text code style={{ fontSize: 12 }}>
                  {initialValues?.slug}
                </Text>
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                将用于项目 URL，如{' '}
                <Text code style={{ fontSize: 11 }}>
                  /project/<b>your-slug</b>/...
                </Text>
              </Text>
            )
          }
        >
          <Input
            placeholder="例如：ecommerce-data-2026"
            maxLength={63}
            disabled={isEditing}
            onChange={handleSlugChange}
            prefix={
              <Text type="secondary" style={{ fontSize: 12, userSelect: 'none' }}>
                /project/
              </Text>
            }
            style={isEditing ? { color: '#6b7280', background: '#f8fafc' } : undefined}
          />
        </Form.Item>

        <Form.Item name="description" label="项目描述">
          <TextArea rows={3} placeholder="简要描述该项目的目标与用途（可选）" maxLength={256} showCount />
        </Form.Item>

        {isAdmin ? (
          <Form.Item name="organization" label="所属组织" rules={[{ required: true, message: '请选择所属组织' }]}>
            <Select placeholder="选择或搜索组织" showSearch allowClear>
              {organizations.map((item) => (
                <Select.Option key={item} value={item}>
                  {item}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          <Form.Item name="organization" label="所属组织" tooltip="默认为您所在的组织，不可修改">
            <Input disabled />
          </Form.Item>
        )}

        <Form.Item name="visibility" label="可见性">
          <Select options={VISIBILITY_OPTIONS} />
        </Form.Item>

        <Form.Item name="color" label="项目主题色" tooltip="用于区分项目的主题颜色">
          <ColorPicker showText format="hex" />
        </Form.Item>

        {!isEditing && (
          <Alert
            type="info"
            showIcon
            message="创建后您将自动成为项目所有者，可在「成员管理」中邀请其他人加入。"
            style={{ borderRadius: 8 }}
          />
        )}
      </Form>
    </Modal>
  )
}

export default ProjectModal
