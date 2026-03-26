import React from 'react'
import { lazyComponents } from '../config/lazyLoad.config'

/**
 * 业务功能路由
 * 主要的业务页面路由配置
 */
export const businessRoutes = [
  {
    path: 'demo',
    name: 'Demo',
    i18nKey: 'demo',
    element: <lazyComponents.Demo />,
  },
  {
    path: 'zustand',
    name: 'Zustand演示',
    i18nKey: 'menu.zustand',
    element: <lazyComponents.ZustandDemo />,
  },
  {
    path: 'motion',
    name: 'Motion',
    i18nKey: 'menu.motion',
    element: <lazyComponents.Motion />,
  },
  {
    path: 'business',
    name: 'Business',
    i18nKey: 'menu.business',
    element: <lazyComponents.Business />,
  },
]
