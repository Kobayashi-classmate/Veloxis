import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Typography, Button, Table, Space, Modal, Steps, Upload, message, Input, Select, Tag, Tooltip } from 'antd'
import { InboxOutlined, PlusOutlined, DatabaseOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { getDatasets, uploadDatasetFile, createDataset, createDatasetVersion, createRecipe, getRecipes, updateRecipe } from '@src/service/api/datasets'

const { Title, Text, Paragraph } = Typography
const { Step } = Steps
const { Dragger } = Upload
const { Option } = Select

const Datasets = () => {
  const { id: projectId } = useParams()
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [isModalVisible, setIsModalVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [editingDataset, setEditingDataset] = useState(null)
  const [existingRecipe, setExistingRecipe] = useState(null)

  // 当前选择的文件
  const [currentFile, setCurrentFile] = useState(null)

  // 预览数据
  const [originalHeaders, setOriginalHeaders] = useState([])
  const [dataPreview, setDataPreview] = useState([])

  // 映射配置 { '原表头': { targetName: '目标表头', type: '类型' } }
  const [headerMapping, setHeaderMapping] = useState({})
  const [datasetName, setDatasetName] = useState('')

  const fetchDatasets = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await getDatasets(projectId)
      setDatasets(data || [])
    } catch (error) {
      console.error('Failed to fetch datasets:', error)
      message.error('获取数据源失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDatasets()
  }, [projectId])

  // 打开创建/更新弹窗
  const showModal = async (dataset = null) => {
    setEditingDataset(dataset)
    setIsModalVisible(true)
    setCurrentStep(0)
    setCurrentFile(null)
    setOriginalHeaders([])
    setDataPreview([])
    setHeaderMapping({})
    setDatasetName(dataset ? dataset.name : '')

    if (dataset) {
      try {
        const recipes = await getRecipes(dataset.id)
        if (recipes && recipes.length > 0) {
          setExistingRecipe(recipes[0])
        } else {
          setExistingRecipe(null)
        }
      } catch (err) {
        console.error('Fetch recipe error', err)
      }
    } else {
      setExistingRecipe(null)
    }
  }

  const handleCancel = () => {
    setIsModalVisible(false)
  }

  // 简易 CSV 解析（仅用于前端预览和表头提取）
  const parseCSV = (text) => {
    const lines = text.split('\n').filter((line) => line.trim() !== '')
    if (lines.length === 0) return { headers: [], rows: [] }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const rows = lines.slice(1, 6).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const rowData = {}
      headers.forEach((h, i) => {
        rowData[h] = values[i]
      })
      return rowData
    })

    return { headers, rows }
  }

  const handleFileUpload = (file) => {
    setCurrentFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      const { headers, rows } = parseCSV(content)

      setOriginalHeaders(headers)
      setDataPreview(rows)

      const initialMapping = {}
      headers.forEach((h) => {
        let targetName = h
        if (existingRecipe && existingRecipe.config) {
          const matchedOp = existingRecipe.config.find((op) => op.type === 'rename' && op.from === h)
          if (matchedOp && matchedOp.to) {
            targetName = matchedOp.to
          }
        }
        initialMapping[h] = {
          targetName: targetName,
          type: 'string',
        }
      })
      setHeaderMapping(initialMapping)
      if (!editingDataset) {
        setDatasetName(file.name.replace(/\.[^/.]+$/, ''))
      }

      message.success(`${file.name} 文件解析成功`)
      setCurrentStep(1)
    }
    reader.onerror = () => {
      message.error('文件读取失败')
    }
    reader.readAsText(file)
    return false // 阻止默认上传行为，等第二步再统一提交
  }

  const draggerProps = {
    name: 'file',
    multiple: false,
    fileList: currentFile ? [currentFile] : [],
    beforeUpload: handleFileUpload,
    onRemove: () => {
      setCurrentFile(null)
      return true
    },
    accept: '.csv,.txt',
  }

  const handleMappingChange = (originalHeader, field, value) => {
    setHeaderMapping((prev) => ({
      ...prev,
      [originalHeader]: {
        ...prev[originalHeader],
        [field]: value,
      },
    }))
  }

  const handleSaveDataset = async () => {
    const targetNames = Object.values(headerMapping).map((m) => m.targetName)
    const uniqueTargetNames = new Set(targetNames)
    if (targetNames.includes('')) {
      message.error('目标表头不能为空')
      return
    }
    if (targetNames.length !== uniqueTargetNames.size) {
      message.error('目标表头不能重复')
      return
    }

    if (!currentFile || !projectId) {
      message.error('文件或项目信息缺失')
      return
    }

    setSaving(true)
    try {
      // 1. 上传文件到 Directus
      const uploadRes = await uploadDatasetFile(currentFile)
      const fileId = uploadRes?.id

      if (!fileId) throw new Error('File upload failed (no id returned)')

      let datasetId = editingDataset?.id

      if (!editingDataset) {
        // 2. 创建数据集
        const newDataset = await createDataset({
          name: datasetName || currentFile.name,
          project_id: projectId,
          type: 'CSV',
        })
        datasetId = newDataset.id
      }

      // 3. 创建或更新 ETL Recipe 记录映射配置
      const recipeConfig = Object.entries(headerMapping)
        .filter(([original, mapping]) => original !== mapping.targetName)
        .map(([original, mapping]) => ({
          type: 'rename',
          from: original,
          to: mapping.targetName
        }))

      if (existingRecipe) {
        await updateRecipe(existingRecipe.id, { config: recipeConfig })
      } else if (recipeConfig.length > 0) {
        await createRecipe({
          dataset_id: datasetId,
          name: '表头映射规则',
          config: recipeConfig
        })
      }

      // 4. 创建数据集版本并关联 file_id
      await createDatasetVersion({
        dataset_id: datasetId,
        version_name: editingDataset ? `v${dayjs().format('YYYYMMDDHHmmss')}` : 'v1.0',
        file_id: fileId,
        status: 'processing'
      })

      message.success(editingDataset ? '数据源已更新，正在处理中！' : '数据源创建成功，文件已上传！')
      setIsModalVisible(false)
      fetchDatasets() // 重新拉取列表
    } catch (error) {
      console.error('Save dataset error:', error)
      message.error('保存失败，请检查网络或控制台')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    {
      title: '数据源名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <>
          <DatabaseOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          {text}
        </>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={status === 'ready' ? 'green' : 'orange'}>{status}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'date_created',
      key: 'date_created',
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm:ss') : '—',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="更新数据并重新应用映射">
            <Button type="link" icon={<SyncOutlined />} onClick={() => showModal(record)}>
              更新
            </Button>
          </Tooltip>
          <Tooltip title="编辑映射关系">
            <Button type="link" icon={<EditOutlined />} onClick={() => showModal(record)}>
              编辑配置
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ]

  const mappingColumns = [
    {
      title: '原始表头 (Source Header)',
      dataIndex: 'originalHeader',
      key: 'originalHeader',
      render: (text) => (
        <Text strong>
          {text}
          {/[\u4e00-\u9fa5]/.test(text) ? (
            <Tag color="orange" style={{ marginLeft: 8 }}>
              中文
            </Tag>
          ) : (
            <Tag color="cyan" style={{ marginLeft: 8 }}>
              EN
            </Tag>
          )}
        </Text>
      ),
    },
    {
      title: '目标表头 / 别名 (Target Header)',
      dataIndex: 'targetName',
      key: 'targetName',
      render: (_, record) => (
        <Input
          value={headerMapping[record.originalHeader]?.targetName}
          onChange={(e) => handleMappingChange(record.originalHeader, 'targetName', e.target.value)}
          placeholder="输入映射后的表头名称"
        />
      ),
    },
    {
      title: '数据类型',
      dataIndex: 'type',
      key: 'type',
      render: (_, record) => (
        <Select
          value={headerMapping[record.originalHeader]?.type}
          onChange={(val) => handleMappingChange(record.originalHeader, 'type', val)}
          style={{ width: 120 }}
        >
          <Option value="string">字符串 (String)</Option>
          <Option value="number">数字 (Number)</Option>
          <Option value="date">日期 (Date)</Option>
          <Option value="boolean">布尔 (Boolean)</Option>
        </Select>
      ),
    },
    {
      title: '数据预览 (首行)',
      dataIndex: 'preview',
      key: 'preview',
      render: (_, record) => {
        const val = dataPreview.length > 0 ? dataPreview[0][record.originalHeader] : ''
        return (
          <Text type="secondary" ellipsis style={{ maxWidth: 150 }}>
            {val}
          </Text>
        )
      },
    },
  ]

  const mappingData = originalHeaders.map((h) => ({ key: h, originalHeader: h }))

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            数据源管理 (Data Sources)
          </Title>
          <Text type="secondary">上传或连接源数据，配置并固化中英文表头映射关系，保证后续数据更新依然生效。</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
          接入新数据
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={datasets} 
        rowKey="id" 
        pagination={{ pageSize: 10 }} 
        loading={loading}
      />

      <Modal
        title="接入/更新数据源"
        open={isModalVisible}
        onCancel={handleCancel}
        width={900}
        footer={null}
        destroyOnClose
        maskClosable={!saving}
        closable={!saving}
      >
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          <Step title="上传数据" description="支持 CSV 格式" />
          <Step title="表头映射与修改" description="兼容中英文及混合场景" />
        </Steps>

        {currentStep === 0 && (
          <div style={{ marginTop: 24 }}>
            <Dragger {...draggerProps} style={{ padding: 48 }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或将文件拖拽到此处上传</p>
              <p className="ant-upload-hint">
                支持 CSV 文本文件。上传后系统将自动提取表头，并允许您对其进行重命名映射。该映射将在未来更新数据时持续生效。
              </p>
            </Dragger>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>数据集名称：</Text>
              <Input
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                style={{ width: 300, marginLeft: 8 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <Paragraph type="secondary">
                系统已提取以下原始表头。您可以修改“目标表头”来实现二次命名（如将中文表头转为标准英文规范，或保留原有含义）。
                <b>修改后的映射关系将被固化</b>，下次上传包含相同原始表头的数据时，配置会自动应用。
              </Paragraph>
            </div>

            <Table
              columns={mappingColumns}
              dataSource={mappingData}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <Button style={{ marginRight: 8 }} onClick={() => setCurrentStep(0)} disabled={saving}>
                上一步 / 重新上传
              </Button>
              <Button type="primary" onClick={handleSaveDataset} loading={saving}>
                保存映射并导入
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Datasets