import request from '../request'

export interface Dataset {
  id: string
  name: string
  project_id: string
  type: string
  status: string
  date_created?: string
}

/**
 * 上传文件到 Directus /files
 */
export async function uploadDatasetFile(file: File): Promise<any> {
  const formData = new FormData()
  formData.append('title', file.name)
  formData.append('file', file)
  
  const res = await request.post('/files', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return (res as any)?.data ?? res
}

/**
 * 获取指定项目的所有数据源
 */
export async function getDatasets(projectId: string): Promise<Dataset[]> {
  const res = await request.get('/items/datasets', {
    params: {
      filter: { project_id: { _eq: projectId } },
      sort: '-id'
    }
  })
  return (res as any)?.data ?? res
}

/**
 * 创建新的数据源记录
 */
export async function createDataset(data: {
  name: string
  project_id: string
  type: string
  status?: string
}): Promise<Dataset> {
  const datasetRes = await request.post('/items/datasets', {
    name: data.name,
    project_id: data.project_id,
    type: data.type,
    status: data.status || 'ready',
  })
  return (datasetRes as any)?.data ?? datasetRes
}

/**
 * 创建数据源版本（用于记录文件处理状态）
 */
export async function createDatasetVersion(data: {
  dataset_id: string
  version_name: string
  file_id: string
  status: string
}): Promise<any> {
  const versionRes = await request.post('/items/dataset_versions', {
    dataset_id: data.dataset_id,
    version_name: data.version_name,
    file_id: data.file_id,
    status: data.status,
  })
  return (versionRes as any)?.data ?? versionRes
}

/**
 * 创建 ETL Recipe (数据处理规则)
 */
export async function createRecipe(data: {
  dataset_id: string
  name: string
  config: any[]
}): Promise<any> {
  const recipeRes = await request.post('/items/recipes', {
    dataset_id: data.dataset_id,
    name: data.name,
    config: data.config,
  })
  return (recipeRes as any)?.data ?? recipeRes
}

export async function getRecipes(datasetId: string): Promise<any[]> {
  const res = await request.get('/items/recipes', {
    params: {
      filter: { dataset_id: { _eq: datasetId } },
      limit: 1
    }
  })
  return (res as any)?.data ?? res
}

export async function updateRecipe(id: string, data: { config: any[] }): Promise<any> {
  const res = await request.patch(`/items/recipes/${id}`, {
    config: data.config
  })
  return (res as any)?.data ?? res
}

