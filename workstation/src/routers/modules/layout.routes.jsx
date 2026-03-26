import React from 'react'
import Layout from '@pages/layout'
import { ProtectedRoute } from '@src/components/auth/ProtectedRoute'
import { lazyComponents } from '../config/lazyLoad.config'

/**
 * 独立布局路由
 * 具有独立布局的模块（不包含在主 Layout 中）
 */
export const layoutRoutes = [
  // Dashboard模块（独立布局）
  {
    path: 'dashboard/*',
    name: 'Dashboard',
    auth: true,
    element: <lazyComponents.Dashboard />,
  },
]

/**
 * 主布局路由配置
 * 包含主 Layout 和所有子路由
 */
export const mainLayoutRoute = {
  path: '/',
  name: '首页',
  i18nKey: 'home',
  auth: true,
  element: (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  ),
  children: [
    // 首页默认路由 → 工作台
    {
      index: true,
      name: '我的工作台',
      i18nKey: 'menu.workbench',
      element: <lazyComponents.Workbench />,
    },
    // 用户工作台（保留显式路径，便于直接访问）
    {
      path: 'workbench',
      name: '我的工作台',
      i18nKey: 'menu.workbench',
      element: <lazyComponents.Workbench />,
      meta: {
        title: '我的工作台',
        icon: 'AppstoreOutlined',
        keepAlive: true,
        permission: 'workbench:read',
      },
    },
    // 演示页（原首页）
    {
      path: 'demo',
      name: '演示',
      i18nKey: 'demo',
      element: <lazyComponents.Home />,
      meta: {
        title: '演示',
        icon: 'GlobalOutlined',
        keepAlive: true,
      },
    },
    // 项目大厅
    {
      path: 'workspaces',
      name: '项目大厅',
      i18nKey: 'menu.workspaces',
      element: <lazyComponents.Workspaces />,
      meta: {
        title: '项目大厅',
        icon: 'AppstoreOutlined',
        keepAlive: true,
        permission: 'workspaces:read',
      },
    },
    // 全局控制台
    {
      path: 'global-console',
      name: '全局控制台',
      i18nKey: 'menu.globalConsole',
      element: <lazyComponents.GlobalConsole />,
      meta: {
        title: '全局控制台',
        icon: 'GlobalOutlined',
        keepAlive: true,
        permission: 'global-console:read',
      },
    },
  ],
}
