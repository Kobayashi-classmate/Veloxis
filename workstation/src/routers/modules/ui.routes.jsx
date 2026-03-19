import React from 'react'
import { lazyComponents } from '../config/lazyLoad.config'

/**
 * UI 组件相关路由
 * 包含各种 UI 展示页面
 */
export const uiRoutes = [
  {
    path: 'qrcode',
    name: 'QrGenerate',
    element: <lazyComponents.QrCode />,
  },
  {
    path: 'tilt',
    name: 'React Tilt',
    element: <lazyComponents.ReactTilt />,
  },
  {
    path: 'music',
    name: 'React Music',
    element: <lazyComponents.ReactMusic />,
  },
  {
    path: 'crypto',
    name: 'React Crypto',
    element: <lazyComponents.MyCrypto />,
  },
  {
    path: 'chatgpt',
    name: 'ChatGPT Markmap',
    element: <lazyComponents.ChatGpt />,
  },
  {
    path: 'prism',
    name: 'Prism Render',
    element: <lazyComponents.PrismRender />,
  },
  {
    path: 'my-iframe',
    name: 'My Iframe',
    element: <lazyComponents.MyIframe />,
  },
  {
    path: 'print',
    name: 'Print',
    element: <lazyComponents.Print />,
  },
  {
    path: 'profile',
    name: 'Profile',
    element: <lazyComponents.Profile />,
  },
  {
    path: 'contact',
    name: 'Contact',
    element: <lazyComponents.Contact />,
  },
  {
    path: 'permission',
    name: '权限示例',
    i18nKey: 'menu.permissionExample',
    element: <lazyComponents.PermissionExample />,
  },
  {
    path: 'dependencies',
    name: '项目依赖分析',
    i18nKey: 'menu.dependencies',
    element: <lazyComponents.Dependencies />,
  },
  {
    path: 'text-editor',
    name: '文本编辑器',
    i18nKey: 'menu.textEditor',
    element: <lazyComponents.RichTextEditor />,
  },
]
