import React from 'react'
import { Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@src/components/auth/ProtectedRoute'
import { lazyComponents } from '../config/lazyLoad.config'

export const adminRoutes = [
  {
    path: 'admin',
    name: '管理员控制台',
    i18nKey: 'menu.admin.console',
    auth: true,
    element: (
      <ProtectedRoute permission="system:read">
        <lazyComponents.AdminLayout />
      </ProtectedRoute>
    ),
    meta: {
      title: '管理员控制台',
      permission: 'system:read',
      keepAlive: false,
    },
    children: [
      {
        index: true,
        element: <Navigate to="overview" replace />,
      },
      {
        path: 'overview',
        name: 'Overview',
        i18nKey: 'menu.admin.overview',
        element: <lazyComponents.AdminOverview />,
      },
      {
        path: 'users',
        name: 'Users',
        i18nKey: 'menu.admin.users',
        element: <lazyComponents.AdminUsers />,
      },
      {
        path: 'roles',
        name: 'Roles',
        i18nKey: 'menu.admin.roles',
        element: <lazyComponents.AdminRoles />,
      },
      {
        path: 'organizations',
        name: 'Organizations',
        i18nKey: 'menu.admin.organizations',
        element: <lazyComponents.AdminOrganizations />,
      },
      {
        path: 'members',
        name: 'Members',
        i18nKey: 'menu.admin.members',
        element: <lazyComponents.AdminMembers />,
      },
      {
        path: 'projects',
        name: 'Projects',
        i18nKey: 'menu.admin.projects',
        element: <lazyComponents.AdminProjects />,
      },
      {
        path: 'plugins',
        name: 'Plugins',
        i18nKey: 'menu.admin.plugins',
        element: <lazyComponents.AdminPlugins />,
      },
      {
        path: 'audit',
        name: 'Audit',
        i18nKey: 'menu.admin.audit',
        element: <lazyComponents.AdminAudit />,
      },
      {
        path: 'legacy',
        name: 'Legacy Admin',
        i18nKey: 'menu.admin.legacy',
        element: <lazyComponents.AdminLegacy />,
      },
    ],
  },
]
