import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { useParams } from 'react-router-dom'
import {
  Typography,
  Button,
  Table,
  Space,
  Modal,
  Steps,
  Upload,
  message,
  Input,
  Select,
  Tag,
  Tooltip,
  Drawer,
  Alert,
  InputNumber,
  Empty,
  Checkbox,
  Divider,
  Spin,
  Progress,
  Tabs,
} from 'antd'
import {
  InboxOutlined,
  PlusOutlined,
  DatabaseOutlined,
  EditOutlined,
  SyncOutlined,
  DeleteOutlined,
  HistoryOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UnlockOutlined,
  CheckOutlined,
  CloseOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
  FolderOutlined,
} from '@ant-design/icons'
import { pinyin } from 'pinyin-pro'
import dayjs from 'dayjs'
import {
  getDatasets,
  uploadDatasetFileWithProgress,
  ensureProjectFolder,
  createDataset,
  updateDataset,
  deleteDataset,
  createDatasetVersionsBulk,
  createRecipe,
  getRecipes,
  updateRecipe,
  getDatasetVersions,
  getFileMetadata,
  deleteFile,
  clearVersionFileId,
  retriggerImport,
} from '@src/service/api/datasets'
import { getProjectBySlug } from '@src/service/api/projects'
import {
  buildSchemaChildName,
  buildSourceGroups,
  buildSourceFileSignature,
  buildSourceUnitId,
  computeSchemaFingerprintFromStorageNames,
} from './multiSourceUtils'
import styles from './index.module.less'

const { Title, Text } = Typography
const { Dragger } = Upload
const { Option } = Select

/** ──────────────────────────────────────────────
 *  拼音规范化工具函数
 * ────────────────────────────────────────────── */

function toStorageName(raw) {
  if (!raw) return 'col'
  let result = pinyin(raw, { toneType: 'none', separator: '_' })
  result = result.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  result = result.replace(/_+/g, '_').replace(/^_|_$/g, '')
  if (/^[0-9]/.test(result)) result = 'col_' + result
  if (!result) result = 'col'
  return result
}

function deduplicateNames(names) {
  const seen = {}
  return names.map((name) => {
    if (!seen[name]) {
      seen[name] = 1
      return name
    }
    seen[name]++
    return `${name}_${seen[name]}`
  })
}

function validateStorageName(name) {
  if (!name || name.trim() === '') return '存储列名不能为空'
  if (!/^[a-z][a-z0-9_]*$/.test(name.trim())) return '只允许小写字母、数字、下划线，且不能以数字开头'
  return null
}

/** 格式化文件大小 */
function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** ──────────────────────────────────────────────
 *  文件解析（只读头部 N+5 行）
 * ────────────────────────────────────────────── */

/**
 * CSV：只读文件头部 64KB，足够覆盖任何合理的表头+预览行
 */
async function parseCSVHead(file, headerRowCount) {
  const PREVIEW_ROWS = headerRowCount + 5
  const CHUNK = 65536
  const slice = file.slice(0, CHUNK)
  const text = await slice.text()
  const lines = text.split('\n').filter((l) => l.trim() !== '')
  const parseLine = (line) => line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
  const headerRows = lines.slice(0, headerRowCount).map(parseLine)
  const dataRows = lines.slice(headerRowCount, PREVIEW_ROWS).map(parseLine)
  return { headerRows, dataRows }
}

/**
 * Excel：只解析前 N+5 行，sheetRows 限制读取行数，大文件不再完整加载内存
 */
async function parseXLSXHead(file, headerRowCount) {
  const PREVIEW_ROWS = headerRowCount + 5
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', sheetRows: PREVIEW_ROWS })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headerRows = json.slice(0, headerRowCount).map((row) => row.map(String))
  const dataRows = json.slice(headerRowCount, PREVIEW_ROWS).map((row) => row.map(String))
  return { headerRows, dataRows }
}

async function listExcelSheetNames(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', sheetRows: 1 })
  return wb.SheetNames ?? []
}

async function parseXLSXHeadBySheet(file, headerRowCount, sheetName) {
  const PREVIEW_ROWS = headerRowCount + 5
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', sheetRows: PREVIEW_ROWS })
  const targetSheet = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0]
  const ws = wb.Sheets[targetSheet]
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  const headerRows = json.slice(0, headerRowCount).map((row) => row.map(String))
  const dataRows = json.slice(headerRowCount, PREVIEW_ROWS).map((row) => row.map(String))
  return { headerRows, dataRows, sheetName: targetSheet }
}

async function parseFileHead(file, headerRowCount) {
  const isExcel = /\.xlsx?$/i.test(file.name)
  if (isExcel) return parseXLSXHead(file, headerRowCount)
  return parseCSVHead(file, headerRowCount)
}

/** ──────────────────────────────────────────────
 *  行内名称编辑单元格
 * ────────────────────────────────────────────── */

const InlineNameCell = ({ record, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(record.name)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      message.warning('名称不能为空')
      setValue(record.name)
      setEditing(false)
      return
    }
    if (trimmed === record.name) {
      setEditing(false)
      return
    }
    try {
      await onSave(record.id, trimmed)
      setEditing(false)
    } catch {
      message.error('名称修改失败')
      setValue(record.name)
      setEditing(false)
    }
  }

  const handleCancel = () => {
    setValue(record.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <Space size={4}>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={handleSave}
          onKeyDown={(e) => e.key === 'Escape' && handleCancel()}
          size="small"
          style={{ width: 200 }}
        />
        <Button
          type="link"
          size="small"
          icon={<CheckOutlined />}
          onClick={handleSave}
          style={{ color: '#16a34a', padding: 0 }}
        />
        <Button
          type="link"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleCancel}
          danger
          style={{ padding: 0 }}
        />
      </Space>
    )
  }

  return (
    <Space size={6} className={styles.nameCell}>
      <DatabaseOutlined style={{ color: '#1677ff' }} />
      <Text strong>{record.name}</Text>
      <Tooltip title="修改名称">
        <EditOutlined className={styles.nameCellEdit} onClick={() => setEditing(true)} />
      </Tooltip>
    </Space>
  )
}

/** ──────────────────────────────────────────────
 *  主组件
 * ────────────────────────────────────────────── */

