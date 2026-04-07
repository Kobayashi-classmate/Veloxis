import React, { useCallback, useMemo, useState } from 'react'
import { Button, Card, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import {
  createPluginInstallation,
  disablePluginInstallation,
  enablePluginInstallation,
  getPluginInstallationAuditLogs,
  getPluginInstallations,
  getPluginRegistryList,
  installPluginRegistry,
  uninstallPluginInstallation,
  validatePluginRegistry,
} from '@src/service/api/worker'

const { Title, Text } = Typography

const DEFAULT_ARTIFACT_PATH = '/www/CodeSpace/Veloxis/plugins/official/visualization/hello-chart'

const statusColorMap = {
  validated: 'green',
  enabled: 'green',
  installed: 'blue',
  disabled: 'default',
  upgraded: 'gold',
  uninstalled: 'red',
  error: 'red',
}

const PluginDebugPage = () => {
  const [artifactPath, setArtifactPath] = useState(DEFAULT_ARTIFACT_PATH)
  const [pluginId, setPluginId] = useState('veloxis.plugin.visualization.hello-chart')
  const [version, setVersion] = useState('0.1.0')
  const [scopeType, setScopeType] = useState('global')
  const [scopeId, setScopeId] = useState('')

  const [registryRows, setRegistryRows] = useState([])
  const [installationRows, setInstallationRows] = useState([])
  const [auditRows, setAuditRows] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [registries, installations] = await Promise.all([
        getPluginRegistryList(),
        getPluginInstallations({ includeManifest: true }),
      ])
      setRegistryRows(registries)
      setInstallationRows(installations)
    } catch (error) {
      console.error('[PluginDebug] reload failed:', error)
      message.error('刷新插件状态失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const installAndValidate = useCallback(async () => {
    setLoading(true)
    try {
      await installPluginRegistry({
        artifactPath,
        pluginId,
        version,
      })
      await validatePluginRegistry(pluginId, version)
      message.success('registry install + validate 完成')
      await reload()
    } catch (error) {
      console.error('[PluginDebug] installAndValidate failed:', error)
      message.error('安装或校验失败')
    } finally {
      setLoading(false)
    }
  }, [artifactPath, pluginId, version, reload])

  const createInstallation = useCallback(async () => {
    setLoading(true)
    try {
      await createPluginInstallation({
        pluginId,
        version,
        scopeType,
        ...(scopeType !== 'global' && scopeId ? { scopeId } : {}),
      })
      message.success('installation 创建成功')
      await reload()
    } catch (error) {
      console.error('[PluginDebug] createInstallation failed:', error)
      message.error('创建 installation 失败')
    } finally {
      setLoading(false)
    }
  }, [pluginId, version, scopeType, scopeId, reload])

  const onEnable = useCallback(
    async (installationId) => {
      setLoading(true)
      try {
        await enablePluginInstallation(installationId)
        message.success('插件已启用')
        await reload()
      } catch (error) {
        console.error('[PluginDebug] enable failed:', error)
        message.error('启用失败')
      } finally {
        setLoading(false)
      }
    },
    [reload]
  )

  const onDisable = useCallback(
    async (installationId) => {
      setLoading(true)
      try {
        await disablePluginInstallation(installationId)
        message.success('插件已停用')
        await reload()
      } catch (error) {
        console.error('[PluginDebug] disable failed:', error)
        message.error('停用失败')
      } finally {
        setLoading(false)
      }
    },
    [reload]
  )

  const onUninstall = useCallback(
    async (installationId) => {
      setLoading(true)
      try {
        await uninstallPluginInstallation(installationId)
        message.success('插件已卸载')
        await reload()
      } catch (error) {
        console.error('[PluginDebug] uninstall failed:', error)
        message.error('卸载失败')
      } finally {
        setLoading(false)
      }
    },
    [reload]
  )

  const onViewAudit = useCallback(async (installationId) => {
    setLoading(true)
    try {
      const rows = await getPluginInstallationAuditLogs(installationId)
      setAuditRows(rows)
    } catch (error) {
      console.error('[PluginDebug] audit load failed:', error)
      message.error('读取审计失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const installationColumns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 220 },
      { title: 'Plugin', dataIndex: 'plugin_id', key: 'plugin_id', width: 280 },
      { title: 'Version', dataIndex: 'version', key: 'version', width: 100 },
      {
        title: 'Scope',
        key: 'scope',
        width: 140,
        render: (_, row) => `${row.scope_type}${row.scope_id ? `:${row.scope_id}` : ''}`,
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status) => <Tag color={statusColorMap[status] ?? 'default'}>{status}</Tag>,
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, row) => (
          <Space>
            <Button size="small" onClick={() => onEnable(row.id)}>
              Enable
            </Button>
            <Button size="small" onClick={() => onDisable(row.id)}>
              Disable
            </Button>
            <Button size="small" danger onClick={() => onUninstall(row.id)}>
              Uninstall
            </Button>
            <Button size="small" onClick={() => onViewAudit(row.id)}>
              Audit
            </Button>
          </Space>
        ),
      },
    ],
    [onEnable, onDisable, onUninstall, onViewAudit]
  )

  const registryColumns = [
    { title: 'Plugin', dataIndex: 'plugin_id', key: 'plugin_id', width: 280 },
    { title: 'Version', dataIndex: 'version', key: 'version', width: 100 },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 140 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 120, render: (status) => <Tag>{status}</Tag> },
    { title: 'Artifact', dataIndex: 'artifact_path', key: 'artifact_path' },
  ]

  const auditColumns = [
    { title: 'Action', dataIndex: 'action', key: 'action', width: 140 },
    { title: 'From', dataIndex: 'from_status', key: 'from_status', width: 100 },
    { title: 'To', dataIndex: 'to_status', key: 'to_status', width: 100 },
    {
      title: 'Success',
      dataIndex: 'success',
      key: 'success',
      width: 100,
      render: (success) => <Tag color={success ? 'green' : 'red'}>{String(success)}</Tag>,
    },
    { title: 'Request ID', dataIndex: 'request_id', key: 'request_id', width: 180 },
    { title: 'Created At', dataIndex: 'date_created', key: 'date_created' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>Plugin Debug Console</Title>
      <Text type="secondary">
        该页面用于验证插件最小闭环：registry install/validate、installation create、enable/disable、审计日志。
      </Text>

      <Card style={{ marginTop: 16 }} loading={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input
            value={artifactPath}
            onChange={(event) => setArtifactPath(event.target.value)}
            addonBefore="artifactPath"
          />
          <Space style={{ width: '100%' }}>
            <Input
              value={pluginId}
              onChange={(event) => setPluginId(event.target.value)}
              addonBefore="pluginId"
              style={{ minWidth: 320 }}
            />
            <Input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              addonBefore="version"
              style={{ width: 180 }}
            />
          </Space>
          <Space>
            <Select
              value={scopeType}
              onChange={setScopeType}
              options={[
                { label: 'global', value: 'global' },
                { label: 'organization', value: 'organization' },
                { label: 'project', value: 'project' },
              ]}
              style={{ width: 140 }}
            />
            <Input
              value={scopeId}
              onChange={(event) => setScopeId(event.target.value)}
              placeholder="scopeId (organization/project required)"
              style={{ width: 280 }}
              disabled={scopeType === 'global'}
            />
            <Button type="primary" onClick={installAndValidate}>
              Install + Validate
            </Button>
            <Button onClick={createInstallation}>Create Installation</Button>
            <Button onClick={reload}>Reload</Button>
          </Space>
        </Space>
      </Card>

      <Card title="Registry" style={{ marginTop: 16 }}>
        <Table rowKey="id" columns={registryColumns} dataSource={registryRows} pagination={false} scroll={{ x: 920 }} />
      </Card>

      <Card title="Installations" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          columns={installationColumns}
          dataSource={installationRows}
          pagination={false}
          scroll={{ x: 1080 }}
        />
      </Card>

      <Card title="Audit Logs" style={{ marginTop: 16 }}>
        <Table
          rowKey={(row, idx) => row.id ?? `${row.action}-${idx}`}
          columns={auditColumns}
          dataSource={auditRows}
          pagination={false}
        />
      </Card>
    </div>
  )
}

export default PluginDebugPage
