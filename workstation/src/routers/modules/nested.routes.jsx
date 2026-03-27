import React from 'react'
import { Outlet } from 'react-router-dom'
import { lazyComponents } from '../config/lazyLoad.config'
import RouterErrorElement from '@/components/RouterErrorElement'

/**
 * 嵌套路由配置
 * 规则总结：
 * 1. 所有 key 必须等于该路由真实匹配的完整 URL
 * 2. index: true 的路由，其 key = 父路由的完整路径（绝不能写成 /xxx/index）
 * 3. 中间层级路由（有子路由）必须使用 <Outlet />
 * 4. 面包屑、菜单高亮、权限控制全部依赖 key，保持一致极为重要
 */
export const nestedRoutes = [
  // 前端技术栈模块（嵌套路由）
]
