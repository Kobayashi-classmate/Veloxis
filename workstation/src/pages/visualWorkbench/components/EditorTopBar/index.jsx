import React from 'react'
import { Typography, Button, Space, Divider, Tooltip, Badge } from 'antd'
import {
  ArrowLeftOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  SaveOutlined,
  ExportOutlined,
  ShareAltOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

const EditorTopBar = ({ workbookName }) => {
  const navigate = useNavigate()
  const { id: projectId } = useParams()

  const { categories, activeCategoryId, categorySidebarOpen, toggleCategorySidebar } =
    useWorkbenchState()

  const activeCategory = categories.find((c) => c.id === activeCategoryId)

  const handleBack = () => {
    navigate(`/project/${projectId}/workbooks`)
  }

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

      {/* 中间：类别菜单开关 */}
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
      </div>

      {/* 右侧：操作按钮 */}
      <div className={styles.rightSection}>
        <Space size={4}>
          <Tooltip title="保存（开发中）">
            <Button
              type="text"
              size="small"
              icon={<SaveOutlined />}
              className={styles.actionBtn}
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
