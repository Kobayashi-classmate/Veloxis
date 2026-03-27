import React, { useEffect, useState } from 'react'
import { Modal, Form, Input, Select, ColorPicker, Alert, Space, Typography } from 'antd'
import { ProjectOutlined, LockOutlined, TeamOutlined, GlobalOutlined } from '@ant-design/icons'
import { authService } from '@/service/authService'
import { getTenants } from '@/service/api/projects'
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

const ProjectModal = ({ open, onCancel, onOk, initialValues, title }) => {
  const [form] = Form.useForm()
  const [tenants, setTenants] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const user = authService.getState().user

  useEffect(() => {
    if (!open) return
    const checkAdmin = async () => {
      try {
        const perms = await getUserPermissions()
        const admin = perms.permissions.includes('*:*')
        setIsAdmin(admin)
        if (admin) {
          try {
            const list = await getTenants()
            setTenants(Array.from(new Set([...list, user?.tenant].filter(Boolean))))
          } catch {
            if (user?.tenant) setTenants([user.tenant])
          }
        }
      } catch {
        // non-admin, silently ignore
      }
    }
    checkAdmin()
  }, [open, user?.tenant])

  useEffect(() => {
    if (!open) return
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
        tenant: user?.tenant,
      })
    }
  }, [open, initialValues, form, user?.tenant])

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
      okText={initialValues ? '保存更改' : '创建项目'}
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
          <Input placeholder="例如：电商运营数据中台" maxLength={64} showCount />
        </Form.Item>

        <Form.Item name="description" label="项目描述">
          <TextArea rows={3} placeholder="简要描述该项目的目标与用途（可选）" maxLength={256} showCount />
        </Form.Item>

        {isAdmin ? (
          <Form.Item name="tenant" label="所属组织 / 租户" rules={[{ required: true, message: '请选择所属组织' }]}>
            <Select placeholder="选择或搜索组织" showSearch allowClear>
              {tenants.map((t) => (
                <Select.Option key={t} value={t}>
                  {t}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        ) : (
          <Form.Item name="tenant" label="所属组织 / 租户" tooltip="默认为您所在的组织，不可修改">
            <Input disabled />
          </Form.Item>
        )}

        <Form.Item name="visibility" label="可见性">
          <Select options={VISIBILITY_OPTIONS} />
        </Form.Item>

        <Form.Item name="color" label="项目主题色" tooltip="用于区分项目的主题颜色">
          <ColorPicker showText format="hex" />
        </Form.Item>

        {!initialValues && (
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
