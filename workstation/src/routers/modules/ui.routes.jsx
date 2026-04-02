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
    i18nKey: 'menu.qrGenerate',
    element: <lazyComponents.QrCode />,
  },
  {
    path: 'tilt',
    name: 'React Tilt',
    i18nKey: 'menu.reactTilt',
    element: <lazyComponents.ReactTilt />,
  },
  {
    path: 'music',
    name: 'React Music',
    i18nKey: 'menu.music',
    element: <lazyComponents.ReactMusic />,
  },
  {
    path: 'crypto',
    name: 'React Crypto',
    i18nKey: 'menu.crypto',
    element: <lazyComponents.MyCrypto />,
  },
  {
    path: 'chatgpt',
    name: 'ChatGPT Markmap',
    i18nKey: 'menu.chatgpt',
    element: <lazyComponents.ChatGpt />,
  },
  {
    path: 'prism',
    name: 'Prism Render',
    i18nKey: 'menu.prismRender',
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
    i18nKey: 'menu.print',
    element: <lazyComponents.Print />,
  },
  {
    path: 'profile',
    name: 'Profile',
    i18nKey: 'menu.profile',
    element: <lazyComponents.Profile />,
  },
  {
    path: 'setting',
    name: 'User Settings',
    i18nKey: 'menu.setting',
    element: <lazyComponents.UserSettings />,
  },
  {
    path: 'contact',
    name: 'Contact',
    i18nKey: 'menu.contact',
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
    path: 'plugin-debug',
    name: 'Plugin Debug',
    element: <lazyComponents.PluginDebug />,
  },
  {
    path: 'text-editor',
    name: '文本编辑器',
    i18nKey: 'menu.textEditor',
    element: <lazyComponents.RichTextEditor />,
  },
]
