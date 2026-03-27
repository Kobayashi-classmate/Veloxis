import React, { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { useParams } from 'react-router-dom'
import {
  Typography, Button, Table, Space, Modal, Steps, Upload, message,
  Input, Select, Tag, Tooltip, Drawer, Alert, InputNumber, Empty,
  Divider, Spin, Progress,
} from 'antd'
import {
  InboxOutlined, PlusOutlined, DatabaseOutlined, EditOutlined,
  SyncOutlined, DeleteOutlined, HistoryOutlined, SwapOutlined,
  ThunderboltOutlined, WarningOutlined, CheckCircleOutlined, CloseCircleOutlined,
  UnlockOutlined, CheckOutlined, CloseOutlined, FileTextOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import { pinyin } from 'pinyin-pro'
import dayjs from 'dayjs'
import {
  getDatasets, uploadDatasetFileWithProgress, ensureProjectFolder,
  createDataset, updateDataset, deleteDataset,
  createDatasetVersion, createRecipe, getRecipes, updateRecipe,
  getDatasetVersions,
} from '@src/service/api/datasets'
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
    if (!seen[name]) { seen[name] = 1; return name }
    seen[name]++
    return `${name}_${seen[name]}`
  })
}

function validateStorageName(name) {
  if (!name || name.trim() === '') return '存储列名不能为空'
  if (!/^[a-z][a-z0-9_]*$/.test(name.trim())) return '只允许小写字母、数字、下划线，且不能以数字开头'
  return null
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
    if (editing) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [editing])

  const handleSave = async () => {
    const trimmed = value.trim()
    if (!trimmed) { message.warning('名称不能为空'); setValue(record.name); setEditing(false); return }
    if (trimmed === record.name) { setEditing(false); return }
    try {
      await onSave(record.id, trimmed)
      setEditing(false)
    } catch {
      message.error('名称修改失败')
      setValue(record.name)
      setEditing(false)
    }
  }

  const handleCancel = () => { setValue(record.name); setEditing(false) }

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
        <Button type="link" size="small" icon={<CheckOutlined />} onClick={handleSave} style={{ color: '#16a34a', padding: 0 }} />
        <Button type="link" size="small" icon={<CloseOutlined />} onClick={handleCancel} danger style={{ padding: 0 }} />
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
  const { id: projectId } = useParams()

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
  const [fileType, setFileType] = useState('CSV')
  const [datasetName, setDatasetName] = useState('')

  /** Step 1：表头配置 */
  const [headerRowCount, setHeaderRowCount] = useState(1)
  const [parsing, setParsing] = useState(false)       /** 解析中 */
  const [parsed, setParsed] = useState(false)          /** 已解析完成 */
  const [headerRows, setHeaderRows] = useState([])
  const [dataRows, setDataRows] = useState([])
  const [storageRowIndex, setStorageRowIndex] = useState(0)
  const [labelRowIndex, setLabelRowIndex] = useState(1)

  /** Step 2：字段映射 */
  const [mapping, setMapping] = useState({})

  /** 版本历史 Drawer */
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState(null)
  const [versions, setVersions] = useState([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  /** ── 获取数据集列表 ── */
  const fetchDatasets = useCallback(async (silent = false) => {
    if (!projectId) return
    if (!silent) setLoading(true)
    try {
      const data = await getDatasets(projectId)
      setDatasets((prev) => {
        /** 保留还在上传中的临时行（Directus 尚未有记录），其余全量替换 */
        const uploadingRows = prev.filter((d) => d.status === 'uploading' && d._isTemp)
        return [...uploadingRows, ...(data || [])]
      })
    } catch {
      if (!silent) message.error('获取数据源失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchDatasets() }, [fetchDatasets])

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

  const openVersionDrawer = (record) => {
    setSelectedDataset(record)
    setVersions([])
    setVersionDrawerOpen(true)
    fetchVersions(record.id)
  }

  const hasProcessingVersion = versions.some((v) => v.status === 'processing')
  useEffect(() => {
    if (!versionDrawerOpen || !selectedDataset || !hasProcessingVersion) return
    const timer = setInterval(() => fetchVersions(selectedDataset.id, true), 3000)
    return () => clearInterval(timer)
  }, [versionDrawerOpen, selectedDataset, hasProcessingVersion, fetchVersions])

  /** ── 打开 Modal ── */
  const openModal = async (dataset = null) => {
    setEditingDataset(dataset)
    setModalOpen(true)
    setCurrentStep(0)
    setCurrentFile(null)
    setFileType('CSV')
    setDatasetName(dataset?.name ?? '')
    setStorageUnlocked(false)
    setExistingRecipe(null)
    setHeaderRowCount(1)
    setParsing(false)
    setParsed(false)
    setHeaderRows([])
    setDataRows([])
    setStorageRowIndex(0)
    setLabelRowIndex(1)
    setMapping({})

    if (dataset) {
      try {
        const recipes = await getRecipes(dataset.id)
        if (recipes?.length > 0) {
          setExistingRecipe(recipes[0])
          const savedCount = recipes[0]?.header_row_count ?? 1
          setHeaderRowCount(savedCount)
        }
      } catch { /* 忽略 */ }
    }
  }

  /** ── Step 0：选择文件（仅记录，不解析） ── */
  const handleFileSelect = (file) => {
    setCurrentFile(file)
    setFileType(/\.xlsx?$/i.test(file.name) ? 'Excel' : 'CSV')
    setParsed(false)
    setHeaderRows([])
    setDataRows([])
    setMapping({})
    if (!editingDataset) {
      setDatasetName(file.name.replace(/\.[^/.]+$/, ''))
    }
    return false
  }

  /** ── Step 1：用户点「解析文件」按钮 ── */
  const handleParse = async () => {
    if (!currentFile) return
    setParsing(true)
    setParsed(false)
    setHeaderRows([])
    setDataRows([])
    setMapping({})
    try {
      const result = await parseFileHead(currentFile, headerRowCount)
      if (!result.headerRows.length) {
        message.error('未能识别到表头，请检查文件内容或标题行数设置')
        return
      }
      /** startTransition：让解析结果渲染为低优先级，不阻塞按钮响应 */
      startTransition(() => {
        setHeaderRows(result.headerRows)
        setDataRows(result.dataRows)
        setStorageRowIndex(0)
        setLabelRowIndex(result.headerRows.length > 1 ? 1 : 0)
        setParsed(true)
      })
    } catch {
      message.error('文件解析失败，请检查文件格式')
    } finally {
      setParsing(false)
    }
  }

  /** ── Step 1 → Step 2：构建 mapping 后切步骤 ── */
  const proceedToMapping = () => {
    const sHeaders = headerRows[storageRowIndex] || []
    const lHeaders = headerRows[labelRowIndex] ?? sHeaders
    const recipe = existingRecipe
    const init = {}
    sHeaders.forEach((orig, i) => {
      let storageName = orig
      let label = lHeaders[i] ?? orig
      if (recipe?.config) {
        const matched = recipe.config.find((op) => op.from === orig)
        if (matched) { storageName = matched.to ?? orig; label = matched.label ?? label }
      }
      init[orig] = { storageName, label, type: 'string' }
    })
    /** startTransition：mapping + 步骤切换一起作为低优先级批量更新 */
    startTransition(() => {
      setMapping(init)
      setCurrentStep(2)
    })
  }

  /** ── 互换存储行/展示行 ── */
  const swapRows = () => {
    setStorageRowIndex(labelRowIndex)
    setLabelRowIndex(storageRowIndex)
  }

  /** ── 一键规范化 ── */
  const handleNormalize = () => {
    const sHeaders = headerRows[storageRowIndex] || []
    const deduped = deduplicateNames(sHeaders.map(toStorageName))
    setMapping((prev) => {
      const next = { ...prev }
      sHeaders.forEach((orig, i) => { next[orig] = { ...next[orig], storageName: deduped[i] } })
      return next
    })
    message.success('存储列名已规范化')
  }

  /** ── 映射字段变更 ── */
  const handleMappingChange = (orig, field, value) => {
    setMapping((prev) => ({ ...prev, [orig]: { ...prev[orig], [field]: value } }))
  }

  /** ── 实时冲突检测 ── */
  const allStorageNames = Object.values(mapping).map((m) => m.storageName ?? '')
  const getStorageNameError = (orig) => {
    const name = mapping[orig]?.storageName ?? ''
    const err = validateStorageName(name)
    if (err) return err
    if (allStorageNames.filter((n) => n === name).length > 1) return '与其他列重复'
    return null
  }
  const storageHeaders = headerRows[storageRowIndex] || []
  const hasAnyError = () => storageHeaders.some((h) => getStorageNameError(h) !== null)

  /** ── 解锁存储列名 ── */
  const handleUnlock = () => {
    Modal.confirm({
      title: '解锁存储列名',
      icon: <WarningOutlined style={{ color: '#faad14' }} />,
      content: (
        <div>
          <p>修改存储列名后，系统将要求您<strong>重新上传数据文件</strong>，原有 Doris 表数据将被覆盖。</p>
          <p style={{ color: '#ff4d4f' }}>此操作不可撤销，请确认后继续。</p>
        </div>
      ),
      okText: '确认解锁',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        setStorageUnlocked(true)
        setCurrentFile(null)
        setParsed(false)
        setHeaderRows([])
        setDataRows([])
        setMapping({})
        setCurrentStep(0)
        message.warning('存储列名已解锁，请重新上传数据文件')
      },
    })
  }

  /** ── 删除数据集 ── */
  const handleDelete = (record) => {
    Modal.confirm({
      title: `确认删除「${record.name}」？`,
      icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
      content: '删除后数据源记录及所有历史版本将被移除，Doris 中的表数据不会自动清理。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteDataset(record.id)
          message.success('数据源已删除')
          fetchDatasets()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  /** ── 保存 ── */
  const handleSave = async () => {
    if (!currentFile || !projectId) { message.error('文件或项目信息缺失'); return }
    if (hasAnyError()) { message.error('存储列名存在错误，请修正后再保存'); return }

    /** 快照当前 Modal 数据（关闭后这些 state 将被重置） */
    const file = currentFile
    const type = fileType
    const name = datasetName || currentFile.name
    const dsId = editingDataset?.id ?? null
    const isUpdate = !!editingDataset
    const recipe = existingRecipe
    const sHeaders = [...storageHeaders]
    const sRowIdx = storageRowIndex
    const lRowIdx = labelRowIndex
    const hCount = headerRowCount
    const currentMapping = { ...mapping }

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
      }
      /** 更新模式：替换原行；新建模式：插到列表头部 */
      if (isUpdate) {
        return prev.map((d) => d.id === dsId ? { ...d, status: 'uploading', uploadProgress: 0, _tempId: tempId } : d)
      }
      return [tempRow, ...prev]
    })

    /** 后台异步执行上传 + 创建流程 */
    try {
      /** 1. 确保项目目录，获取 folderId */
      const folderId = await ensureProjectFolder(projectId)

      /** 2. 带进度上传文件 */
      const uploadedFile = await uploadDatasetFileWithProgress(file, folderId, (percent) => {
        setDatasets((prev) => prev.map((d) => {
          if (d.id === tempId) return { ...d, uploadProgress: percent }
          if (d._tempId === tempId) return { ...d, uploadProgress: percent }
          return d
        }))
      })

      const fileId = uploadedFile?.id
      if (!fileId) throw new Error('文件上传失败，未获取到 fileId')

      /** 文件已确认上传成功，推进度到 100% */
      setDatasets((prev) => prev.map((d) => {
        if (d.id === tempId || d._tempId === tempId) return { ...d, uploadProgress: 100 }
        return d
      }))

      /** 3. 创建或更新 Dataset 记录 */
      let datasetId = dsId
      if (!isUpdate) {
        const newDs = await createDataset({ name, project_id: projectId, type, status: 'processing' })
        datasetId = newDs.id
      } else {
        await updateDataset(datasetId, { status: 'processing', type })
      }

      /** 4. 保存 Recipe */
      const recipeConfig = sHeaders.map((orig) => ({
        type: 'rename',
        from: orig,
        to: currentMapping[orig]?.storageName ?? orig,
        label: currentMapping[orig]?.label ?? orig,
      }))
      const recipePayload = { config: recipeConfig, header_row_count: hCount, storage_row_index: sRowIdx, label_row_index: lRowIdx }
      if (recipe) {
        await updateRecipe(recipe.id, recipePayload)
      } else {
        await createRecipe({ dataset_id: datasetId, name: '表头映射规则', ...recipePayload })
      }

      /** 5. 创建版本记录（触发 Webhook → Worker） */
      await createDatasetVersion({
        dataset_id: datasetId,
        version_name: isUpdate ? `v${dayjs().format('YYYYMMDDHHmmss')}` : 'v1.0',
        file_id: fileId,
        status: 'processing',
      })

      /** 6. 刷新列表（临时行替换为真实数据） */
      fetchDatasets()

    } catch (err) {
      console.error('Save dataset error:', err)
      /** 上传/创建失败：移除临时行，显示错误 */
      setDatasets((prev) => {
        if (isUpdate) {
          return prev.map((d) => d._tempId === tempId ? { ...d, status: 'failed', uploadProgress: 0, _tempId: undefined } : d)
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
        if (status === 'ready') return <Tag icon={<CheckCircleOutlined />} color="success">就绪</Tag>
        if (status === 'failed') return <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
        return <Tag icon={<SyncOutlined spin />} color="warning">处理中</Tag>
      },
    },
    {
      title: '创建时间',
      dataIndex: 'date_created',
      key: 'date_created',
      width: 180,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '—',
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
              <Button type="link" size="small" icon={<SyncOutlined />} onClick={() => openModal(record)} disabled={isUploading}>更新</Button>
            </Tooltip>
            <Tooltip title={isUploading ? '上传中，请稍候' : '查看导入版本历史'}>
              <Button type="link" size="small" icon={<HistoryOutlined />} onClick={() => openVersionDrawer(record)} disabled={isUploading}>历史</Button>
            </Tooltip>
            <Tooltip title={isUploading ? '上传中，请稍候' : '删除数据源'}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} disabled={isUploading} />
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
          <Text strong style={{ fontFamily: 'monospace' }}>{orig}</Text>
          {/[\u4e00-\u9fa5]/.test(orig)
            ? <Tag color="orange" style={{ fontSize: 10 }}>中文</Tag>
            : <Tag color="cyan" style={{ fontSize: 10 }}>EN</Tag>}
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
              value={mapping[orig]?.storageName ?? ''}
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
          value={mapping[orig]?.label ?? ''}
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
          value={mapping[orig]?.type ?? 'string'}
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

  const mappingData = storageHeaders.map((orig) => ({ key: orig, orig }))

  const steps = [
    { title: '上传文件', description: '选择本地文件' },
    { title: '表头配置', description: '解析并指定行角色' },
    { title: '字段映射', description: '配置列名与类型' },
  ]

  /** ── 渲染 ── */
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={4} style={{ margin: 0 }}>数据源管理</Title>
          <Text type="secondary">上传或连接源数据，配置表头映射关系，固化后续数据更新时自动应用。</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>接入新数据</Button>
      </div>

      {!loading && datasets.length === 0 ? (
        <div className={styles.emptyWrap}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据源，点击「接入新数据」开始上传">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>接入第一个数据源</Button>
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
              multiple={false}
              fileList={[]}
              beforeUpload={handleFileSelect}
              accept=".csv,.txt,.xlsx,.xls"
              style={{ padding: '20px 0' }}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽文件到此处</p>
              <p className="ant-upload-hint">支持 CSV、TXT、Excel (.xlsx)。映射关系固化后更新数据时持续生效。</p>
            </Dragger>

            {currentFile && (
              <div className={styles.fileInfo}>
                <FileTextOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                <Text strong style={{ flex: 1 }}>{currentFile.name}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{(currentFile.size / 1024).toFixed(1)} KB</Text>
                <Button
                  type="link" size="small" danger icon={<CloseOutlined />}
                  onClick={() => setCurrentFile(null)} style={{ padding: 0 }}
                />
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button type="primary" disabled={!currentFile} onClick={() => setCurrentStep(1)}>
                下一步
              </Button>
            </div>
          </div>
        )}

        {/** Step 1 — 表头配置 */}
        {currentStep === 1 && (
          <div>
            {/** 更新模式只读提示 */}
            {isUpdateMode && !storageUnlocked && (
              <Alert
                type="info" showIcon
                message="表头配置已锁定"
                description="更新数据时表头行配置不可修改，将沿用首次导入时的配置。若需修改，请先在字段映射步骤点击「解锁修改」。"
                style={{ marginBottom: 16 }}
              />
            )}

            {/** 行数配置 + 解析按钮 */}
            {(!isUpdateMode || storageUnlocked) && (
              <div className={styles.parseBar}>
                <Text>标题行数：</Text>
                <InputNumber
                  min={1} max={2} value={headerRowCount}
                  onChange={(val) => { setHeaderRowCount(val ?? 1); setParsed(false); setHeaderRows([]); setMapping({}) }}
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
                            <span key={ci} className={styles.headerPreviewCell}>{cell}</span>
                          ))}
                          {row.length > 8 && <Text type="secondary" style={{ fontSize: 12 }}>+{row.length - 8} 列</Text>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {headerRows.length >= 2 && (!isUpdateMode || storageUnlocked) && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <Button icon={<SwapOutlined />} onClick={swapRows}>互换存储行与展示行</Button>
                  </div>
                )}
              </>
            )}

            {/** 未解析时的空提示 */}
            {!parsing && !parsed && (
              <div className={styles.parseEmpty}>
                <Text type="secondary">
                  {isUpdateMode && !storageUnlocked
                    ? '沿用上次配置，直接点击「下一步」进入字段映射。'
                    : '设定标题行数后，点击「解析文件」预览表头内容。'}
                </Text>
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(0)}>上一步</Button>
              <Button
                type="primary"
                disabled={!isUpdateMode && !storageUnlocked && !parsed}
                onClick={proceedToMapping}
              >
                下一步
              </Button>
            </div>
          </div>
        )}

        {/** Step 2 — 字段映射 */}
        {currentStep === 2 && (
          <div>
            {isStorageLocked && (
              <Alert
                className={styles.lockAlert}
                type="warning" showIcon
                message="存储列名已锁定"
                description={
                  <span>
                    Doris 表已建立，存储列名不可直接修改。若需修改列名，请点击「解锁修改」，系统将要求重新上传数据，<strong>原有数据将被覆盖，此操作不可撤销。</strong>
                  </span>
                }
                action={
                  <Button size="small" danger icon={<UnlockOutlined />} onClick={handleUnlock}>解锁修改</Button>
                }
              />
            )}

            {!isUpdateMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Text strong style={{ flexShrink: 0 }}>数据集名称：</Text>
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
                <Text type="secondary" style={{ fontSize: 12 }}>中文列名将转为拼音，重复列名自动追加 _2、_3…</Text>
              </div>
            )}

            <Table
              columns={mappingColumns}
              dataSource={mappingData}
              pagination={false}
              size="small"
              scroll={{ y: 320 }}
              rowClassName={({ orig }) => !isStorageLocked && getStorageNameError(orig) ? styles.conflictRow : ''}
            />

            <Divider style={{ margin: '16px 0' }} />

            <div style={{ textAlign: 'right' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(1)}>上一步</Button>
              <Button
                type="primary"
                onClick={handleSave}
                disabled={!isStorageLocked && hasAnyError()}
              >
                {isUpdateMode ? '保存并更新数据' : '保存映射并导入'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/** ── 版本历史 Drawer ── */}
      <Drawer
        title={`版本历史 — ${selectedDataset?.name ?? ''}`}
        open={versionDrawerOpen}
        onClose={() => setVersionDrawerOpen(false)}
        style={{ minWidth: 480 }}
      >
        <Table
          dataSource={versions}
          rowKey="id"
          loading={versionsLoading}
          size="small"
          pagination={false}
          locale={{ emptyText: '暂无版本记录' }}
          columns={[
            { title: '版本', dataIndex: 'version_name', key: 'version_name', width: 120, render: (v) => <Text code>{v}</Text> },
            {
              title: '状态', dataIndex: 'status', key: 'status', width: 100,
              render: (status) => {
                if (status === 'ready') return <Tag icon={<CheckCircleOutlined />} color="success">就绪</Tag>
                if (status === 'failed') return <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
                return <Tag icon={<SyncOutlined spin />} color="warning">处理中</Tag>
              },
            },
            { title: '时间', dataIndex: 'date_created', key: 'date_created', render: (v) => v ? dayjs(v).format('MM-DD HH:mm:ss') : '—' },
          ]}
        />
      </Drawer>
    </div>
  )
}

export default Datasets
