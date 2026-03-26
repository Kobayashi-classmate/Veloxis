import React from 'react'
import { lazyComponents } from '../config/lazyLoad.config'

/**
 * 项目详情相关路由
 */
export const projectRoutes = [
  {
    path: 'project/:id',
    element: <lazyComponents.ProjectLayout />,
    children: [
      {
        index: true,
        i18nKey: 'menu.project.overview',
        element: <lazyComponents.ProjectOverview />,
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
