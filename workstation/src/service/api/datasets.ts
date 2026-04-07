import request from '../request'

export interface Dataset {
  id: string
  name: string
  project_id: string
  type: 'CSV' | 'Excel'
  status: 'processing' | 'ready' | 'failed'
  root_dataset_id?: string | null
  schema_fingerprint?: string | null
  schema_order?: number | null
  merge_same_schema?: boolean | null
  date_created?: string
}

export interface DatasetVersion {
  id: string
  dataset_id: string
  version_name: string
  file_id: string | null
  status: 'processing' | 'ready' | 'failed'
  ingest_batch_id?: string | null
  sheet_name?: string | null
  schema_fingerprint?: string | null
  source_file_name?: string | null
  source_sheet_name?: string | null
  date_created?: string
  /** Worker 失败时写入的错误信息（最长 500 字符） */
  error_message?: string | null
  /** 文件内容的 SHA-256 哈希值，用于判断多版本是否引用同一份文件内容 */
  file_hash?: string | null
}

export interface FileMetadata {
  id: string
  filename_download: string
  filesize: number
  type: string
  metadata?: any
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
        token = typeof parsed === 'object' ? (parsed.token ?? '') : raw
      }
    } catch {
      /* 忽略 */
    }

    /** 读取 BaseURL */
    let baseURL = ''
    try {
      if (typeof (window as any).__APP_CONFIG__ !== 'undefined') {
        baseURL = (window as any).__APP_CONFIG__?.APP_BASE_URL ?? ''
      }
    } catch {
      /* 忽略 */
    }

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
  root_dataset_id?: string | null
  schema_fingerprint?: string | null
  schema_order?: number | null
  merge_same_schema?: boolean | null
}): Promise<Dataset> {
  const datasetRes = await request.post('/items/datasets', {
    name: data.name,
    project_id: data.project_id,
    type: data.type,
    status: data.status || 'processing',
    ...(data.root_dataset_id !== undefined ? { root_dataset_id: data.root_dataset_id } : {}),
    ...(data.schema_fingerprint !== undefined ? { schema_fingerprint: data.schema_fingerprint } : {}),
    ...(data.schema_order !== undefined ? { schema_order: data.schema_order } : {}),
    ...(data.merge_same_schema !== undefined ? { merge_same_schema: data.merge_same_schema } : {}),
  })
  return (datasetRes as any)?.data ?? datasetRes
}

/**
 * 更新数据源基本信息（名称等）
 */
export async function updateDataset(
  id: string,
  data: Partial<Pick<Dataset, 'name' | 'type' | 'status' | 'merge_same_schema'>>
): Promise<Dataset> {
  const res = await request.patch(`/items/datasets/${id}`, data)
  return (res as any)?.data ?? res
}

/**
 * 获取数据源的版本历史
 * @param datasetId 数据源 ID
 * @param limit 最大返回条数，不传则返回全量（用于级联删除和文件管理）
 */
export async function getDatasetVersions(datasetId: string, limit?: number): Promise<DatasetVersion[]> {
  const params: Record<string, any> = {
    'filter[dataset_id][_eq]': datasetId,
    sort: '-id',
  }
  if (limit !== undefined) {
    params.limit = limit
  } else {
    params.limit = -1 // Directus: -1 = no limit
  }
  const res = await request.get('/items/dataset_versions', params)
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
  ingest_batch_id?: string
  sheet_name?: string
  schema_fingerprint?: string
  source_file_name?: string
  source_sheet_name?: string
}): Promise<DatasetVersion> {
  const versionRes = await request.post('/items/dataset_versions', {
    dataset_id: data.dataset_id,
    version_name: data.version_name,
    file_id: data.file_id,
    status: data.status,
    ...(data.ingest_batch_id !== undefined ? { ingest_batch_id: data.ingest_batch_id } : {}),
    ...(data.sheet_name !== undefined ? { sheet_name: data.sheet_name } : {}),
    ...(data.schema_fingerprint !== undefined ? { schema_fingerprint: data.schema_fingerprint } : {}),
    ...(data.source_file_name !== undefined ? { source_file_name: data.source_file_name } : {}),
    ...(data.source_sheet_name !== undefined ? { source_sheet_name: data.source_sheet_name } : {}),
  })
  return (versionRes as any)?.data ?? versionRes
}

