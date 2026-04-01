import React from 'react'
import { lazyComponents } from '../config/lazyLoad.config'

/**
 * 项目详情相关路由
 */
export const projectRoutes = [
  {
    path: 'project/:slug',
    name: '项目概览',
    i18nKey: 'menu.project.overview',
    element: <lazyComponents.ProjectLayout />,
    children: [
      {
        index: true,
        i18nKey: 'menu.project.overview',
        element: <lazyComponents.ProjectOverview />,
      },
      {
        path: 'datasets',
        i18nKey: 'menu.project.datasets',
        element: <lazyComponents.ProjectDatasets />,
      },
      {
        path: 'models',
        i18nKey: 'menu.project.models',
        element: <lazyComponents.ProjectModels />,
      },
      {
        path: 'workbooks',
        i18nKey: 'menu.project.workbooks',
        element: <lazyComponents.ProjectWorkbooks />,
      },
      {
        // 全屏可视化编辑器：position:fixed 覆盖视口，脱离 ProjectLayout 视觉框架
        path: 'workbooks/:workbookSlug',
        i18nKey: 'menu.project.visualWorkbench',
        element: <lazyComponents.VisualWorkbench />,
      },
      {
        path: 'recipes',
        i18nKey: 'menu.project.recipes',
        element: <lazyComponents.ProjectRecipes />,
      },
      {
        path: 'members',
        i18nKey: 'menu.project.members',
        element: <lazyComponents.ProjectMembers />,
      },
      {
        path: 'settings',
        i18nKey: 'menu.project.settings',
        element: <lazyComponents.ProjectSettings />,
      },
    ],
  },
]
