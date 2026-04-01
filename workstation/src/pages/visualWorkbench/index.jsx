import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Modal, Spin } from 'antd'
import EditorTopBar from './components/EditorTopBar'
import CategorySidebar from './components/CategorySidebar'
import Canvas from './components/Canvas'
import ChartPalette from './components/ChartPalette'
import SheetBar from './components/SheetBar'
import ConfigPanel from './components/ConfigPanel'
import useWorkbenchState from './hooks/useWorkbenchState'
import { useLeaveInterception } from './hooks/useLeaveInterception'
import { getWorkbookBySlug } from '@src/service/api/workbooks'
import { getProjectBySlug } from '@src/service/api/projects'
import styles from './index.module.less'

/**
 * VisualWorkbench — 全屏可视化编辑器
 *
 * 路由参数：:workbookSlug（URL-safe slug，如 "wb-1698765432100-sales"）
 * 加载时先通过 slug → workbook UUID，再 bootstrap Zustand store
 * URL 示例：/project/:slug/workbooks/:workbookSlug
 */
const VisualWorkbench = () => {
  const { slug: projectSlug, workbookSlug } = useParams()

  const {
    bootstrap, bootstrapping, bootstrapped,
    selectedChartId, removeChart, closeConfigPanel, deselectChart,
    resetWorkbench,
  } = useWorkbenchState()

  // 离开拦截（未保存时提示保存草稿）
  const { leaveModal } = useLeaveInterception()

  useEffect(() => {
    if (!workbookSlug) return
    let cancelled = false

    const load = async () => {
      let workbookId = workbookSlug

      // slug 以 "wb-" 开头时，通过 Directus 查询解析为 UUID
      if (workbookSlug.startsWith('wb-')) {
        let projectId
        if (projectSlug) {
          try {
            const project = await getProjectBySlug(projectSlug)
            projectId = project?.id
          } catch { /* 降级：不过滤 project_id */ }
        }
        const wb = await getWorkbookBySlug(workbookSlug, projectId)
        if (cancelled) return
        if (wb?.id) workbookId = wb.id
      }

      // 每次（重）进入工作台都重置 store，确保不显示上次的草稿缓存
      if (!cancelled) {
        resetWorkbench()
        bootstrap(workbookId)
      }
    }

    load()
    return () => { cancelled = true }
  }, [workbookSlug, projectSlug, resetWorkbench, bootstrap])

  /** 全局键盘快捷键 */
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape：关闭配置面板 + 取消选中
      if (e.key === 'Escape') {
        closeConfigPanel()
        deselectChart()
        return
      }
      // Delete / Backspace：删除选中图表（避开输入框）
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedChartId) {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        Modal.confirm({
          title: '删除图表？',
          content: '确定要删除此图表吗？此操作不可撤销。',
          okText: '删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => removeChart(selectedChartId),
        })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedChartId, removeChart, closeConfigPanel, deselectChart])

  /** 首次加载中显示全屏 Spin */
  if (!bootstrapped && bootstrapping) {
    return (
      <>
        <div className={styles.loadingWrap}>
          <Spin size="large" tip="加载工作台..." />
        </div>
        {leaveModal}
      </>
    )
  }

  return (
    <div
      className={styles.editor}
      onClick={() => deselectChart()}
    >
      {/** 顶部工具条 */}
      <EditorTopBar />

      {/** 主体区域 */}
      <div className={styles.body}>
        {/** 类别侧边栏（绝对定位，覆盖画布左侧，可收起）*/}
        <CategorySidebar />

        {/** 画布区域 */}
        <Canvas />

        {/** 右侧图表工具栏（常驻，与画布并列）*/}
        <ChartPalette />
      </div>

      {/** 底部 Sheet 标签栏 */}
      <SheetBar />

      {/** 浮动配置面板（Portal 到 body）*/}
      <ConfigPanel />

      {/** 离开拦截弹窗（受控 Modal，替代 Modal.confirm imperative API）*/}
      {leaveModal}
    </div>
  )
}

export default VisualWorkbench
