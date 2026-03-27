import React, { useState, useRef, useEffect } from 'react'
import { Typography, Input, Button, Dropdown, Modal, Tooltip } from 'antd'
import {
  PlusOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FolderOutlined,
  MoreOutlined,
} from '@ant-design/icons'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

// ── 单个 Sheet 标签 ───────────────────────────────────────────────────────────
const SheetTab = ({ canvas, isActive, onClick, groups }) => {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(canvas.name)
  const inputRef = useRef(null)

  const { renameCanvas, removeCanvas, duplicateCanvas, addGroup, moveCanvasToGroup } =
    useWorkbenchState()

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const handleRenameConfirm = () => {
    if (nameVal.trim()) renameCanvas(canvas.id, nameVal.trim())
    else setNameVal(canvas.name)
    setEditing(false)
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    Modal.confirm({
      title: `删除"${canvas.name}"？`,
      content: '画布上的所有图表将一同删除，无法恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => removeCanvas(canvas.id),
    })
  }

  // 分组子菜单
  const groupSubItems = [
    { key: 'none', label: '无分组', onClick: () => moveCanvasToGroup(canvas.id, null) },
    ...groups.map((g) => ({
      key: g.id,
      label: g.name,
      onClick: () => moveCanvasToGroup(canvas.id, g.id),
    })),
    { type: 'divider' },
    {
      key: 'new-group',
      label: '新建分组...',
      onClick: () => {
        Modal.confirm({
          title: '新建画布分组',
          content: (
            <Input
              id="new-group-input"
              placeholder="输入分组名称"
              autoFocus
              maxLength={20}
            />
          ),
          onOk: () => {
            const val = document.getElementById('new-group-input')?.value
            if (val?.trim()) {
              const gid = addGroup(canvas.categoryId, val.trim())
              moveCanvasToGroup(canvas.id, gid)
            }
          },
          okText: '创建',
          cancelText: '取消',
        })
      },
    },
  ]

  const menuItems = [
    { key: 'rename', label: '重命名', icon: <EditOutlined />, onClick: () => setEditing(true) },
    { key: 'duplicate', label: '复制画布', icon: <CopyOutlined />, onClick: () => duplicateCanvas(canvas.id) },
    { key: 'group', label: '移动到分组', icon: <FolderOutlined />, children: groupSubItems },
    { type: 'divider' },
    { key: 'delete', label: '删除画布', icon: <DeleteOutlined />, danger: true, onClick: handleDelete },
  ]

  const groupName = groups.find((g) => g.id === canvas.groupId)?.name

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div
        className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
        onClick={onClick}
        onDoubleClick={(e) => { e.stopPropagation(); setNameVal(canvas.name); setEditing(true) }}
      >
        {groupName && (
          <Text className={styles.tabGroupTag}>{groupName}</Text>
        )}

        {editing ? (
          <Input
            ref={inputRef}
            size="small"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onPressEnter={handleRenameConfirm}
            onBlur={handleRenameConfirm}
            className={styles.tabInput}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <Text className={styles.tabName}>{canvas.name}</Text>
        )}

        {/* 关闭按钮 */}
        {!editing && (
          <CloseOutlined className={styles.tabClose} onClick={handleDelete} />
        )}
      </div>
    </Dropdown>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
const SheetBar = () => {
  const {
    canvases,
    activeCanvasId,
    activeCategoryId,
    groups,
    setActiveCanvas,
    addCanvas,
  } = useWorkbenchState()

  // 当前类别下的画布，按分组聚合显示
  const categoryCanvases = canvases.filter((cv) => cv.categoryId === activeCategoryId)
  const categoryGroups = groups.filter((g) => g.categoryId === activeCategoryId)

  // 分组渲染：无分组的直接显示，有分组的在分组标题后聚合
  const renderTabs = () => {
    const ungrouped = categoryCanvases.filter((cv) => !cv.groupId)
    const result = []

    // 无分组画布
    ungrouped.forEach((cv) => {
      result.push(
        <SheetTab
          key={cv.id}
          canvas={cv}
          isActive={cv.id === activeCanvasId}
          onClick={() => setActiveCanvas(cv.id)}
          groups={categoryGroups}
        />
      )
    })

    // 分组画布
    categoryGroups.forEach((group) => {
      const inGroup = categoryCanvases.filter((cv) => cv.groupId === group.id)
      if (inGroup.length === 0) return
      result.push(
        <div key={`group-${group.id}`} className={styles.groupSection}>
          <Text className={styles.groupLabel}>
            <FolderOutlined style={{ marginRight: 4 }} />
            {group.name}
          </Text>
          {inGroup.map((cv) => (
            <SheetTab
              key={cv.id}
              canvas={cv}
              isActive={cv.id === activeCanvasId}
              onClick={() => setActiveCanvas(cv.id)}
              groups={categoryGroups}
            />
          ))}
        </div>
      )
    })

    return result
  }

  return (
    <div className={styles.sheetBar}>
      <div className={styles.tabList}>{renderTabs()}</div>

      {/* 新建画布按钮 */}
      <Tooltip title="新建画布">
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          className={styles.addTabBtn}
          onClick={() => addCanvas(activeCategoryId)}
        />
      </Tooltip>
    </div>
  )
}

export default SheetBar
