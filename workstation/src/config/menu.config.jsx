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
  ControlOutlined,
  FolderOpenOutlined,
  DashboardOutlined,
  TeamOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons'

// 静态菜单配置
// 这里的 path 对应路由 path
const rawMainLayoutMenu = [
  {
    label: '我的工作台',
    i18nKey: 'menu.workbench',
    path: '/',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <AppstoreOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '项目大厅',
    i18nKey: 'menu.workspaces',
    path: '/workspaces',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <FolderOpenOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '全局控制台',
    i18nKey: 'menu.globalConsole',
    path: '/global-console',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ControlOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '演示',
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
    label: 'Plugin Debug',
    path: '/plugin-debug',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ToolOutlined />
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

// 项目内部专用的菜单配置
const rawProjectMenu = [
  {
    label: '项目概览',
    i18nKey: 'menu.project.overview',
    path: '/project/:slug',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <DashboardOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '数据源管理',
    i18nKey: 'menu.project.datasets',
    path: '/project/:slug/datasets',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <DatabaseOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '数据模型',
    i18nKey: 'menu.project.models',
    path: '/project/:slug/models',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <NodeIndexOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '可视化工作台',
    i18nKey: 'menu.project.workbooks',
    path: '/project/:slug/workbooks',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <BarChartOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '数据配方 (ETL)',
    i18nKey: 'menu.project.recipes',
    path: '/project/:slug/recipes',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ThunderboltOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '成员管理',
    i18nKey: 'menu.project.members',
    path: '/project/:slug/members',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <TeamOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '项目设置',
    i18nKey: 'menu.project.settings',
    path: '/project/:slug/settings',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <SettingOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '返回大厅',
    i18nKey: 'menu.project.back',
    path: '/workspaces',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ArrowLeftOutlined />
      </AnimatedIcon>
    ),
  },
]

export const projectMenu = normalizeMenu(rawProjectMenu)

const rawAdminMenu = [
  {
    label: '管理总览',
    path: '/admin/overview',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <SafetyCertificateOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '用户管理',
    path: '/admin/users',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <UserOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '角色管理',
    path: '/admin/roles',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <LockOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '组织管理',
    path: '/admin/organizations',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ApartmentOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '成员关系',
    path: '/admin/members',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <TeamOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '项目管理',
    path: '/admin/projects',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ProjectOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '插件治理',
    path: '/admin/plugins',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ToolOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '审计中心',
    path: '/admin/audit',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <SafetyCertificateOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: 'Legacy 入口',
    path: '/admin/legacy',
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <SettingOutlined />
      </AnimatedIcon>
    ),
  },
  {
    label: '返回前台首页',
    path: '/',
    alwaysVisible: true,
    bypassPermission: true,
    icon: (
      <AnimatedIcon variant="spin" mode="hover">
        <ArrowLeftOutlined />
      </AnimatedIcon>
    ),
  },
]

export const adminMenu = normalizeMenu(rawAdminMenu)
