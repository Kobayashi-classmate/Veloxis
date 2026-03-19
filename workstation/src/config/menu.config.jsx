import AnimatedIcon from '@stateless/AnimatedIcon'
import React from 'react'
import {
  HomeOutlined,
  DeploymentUnitOutlined,
  HeatMapOutlined,
  ApartmentOutlined,
  QuestionCircleOutlined,
  GlobalOutlined,
  QrcodeOutlined,
  RocketOutlined,
  BankOutlined,
  FundProjectionScreenOutlined,
  BarChartOutlined,
  HighlightOutlined,
  ExperimentOutlined,
  SoundOutlined,
  LockOutlined,
  VideoCameraOutlined,
  PieChartOutlined,
  RobotOutlined,
  SendOutlined,
  EnvironmentOutlined,
  PrinterOutlined,
  UserOutlined,
  ContactsOutlined,
  Html5Outlined,
  CloudServerOutlined,
  AppstoreOutlined,
  CodeOutlined,
  ProjectOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'

// 静态菜单配置
// 这里的 path 对应路由 path
const rawMainLayoutMenu = [
  {
    label: 'home',
    i18nKey: 'home',
    path: '/',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <HomeOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'demo',
    i18nKey: 'demo',
    path: '/demo',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <GlobalOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '项目依赖分析',
    i18nKey: 'menu.dependencies',
    path: '/dependencies',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <CloudUploadOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Text Editor',
    i18nKey: 'menu.textEditor',
    path: '/text-editor',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <FileTextOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Zustand演示',
    i18nKey: 'menu.zustand',
    path: '/zustand',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <DatabaseOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Motion',
    i18nKey: 'menu.motion',
    path: '/motion',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <PlayCircleOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Mermaid',
    i18nKey: 'menu.mermaid',
    path: '/mermaid',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ProjectOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Topology',
    i18nKey: 'menu.topology',
    path: '/topology',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <DeploymentUnitOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '权限示例',
    i18nKey: 'menu.permissionExample',
    path: '/permission',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <LockOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'ChatGPT',
    i18nKey: 'menu.chatgpt',
    path: '/chatgpt',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <RobotOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Crypto',
    i18nKey: 'menu.crypto',
    path: '/crypto',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <SafetyCertificateOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Echarts',
    i18nKey: 'menu.echarts',
    path: '/echarts',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <PieChartOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Qr Generate',
    i18nKey: 'menu.qrGenerate',
    path: '/qrcode',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <QrcodeOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Business',
    i18nKey: 'menu.business',
    path: '/business',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <BankOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Prism Render',
    i18nKey: 'menu.prismRender',
    path: '/prism',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <HighlightOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Print',
    i18nKey: 'menu.print',
    path: '/print',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <PrinterOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Profile',
    i18nKey: 'menu.profile',
    path: '/profile',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <UserOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Contact',
    i18nKey: 'menu.contact',
    path: '/contact',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ContactsOutlined />
      </AnimatedIcon>
    ),
  },
]

// 规范化菜单：确保同时存在 path 和 key（两者值一致）
function normalizeMenu(items) {
  return items.map((it) => {
    const { children, ...rest } = it
    const path = it.path || it.key
    // Ant Design Menu 需要 key 属性
    const normalized = { ...rest, path, key: it.key || path }
    if (children && Array.isArray(children)) {
      normalized.children = normalizeMenu(children)
    }
    return normalized
  })
}

export const mainLayoutMenu = normalizeMenu(rawMainLayoutMenu)
