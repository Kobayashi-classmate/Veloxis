import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Spin } from 'antd'
import EditorTopBar from './components/EditorTopBar'
import CategorySidebar from './components/CategorySidebar'
import Canvas from './components/Canvas'
import ChartPalette from './components/ChartPalette'
import SheetBar from './components/SheetBar'
import ConfigPanel from './components/ConfigPanel'
import styles from './index.module.less'

/**
 * VisualWorkbench — 全屏可视化编辑器
 *
 * 使用 position: fixed; inset: 0 覆盖整个视口，
 * 视觉上脱离 ProjectLayout，但 URL 保持在项目路由树下：
 *   /project/:id/workbooks/:workbookId
 */
const VisualWorkbench = () => {
const { id: projectId, workbookId } = useParams()
  const [workbookName, setWorkbookName] = useState('分析工作台')
  const [loading, setLoading] = useState(false)

  // 后续接入真实 API 时在此处加载工作台元数据
  // useEffect(() => {
  //   getWorkbook(workbookId, projectId).then(wb => setWorkbookName(wb?.name ?? '分析工作台'))
  // }, [workbookId, projectId])

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <Spin size="large" tip="加载工作台..." />
      </div>
    )
  }

  return (
    <div className={styles.editor}>
      {/* 顶部工具条 */}
      <EditorTopBar workbookName={workbookName} />

      {/* 主体区域 */}
      <div className={styles.body}>
        {/* 类别侧边栏（绝对定位，覆盖画布左侧，可收起）*/}
        <CategorySidebar />

        {/* 画布区域 */}
        <Canvas />

        {/* 右侧图表工具栏（常驻，与画布并列）*/}
        <ChartPalette />
      </div>

      {/* 底部 Sheet 标签栏 */}
      <SheetBar />

      {/* 浮动配置面板（Portal 到 body）*/}
      <ConfigPanel />
    </div>
  )
}

export default VisualWorkbench
