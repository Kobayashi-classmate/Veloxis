import React from 'react'
import { App, Alert, Button, Card, Space, Typography } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import AdminPageShell from '../components/AdminPageShell'
import AdminDangerAction from '../components/AdminDangerAction'
import { legacyEntry } from '../constants/legacyEntry'
import { useAdminOutlet } from '../hooks/useAdminOutlet'
import styles from '../index.module.less'

const { Paragraph, Text } = Typography

const LegacyPage = () => {
  const { message } = App.useApp()
  const { profile, actor } = useAdminOutlet()

  return (
    <AdminPageShell
      title="Legacy Admin Entry"
      subtitle="仅保留低频高级配置入口，默认推荐在 Admin Console 完成管理任务。"
      roleLabel={profile.roleLabel}
      tenantScoped={profile.tenantScoped}
    >
      <Alert
        type="info"
        showIcon
        message="过渡期受控入口"
        description="Legacy Admin 仅用于尚未迁移到 Admin Console 的低频高级配置，不作为主交互路径。"
      />

      <Card className={styles.sectionCard}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <div className={styles.legacyBox}>
            <Paragraph style={{ marginBottom: 8 }}>{legacyEntry.note}</Paragraph>
            <Text type="warning">{legacyEntry.warning}</Text>
          </div>

          <Space wrap>
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={() => {
                window.open(legacyEntry.url, '_blank', 'noopener')
              }}
            >
              进入 Legacy Admin
            </Button>

            <AdminDangerAction
              actionKey="admin.legacy.access"
              label="登记高危访问"
              target="legacy_directus_admin"
              description="进入旧后台前记录访问原因与操作窗口，保证审计可追踪。"
              riskLevel="high"
              actor={actor}
              onConfirm={async () => {
                message.success('Legacy 访问已登记，审计链路占位生效。')
              }}
            />
          </Space>
        </Space>
      </Card>
    </AdminPageShell>
  )
}

export default LegacyPage
