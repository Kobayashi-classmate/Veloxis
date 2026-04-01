import React, { useState, useEffect, useMemo } from 'react'
import { Layout, theme, Space } from 'antd'
import { useLocation } from 'react-router-dom'
import { getKeyName } from '@utils/publicFn'
import { permissionService } from '@src/service/permissionService'
import { createHomeTabKey, normalizePath, resolveScopeHomePath, resolveScopeKey } from '@src/utils/tabScope'
import ProTabs from '../proTabs'
import styles from './index.module.less'

const { Content, Footer } = Layout

const ProContent = () => {
  const [tabActiveKey, setTabActiveKey] = useState('home')
  const [allowedRoutes, setAllowedRoutes] = useState(['/'])
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

  const scopeKey = useMemo(() => resolveScopeKey(pathname), [pathname])
  const scopeHomePath = useMemo(() => resolveScopeHomePath(pathname, allowedRoutes), [pathname, allowedRoutes])
  const scopeHomePane = useMemo(() => {
    // "/" 在路由表中先匹配到 Layout，会导致内容区递归嵌套；
    // 这里将主菜单首页映射到实际首页页面组件（workbench）。
    const normalizedHome = normalizePath(scopeHomePath)
    const homeInfo = normalizedHome === '/' ? getKeyName('/workbench') : getKeyName(scopeHomePath)

    return {
      title: homeInfo?.title || 'Home',
      content: homeInfo?.element || null,
      i18nKey: homeInfo?.i18nKey,
      path: normalizedHome,
      closable: false,
    }
  }, [scopeHomePath])

  useEffect(() => {
    let mounted = true

    const loadAllowedRoutes = async () => {
      try {
        const permissions = await permissionService.getPermissions()
        if (!mounted) return
        const routes = Array.isArray(permissions?.routes) ? permissions.routes : []
        const nextRoutes = Array.from(new Set(['/'].concat(routes.filter(Boolean))))
        setAllowedRoutes(nextRoutes)
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ProContent] loadAllowedRoutes failed:', error)
        }
        if (mounted) setAllowedRoutes(['/'])
      }
    }

    loadAllowedRoutes()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    // pass full path (including search) so getKeyName can consider query params
    const full = search ? pathname + search : pathname
    const currentInfo = getKeyName(full)
    const homeTabKey = createHomeTabKey(scopeKey)
    const isScopeHome = normalizePath(pathname) === normalizePath(scopeHomePath)

    const tabKey = isScopeHome ? homeTabKey : currentInfo?.tabKey
    const title = isScopeHome ? scopeHomePane?.title || currentInfo?.title : currentInfo?.title
    const element = isScopeHome ? scopeHomePane?.content || currentInfo?.element : currentInfo?.element
    const i18nKey = isScopeHome ? scopeHomePane?.i18nKey || currentInfo?.i18nKey : currentInfo?.i18nKey
    const tabPath = isScopeHome ? `${scopeHomePath}${search || ''}` : full

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        setPanesItem({
          title,
          content: element,
          key: tabKey,
          closable: !isScopeHome,
          path: tabPath,
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
          closable: !isScopeHome,
          path: tabPath,
          i18nKey,
        })
        setTabActiveKey(tabKey)
      }, 0)
    }
  }, [pathname, search, scopeKey, scopeHomePath, scopeHomePane])

  return (
    <Layout className={styles.layout} id="fullScreen">
      <Content className="layout-content" id="fullScreenContent" style={{ backgroundColor: colorBgContainer }}>
        <ProTabs
          panesItem={panesItem}
          tabActiveKey={tabActiveKey}
          scopeKey={scopeKey}
          scopeHomePath={scopeHomePath}
          scopeHomePane={scopeHomePane}
        />
      </Content>
      <Footer className="layout-footer">
        <Space>&copy; {new Date().getFullYear()} Veloxis Panel</Space>
      </Footer>
    </Layout>
  )
}

export default ProContent
