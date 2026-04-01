import React, { useState, useRef, useEffect } from 'react'
import { Typography, Input, Button, Dropdown, Modal, Tooltip, Select, Space } from 'antd'
import {
  PlusOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FolderOutlined,
  FolderAddOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

// ── 可拖拽标签页 ─────────────────────────────────────────────────────────────

const SortableTab = ({
  canvas,
  isActive,
  onClick,
  groups,
  chartCount,
  accentColor,
  isDragOverlay = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: canvas.id,
    disabled: isDragOverlay,
    data: { type: 'canvas', groupId: canvas.groupId },
  })

  const style = isDragOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }

  const activeTabStyle = isActive
    ? { boxShadow: `0 -2px 0 ${accentColor} inset` }
    : {}

  return (
    <TabContent
      canvas={canvas}
      isActive={isActive}
      onClick={onClick}
      groups={groups}
      chartCount={chartCount}
      accentColor={accentColor}
      activeTabStyle={activeTabStyle}
      nodeRef={setNodeRef}
      style={style}
      dragAttributes={isDragOverlay ? {} : attributes}
      dragListeners={isDragOverlay ? {} : listeners}
    />
  )
}

// ── 标签页内容（拖拽把手 + 菜单分离） ─────────────────────────────────────────

const TabContent = ({
  canvas,
  isActive,
  onClick,
  groups,
  chartCount,
  accentColor,
  activeTabStyle = {},
  nodeRef,
  style = {},
  dragAttributes = {},
  dragListeners = {},
}) => {
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
          onOk: async () => {
            const val = document.getElementById('new-group-input')?.value
            if (val?.trim()) {
              const gid = await addGroup(canvas.categoryId, val.trim())
              if (gid) moveCanvasToGroup(canvas.id, gid)
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
        ref={nodeRef}
        className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
        style={{ ...activeTabStyle, ...style }}
        onClick={onClick}
        onDoubleClick={(e) => {
          e.stopPropagation()
          setNameVal(canvas.name)
          setEditing(true)
        }}
        onContextMenu={(e) => e.stopPropagation()}
        {...dragAttributes}
        {...dragListeners}
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
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <Text className={styles.tabName}>{canvas.name}</Text>
        )}

        {chartCount > 0 && !editing && (
          <span className={styles.chartCount}>{chartCount}</span>
        )}

        {!editing && (
          <CloseOutlined
            className={styles.tabClose}
            onClick={handleDelete}
            onMouseDown={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </Dropdown>
  )
}

// ── SheetBar 主体 ─────────────────────────────────────────────────────────────

const SheetBar = () => {
  const {
    canvases,
    activeCanvasId,
    activeCategoryId,
    categories,
    groups,
    charts,
    setActiveCanvas,
    addCanvas,
    addGroup,
    moveCanvasToGroup,
    reorderCanvas,
    reorderGroup,
  } = useWorkbenchState()

  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [orderModalKey, setOrderModalKey] = useState(0)
  const [activeId, setActiveId] = useState(null)
  const [activeType, setActiveType] = useState(null) // 'canvas' | 'group'

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const categoryCanvases = canvases
    .filter((cv) => cv.categoryId === activeCategoryId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const categoryGroups = groups
    .filter((g) => g.categoryId === activeCategoryId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const activeCategory = categories.find((c) => c.id === activeCategoryId)
  const accentColor = activeCategory?.color ?? '#1677ff'

  const getChartCount = (canvasId) => charts.filter((ch) => ch.canvasId === canvasId).length

  const draggingCanvas = activeId && activeType === 'canvas'
    ? categoryCanvases.find((cv) => cv.id === activeId)
    : null
  const draggingGroup = activeId && activeType === 'group'
    ? categoryGroups.find((g) => g.id === activeId)
    : null

  const groupIdSet = new Set(categoryGroups.map((g) => g.id))
  const topLevelItems = [
    ...categoryCanvases.filter((cv) => !cv.groupId),
    ...categoryGroups,
  ].sort((a, b) => {
    const orderA = a.order ?? 0
    const orderB = b.order ?? 0
    if (orderA !== orderB) return orderA - orderB
    return a.id.localeCompare(b.id)
  })
  const ungroupedIds = topLevelItems
    .filter((item) => !groupIdSet.has(item.id))
    .map((item) => item.id)
  const groupIds = topLevelItems
    .filter((item) => groupIdSet.has(item.id))
    .map((item) => item.id)
  const allSortableIds = topLevelItems.map((item) => item.id)

  /**
   * 自定义碰撞检测：
   * - 拖画布：全范围 closestCenter（可命中分组头部触发"移入分组"）
   * - 拖分组：仅在分组 id 范围内寻找 over 目标，避免因画布节点更近而误命中画布
   */
  const activeTypeRef = useRef(activeType)
  useEffect(() => { activeTypeRef.current = activeType }, [activeType])

  // groupIds 需在 useCallback 内访问，用 ref 保持稳定
  const groupIdsRef = useRef(groupIds)
  useEffect(() => { groupIdsRef.current = groupIds }, [groupIds])

  const isPointerWithin = (pointer, rect) =>
    pointer?.x >= rect.left && pointer?.x <= rect.right &&
    pointer?.y >= rect.top && pointer?.y <= rect.bottom

  const collisionDetection = (args) => {
    if (activeTypeRef.current === 'group') {
      return closestCenter(args)
    }

    const canvasContainers = args.droppableContainers.filter(
      (c) => !groupIdsRef.current.includes(c.id)
    )
    const groupContainers = args.droppableContainers.filter((c) =>
      groupIdsRef.current.includes(c.id)
    )

    const pointerGroupTargets = groupContainers.filter((container) =>
      isPointerWithin(args.pointerCoordinates, container.rect)
    )
    if (pointerGroupTargets.length > 0) {
      return closestCenter({
        ...args,
        droppableContainers: pointerGroupTargets,
      })
    }

    return closestCenter({
      ...args,
      droppableContainers: canvasContainers,
    })
  }

  // ── 拖拽结束处理 ────────────────────────────────────────────────────────────
  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null)
    setActiveType(null)
    if (!over || active.id === over.id) return

    const activeData = active.data.current
    const overData = over.data.current
    if (!activeData) return

    if (activeData.type === 'canvas') {
      const activeCanvas = categoryCanvases.find((cv) => cv.id === active.id)
      if (!activeCanvas) return

      // 画布拖到分组头部 → 移入分组
      if (overData?.type === 'group') {
        await moveCanvasToGroup(active.id, over.id)
        return
      }

      // 画布拖到另一画布 → 重排序（含跨分组）
      const overCanvas = categoryCanvases.find((cv) => cv.id === over.id)
      if (!overCanvas) return

      if (activeCanvas.groupId !== overCanvas.groupId) {
        await moveCanvasToGroup(active.id, overCanvas.groupId)
      }

      const scopeCanvases = categoryCanvases.filter(
        (cv) => cv.groupId === (overCanvas.groupId ?? null)
      )
      const scopeIds = scopeCanvases.map((cv) => cv.id)
      const oldIndex = scopeIds.indexOf(active.id)
      const newIndex = scopeIds.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const otherIds = categoryCanvases
        .filter((cv) => !scopeIds.includes(cv.id))
        .map((cv) => cv.id)
      await reorderCanvas(activeCategoryId, [...otherIds, ...arrayMove(scopeIds, oldIndex, newIndex)])
    }

    if (activeData.type === 'group') {
      const combinedIds = allSortableIds
      const oldIndex = combinedIds.indexOf(active.id)
      const newIndex = combinedIds.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const nextIds = arrayMove(combinedIds, oldIndex, newIndex)
      await reorderGroup(activeCategoryId, nextIds.filter((id) => groupIds.includes(id)))
      await reorderCanvas(activeCategoryId, nextIds.filter((id) => ungroupedIds.includes(id)))
    }
  }

  const handleOrderSave = async ({ groupOrder: nextGroupOrder, canvasLayout }) => {
    const currentGroupMap = categoryCanvases.reduce((acc, cv) => {
      acc[cv.id] = cv.groupId ?? 'none'
      return acc
    }, {})

    const membershipChanges = []
    Object.entries(canvasLayout).forEach(([groupId, ids]) => {
      ids.forEach((canvasId) => {
        const targetGroup = groupId === 'none' ? null : groupId
        if (currentGroupMap[canvasId] !== targetGroup) {
          membershipChanges.push({ canvasId, groupId: targetGroup })
        }
      })
    })

    const orderedCanvasIds = [
      ...(canvasLayout.none ?? []),
      ...nextGroupOrder.flatMap((gid) => canvasLayout[gid] ?? []),
    ]

    await Promise.all(
      membershipChanges.map(({ canvasId, groupId }) => moveCanvasToGroup(canvasId, groupId))
    )
    await reorderGroup(activeCategoryId, nextGroupOrder)
    await reorderCanvas(activeCategoryId, orderedCanvasIds)
  }

  const addMenuItems = [
    {
      key: 'canvas',
      label: '新建画布',
      icon: <PlusOutlined />,
      onClick: () => addCanvas(activeCategoryId),
    },
    {
      key: 'group',
      label: '新建分组',
      icon: <FolderAddOutlined />,
      onClick: () => {
        Modal.confirm({
          title: '新建画布分组',
          content: (
            <Input
              id="new-sheetbar-group-input"
              placeholder="输入分组名称"
              autoFocus
              maxLength={20}
            />
          ),
          onOk: async () => {
            const val = document.getElementById('new-sheetbar-group-input')?.value
            if (val?.trim()) await addGroup(activeCategoryId, val.trim())
          },
          okText: '创建',
          cancelText: '取消',
        })
      },
    },
  ]

  const blankAreaMenuItems = [
    {
      key: 'new-canvas',
      label: '新建画布',
      icon: <PlusOutlined />,
      onClick: () => addCanvas(activeCategoryId),
    },
    {
      key: 'new-group',
      label: '新建分组',
      icon: <FolderAddOutlined />,
      onClick: () => {
        Modal.confirm({
          title: '新建画布分组',
          content: (
            <Input
              id="new-sheetbar-blank-group-input"
              placeholder="输入分组名称"
              autoFocus
              maxLength={20}
            />
          ),
          onOk: async () => {
            const val = document.getElementById('new-sheetbar-blank-group-input')?.value
            if (val?.trim()) await addGroup(activeCategoryId, val.trim())
          },
          okText: '创建',
          cancelText: '取消',
        })
      },
    },
    {
      key: 'manage-order',
      label: '管理分组与画布顺序',
      onClick: () => {
        setOrderModalKey((prev) => prev + 1)
        setOrderModalOpen(true)
      },
    },
  ]

  const activeCanvas = categoryCanvases.find((cv) => cv.id === activeCanvasId)

  const renderTabs = () => {
    const result = []

    topLevelItems.forEach((item) => {
      if (groupIdSet.has(item.id)) {
        const group = categoryGroups.find((g) => g.id === item.id)
        if (group) {
          result.push(
            <SortableGroupSection
              key={group.id}
              group={group}
              inGroup={categoryCanvases.filter((cv) => cv.groupId === group.id)}
              activeCanvas={activeCanvas}
              activeCanvasId={activeCanvasId}
              setActiveCanvas={setActiveCanvas}
              accentColor={accentColor}
            />
          )
        }
      } else {
        const canvas = categoryCanvases.find((cv) => cv.id === item.id)
        if (canvas) {
          result.push(
            <SortableTab
              key={canvas.id}
              canvas={canvas}
              isActive={canvas.id === activeCanvasId}
              onClick={() => setActiveCanvas(canvas.id)}
              groups={categoryGroups}
              chartCount={getChartCount(canvas.id)}
              accentColor={accentColor}
            />
          )
        }
      }
    })

    return result
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={({ active }) => {
          setActiveId(active.id)
          setActiveType(active.data.current?.type ?? null)
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setActiveType(null)
        }}
      >
        <SortableContext
          items={allSortableIds}
          strategy={horizontalListSortingStrategy}
        >
          <div className={styles.sheetBar}>
          {activeCategory && (
            <div className={styles.sheetBarLeft} style={{ borderLeftColor: accentColor }}>
              <span className={styles.categoryIcon}>{activeCategory.icon}</span>
              <Text className={styles.categoryLabel} ellipsis style={{ color: accentColor }}>
                {activeCategory.name}
              </Text>
            </div>
          )}

          <Dropdown
            menu={{ items: blankAreaMenuItems }}
            trigger={['contextMenu']}
            overlayClassName={styles.blankAreaMenu}
          >
            <div className={styles.tabList}>
              {renderTabs()}
              <div className={styles.addTabWrapper}>
                <Dropdown
                  menu={{ items: addMenuItems }}
                  trigger={['click']}
                  placement="topRight"
                  onOpenChange={(open) => setAddMenuOpen(open)}
                >
                  <Tooltip title="新建画布 / 分组" placement="left" open={addMenuOpen ? false : undefined}>
                    <Button
                      type="text"
                      size="small"
                      icon={<PlusOutlined />}
                      className={styles.addTabBtn}
                    />
                  </Tooltip>
                </Dropdown>
              </div>
            </div>
          </Dropdown>
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {draggingCanvas ? (
          <SortableTab
            canvas={draggingCanvas}
            isActive={draggingCanvas.id === activeCanvasId}
            onClick={() => {}}
            groups={categoryGroups}
            chartCount={charts.filter((ch) => ch.canvasId === draggingCanvas.id).length}
            accentColor={accentColor}
            isDragOverlay
          />
        ) : draggingGroup ? (
          <GroupOverlay
            group={draggingGroup}
            inGroup={categoryCanvases.filter((cv) => cv.groupId === draggingGroup.id)}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
      <OrderManagerModal
        key={orderModalKey}
        open={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        groups={categoryGroups}
        canvases={categoryCanvases}
        onSave={handleOrderSave}
      />
    </>
  )
}

const OrderManagerModal = ({ open, onClose, groups, canvases, onSave }) => {
  const [groupOrder, setGroupOrder] = useState(() => groups.map((group) => group.id))
  const [canvasLayout, setCanvasLayout] = useState(() => {
    const layout = {
      none: canvases.filter((cv) => !cv.groupId).map((cv) => cv.id),
    }
    groups.forEach((group) => {
      layout[group.id] = canvases
        .filter((cv) => cv.groupId === group.id)
        .map((cv) => cv.id)
    })
    return layout
  })
  const [saving, setSaving] = useState(false)

  const moveItem = (array, fromIndex, toIndex) => {
    const copy = [...array]
    const [item] = copy.splice(fromIndex, 1)
    copy.splice(toIndex, 0, item)
    return copy
  }

  const moveGroup = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= groupOrder.length) return
    setGroupOrder((prev) => moveItem(prev, index, nextIndex))
  }

  const moveCanvas = (groupId, index, direction) => {
    const list = canvasLayout[groupId] ?? []
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= list.length) return
    setCanvasLayout((prev) => ({
      ...prev,
      [groupId]: moveItem(list, index, nextIndex),
    }))
  }

  const changeCanvasGroup = (canvasId, targetGroupId) => {
    setCanvasLayout((prev) => {
      const sourceGroupId = Object.keys(prev).find((key) => prev[key].includes(canvasId)) || 'none'
      if (sourceGroupId === targetGroupId) return prev
      const nextLayout = {
        ...prev,
        [sourceGroupId]: (prev[sourceGroupId] || []).filter((id) => id !== canvasId),
        [targetGroupId]: [...(prev[targetGroupId] || []), canvasId],
      }
      return nextLayout
    })
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave({ groupOrder, canvasLayout })
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      title="管理分组与画布顺序"
      width={760}
      style={{ top: 20 }}
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      bodyStyle={{ padding: '16px 24px', maxHeight: '560px', overflow: 'hidden' }}
    >
      <div className={styles.orderModalContent}>
        <div className={styles.orderSection}>
          <div className={styles.orderSectionTitle}>未分组画布</div>
          {(canvasLayout.none || []).map((canvasId, index) => {
            const canvas = canvases.find((cv) => cv.id === canvasId)
            if (!canvas) return null
            return (
              <div key={canvas.id} className={styles.orderRow}>
                <Text className={styles.orderRowName}>{canvas.name}</Text>
                <Space size="middle">
                  <Button
                    type="text"
                    icon={<UpOutlined />}
                    onClick={() => moveCanvas('none', index, -1)}
                    disabled={index === 0}
                  />
                  <Button
                    type="text"
                    icon={<DownOutlined />}
                    onClick={() => moveCanvas('none', index, 1)}
                    disabled={index === (canvasLayout.none?.length ?? 0) - 1}
                  />
                  <Select
                    value="none"
                    style={{ width: 140 }}
                    onChange={(value) => changeCanvasGroup(canvas.id, value)}
                    options={[
                      { label: '无分组', value: 'none' },
                      ...groups.map((group) => ({ label: group.name, value: group.id })),
                    ]}
                  />
                </Space>
              </div>
            )
          })}
        </div>

        <div className={styles.orderSection}>
          <div className={styles.orderSectionTitle}>分组顺序</div>
          {groupOrder.map((groupId, index) => {
            const group = groups.find((g) => g.id === groupId)
            if (!group) return null
            return (
              <div key={group.id} className={styles.orderGroupCard}>
                <div className={styles.orderGroupHeader}>
                  <Text className={styles.orderGroupTitle}>{group.name}</Text>
                  <Space size="small">
                    <Button
                      type="text"
                      icon={<UpOutlined />}
                      onClick={() => moveGroup(index, -1)}
                      disabled={index === 0}
                    />
                    <Button
                      type="text"
                      icon={<DownOutlined />}
                      onClick={() => moveGroup(index, 1)}
                      disabled={index === groupOrder.length - 1}
                    />
                  </Space>
                </div>
                <div className={styles.orderGroupBody}>
                  {(canvasLayout[group.id] || []).map((canvasId, canvasIndex) => {
                    const canvas = canvases.find((cv) => cv.id === canvasId)
                    if (!canvas) return null
                    return (
                      <div key={canvas.id} className={styles.orderRow}>
                        <Text className={styles.orderRowName}>{canvas.name}</Text>
                        <Space size="middle">
                          <Button
                            type="text"
                            icon={<UpOutlined />}
                            onClick={() => moveCanvas(group.id, canvasIndex, -1)}
                            disabled={canvasIndex === 0}
                          />
                          <Button
                            type="text"
                            icon={<DownOutlined />}
                            onClick={() => moveCanvas(group.id, canvasIndex, 1)}
                            disabled={canvasIndex === (canvasLayout[group.id]?.length ?? 0) - 1}
                          />
                          <Select
                            value={group.id}
                            style={{ width: 140 }}
                            onChange={(value) => changeCanvasGroup(canvas.id, value)}
                            options={[
                              { label: '无分组', value: 'none' },
                              ...groups.map((grp) => ({ label: grp.name, value: grp.id })),
                            ]}
                          />
                        </Space>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ── 分组节 sortable wrapper ───────────────────────────────────────────────────

const SortableGroupSection = ({
  group,
  inGroup,
  activeCanvas,
  activeCanvasId,
  setActiveCanvas,
  accentColor,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: group.id,
    data: { type: 'group' },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  const groupMenuItems = inGroup.map((cv) => ({
    key: cv.id,
    label: cv.name,
    onClick: () => setActiveCanvas(cv.id),
  }))

  const activeInGroup = activeCanvas?.groupId === group.id ? activeCanvas.name : null

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        outline: isOver ? `2px dashed ${accentColor}` : 'none',
      }}
      className={styles.groupSection}
    >
      <Dropdown
        menu={{
          items: groupMenuItems,
          selectedKeys: activeCanvasId && inGroup.some((cv) => cv.id === activeCanvasId)
            ? [activeCanvasId]
            : [],
        }}
        trigger={['click', 'contextMenu']}
        placement="bottomLeft"
      >
        <div
          className={styles.groupHeader}
          onContextMenu={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <FolderOutlined />
          <span>{group.name}</span>
          {activeInGroup && (
            <span className={styles.groupActiveCanvas}>{activeInGroup}</span>
          )}
          <span className={styles.groupCount}>{inGroup.length}</span>
        </div>
      </Dropdown>
    </div>
  )
}

// ── 分组拖拽幽灵 ──────────────────────────────────────────────────────────────

const GroupOverlay = ({ group, inGroup }) => (
  <div className={styles.groupSection} style={{ opacity: 0.8 }}>
    <div className={styles.groupHeader}>
      <FolderOutlined />
      <span>{group.name}</span>
      <span className={styles.groupCount}>{inGroup.length}</span>
    </div>
  </div>
)

export default SheetBar