const Datasets = () => {
  const { slug } = useParams()

  /** slug → UUID 解析：所有 API 仍使用 UUID */
  const [projectId, setProjectId] = useState(null)
  useEffect(() => {
    if (!slug) return
    getProjectBySlug(slug).then((p) => {
      if (p?.id) setProjectId(p.id)
    })
  }, [slug])

  /** 列表状态 */
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(false)

  /** Modal 状态 */
  const [modalOpen, setModalOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [editingDataset, setEditingDataset] = useState(null)
  const [existingRecipe, setExistingRecipe] = useState(null)
  const [storageUnlocked, setStorageUnlocked] = useState(false)

  /** Step 0：文件 */
  const [currentFile, setCurrentFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [excelSheetsByFile, setExcelSheetsByFile] = useState({})
  const [selectedSheetsByFile, setSelectedSheetsByFile] = useState({})
  const [mergeSameSchema, setMergeSameSchema] = useState(true)
  const [fileType, setFileType] = useState('CSV')
  const [datasetName, setDatasetName] = useState('')

  /** Step 1：表头配置 */
  const [headerRowCount, setHeaderRowCount] = useState(1)
  const [parsing, setParsing] = useState(false) /** 解析中 */
  const [parsed, setParsed] = useState(false) /** 已解析完成 */
  const [headerRows, setHeaderRows] = useState([])
  const [dataRows, setDataRows] = useState([])
  const [storageRowIndex, setStorageRowIndex] = useState(0)
  const [labelRowIndex, setLabelRowIndex] = useState(1)
  const [sourceUnits, setSourceUnits] = useState([])
  const [sourceGroups, setSourceGroups] = useState([])
  const [activeGroupKey, setActiveGroupKey] = useState('')

  /** Step 2：字段映射 */
  const [mapping, setMapping] = useState({})
  const [groupMappings, setGroupMappings] = useState({})

  /** 版本历史 Drawer */
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState(null)
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [drawerActiveTab, setDrawerActiveTab] = useState('versions')

  /** 文件元数据缓存 { [fileId]: FileMetadata } */
  const [fileMeta, setFileMeta] = useState({})
  const [fileMetaLoading, setFileMetaLoading] = useState(false)

  /** 操作中状态（重启、删除文件等按钮 loading） */
  const [retriggeringId, setRetriggeringId] = useState(null)
  const [deletingFileId, setDeletingFileId] = useState(null)

  /** 删除弹窗明细 */
  const [deleteDetails, setDeleteDetails] = useState(null)
  const [deleteDetailsLoading, setDeleteDetailsLoading] = useState(false)
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const resetParsedArtifacts = () => {
    setParsed(false)
    setHeaderRows([])
    setDataRows([])
    setStorageRowIndex(0)
    setLabelRowIndex(1)
    setSourceUnits([])
    setSourceGroups([])
    setActiveGroupKey('')
    setMapping({})
    setGroupMappings({})
  }

  /** ── 获取数据集列表 ── */
  const fetchDatasets = useCallback(
    async (silent = false) => {
      if (!projectId) return
      if (!silent) setLoading(true)
      try {
        const data = await getDatasets(projectId)
        setDatasets((prev) => {
          /**
           * 保留仍在上传文件阶段的临时行（status === 'uploading' 且 _isTemp）。
           * 此时 Directus 尚无对应真实记录，无法从 data 中找到它，需要暂时保留。
           * 一旦 createDatasetVersion 调用成功后的 fetchDatasets() 执行，
           * Directus 已有真实记录，data 中会包含对应项，
           * 此时临时行必须从 uploadingRows 中排除（避免与真实记录重复显示）。
           */
          const realIds = new Set((data || []).map((d) => d.id))
          const uploadingRows = prev.filter((d) => d._isTemp && d.status === 'uploading' && !realIds.has(d._datasetId))
          return [...uploadingRows, ...(data || [])]
        })
      } catch {
        if (!silent) message.error('获取数据源失败')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    fetchDatasets()
  }, [fetchDatasets])

  const hasProcessing = datasets.some((d) => d.status === 'processing' || d.status === 'uploading')
  useEffect(() => {
    if (!hasProcessing) return
    const timer = setInterval(() => fetchDatasets(true), 3000)
    return () => clearInterval(timer)
  }, [hasProcessing, fetchDatasets])

  /** ── 修改数据源名称（行内） ── */
  const handleRename = async (id, name) => {
    await updateDataset(id, { name })
    setDatasets((prev) => prev.map((d) => (d.id === id ? { ...d, name } : d)))
    message.success('名称已更新')
  }

  /** ── 版本历史 Drawer ── */
  const fetchVersions = useCallback(async (datasetId, silent = false) => {
    if (!silent) setVersionsLoading(true)
    try {
      const data = await getDatasetVersions(datasetId)
      setVersions(data || [])
    } catch {
      if (!silent) message.error('获取版本历史失败')
    } finally {
      if (!silent) setVersionsLoading(false)
    }
  }, [])

  /** 加载文件元数据（打开文件管理 Tab 时调用） */
  const loadFileMeta = useCallback(async (versionList) => {
    const fileIds = [...new Set(versionList.map((v) => v.file_id).filter(Boolean))]
    if (fileIds.length === 0) return
    setFileMetaLoading(true)
    try {
      const results = await Promise.allSettled(fileIds.map((fid) => getFileMetadata(fid)))
      const meta = {}
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          meta[fileIds[idx]] = result.value
        }
      })
      setFileMeta((prev) => ({ ...prev, ...meta }))
    } catch {
      /* 忽略 */
    } finally {
      setFileMetaLoading(false)
    }
  }, [])

  const openVersionDrawer = (record) => {
    setSelectedDataset(record)
    setVersions([])
    setFileMeta({})
    setDrawerActiveTab('versions')
    setVersionDrawerOpen(true)
    fetchVersions(record.id)
  }

  const handleDrawerTabChange = (tab) => {
    setDrawerActiveTab(tab)
    if (tab === 'files' && versions.length > 0) {
      loadFileMeta(versions)
    }
  }

  const hasProcessingVersion = versions.some((v) => v.status === 'processing')
  useEffect(() => {
    if (!versionDrawerOpen || !selectedDataset || !hasProcessingVersion) return
    const timer = setInterval(() => fetchVersions(selectedDataset.id, true), 3000)
    return () => clearInterval(timer)
  }, [versionDrawerOpen, selectedDataset, hasProcessingVersion, fetchVersions])

  /** ── 重启导入 ── */
  const handleRetrigger = async (version) => {
    setRetriggeringId(version.id)
    try {
      await retriggerImport(version.id)
      // 同时更新 dataset 状态（显示为 processing）
      if (selectedDataset) {
        await updateDataset(selectedDataset.id, { status: 'processing' })
      }
      message.success('已重启导入任务，请稍候…')
      fetchVersions(selectedDataset.id)
      fetchDatasets(true)
    } catch {
      message.error('重启导入失败，请稍后重试')
    } finally {
      setRetriggeringId(null)
    }
  }

  /** ── 文件管理：删除文件（保留版本记录） ── */
  const handleDeleteVersionFile = async (version) => {
    Modal.confirm({
      title: '删除文件',
      icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
      content: `确认删除版本「${version.version_name}」关联的文件？版本记录将保留，file_hash 指纹也将保留，但文件将不可下载。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setDeletingFileId(version.id)
        try {
          // 1. 删除 Directus 文件
          await deleteFile(version.file_id)
          // 2. 清空版本记录的 file_id
          await clearVersionFileId(version.id)
          message.success('文件已删除')
          // 刷新版本列表
          await fetchVersions(selectedDataset.id, true)
          // 清除该文件的元数据缓存
          setFileMeta((prev) => {
            const next = { ...prev }
            delete next[version.file_id]
            return next
          })
        } catch {
          message.error('删除文件失败')
        } finally {
          setDeletingFileId(null)
        }
      },
    })
  }

  /** ── 删除数据集（级联，带明细弹窗） ── */
  const handleDelete = async (record) => {
    setPendingDeleteRecord(record)
    setDeleteDetails(null)
    setDeleteModalOpen(true)
    setDeleteDetailsLoading(true)

    try {
      // 并行查询版本和文件大小
      const [allVersions, recipes] = await Promise.all([getDatasetVersions(record.id), getRecipes(record.id)])

      const uniqueFileIds = [...new Set(allVersions.map((v) => v.file_id).filter(Boolean))]
      const fileMetaResults = await Promise.allSettled(uniqueFileIds.map((fid) => getFileMetadata(fid)))
      let totalSize = 0
      let validFileCount = 0
      fileMetaResults.forEach((r) => {
        if (r.status === 'fulfilled') {
          validFileCount++
          totalSize += r.value?.filesize ?? 0
        }
      })

      setDeleteDetails({
        versionCount: allVersions.length,
        fileCount: validFileCount,
        totalSize,
        recipeCount: recipes.length,
      })
    } catch {
      setDeleteDetails({ error: true })
    } finally {
      setDeleteDetailsLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteRecord) return
    try {
      await deleteDataset(pendingDeleteRecord.id)
      message.success('数据源已删除')
      setDeleteModalOpen(false)
      setPendingDeleteRecord(null)
      setDeleteDetails(null)
      fetchDatasets()
    } catch {
      message.error('删除失败')
    }
  }

  /** ── 打开 Modal ── */
  const openModal = async (dataset = null) => {
    setEditingDataset(dataset)
    setModalOpen(true)
    setCurrentStep(0)
    setCurrentFile(null)
    setSelectedFiles([])
    setExcelSheetsByFile({})
    setSelectedSheetsByFile({})
    setMergeSameSchema(dataset?.merge_same_schema ?? true)
    setFileType('CSV')
    setDatasetName(dataset?.name ?? '')
    setStorageUnlocked(false)
    setExistingRecipe(null)
    setHeaderRowCount(1)
    setParsing(false)
    resetParsedArtifacts()

    if (dataset) {
      try {
        const recipes = await getRecipes(dataset.id)
        if (recipes?.length > 0) {
          setExistingRecipe(recipes[0])
          const savedCount = recipes[0]?.header_row_count ?? 1
          setHeaderRowCount(savedCount)
        }
      } catch {
        /* 忽略 */
      }
    }
  }

  /** ── Step 0：选择文件（仅记录，不解析） ── */
  const handleFileSelect = async (file) => {
    const signature = buildSourceFileSignature(file)
    setSelectedFiles((prev) => {
      const exists = prev.some((f) => buildSourceFileSignature(f) === signature)
      if (exists) return prev
      return [...prev, file]
    })

    if (!currentFile) {
      setCurrentFile(file)
      setFileType(/\.xlsx?$/i.test(file.name) ? 'Excel' : 'CSV')
      if (!editingDataset) {
        setDatasetName(file.name.replace(/\.[^/.]+$/, ''))
      }
    }

    resetParsedArtifacts()

    if (/\.xlsx?$/i.test(file.name)) {
      try {
        const sheetNames = await listExcelSheetNames(file)
        setExcelSheetsByFile((prev) => ({ ...prev, [signature]: sheetNames }))
        if (sheetNames.length > 0) {
          setSelectedSheetsByFile((prev) => ({ ...prev, [signature]: [...sheetNames] }))
        }
      } catch {
        message.error(`读取 Sheet 失败：${file.name}`)
      }
    }
    return false
  }

  const removeSelectedFile = (file) => {
    const signature = buildSourceFileSignature(file)
    const nextFiles = selectedFiles.filter((f) => buildSourceFileSignature(f) !== signature)
    setSelectedFiles(nextFiles)
    setExcelSheetsByFile((prev) => {
      const next = { ...prev }
      delete next[signature]
      return next
    })
    setSelectedSheetsByFile((prev) => {
      const next = { ...prev }
      delete next[signature]
      return next
    })

    if (currentFile && buildSourceFileSignature(currentFile) === signature) {
      const fallback = nextFiles[0] || null
      setCurrentFile(fallback)
      setFileType(fallback && /\.xlsx?$/i.test(fallback.name) ? 'Excel' : 'CSV')
    }

    resetParsedArtifacts()
  }

  const handleSheetSelectionChange = (signature, values) => {
    setSelectedSheetsByFile((prev) => ({
      ...prev,
      [signature]: values,
    }))
    resetParsedArtifacts()
  }

  const handleSelectAllSheets = (signature, sheetOptions) => {
    setSelectedSheetsByFile((prev) => ({
      ...prev,
      [signature]: [...sheetOptions],
    }))
    resetParsedArtifacts()
  }

  const hasMissingSheetSelection = () => {
    return selectedFiles.some((file) => {
      if (!/\.xlsx?$/i.test(file.name)) return false
      const signature = buildSourceFileSignature(file)
      return (selectedSheetsByFile[signature] || []).length === 0
    })
  }

  /** ── Step 3：用户点「解析文件」按钮 ── */
  const handleParse = async () => {
    if (selectedFiles.length === 0) return
    setParsing(true)
    resetParsedArtifacts()
    try {
      const nextStorageRow = 0
      const nextLabelRow = headerRowCount > 1 ? 1 : 0
      const parsedUnits = []

      for (const file of selectedFiles) {
        const signature = buildSourceFileSignature(file)
        const isExcel = /\.xlsx?$/i.test(file.name)
        if (!isExcel) {
          const result = await parseFileHead(file, headerRowCount)
          if (!result.headerRows.length) continue
          const storageHeaders = result.headerRows[nextStorageRow] || []
          const labelHeaders = result.headerRows[nextLabelRow] || storageHeaders
          const dedupedStorage = deduplicateNames(storageHeaders.map(toStorageName))
          const schemaFingerprint = await computeSchemaFingerprintFromStorageNames(dedupedStorage)
          parsedUnits.push({
            id: buildSourceUnitId(signature, ''),
            sourceFileSignature: signature,
            file,
            fileName: file.name,
            isExcel: false,
            sheetName: '',
            headerRows: result.headerRows,
            dataRows: result.dataRows,
            storageHeaders,
            labelHeaders,
            dedupedStorage,
            schemaFingerprint,
          })
          continue
        }

        const allSheets =
          excelSheetsByFile[signature]?.length > 0 ? excelSheetsByFile[signature] : await listExcelSheetNames(file)
        const selectedSheets =
          selectedSheetsByFile[signature] && selectedSheetsByFile[signature].length > 0
            ? selectedSheetsByFile[signature]
            : allSheets

        for (const sheetName of selectedSheets) {
          const result = await parseXLSXHeadBySheet(file, headerRowCount, sheetName)
          if (!result.headerRows.length) continue
          const storageHeaders = result.headerRows[nextStorageRow] || []
          const labelHeaders = result.headerRows[nextLabelRow] || storageHeaders
          const dedupedStorage = deduplicateNames(storageHeaders.map(toStorageName))
          const schemaFingerprint = await computeSchemaFingerprintFromStorageNames(dedupedStorage)
          parsedUnits.push({
            id: buildSourceUnitId(signature, result.sheetName || sheetName),
            sourceFileSignature: signature,
            file,
            fileName: file.name,
            isExcel: true,
            sheetName: result.sheetName || sheetName,
            headerRows: result.headerRows,
            dataRows: result.dataRows,
            storageHeaders,
            labelHeaders,
            dedupedStorage,
            schemaFingerprint,
          })
        }
      }

      if (parsedUnits.length === 0) {
        message.error('未能识别到可导入的表头，请检查文件内容或 Sheet 选择')
        return
      }

      const grouped = buildSourceGroups(parsedUnits, mergeSameSchema)
      const mappingByGroup = {}
      grouped.forEach((group) => {
        const rep = group.sourceUnits[0]
        const groupMap = {}
        rep.storageHeaders.forEach((orig, i) => {
          let storageName = rep.dedupedStorage[i] || toStorageName(orig)
          let label = rep.labelHeaders[i] || orig
          if (existingRecipe?.config?.length > 0) {
            const matched = existingRecipe.config.find((op) => op.from === orig)
            if (matched) {
              storageName = matched.to ?? storageName
              label = matched.label ?? label
            }
          }
          groupMap[orig] = { storageName, label, type: 'string' }
        })
        mappingByGroup[group.groupKey] = groupMap
      })

      const firstGroup = grouped[0]
      const firstRep = firstGroup.sourceUnits[0]

      startTransition(() => {
        setStorageRowIndex(nextStorageRow)
        setLabelRowIndex(nextLabelRow)
        setSourceUnits(parsedUnits)
        setSourceGroups(grouped)
        setActiveGroupKey(firstGroup.groupKey)
        setGroupMappings(mappingByGroup)
        setMapping(mappingByGroup[firstGroup.groupKey] || {})
        setHeaderRows(firstRep.headerRows)
        setDataRows(firstRep.dataRows)
        setParsed(true)
      })
    } catch {
      message.error('文件解析失败，请检查文件格式')
    } finally {
      setParsing(false)
    }
  }

  /** ── Step 3 → Step 4：构建 mapping 后切步骤 ── */
  const proceedToMapping = () => {
    if (parsed && sourceGroups.length > 0) {
      const key = activeGroupKey || sourceGroups[0].groupKey
      startTransition(() => {
        setActiveGroupKey(key)
        setMapping(groupMappings[key] || {})
        setCurrentStep(4)
      })
      return
    }

    const recipe = existingRecipe
    const init = {}

    /**
     * 更新模式（存储锁定，未重新解析）：直接从 existingRecipe.config 重建 mapping。
     * Recipe config 中每条 rename op 的 from = 原始列名，to = 存储列名，label = 展示名。
     * 此时 headerRows 为空，不能依赖它。
     */
    const usedRecipeDirectly = isUpdateMode && !storageUnlocked && !parsed && recipe?.config?.length > 0
    if (usedRecipeDirectly) {
      recipe.config.forEach((op) => {
        if (op.from) {
          init[op.from] = {
            storageName: op.to ?? op.from,
            label: op.label ?? op.from,
            type: 'string',
          }
        }
      })
      startTransition(() => {
        setMapping(init)
        setCurrentStep(4)
      })
      return
    }

    /**
     * 新建模式 / 解锁后重新解析：从 headerRows 构建 mapping，
     * 已有 recipe 时优先回填存储列名和展示名。
     */
    const sHeaders = headerRows[storageRowIndex] || []
    const lHeaders = headerRows[labelRowIndex] ?? sHeaders
    sHeaders.forEach((orig, i) => {
      let storageName = orig
      let label = lHeaders[i] ?? orig
      if (recipe?.config) {
        const matched = recipe.config.find((op) => op.from === orig)
        if (matched) {
          storageName = matched.to ?? orig
          label = matched.label ?? label
        }
      }
      init[orig] = { storageName, label, type: 'string' }
    })
    startTransition(() => {
      setMapping(init)
      setCurrentStep(4)
    })
  }

  /** ── 互换存储行/展示行 ── */
  const swapRows = () => {
    setStorageRowIndex(labelRowIndex)
    setLabelRowIndex(storageRowIndex)
  }

  /** ── 一键规范化 ── */
  const handleNormalize = () => {
    const activeGroup = sourceGroups.find((g) => g.groupKey === activeGroupKey)
    const representative = activeGroup?.sourceUnits?.[0]
    const sHeaders = representative?.storageHeaders ?? (headerRows[storageRowIndex] || [])
    const deduped = deduplicateNames(sHeaders.map(toStorageName))
    setGroupMappings((prev) => {
      const nextAll = { ...prev }
      const current = { ...(nextAll[activeGroupKey] || mapping) }
      sHeaders.forEach((orig, i) => {
        current[orig] = { ...current[orig], storageName: deduped[i] }
      })
      nextAll[activeGroupKey] = current
      setMapping(current)
      return nextAll
    })
    message.success('存储列名已规范化')
  }

  /** ── 映射字段变更 ── */
  const handleMappingChange = (orig, field, value) => {
    setGroupMappings((prev) => {
      const next = { ...prev }
      const current = { ...(next[activeGroupKey] || mapping) }
      current[orig] = { ...current[orig], [field]: value }
      next[activeGroupKey] = current
      setMapping(current)
      return next
    })
  }

  /** ── 实时冲突检测 ── */
  const activeMapping = groupMappings[activeGroupKey] || mapping
  const allStorageNames = Object.values(activeMapping).map((m) => m.storageName ?? '')
  const getStorageNameError = (orig) => {
    const name = activeMapping[orig]?.storageName ?? ''
    const err = validateStorageName(name)
    if (err) return err
    if (allStorageNames.filter((n) => n === name).length > 1) return '与其他列重复'
    return null
  }
  const activeGroup = sourceGroups.find((g) => g.groupKey === activeGroupKey)
  const representativeUnit = activeGroup?.sourceUnits?.[0]
  const storageHeaders =
    representativeUnit?.storageHeaders?.length > 0
      ? representativeUnit.storageHeaders
      : headerRows[storageRowIndex]?.length > 0
        ? headerRows[storageRowIndex]
        : Object.keys(activeMapping)
  const hasAnyError = () => storageHeaders.some((h) => getStorageNameError(h) !== null)

  useEffect(() => {
    if (!activeGroupKey) return
    const group = sourceGroups.find((g) => g.groupKey === activeGroupKey)
    const rep = group?.sourceUnits?.[0]
    if (!group || !rep) return
    setMapping(groupMappings[activeGroupKey] || {})
    setHeaderRows(rep.headerRows || [])
    setDataRows(rep.dataRows || [])
  }, [activeGroupKey, sourceGroups, groupMappings])

  /** ── 解锁存储列名 ── */
  const handleUnlock = () => {
    Modal.confirm({
      title: '解锁存储列名',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: (
        <div>
          <p>
            修改存储列名后，系统将要求您<strong>重新上传数据文件</strong>，原有 Doris 表数据将被覆盖。
          </p>
          <p style={{ color: '#ff4d4f' }}>此操作不可撤销，请确认后继续。</p>
        </div>
      ),
      okText: '确认解锁',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setStorageUnlocked(true)
        setCurrentFile(null)
        setSelectedFiles([])
        setExcelSheetsByFile({})
        setSelectedSheetsByFile({})
        setParsing(false)
        resetParsedArtifacts()
        setCurrentStep(0)
        message.warning('存储列名已解锁，请重新上传数据文件')
      },
    })
  }

  const generateIngestBatchId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    const rand = Math.random().toString(16).slice(2, 10)
    return `ingest_${Date.now()}_${rand}`
  }

  /** ── 保存 ── */
  const handleSave = async () => {
    if (selectedFiles.length === 0 || !projectId) {
      message.error('文件或项目信息缺失')
      return
    }
    if (hasAnyError()) {
      message.error('存储列名存在错误，请修正后再保存')
      return
    }
    if (sourceGroups.length === 0) {
      message.error('请先解析文件并生成结构分组')
      return
    }

    /** 快照当前 Modal 数据（关闭后这些 state 将被重置） */
    const files = [...selectedFiles]
    const type = files.some((f) => /\.xlsx?$/i.test(f.name)) ? 'Excel' : fileType
    const name = datasetName || currentFile?.name || files[0]?.name || '未命名数据源'
    const dsId = editingDataset?.id ?? null
    const isUpdate = !!editingDataset
    const recipe = existingRecipe
    const mergeSameSchemaSnapshot = mergeSameSchema
    const groupsSnapshot = sourceGroups.map((group) => ({
      groupKey: group.groupKey,
      schemaFingerprint: group.schemaFingerprint,
      schemaOrder: group.schemaOrder,
      sourceUnits: group.sourceUnits.map((unit) => ({ ...unit })),
    }))
    const groupMappingsSnapshot = { ...groupMappings }
    const sRowIdx = 0
    const lRowIdx = headerRowCount > 1 ? 1 : 0
    const hCount = headerRowCount
    const ingestBatchId = generateIngestBatchId()

    /** 新建模式：同项目内数据源名称唯一性校验 */
    if (!isUpdate) {
      const existingDs = datasets.filter((d) => !d._isTemp)
      const nameConflict = existingDs.find((d) => d.name === name)
      if (nameConflict) {
        message.error(`数据源「${name}」已存在，请修改名称后重试`)
        return
      }
    }

    /** 临时行 ID，用于在列表中定位进度 */
    const tempId = `__uploading_${Date.now()}`

    /** 关闭 Modal（立即），列表插入上传中临时行 */
    setModalOpen(false)
    setDatasets((prev) => {
      const tempRow = {
        id: tempId,
        name: isUpdate ? editingDataset.name : name,
        type,
        status: 'uploading',
        uploadProgress: 0,
        date_created: new Date().toISOString(),
        _isTemp: true,
        /**
         * 新建模式：_datasetId 暂为空，createDataset 成功后通过 setDatasets 回填。
         * fetchDatasets 用此字段判断"Directus 是否已有对应真实记录"，
         * 从而决定是否继续保留临时行，防止临时行与真实记录重复显示。
         */
        _datasetId: dsId ?? null,
      }
      /** 更新模式：替换原行；新建模式：插到列表头部 */
      if (isUpdate) {
        return prev.map((d) => (d.id === dsId ? { ...d, status: 'uploading', uploadProgress: 0, _tempId: tempId } : d))
      }
      return [tempRow, ...prev]
    })

    /** 后台异步执行上传 + 创建流程 */
    try {
      /** 1. 确保项目目录，获取 folderId */
      const folderId = await ensureProjectFolder(projectId)

      /** 2. 物理文件去重上传 */
      const uploadProgressByFile = {}
      const uploadedFileIdBySignature = {}
      const uniqueFiles = []
      files.forEach((file) => {
        const signature = buildSourceFileSignature(file)
        if (uploadedFileIdBySignature[signature]) return
        uploadedFileIdBySignature[signature] = ''
        uniqueFiles.push(file)
      })

      for (const file of uniqueFiles) {
        const signature = buildSourceFileSignature(file)
        const uploadedFile = await uploadDatasetFileWithProgress(file, folderId, (percent) => {
          uploadProgressByFile[signature] = percent
          const values = Object.values(uploadProgressByFile)
          const avg =
            values.length > 0 ? Math.round(values.reduce((sum, p) => sum + Number(p || 0), 0) / uniqueFiles.length) : 0
          setDatasets((prev) =>
            prev.map((d) => {
              if (d.id === tempId || d._tempId === tempId) return { ...d, uploadProgress: avg }
              return d
            })
          )
        })
        if (!uploadedFile?.id) throw new Error(`文件上传失败：${file.name}`)
        uploadedFileIdBySignature[signature] = uploadedFile.id
      }

      setDatasets((prev) =>
        prev.map((d) => {
          if (d.id === tempId || d._tempId === tempId) return { ...d, uploadProgress: 100 }
          return d
        })
      )

      /** 3. 匹配/创建目标 Dataset（同构合并、异构拆分） */
      const datasetIdByGroupKey = {}
      let rootDatasetId = dsId
      let rootSchemaFingerprint = editingDataset?.schema_fingerprint || ''

      if (!isUpdate) {
        const firstGroup = groupsSnapshot[0]
        const rootDataset = await createDataset({
          name,
          project_id: projectId,
          type,
          status: 'processing',
          root_dataset_id: null,
          schema_fingerprint: firstGroup.schemaFingerprint,
          schema_order: 1,
          merge_same_schema: mergeSameSchemaSnapshot,
        })
        rootDatasetId = rootDataset.id
        rootSchemaFingerprint = firstGroup.schemaFingerprint
        datasetIdByGroupKey[firstGroup.groupKey] = rootDataset.id
        setDatasets((prev) => prev.map((d) => (d.id === tempId ? { ...d, _datasetId: rootDataset.id } : d)))
      } else if (rootDatasetId) {
        await updateDataset(rootDatasetId, {
          status: 'processing',
          type,
          merge_same_schema: mergeSameSchemaSnapshot,
        })
      }

      const existingDatasets = [...datasets]
      for (const group of groupsSnapshot) {
        if (datasetIdByGroupKey[group.groupKey]) continue

        let targetDatasetId = null
        if (isUpdate && rootDatasetId) {
          if (!mergeSameSchemaSnapshot && group.schemaOrder === 1) {
            targetDatasetId = rootDatasetId
          } else if (
            mergeSameSchemaSnapshot &&
            rootSchemaFingerprint &&
            group.schemaFingerprint === rootSchemaFingerprint
          ) {
            targetDatasetId = rootDatasetId
          } else {
            const existingChild = mergeSameSchemaSnapshot
              ? existingDatasets.find(
                  (d) => d.root_dataset_id === rootDatasetId && d.schema_fingerprint === group.schemaFingerprint
                )
              : existingDatasets.find(
                  (d) => d.root_dataset_id === rootDatasetId && d.schema_order === group.schemaOrder
                )
            if (existingChild) {
              targetDatasetId = existingChild.id
              await updateDataset(targetDatasetId, {
                status: 'processing',
                type,
                merge_same_schema: mergeSameSchemaSnapshot,
              })
            }
          }
        }

        if (!targetDatasetId) {
          if (isUpdate && !mergeSameSchemaSnapshot && group.schemaOrder === 1 && rootDatasetId) {
            targetDatasetId = rootDatasetId
          }
        }

        if (!targetDatasetId) {
          const childName = isUpdate
            ? buildSchemaChildName(editingDataset?.name || name, group.schemaOrder)
            : buildSchemaChildName(name, group.schemaOrder)
          const created = await createDataset({
            name: childName,
            project_id: projectId,
            type,
            status: 'processing',
            root_dataset_id: isUpdate ? rootDatasetId : group.schemaOrder === 1 ? null : rootDatasetId,
            schema_fingerprint: group.schemaFingerprint,
            schema_order: group.schemaOrder,
            merge_same_schema: mergeSameSchemaSnapshot,
          })
          targetDatasetId = created.id
        }

        datasetIdByGroupKey[group.groupKey] = targetDatasetId
      }

      /** 4. upsert recipe（按分组） */
      for (const group of groupsSnapshot) {
        const targetDatasetId = datasetIdByGroupKey[group.groupKey]
        if (!targetDatasetId) continue
        const representative = group.sourceUnits[0]
        const groupMap = groupMappingsSnapshot[group.groupKey] || {}
        const recipeConfig = representative.storageHeaders.map((orig) => ({
          type: 'rename',
          from: orig,
          to: groupMap[orig]?.storageName ?? orig,
          label: groupMap[orig]?.label ?? orig,
        }))
        const recipePayload = {
          config: recipeConfig,
          header_row_count: hCount,
          storage_row_index: sRowIdx,
          label_row_index: lRowIdx,
        }

        let recipeRecord = null
        if (recipe && targetDatasetId === dsId) {
          recipeRecord = recipe
        } else {
          const recipes = await getRecipes(targetDatasetId)
          recipeRecord = recipes?.[0] ?? null
        }

        if (recipeRecord?.id) {
          await updateRecipe(recipeRecord.id, recipePayload)
        } else {
          await createRecipe({ dataset_id: targetDatasetId, name: '表头映射规则', ...recipePayload })
        }
      }

      /** 5. 批量创建 versions（触发 Webhook -> Worker） */
      const versionPayloads = []
      groupsSnapshot.forEach((group) => {
        const targetDatasetId = datasetIdByGroupKey[group.groupKey]
        group.sourceUnits.forEach((unit, idx) => {
          const fileId = uploadedFileIdBySignature[unit.sourceFileSignature]
          if (!fileId || !targetDatasetId) return
          const suffix = unit.sheetName ? `_${unit.sheetName}` : `_${idx + 1}`
          versionPayloads.push({
            dataset_id: targetDatasetId,
            version_name: `v${dayjs().format('YYYYMMDDHHmmss')}${suffix}`,
            file_id: fileId,
            status: 'processing',
            ingest_batch_id: ingestBatchId,
            sheet_name: unit.sheetName || '',
            schema_fingerprint: group.schemaFingerprint,
            source_file_name: unit.fileName || '',
            source_sheet_name: unit.sheetName || '',
          })
        })
      })

      if (versionPayloads.length === 0) {
        throw new Error('未生成可导入的版本记录')
      }

      await createDatasetVersionsBulk(versionPayloads)

      /** 6. 刷新列表（临时行替换为真实数据） */
      fetchDatasets()
    } catch (err) {
      console.error('Save dataset error:', err)
      /** 上传/创建失败：移除临时行，显示错误 */
      setDatasets((prev) => {
        if (isUpdate) {
          return prev.map((d) =>
            d._tempId === tempId ? { ...d, status: 'failed', uploadProgress: 0, _tempId: undefined } : d
          )
        }
        return prev.filter((d) => d.id !== tempId)
      })
      message.error(`操作失败：${err.message ?? '请检查网络或控制台'}`)
    }
  }

  /** ── 列表表格列定义 ── */
  const isDatasetBuilt = (d) => d.status === 'ready' || d.status === 'failed'
  const isUpdateMode = !!editingDataset
  const isStorageLocked = isUpdateMode && isDatasetBuilt(editingDataset) && !storageUnlocked

  const columns = [
    {
      title: '数据源名称',
      dataIndex: 'name',
      key: 'name',
      render: (_, record) => <InlineNameCell record={record} onSave={handleRename} />,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => <Tag color={type === 'Excel' ? 'purple' : 'blue'}>{type ?? 'CSV'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status, record) => {
        if (status === 'uploading') {
          return (
            <div style={{ minWidth: 120 }}>
              <Progress
                percent={record.uploadProgress ?? 0}
                size="small"
                status="active"
                strokeColor="#1677ff"
                format={(p) => `${p}%`}
              />
            </div>
          )
        }
        if (status === 'ready')
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              就绪
            </Tag>
          )
        if (status === 'failed')
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              失败
            </Tag>
          )
        return (
          <Tag icon={<SyncOutlined spin />} color="warning">
            处理中
          </Tag>
        )
      },
    },
    {
      title: '更新时间',
      dataIndex: 'date_updated',
      key: 'date_updated',
      width: 180,
      render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '—'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => {
        const isUploading = record.status === 'uploading'
        return (
          <Space size={4}>
            <Tooltip title={isUploading ? '上传中，请稍候' : '上传新版本数据'}>
              <Button
                type="link"
                size="small"
                icon={<SyncOutlined />}
                onClick={() => openModal(record)}
                disabled={isUploading}
              >
                更新
              </Button>
            </Tooltip>
            <Tooltip title={isUploading ? '上传中，请稍候' : '查看导入版本历史'}>
              <Button
                type="link"
                size="small"
                icon={<HistoryOutlined />}
                onClick={() => openVersionDrawer(record)}
                disabled={isUploading}
              >
                历史
              </Button>
            </Tooltip>
            <Tooltip title={isUploading ? '上传中，请稍候' : '删除数据源'}>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                disabled={isUploading}
              />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  /** ── 映射表格列定义 ── */
  const mappingColumns = [
    {
      title: '原始列',
      dataIndex: 'orig',
      key: 'orig',
      width: 160,
      render: (orig) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'monospace' }}>
            {orig}
          </Text>
          {/[\u4e00-\u9fa5]/.test(orig) ? (
            <Tag color="orange" style={{ fontSize: 10 }}>
              中文
            </Tag>
          ) : (
            <Tag color="cyan" style={{ fontSize: 10 }}>
              EN
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '存储列名',
      key: 'storageName',
      render: (_, { orig }) => {
        const err = getStorageNameError(orig)
        return (
          <Tooltip title={isStorageLocked ? '已锁定，点击顶部「解锁修改」方可编辑' : err}>
            <Input
              value={activeMapping[orig]?.storageName ?? ''}
              disabled={isStorageLocked}
              status={!isStorageLocked && err ? 'error' : undefined}
              onChange={(e) => handleMappingChange(orig, 'storageName', e.target.value)}
              placeholder="snake_case 列名"
              style={{ fontFamily: 'monospace' }}
            />
          </Tooltip>
        )
      },
    },
    {
      title: '展示名称',
      key: 'label',
      render: (_, { orig }) => (
        <Input
          value={activeMapping[orig]?.label ?? ''}
          onChange={(e) => handleMappingChange(orig, 'label', e.target.value)}
          placeholder="展示给用户的列名"
        />
      ),
    },
    {
      title: '数据类型',
      key: 'type',
      width: 130,
      render: (_, { orig }) => (
        <Select
          value={activeMapping[orig]?.type ?? 'string'}
          onChange={(val) => handleMappingChange(orig, 'type', val)}
          style={{ width: 120 }}
        >
          <Option value="string">字符串</Option>
          <Option value="number">数字</Option>
          <Option value="date">日期</Option>
          <Option value="boolean">布尔</Option>
        </Select>
      ),
    },
    // 数据预览列：仅在有解析结果时展示（新建模式 / 解锁后重新解析）
    ...(parsed
      ? [
          {
            title: '数据预览',
            key: 'preview',
            width: 130,
            render: (_, { orig }) => {
              const colIdx = storageHeaders.indexOf(orig)
              const val = dataRows[0]?.[colIdx] ?? ''
              return (
                <Text type="secondary" ellipsis style={{ maxWidth: 120, fontFamily: 'monospace', fontSize: 12 }}>
                  {val || '—'}
                </Text>
              )
            },
          },
        ]
      : []),
  ]

  const mappingData = storageHeaders.map((orig) => ({ key: orig, orig }))

  const steps = [
    { title: '上传文件', description: '选择本地文件' },
    { title: '选择 Sheet', description: '配置 Excel Sheet' },
    { title: '合并导入', description: '设置同构是否合并' },
    { title: '表头配置', description: '解析并指定行角色' },
    { title: '字段映射', description: '配置列名与类型' },
  ]

  /** ── 版本历史 Tab：计算最新失败版本 ── */
  const latestFailedVersion = (() => {
    const failedVersions = versions.filter((v) => v.status === 'failed')
    if (failedVersions.length === 0) return null
    // versions 已按 -id 排序（最新在前），取第一个 failed
    return failedVersions[0]
  })()

  /** 判断最新版本（第一条）是否是 ready 状态 */
  const latestVersionIsReady = versions.length > 0 && versions[0].status === 'ready'

  /** ── 文件管理 Tab：最新成功版本 ── */
  const latestReadyVersion = (() => {
    return versions.find((v) => v.status === 'ready') ?? null
  })()

  /** hash 分组：同 hash 的版本归为一组，用于标识重复文件 */
  const hashGroups = (() => {
    const groups = {}
    versions.forEach((v) => {
      if (v.file_hash) {
        if (!groups[v.file_hash]) groups[v.file_hash] = []
        groups[v.file_hash].push(v.version_name)
      }
    })
    return groups
  })()

  /**
   * 文件管理 Tab 数据源：按 file_hash 合并同一文件的多个版本为一行。
   * 无 file_hash 的版本（处理中/失败）单独一行。
   * 每组取 versions 中第一个（最新）版本的 id/file_id/status 作为代表行。
   */
  const fileTableRows = (() => {
    const seen = new Set()
    const rows = []
    versions.forEach((v) => {
      if (!v.file_hash) {
        // 无 hash：单行展示
        rows.push({ ...v, _versionNames: [v.version_name] })
        return
      }
      if (seen.has(v.file_hash)) return
      seen.add(v.file_hash)
      // 同 hash 的所有版本（已按 -id 排序，第一个最新）
      const group = versions.filter((x) => x.file_hash === v.file_hash)
      rows.push({
        ...group[0], // 用最新版本的 id/file_id/status 作代表
        _versionNames: group.map((x) => x.version_name),
        _isLatestReadyInGroup: group.some((x) => latestReadyVersion?.id === x.id),
        _isProcessingInGroup: group.some((x) => x.status === 'processing'),
      })
    })
    return rows
  })()

  /** 版本历史列定义 */
  const versionColumns = [
    {
      title: '版本',
      dataIndex: 'version_name',
      key: 'version_name',
      width: 130,
      render: (v) => <Text code>{v}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        if (status === 'ready')
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              就绪
            </Tag>
          )
        if (status === 'failed')
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              失败
            </Tag>
          )
        return (
          <Tag icon={<SyncOutlined spin />} color="warning">
            处理中
          </Tag>
        )
      },
    },
    {
      title: '导入时间',
      dataIndex: 'date_updated',
      key: 'date_updated',
      render: (v) => (v ? dayjs(v).format('MM-DD HH:mm:ss') : '—'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => {
        const isLatestFailed = latestFailedVersion?.id === record.id
        const isProcessing = record.status === 'processing'
        const hasProcessingV = hasProcessingVersion

        return (
          <Space size={4}>
            {/** 重启导入：仅最新失败版本，且没有正在处理的版本 */}
            {isLatestFailed && !latestVersionIsReady && (
              <Tooltip title={hasProcessingV ? '有任务正在处理中，请稍候' : '重启导入（在此版本记录上原地重试）'}>
                <Button
                  type="link"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  disabled={hasProcessingV}
                  loading={retriggeringId === record.id}
                  onClick={() => handleRetrigger(record)}
                >
                  重启导入
                </Button>
              </Tooltip>
            )}
            {/** 失败原因：status === 'failed' 且有 error_message */}
            {record.status === 'failed' && record.error_message && (
              <Tooltip
                title={<span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{record.error_message}</span>}
                overlayStyle={{ maxWidth: 400 }}
              >
                <Button type="link" size="small" danger icon={<QuestionCircleOutlined />}>
                  失败原因
                </Button>
              </Tooltip>
            )}
          </Space>
        )
      },
    },
  ]

  /** 文件管理列定义 */
  const fileColumns = [
    {
      title: '版本',
      dataIndex: 'version_name',
      key: 'version_name',
      width: 220,
      render: (_, record) => {
        const names = record._versionNames ?? [record.version_name]
        return (
          <Space size={4} wrap>
            {names.map((vn) => (
              <Text key={vn} code style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {vn}
              </Text>
            ))}
          </Space>
        )
      },
    },
    {
      title: '文件名',
      key: 'filename',
      render: (_, record) => {
        if (!record.file_id) return <Text type="secondary">文件已删除</Text>
        const meta = fileMeta[record.file_id]
        if (!meta) return <Text type="secondary">—</Text>
        return (
          <Tooltip title={meta.filename_download}>
            <Text ellipsis style={{ maxWidth: 160 }}>
              {meta.filename_download}
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: '大小',
      key: 'filesize',
      width: 90,
      render: (_, record) => {
        if (!record.file_id) return <Text type="secondary">—</Text>
        const meta = fileMeta[record.file_id]
        return <Text>{meta ? formatFileSize(meta.filesize) : '—'}</Text>
      },
    },
    {
      title: '内容指纹',
      key: 'file_hash',
      width: 120,
      render: (_, record) => {
        if (!record.file_hash) return <Text type="secondary">—</Text>
        const shortHash = record.file_hash.slice(0, 8)
        return (
          <Tooltip title={`SHA-256: ${record.file_hash}`}>
            <Text code style={{ fontSize: 11 }}>
              {shortHash}…
            </Text>
          </Tooltip>
        )
      },
    },
    {
      title: '导入状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => {
        if (status === 'ready')
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              就绪
            </Tag>
          )
        if (status === 'failed')
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              失败
            </Tag>
          )
        return (
          <Tag icon={<SyncOutlined spin />} color="warning">
            处理中
          </Tag>
        )
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const isLatestReady = record._isLatestReadyInGroup ?? latestReadyVersion?.id === record.id
        const isProcessing = record._isProcessingInGroup ?? record.status === 'processing'
        const hasFile = !!record.file_id
        const canDeleteFile = hasFile && !isLatestReady && !isProcessing

        return (
          <Space size={4}>
            {/** 下载 */}
            {hasFile && (
              <Tooltip title="下载文件">
                <Button
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  href={`/api/assets/${record.file_id}?download`}
                  target="_blank"
                />
              </Tooltip>
            )}
            {/** 删除文件 */}
            <Tooltip
              title={
                !hasFile
                  ? '文件已删除'
                  : isLatestReady
                    ? '最新成功版本的文件不可删除'
                    : isProcessing
                      ? '处理中的版本文件不可删除'
                      : '删除文件（保留版本记录）'
              }
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!canDeleteFile}
                loading={deletingFileId === record.id}
                onClick={() => handleDeleteVersionFile(record)}
              />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  /** ── 渲染 ── */
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} style={{ margin: 0 }}>
            数据源管理
          </Title>
          <Text type="secondary">上传或连接源数据，配置表头映射关系，固化后续数据更新时自动应用。</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          接入新数据
        </Button>
      </div>

      {!loading && datasets.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据源，点击「接入新数据」开始上传">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              接入第一个数据源
            </Button>
          </Empty>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={datasets}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          rowClassName={(record) => {
            if (record.status === 'uploading') return styles.rowUploading
            if (record.status === 'processing') return styles.rowProcessing
            return ''
          }}
        />
      )}

      {/** ── 导入 Modal ── */}
      <Modal
        title={isUpdateMode ? `更新数据 — ${editingDataset.name}` : '接入新数据源'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={960}
        footer={null}
        destroyOnHide
      >
        <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: 24 }} />

        {/** Step 0 — 上传文件 */}
        {currentStep === 0 && (
          <div>
            <Dragger
              name="file"
              multiple
              fileList={[]}
              beforeUpload={handleFileSelect}
              accept=".csv,.txt,.xlsx,.xls"
              style={{ padding: '20px 0' }}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此处</p>
              <p className="ant-upload-hint">
                支持 CSV、TXT、Excel (.xlsx)。可一次选择多个文件；Excel 支持多 Sheet 导入。
              </p>
            </Dragger>

            {selectedFiles.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedFiles.map((file) => {
                  const signature = buildSourceFileSignature(file)
                  return (
                    <div key={signature} className={styles.fileInfo} style={{ display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileTextOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        <Text strong style={{ flex: 1 }}>
                          {file.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {(file.size / 1024).toFixed(1)} KB
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => removeSelectedFile(file)}
                          style={{ padding: 0 }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" disabled={selectedFiles.length === 0} onClick={() => setCurrentStep(1)}>
                下一步
              </Button>
            </div>
          </div>
        )}

        {/** Step 1 — 选择 Sheet */}
        {currentStep === 1 && (
          <div>
            {selectedFiles.length === 0 ? (
              <Alert type="warning" showIcon message="请先上传文件" style={{ marginBottom: 16 }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedFiles.map((file) => {
                  const signature = buildSourceFileSignature(file)
                  const isExcel = /\.xlsx?$/i.test(file.name)
                  const sheetOptions = excelSheetsByFile[signature] || []
                  const selectedSheets = selectedSheetsByFile[signature] || []

                  return (
                    <div key={signature} className={styles.fileInfo} style={{ display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileTextOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        <Text strong style={{ flex: 1 }}>
                          {file.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {(file.size / 1024).toFixed(1)} KB
                        </Text>
                      </div>
                      <div style={{ marginTop: 8, paddingLeft: 24 }}>
                        {isExcel ? (
                          sheetOptions.length > 0 ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Text type="secondary">选择 Sheet（默认全部）：</Text>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => handleSelectAllSheets(signature, sheetOptions)}
                                  style={{ padding: 0, height: 'auto' }}
                                >
                                  全选
                                </Button>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => handleSheetSelectionChange(signature, [])}
                                  style={{ padding: 0, height: 'auto' }}
                                >
                                  清空
                                </Button>
                              </div>

                              <Checkbox.Group
                                value={selectedSheets}
                                onChange={(values) => handleSheetSelectionChange(signature, values)}
                                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                              >
                                {sheetOptions.map((sheet) => (
                                  <Checkbox key={sheet} value={sheet}>
                                    {sheet}
                                  </Checkbox>
                                ))}
                              </Checkbox.Group>

                              {selectedSheets.length === 0 && (
                                <Text type="danger" style={{ fontSize: 12 }}>
                                  请至少选择一个 Sheet
                                </Text>
                              )}
                            </div>
                          ) : (
                            <Text type="warning">未读取到可用 Sheet，请返回上一步重新选择文件</Text>
                          )
                        ) : (
                          <Text type="secondary">CSV/TXT 文件无需选择 Sheet</Text>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(0)}>
                上一步
              </Button>
              <Button
                type="primary"
                disabled={selectedFiles.length === 0 || hasMissingSheetSelection()}
                onClick={() => setCurrentStep(2)}
              >
                下一步
              </Button>
            </div>
          </div>
        )}

        {/** Step 2 — 合并导入 */}
        {currentStep === 2 && (
          <div>
            <Alert
              type="info"
              showIcon
              message="导入合并策略"
              description="开启后：同结构 source unit 自动合并到同一数据表。关闭后：即使同结构也会拆分为独立分组。"
              style={{ marginBottom: 16 }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Text strong>同结构合并导入：</Text>
              <Select
                value={mergeSameSchema ? 'merge' : 'split'}
                style={{ width: 220 }}
                disabled={isUpdateMode}
                onChange={(val) => {
                  const next = val === 'merge'
                  setMergeSameSchema(next)
                  resetParsedArtifacts()
                }}
              >
                <Option value="merge">开启（同结构合并）</Option>
                <Option value="split">关闭（同结构拆分）</Option>
              </Select>
            </div>

            {isUpdateMode && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                更新模式中该策略为只读，沿用当前数据源历史配置。
              </Text>
            )}

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(1)}>
                上一步
              </Button>
              <Button type="primary" onClick={() => setCurrentStep(3)}>
                下一步
              </Button>
            </div>
          </div>
        )}

        {/** Step 3 — 表头配置 */}
        {currentStep === 3 && (
          <div>
            {/** 更新模式只读提示 + 已保存的表头列名展示 */}
            {isUpdateMode && !storageUnlocked && (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="表头配置已锁定"
                  description="更新数据时表头行配置不可修改，将沿用首次导入时的配置。若需修改，请先在字段映射步骤点击「解锁修改」。"
                  style={{ marginBottom: 16 }}
                />
                {existingRecipe?.config?.length > 0 && (
                  <div className={styles.headerPreview}>
                    {/** 存储行：recipe config 的 from 字段（原始列名） */}
                    <div className={`${styles.headerPreviewRow} ${styles.headerPreviewRowStorage}`}>
                      <div className={styles.headerPreviewRole}>
                        <Tag color="blue">存储行</Tag>
                      </div>
                      <div className={styles.headerPreviewCells}>
                        {existingRecipe.config.slice(0, 8).map((op, ci) => (
                          <span key={ci} className={styles.headerPreviewCell}>
                            {op.from}
                          </span>
                        ))}
                        {existingRecipe.config.length > 8 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            +{existingRecipe.config.length - 8} 列
                          </Text>
                        )}
                      </div>
                    </div>
                    {/** 展示行：recipe config 的 label 字段（展示名） */}
                    {existingRecipe.config.some((op) => op.label && op.label !== op.from) && (
                      <div className={`${styles.headerPreviewRow} ${styles.headerPreviewRowLabel}`}>
                        <div className={styles.headerPreviewRole}>
                          <Tag color="green">展示行</Tag>
                        </div>
                        <div className={styles.headerPreviewCells}>
                          {existingRecipe.config.slice(0, 8).map((op, ci) => (
                            <span key={ci} className={styles.headerPreviewCell}>
                              {op.label ?? op.from}
                            </span>
                          ))}
                          {existingRecipe.config.length > 8 && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              +{existingRecipe.config.length - 8} 列
                            </Text>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/** 行数配置 + 解析按钮 */}
            {(!isUpdateMode || storageUnlocked) && (
              <div className={styles.parseBar}>
                <Text>标题行数：</Text>
                <InputNumber
                  min={1}
                  max={2}
                  value={headerRowCount}
                  onChange={(val) => {
                    setHeaderRowCount(val ?? 1)
                    resetParsedArtifacts()
                  }}
                  style={{ width: 72 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  大多数文件为 1 行；含双行标题的文件填 2
                </Text>
                <Button
                  type="primary"
                  icon={parsing ? <SyncOutlined spin /> : <PlayCircleOutlined />}
                  loading={parsing}
                  onClick={handleParse}
                  style={{ marginLeft: 'auto' }}
                >
                  {parsing ? '解析中…' : parsed ? '重新解析' : '解析文件'}
                </Button>
              </div>
            )}

            {/** 解析中 loading */}
            {parsing && (
              <div className={styles.parseLoading}>
                <Spin size="small" />
                <Text type="secondary">正在读取文件头部…</Text>
              </div>
            )}

            {/** 解析完成：行预览 */}
            {parsed && headerRows.length > 0 && (
              <>
                {sourceGroups.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>
                      结构分组预览（{mergeSameSchema ? '同结构自动合并' : '同结构按 source unit 拆分'}）
                    </Text>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sourceGroups.map((group) => (
                        <div key={group.groupKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tag color={group.schemaOrder === 1 ? 'blue' : 'purple'}>
                            schema_{String(group.schemaOrder).padStart(2, '0')}
                          </Tag>
                          <Text type="secondary">{group.sourceUnits.length} 个 source unit</Text>
                          <Text code style={{ fontSize: 11 }}>
                            {group.schemaFingerprint.slice(0, 10)}…
                          </Text>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.headerPreview}>
                  {headerRows.map((row, idx) => {
                    const isStorage = idx === storageRowIndex
                    const isLabel = idx === labelRowIndex
                    return (
                      <div
                        key={idx}
                        className={`${styles.headerPreviewRow} ${isStorage ? styles.headerPreviewRowStorage : isLabel ? styles.headerPreviewRowLabel : ''}`}
                      >
                        <div className={styles.headerPreviewRole}>
                          {isStorage && <Tag color="blue">存储行</Tag>}
                          {isLabel && !isStorage && <Tag color="green">展示行</Tag>}
                          {!isStorage && !isLabel && <Tag>第 {idx + 1} 行</Tag>}
                        </div>
                        <div className={styles.headerPreviewCells}>
                          {row.slice(0, 8).map((cell, ci) => (
                            <span key={ci} className={styles.headerPreviewCell}>
                              {cell}
                            </span>
                          ))}
                          {row.length > 8 && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              +{row.length - 8} 列
                            </Text>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {headerRows.length >= 2 && sourceUnits.length <= 1 && (!isUpdateMode || storageUnlocked) && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <Button icon={<SwapOutlined />} onClick={swapRows}>
                      互换存储行与展示行
                    </Button>
                  </div>
                )}
              </>
            )}

            {/** 未解析时的空提示 */}
            {/** 未解析时的空提示：更新锁定且有 recipe 时不显示（已有列名预览），新建模式未解析时显示引导 */}
            {!parsing && !parsed && !(isUpdateMode && !storageUnlocked && existingRecipe?.config?.length > 0) && (
              <div className={styles.parseEmpty}>
                <Text type="secondary">
                  {isUpdateMode && !storageUnlocked
                    ? '沿用上次配置，直接点击「下一步」进入字段映射。'
                    : '设定标题行数后，点击「解析文件」预览表头内容。'}
                </Text>
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(2)}>
                上一步
              </Button>
              <Button type="primary" disabled={!isUpdateMode && !storageUnlocked && !parsed} onClick={proceedToMapping}>
                下一步
              </Button>
            </div>
          </div>
        )}

        {/** Step 4 — 字段映射 */}
        {currentStep === 4 && (
          <div>
            {isStorageLocked && (
              <Alert
                className={styles.lockAlert}
                type="warning"
                showIcon
                message="存储列名已锁定"
                description={
                  <span>
                    Doris 表已建立，存储列名不可直接修改。若需修改列名，请点击「解锁修改」，系统将要求重新上传数据，
                    <strong>原有数据将被覆盖，此操作不可撤销。</strong>
                  </span>
                }
                action={
                  <Button size="small" danger icon={<UnlockOutlined />} onClick={handleUnlock}>
                    解锁修改
                  </Button>
                }
              />
            )}

            {!isUpdateMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Text strong style={{ flexShrink: 0 }}>
                  数据集名称：
                </Text>
                <Input
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  style={{ width: 280 }}
                  placeholder="数据集名称"
                />
              </div>
            )}

            {!isStorageLocked && (
              <div className={styles.normalizeBar}>
                <ThunderboltOutlined style={{ color: '#1677ff' }} />
                <Text style={{ fontSize: 13 }}>存储列名规范化</Text>
                <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} onClick={handleNormalize}>
                  一键转拼音 snake_case
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  中文列名将转为拼音，重复列名自动追加 _2、_3…
                </Text>
              </div>
            )}

            {sourceGroups.length > 1 && (
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong style={{ marginRight: 4 }}>
                  当前结构组：
                </Text>
                <Select value={activeGroupKey} style={{ minWidth: 360 }} onChange={(val) => setActiveGroupKey(val)}>
                  {sourceGroups.map((group) => (
                    <Option key={group.groupKey} value={group.groupKey}>
                      {`schema_${String(group.schemaOrder).padStart(2, '0')} · ${group.sourceUnits.length} units · ${group.schemaFingerprint.slice(0, 10)}...`}
                    </Option>
                  ))}
                </Select>
              </div>
            )}

            {/** 更新锁定模式：未重新解析文件，无数据预览列，给出说明 */}
            {isUpdateMode && !storageUnlocked && !parsed && (
              <Alert
                type="info"
                showIcon={false}
                banner
                message="当前为更新模式且未重新解析文件，数据预览列不可用。如需预览原始数据，请选择新文件后点击「解析文件」。"
                style={{ marginBottom: 8, fontSize: 12 }}
              />
            )}

            <Table
              columns={mappingColumns}
              dataSource={mappingData}
              pagination={false}
              size="small"
              scroll={{ y: 320 }}
              rowClassName={({ orig }) => (!isStorageLocked && getStorageNameError(orig) ? styles.conflictRow : '')}
            />

            <Divider style={{ margin: '16px 0' }} />

            <div style={{ textAlign: 'right' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(3)}>
                上一步
              </Button>
              <Button type="primary" onClick={handleSave} disabled={!isStorageLocked && hasAnyError()}>
                {isUpdateMode ? '保存并更新数据' : '保存映射并导入'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/** ── 版本历史 Drawer（双 Tab） ── */}
      <Drawer
        title={`版本历史 — ${selectedDataset?.name ?? ''}`}
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        width={640}
      >
        <Tabs
          activeKey={drawerActiveTab}
          onChange={handleDrawerTabChange}
          items={[
            {
              key: 'versions',
              label: '版本历史',
              children: (
                <Table
                  dataSource={versions}
                  rowKey="id"
                  loading={versionsLoading}
                  size="small"
                  pagination={false}
                  locale={{ emptyText: '暂无版本记录' }}
                  columns={versionColumns}
                />
              ),
            },
            {
              key: 'files',
              label: (
                <Space size={4}>
                  <FolderOutlined />
                  文件管理
                </Space>
              ),
              children: (
                <Spin spinning={fileMetaLoading} tip="加载文件信息…">
                  <Table
                    dataSource={fileTableRows}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    locale={{ emptyText: '暂无版本记录' }}
                    columns={fileColumns}
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Drawer>

      {/** ── 删除确认 Modal（带明细） ── */}
      <Modal
        title={
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            {`确认删除「${pendingDeleteRecord?.name ?? ''}」？`}
          </Space>
        }
        open={deleteModalOpen}
        onCancel={() => {
          setDeleteModalOpen(false)
          setPendingDeleteRecord(null)
          setDeleteDetails(null)
        }}
        okText="确认删除"
        okType="danger"
        cancelText="取消"
        onOk={handleDeleteConfirm}
        okButtonProps={{ disabled: deleteDetailsLoading }}
      >
        {deleteDetailsLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Spin size="small" />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">正在查询关联数据…</Text>
            </div>
          </div>
        ) : deleteDetails?.error ? (
          <Alert type="warning" message="无法查询关联数据明细，继续操作将尽力清理。" showIcon />
        ) : deleteDetails ? (
          <div>
            <Alert
              type="warning"
              showIcon
              message="将清理以下内容"
              description={
                <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                  <li>
                    版本记录：<strong>{deleteDetails.versionCount}</strong> 条
                  </li>
                  <li>
                    Directus 文件：<strong>{deleteDetails.fileCount}</strong> 个（共{' '}
                    <strong>{formatFileSize(deleteDetails.totalSize)}</strong>）
                  </li>
                  <li>
                    字段映射配置：<strong>{deleteDetails.recipeCount}</strong> 条
                  </li>
                  <li style={{ color: '#8c8c8c' }}>
                    Doris 中的数据表<strong>不会自动清理</strong>，如需清理请联系管理员。
                  </li>
                </ul>
              }
              style={{ marginBottom: 0 }}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default Datasets
