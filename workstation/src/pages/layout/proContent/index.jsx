import React, { useState, useEffect } from 'react'
import { Layout, theme, Space } from 'antd'
import { useLocation } from 'react-router-dom'
import { getKeyName } from '@utils/publicFn'
import ProTabs from '../proTabs'
import styles from './index.module.less'

const { Content, Footer } = Layout

const ProContent = () => {
  const [tabActiveKey, setTabActiveKey] = useState('home')
  const [panesItem, setPanesItem] = useState({
    title: '',
    content: null,
    key: '',
    closable: false,
    path: '',
    i18nKey: '',
  })
  const { pathname, search } = useLocation()
  const {
    token: { colorBgContainer },
  } = theme.useToken()
  useEffect(() => {
    // pass full path (including search) so getKeyName can consider query params
    const full = search ? pathname + search : pathname
    const { tabKey, title, element, i18nKey } = getKeyName(full)

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        setPanesItem({
          title,
          content: element,
          key: tabKey,
          closable: tabKey !== '/',
          path: full,
          i18nKey,
        })
        setTabActiveKey(tabKey)
      })
    } else {
      setTimeout(() => {
        setPanesItem({
          title,
          content: element,
          key: tabKey,
          closable: tabKey !== '/',
          path: full,
          i18nKey,
        })
        setTabActiveKey(tabKey)
      }, 0)
    }
  }, [pathname, search])

  return (
    <Layout className={styles.layout} id="fullScreen">
      <Content className="layout-content" id="fullScreenContent" style={{ backgroundColor: colorBgContainer }}>
        <ProTabs panesItem={panesItem} tabActiveKey={tabActiveKey} />
      </Content>
      <Footer className="layout-footer">
        <Space>&copy; {new Date().getFullYear()} Veloxis Panel</Space>
      </Footer>
    </Layout>
  )
}

export default ProContent
