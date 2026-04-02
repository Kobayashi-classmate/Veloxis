import React from 'react'
import PropTypes from 'prop-types'
import { Space, Tag, Typography } from 'antd'
import styles from './index.module.less'

const { Title, Paragraph } = Typography

const AdminPageShell = ({ title, subtitle, roleLabel, tenantScoped, extra, children }) => {
  return (
    <div className={styles.pageBody}>
      <div className={styles.pageHeader}>
        <Space direction="vertical" size={4}>
          <Title level={3} className={styles.pageTitle}>
            {title}
          </Title>
          {subtitle ? <Paragraph className={styles.pageSubTitle}>{subtitle}</Paragraph> : null}
          <Space size={8} wrap>
            <Tag color="geekblue" className={styles.scopeTag}>
              {roleLabel || 'User'}
            </Tag>
            {tenantScoped ? <Tag color="gold">Tenant Scope</Tag> : <Tag color="cyan">Platform Scope</Tag>}
          </Space>
        </Space>
        {extra ? <div>{extra}</div> : null}
      </div>
      {children}
    </div>
  )
}

AdminPageShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  roleLabel: PropTypes.string,
  tenantScoped: PropTypes.bool,
  extra: PropTypes.node,
  children: PropTypes.node,
}

export default AdminPageShell
