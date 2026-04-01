import React from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { Layout } from 'antd'
import FixTabPanel from '@stateless/FixTabPanel'
import styles from './index.module.less'

const { Content } = Layout

const ProjectLayout = () => {
  const { slug } = useParams()

  return (
    <FixTabPanel>
      <Layout className={styles.projectLayout}>
        <Content className={styles.projectContent}>
          <div className={styles.contentWrapper}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </FixTabPanel>
  )
}

export default ProjectLayout
