import React, { useEffect, useState } from 'react'
import { Typography, Button, Space, Divider, Tooltip } from 'antd'
import {
  ArrowLeftOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  SaveOutlined,
  ExportOutlined,
  ShareAltOutlined,
  BarChartOutlined,
  CheckCircleFilled,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { getWorkbookBySlug } from '@src/service/api/workbooks'
import { getProjectBySlug } from '@src/service/api/projects'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import { useFormalSave } from '../../hooks/useFormalSave'
import styles from './index.module.less'

const { Text } = Typography

/** 保存状态指示器 */
const SaveStatus = ({ isDirty }) => {
  if (isDirty) {
    return (
      <div className={styles.saveStatus}>
        <span className={styles.saveDot} />
        <Text className={styles.saveStatusText}>未保存</Text>
      </div>
    )
  }
  return (
    <div className={`${styles.saveStatus} ${styles.saveStatusSaved}`}>
      <CheckCircleFilled className={styles.saveCheckIcon} />
      <Text className={styles.saveStatusTextSaved}>已保存</Text>
    </div>
  )
}

const EditorTopBar = () => {
  const navigate = useNavigate()
  const { slug, workbookSlug } = useParams()
  const [workbookName, setWorkbookName] = useState('分析工作台')

  const {
    categories, activeCategoryId, categorySidebarOpen, toggleCategorySidebar,
    isDirty,
  } = useWorkbenchState()

  const { save, saving } = useFormalSave()

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  useEffect(() => {
    if (!workbookSlug) return
    let cancelled = false
    const load = async () => {
      let projectId
      if (slug) {
        try {
          const project = await getProjectBySlug(slug)
          projectId = project?.id
        } catch { /* 降级 */ }
      }
      // 优先用 slug 查；若 workbookSlug 不含 'wb-' 前缀则当 UUID 直接用 getWorkbook
      const wb = workbookSlug.startsWith('wb-')
        ? await getWorkbookBySlug(workbookSlug, projectId)
        : null
      if (!cancelled && wb?.name) setWorkbookName(wb.name)
    }
    load()
    return () => { cancelled = true }
  }, [workbookSlug, slug])

  const handleBack = () => {
    navigate(`/project/${slug}/workbooks`)
  }

  /** Ctrl+S 全局快捷键 */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [save])

  return (
    <div className={styles.topBar}>
      {/* 左侧：返回 + 面包屑 */}
      <div className={styles.leftSection}>
        <Tooltip title="返回工作台列表">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            className={styles.backBtn}
            onClick={handleBack}
          />
        </Tooltip>

        <Divider type="vertical" className={styles.divider} />

        {/* 面包屑 */}
        <div className={styles.breadcrumb}>
          <BarChartOutlined className={styles.breadcrumbIcon} />
          <Text className={styles.breadcrumbWorkbook} ellipsis>
            {workbookName || '分析工作台'}
          </Text>
          {activeCategory && (
            <>
              <Text className={styles.breadcrumbSep}>/</Text>
              <span className={styles.breadcrumbCatIcon}>{activeCategory.icon}</span>
              <Text className={styles.breadcrumbCategory} ellipsis>
                {activeCategory.name}
              </Text>
            </>
          )}
        </div>
      </div>

      {/* 中间：类别菜单开关 + 保存状态 */}
      <div className={styles.centerSection}>
        <Tooltip title={categorySidebarOpen ? '收起类别菜单' : '展开类别菜单'}>
          <Button
            type={categorySidebarOpen ? 'primary' : 'default'}
            size="small"
            icon={categorySidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
            onClick={toggleCategorySidebar}
            className={styles.menuToggleBtn}
          >
            {activeCategory ? activeCategory.name : '类别菜单'}
          </Button>
        </Tooltip>

        <Divider type="vertical" className={styles.divider} />

        <SaveStatus isDirty={isDirty} />
      </div>

      {/* 右侧：操作按钮 */}
      <div className={styles.rightSection}>
        <Space size={4}>
          <Tooltip title="保存 (Ctrl+S)">
            <Button
              type="text"
              size="small"
              icon={<SaveOutlined />}
              loading={saving}
              className={`${styles.actionBtn} ${isDirty ? styles.actionBtnDirty : ''}`}
              onClick={save}
            >
              保存
            </Button>
          </Tooltip>
          <Tooltip title="导出（开发中）">
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              className={styles.actionBtn}
            >
              导出
            </Button>
          </Tooltip>
          <Tooltip title="分享（开发中）">
            <Button
              size="small"
              type="primary"
              icon={<ShareAltOutlined />}
              className={styles.shareBtn}
            >
              分享
            </Button>
          </Tooltip>
        </Space>
      </div>
    </div>
  )
}

export default EditorTopBar
