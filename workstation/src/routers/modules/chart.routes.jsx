import React from 'react'
import { lazyComponents } from '../config/lazyLoad.config'

/**
 * 图表相关路由
 * 包含各种数据可视化页面
 */
export const chartRoutes = [
  {
    path: 'geo',
    name: 'Geo Chart',
    element: <lazyComponents.GeoChart />,
  },
  {
    path: 'echarts',
    name: 'React Echarts',
    i18nKey: 'menu.echarts',
    element: <lazyComponents.Echarts />,
  },
  {
    path: 'topology',
    name: 'Topology',
    i18nKey: 'menu.topology',
    element: <lazyComponents.Topology />,
  },
  {
    path: 'mermaid',
    name: 'Mermaid',
    i18nKey: 'menu.mermaid',
    element: <lazyComponents.Mermaid />,
  },
]
