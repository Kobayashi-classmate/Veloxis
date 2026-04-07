import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Space, Table, Tag, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminDangerAction from '../components/AdminDangerAction'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import { fetchAdminProjects } from '@src/service/api/admin'
import styles from '../index.module.less'

const { Text } = Typography

const statusColorMap = {
  active: 'success',
  warning: 'warning',
  frozen: 'warning',
  archived: 'default',
}

const ProjectsPage = () => {
  const { message } = App.useApp()
  const { profile, organizationId, actor } = useAdminOutlet()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const records = await fetchAdminProjects({
        organizationScoped: profile.organizationScoped,
        organizationId,
      })
      setProjects(records)
    } catch (err) {
      const errorMessage = err?.message || '项目数据加载失败，请稍后重试。'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [message, profile.organizationScoped, organizationId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const scopedProjects = useMemo(() => {
    if (!profile.organizationScoped) return projects
    const organizationFiltered = projects.filter(
      (item) => item.organization_id === organizationId || item.organization_name === organizationId
    )
    return organizationFiltered.length > 0 ? organizationFiltered : projects
  }, [profile.organizationScoped, projects, organizationId])

  return (
    <AdminPageShell
      title="Projects"
      subtitle="统一管理项目状态、负责人、成员入口与配置动作。"
      roleLabel={profile.roleLabel}
      organizationScoped={profile.organizationScoped}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadProjects} loading={loading}>
            刷新
          </Button>
          <Button type="primary">创建项目</Button>
        </Space>
      }
    >
      {error ? (
        <Alert showIcon type="error" message="加载失败" description={error} style={{ marginBottom: 12 }} />
      ) : null}

      <Card className={styles.sectionCard}>
        <div className={styles.tableWrap}>
          <Table
            loading={loading}
            rowKey="id"
            dataSource={scopedProjects}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: 'Project',
                dataIndex: 'name',
                render: (_, record) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{record.name}</Text>
                    <Text type="secondary">slug: {record.slug}</Text>
                  </Space>
                ),
              },
              {
                title: 'Organization',
                dataIndex: 'organization_name',
              },
              {
                title: 'Owner',
                dataIndex: 'owner_user',
              },
              {
                title: 'Members',
                dataIndex: 'member_count',
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (value) => <Tag color={statusColorMap[value] || 'default'}>{value}</Tag>,
              },
              {
                title: 'Last Activity',
                dataIndex: 'last_activity_at',
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_, record) => (
                  <Space wrap>
                    <Button size="small">成员管理</Button>
                    <Button size="small">项目配置</Button>
                    <AdminDangerAction
                      actionKey="admin.projects.freeze"
                      label={record.status === 'frozen' ? '解冻项目' : '冻结项目'}
                      target={record.id}
                      description="冻结后将阻断新任务调度与写入操作。"
                      riskLevel="high"
                      actor={actor}
                      disabled={!profile.capabilities.highRiskMutation && record.organization_id !== organizationId}
                      disabledReason="当前角色不可操作跨组织项目"
                      onConfirm={async (payload) => {
                        message.success(`项目状态变更请求已提交: ${payload.target_id}`)
                      }}
                    />
                  </Space>
                ),
              },
            ]}
          />
        </div>
      </Card>
    </AdminPageShell>
  )
}

export default ProjectsPage