export async function createDatasetVersionsBulk(
  data: Array<{
    dataset_id: string
    version_name: string
    file_id: string
    status: string
    ingest_batch_id?: string
    sheet_name?: string
    schema_fingerprint?: string
    source_file_name?: string
    source_sheet_name?: string
  }>
): Promise<DatasetVersion[]> {
  if (!Array.isArray(data) || data.length === 0) return []
  const payload = data.map((item) => ({
    dataset_id: item.dataset_id,
    version_name: item.version_name,
    file_id: item.file_id,
    status: item.status,
    ...(item.ingest_batch_id !== undefined ? { ingest_batch_id: item.ingest_batch_id } : {}),
    ...(item.sheet_name !== undefined ? { sheet_name: item.sheet_name } : {}),
    ...(item.schema_fingerprint !== undefined ? { schema_fingerprint: item.schema_fingerprint } : {}),
    ...(item.source_file_name !== undefined ? { source_file_name: item.source_file_name } : {}),
    ...(item.source_sheet_name !== undefined ? { source_sheet_name: item.source_sheet_name } : {}),
  }))
  const res = await request.post('/items/dataset_versions', payload)
  return (res as any)?.data ?? res ?? []
}

/**
 * 获取单个 Directus 文件的元数据（文件名、大小、类型等）
 */
export async function getFileMetadata(fileId: string): Promise<FileMetadata> {
  const res = await request.get(`/files/${fileId}`)
  return (res as any)?.data ?? res
}

/**
 * 删除 Directus 文件（物理删除）
 */
export async function deleteFile(fileId: string): Promise<void> {
  await request.delete(`/files/${fileId}`)
}

/**
 * 删除单条 dataset_version 记录
 */
export async function deleteDatasetVersion(versionId: string): Promise<void> {
  await request.delete(`/items/dataset_versions/${versionId}`)
}

/**
 * 将指定 dataset_version 的 file_id 置空（保留版本记录，仅清理文件关联）
 */
export async function clearVersionFileId(versionId: string): Promise<void> {
  await request.patch(`/items/dataset_versions/${versionId}`, { file_id: null })
}

/**
 * 删除 recipe（字段映射规则）
 */
export async function deleteRecipe(recipeId: string): Promise<void> {
  await request.delete(`/items/recipes/${recipeId}`)
}

/**
 * 重启失败版本的导入任务（在原版本记录上原地重试，不新增版本）
 * 将 status 重置为 processing，清空 error_message，由 Directus Flow / Webhook 触发 Worker 重新处理
 */
export async function retriggerImport(versionId: string): Promise<void> {
  await request.patch(`/items/dataset_versions/${versionId}`, {
    status: 'processing',
    error_message: null,
  })
}

/**
 * 级联删除数据源：
 *   1. 查询所有版本，获取文件 ID 列表
 *   2. 查询 recipe
 *   3. 逐个删除 Directus 文件（去重）
 *   4. 批量删除所有 dataset_versions
 *   5. 删除 recipes
 *   6. 删除 datasets 记录
 */
export async function deleteDataset(id: string): Promise<void> {
  // 1. 查询所有版本（无 limit）
  const versions = await getDatasetVersions(id)
  // 2. 查询 recipes
  const recipes = await getRecipes(id)

  // 3. 逐个删除 Directus 文件（file_id 去重，避免同一文件被多版本引用时重复删除）
  const uniqueFileIds = [...new Set(versions.map((v) => v.file_id).filter(Boolean))] as string[]
  for (const fid of uniqueFileIds) {
    try {
      await deleteFile(fid)
    } catch {
      /* 文件可能已被删除，忽略 */
    }
  }

  // 4. 批量删除 dataset_versions（Directus 批量删除：body 为 id 数组，通过 axios data 字段传入）
  const versionIds = versions.map((v) => v.id)
  if (versionIds.length > 0) {
    try {
      await request.delete('/items/dataset_versions', {}, { data: versionIds })
    } catch {
      // Fallback：逐个删除
      for (const vid of versionIds) {
        try {
          await deleteDatasetVersion(vid)
        } catch {
          /* 忽略 */
        }
      }
    }
  }

  // 5. 删除 recipes
  for (const r of recipes) {
    try {
      await deleteRecipe(r.id)
    } catch {
      /* 忽略 */
    }
  }

  // 6. 删除 datasets 记录
  await request.delete(`/items/datasets/${id}`)
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
export async function updateRecipe(
  id: string,
  data: {
    config: RecipeOperator[]
    header_row_count?: number
    storage_row_index?: number
    label_row_index?: number
  }
): Promise<any> {
  const res = await request.patch(`/items/recipes/${id}`, {
    config: data.config,
    ...(data.header_row_count !== undefined && { header_row_count: data.header_row_count }),
    ...(data.storage_row_index !== undefined && { storage_row_index: data.storage_row_index }),
    ...(data.label_row_index !== undefined && { label_row_index: data.label_row_index }),
  })
  return (res as any)?.data ?? res
}
