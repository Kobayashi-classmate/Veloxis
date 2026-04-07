/**
 * Recipes API — Directus v11 Items API
 *
 * Collections:
 *   recipes   — ETL 配方记录（属于某 project + dataset）
 */

import request from '../request'
import { getDatasets } from './datasets'

export type { Dataset } from './datasets'
export { getDatasets }

export interface ProjectRecipe {
  id: string
  project_id: string
  dataset_id: string
  name: string
  description?: string
  config: RecipeOp[]
  header_row_count?: number
  storage_row_index?: number
  label_row_index?: number
  date_created?: string
  date_updated?: string
}

export interface RecipeOp {
  type: 'rename' | 'filter' | 'uppercase' | 'lowercase'
  from: string
  to?: string
  label?: string
}

/**
 * 获取指定项目下的所有 ETL 配方
 */
export async function getRecipesByProject(projectId: string): Promise<ProjectRecipe[]> {
  const res = await request.get('/items/recipes', {
    'filter[project_id][_eq]': projectId,
    sort: '-date_created',
    limit: -1,
  })
  return (res as any)?.data ?? res ?? []
}

/**
 * 创建项目级 ETL 配方
 */
export async function createProjectRecipe(data: {
  project_id: string
  dataset_id: string
  name: string
  description?: string
  config: RecipeOp[]
  header_row_count?: number
  storage_row_index?: number
  label_row_index?: number
}): Promise<ProjectRecipe> {
  const res = await request.post('/items/recipes', {
    project_id: data.project_id,
    dataset_id: data.dataset_id,
    name: data.name,
    description: data.description ?? '',
    config: data.config,
    header_row_count: data.header_row_count ?? 1,
    storage_row_index: data.storage_row_index ?? 0,
    label_row_index: data.label_row_index ?? 1,
  })
  return (res as any)?.data ?? res
}

/**
 * 更新 ETL 配方（名称、描述、处理步骤）
 */
export async function updateProjectRecipe(
  id: string,
  data: Partial<
    Pick<
      ProjectRecipe,
      'name' | 'description' | 'config' | 'header_row_count' | 'storage_row_index' | 'label_row_index'
    >
  >
): Promise<void> {
  await request.patch(`/items/recipes/${id}`, data)
}

/**
 * 删除 ETL 配方
 */
export async function deleteProjectRecipe(id: string): Promise<void> {
  await request.delete(`/items/recipes/${id}`)
}
