import React, { useCallback, useEffect, useState } from 'react'
import { Alert, App, Button, Card, Space, Table, Tabs, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminAccessDenied from '../components/AdminAccessDenied'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { fetchAdminPlugins } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const PluginsPage = () => {
  const { message } = App.useApp()
  const { profile, actor, organizationId } = useAdminOutlet()
  const [pluginData, setPluginData] = useState({
    definitions: [],
    installations: [],
    audit: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await fetchAdminPlugins({
        organizationScoped: profile.organizationScoped,
        organizationId,
      })
      setPluginData(payload)
    } catch (err) {
      const errorMessage = err?.message || '插件数据加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [message, profile.organizationScoped, organizationId])

  useEffect(() => {
    if (profile.capabilities.plugins) {
      loadPlugins()
    }
  }, [loadPlugins, profile.capabilities.plugins])

  if (!profile.capabilities.plugins) {
    return <AdminAccessDenied message="当前角色不可访问平台插件治理模块。" />
  }

  return (
    <AdminPageShell
      title="Plugins"
      subtitle="统一管理插件定义、安装实例与审核审计，避免直接操作底层控制面。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadPlugins} loading={loading}>
            刷新
          </Button>
          <Button type="primary">注册插件</Button>
        </Space>
      }
    >
      {error ? (
        <Alert showIcon type="error" message="加载失败" description={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Card className={styles.sectionCard}>
        <Tabs
          items={[
            {
              key: 'definitions',
              label: '插件定义',
              children: (
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={pluginData.definitions}
                  pagination={false}
                  columns={[
                    {
                      title: 'Plugin',
                      dataIndex: 'name',
                      render: (_, record) => (
                        <Space direction="vertical" size={0}>
                          <Text strong>{record.name}</Text>
                          <Text type="secondary">{record.code}</Text>
                        </Space>
                      ),
                    },
                    {
                      title: 'Version',
                      dataIndex: 'version',
                    },
                    {
                      title: 'Risk',
                      dataIndex: 'risk_level',
                      render: (value) => <Tag color={value === 'high' ? 'red' : 'gold'}>{value}</Tag>,
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      render: (value) => <Tag>{value}</Tag>,
                    },
                    {
                      title: 'Actions',
                      key: 'actions',
                      render: (_, record) => (
                        <Space>
                          <Button size="small">查看定义</Button>
                          <AdminDangerAction
                            actionKey="admin.plugins.publish"
                            label="发布版本"
                            target={record.id}
                            description="发布插件新版本可能影响已安装实例。"
                            riskLevel="high"
                            actor={actor}
                            disabled={!profile.capabilities.highRiskMutation}
                            disabledReason="当前角色仅可查看，不能发布版本"
                            onConfirm={async (payload) => {
                              message.success(`插件版本发布请求已提交: ${payload.target_id}`)
                            }}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'instances',
              label: '安装实例',
              children: (
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={pluginData.installations}
                  pagination={false}
                  columns={[
                    {
                      title: 'Plugin Code',
                      dataIndex: 'plugin_code',
                    },
                    {
                      title: 'Scope',
                      render: (_, record) => (
                        <Tag color={record.scope_type === 'platform' ? 'geekblue' : 'gold'}>
                          {record.scope_type}:{record.scope_id}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Enabled',
                      dataIndex: 'enabled',
                      render: (value) => (value ? <Tag color="success">true</Tag> : <Tag color="default">false</Tag>),
                    },
                    {
                      title: 'Updated At',
                      dataIndex: 'updated_at',
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      render: (value) => <Tag>{value}</Tag>,
                    },
                    {
                      title: 'Actions',
                      key: 'actions',
                      render: (_, record) => (
                        <Space>
                          <AdminDangerAction
                            actionKey="admin.plugins.toggle"
                            label={record.enabled ? '停用' : '启用'}
                            target={record.id}
                            description="插件启停会改变对应作用域的运行能力。"
                            riskLevel={record.scope_type === 'platform' ? 'critical' : 'high'}
                            actor={actor}
                            disabled={!profile.capabilities.highRiskMutation}
                            disabledReason="当前角色仅可查看插件状态"
                            onConfirm={async (payload) => {
                              message.success(`插件实例变更请求已提交: ${payload.target_id}`)
                            }}
                          />
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: 'audit',
              label: '审计记录',
              children: (
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={pluginData.audit}
                  locale={{ emptyText: '暂无插件审计记录（MVP 占位）' }}
                  columns={[
                    {
                      title: 'Actor',
                      dataIndex: 'actor',
                    },
                    {
                      title: 'Action',
                      dataIndex: 'action',
                    },
                    {
                      title: 'Target',
                      dataIndex: 'target',
                    },
                    {
                      title: 'Risk',
                      dataIndex: 'risk_level',
                    },
                    {
                      title: 'Created At',
                      dataIndex: 'created_at',
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </AdminPageShell>
  )
}

export default PluginsPage
