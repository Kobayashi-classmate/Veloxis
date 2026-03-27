import request from '../request'

export interface Dataset {
  id: string
  name: string
  project_id: string
  type: 'CSV' | 'Excel'
  status: 'processing' | 'ready' | 'failed'
  date_created?: string
}

export interface DatasetVersion {
  id: string
  dataset_id: string
  version_name: string
  file_id: string
  status: 'processing' | 'ready' | 'failed'
  date_created?: string
}

export interface RecipeOperator {
  type: 'rename' | 'filter' | 'uppercase' | 'lowercase'
  from: string
  to: string
  label?: string
}

export interface Recipe {
  id: string
  dataset_id: string
  name: string
  config: RecipeOperator[]
  /** 首次导入时保存的表头行数（1 或 2） */
  header_row_count?: number
  /** 存储行在文件中的索引（0-based） */
  storage_row_index?: number
  /** 展示行在文件中的索引（0-based） */
  label_row_index?: number
}

/** 项目 Folder UUID 缓存（projectId → folderUUID），避免重复请求 */
const folderCache: Record<string, string> = {}

/**
 * 确保 Directus 中存在与项目对应的 Folder，返回 folder UUID
 * 文件夹名称格式：project_{projectId}
 */
export async function ensureProjectFolder(projectId: string): Promise<string> {
  if (folderCache[projectId]) return folderCache[projectId]

  const folderName = `project_${projectId}`

  // 查询是否已存在
  const listRes = await request.get('/folders', {
    'filter[name][_eq]': folderName,
    limit: 1,
  })
  const existing = ((listRes as any)?.data ?? listRes) as any[]

  if (existing?.length > 0) {
    folderCache[projectId] = existing[0].id
    return existing[0].id
  }

  // 不存在则创建
  const createRes = await request.post('/folders', { name: folderName })
  const created = (createRes as any)?.data ?? createRes
  folderCache[projectId] = created.id
  return created.id
}

/**
 * 上传文件到 Directus /files，按项目分目录存储
 */
export async function uploadDatasetFile(file: File, projectId: string): Promise<any> {
  const folderId = await ensureProjectFolder(projectId)

  const formData = new FormData()
  formData.append('title', file.name)
  formData.append('folder', folderId)
  formData.append('file', file)

  const res = await request.post('/files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return (res as any)?.data ?? res
}

/**
 * 上传文件到 Directus /files，支持上传进度回调
 * onProgress(percent: 0-100)
 */
export function uploadDatasetFileWithProgress(
  file: File,
  folderId: string,
  onProgress: (percent: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    /** 读取 Token（与 request.js 保持一致） */
    let token = ''
    try {
      const raw = localStorage.getItem('token')
      if (raw) {
        const parsed = JSON.parse(raw)
        token = typeof parsed === 'object' ? parsed.token ?? '' : raw
      }
    } catch { /* 忽略 */ }

    /** 读取 BaseURL */
    let baseURL = ''
    try {
      if (typeof (window as any).__APP_CONFIG__ !== 'undefined') {
        baseURL = (window as any).__APP_CONFIG__?.APP_BASE_URL ?? ''
      }
    } catch { /* 忽略 */ }

    const formData = new FormData()
    formData.append('title', file.name)
    formData.append('folder', folderId)
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${baseURL}/api/files`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        /** 上传进度最多到 99%：文件传完后服务器仍在处理，
         *  等 xhr.onload 真正返回后再由调用方将进度推到 100% */
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText)
          resolve(json?.data ?? json)
        } catch {
          reject(new Error('响应解析失败'))
        }
      } else {
        reject(new Error(`上传失败，状态码 ${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error('网络错误，上传失败'))
    xhr.onabort = () => reject(new Error('上传已取消'))

    xhr.send(formData)
  })
}

/**
 * 获取指定项目的所有数据源
 */
export async function getDatasets(projectId: string): Promise<Dataset[]> {
  const res = await request.get('/items/datasets', {
    'filter[project_id][_eq]': projectId,
    sort: '-id',
  })
  return (res as any)?.data ?? res
}

/**
 * 创建新的数据源记录
 */
export async function createDataset(data: {
  name: string
  project_id: string
  type: 'CSV' | 'Excel'
  status?: string
}): Promise<Dataset> {
  const datasetRes = await request.post('/items/datasets', {
    name: data.name,
    project_id: data.project_id,
    type: data.type,
    status: data.status || 'processing',
  })
  return (datasetRes as any)?.data ?? datasetRes
}

/**
 * 更新数据源基本信息（名称等）
 */
export async function updateDataset(id: string, data: Partial<Pick<Dataset, 'name' | 'type' | 'status'>>): Promise<Dataset> {
  const res = await request.patch(`/items/datasets/${id}`, data)
  return (res as any)?.data ?? res
}

/**
 * 删除数据源记录
 */
export async function deleteDataset(id: string): Promise<void> {
  await request.delete(`/items/datasets/${id}`)
}

/**
 * 获取数据源的版本历史（最新 10 条）
 */
export async function getDatasetVersions(datasetId: string): Promise<DatasetVersion[]> {
  const res = await request.get('/items/dataset_versions', {
    'filter[dataset_id][_eq]': datasetId,
    sort: '-id',
    limit: 10,
  })
  return (res as any)?.data ?? res
}

/**
 * 创建数据源版本（用于记录文件处理状态）
 */
export async function createDatasetVersion(data: {
  dataset_id: string
  version_name: string
  file_id: string
  status: string
}): Promise<DatasetVersion> {
  const versionRes = await request.post('/items/dataset_versions', {
    dataset_id: data.dataset_id,
    version_name: data.version_name,
    file_id: data.file_id,
    status: data.status,
  })
  return (versionRes as any)?.data ?? versionRes
}

/**
 * 创建 ETL Recipe（数据处理规则）
 */
export async function createRecipe(data: {
  dataset_id: string
  name: string
  config: RecipeOperator[]
  header_row_count?: number
  storage_row_index?: number
  label_row_index?: number
}): Promise<any> {
  const recipeRes = await request.post('/items/recipes', {
    dataset_id: data.dataset_id,
    name: data.name,
    config: data.config,
    header_row_count: data.header_row_count ?? 1,
    storage_row_index: data.storage_row_index ?? 0,
    label_row_index: data.label_row_index ?? 1,
  })
  return (recipeRes as any)?.data ?? recipeRes
}

/**
 * 获取数据源的 ETL Recipe（取最新一条）
 */
export async function getRecipes(datasetId: string): Promise<any[]> {
  const res = await request.get('/items/recipes', {
    'filter[dataset_id][_eq]': datasetId,
    limit: 1,
  })
  return (res as any)?.data ?? res
}

/**
 * 更新 ETL Recipe 配置
 */
export async function updateRecipe(id: string, data: {
  config: RecipeOperator[]
  header_row_count?: number
  storage_row_index?: number
  label_row_index?: number
}): Promise<any> {
  const res = await request.patch(`/items/recipes/${id}`, {
    config: data.config,
    ...(data.header_row_count !== undefined && { header_row_count: data.header_row_count }),
    ...(data.storage_row_index !== undefined && { storage_row_index: data.storage_row_index }),
    ...(data.label_row_index !== undefined && { label_row_index: data.label_row_index }),
  })
  return (res as any)?.data ?? res
}
