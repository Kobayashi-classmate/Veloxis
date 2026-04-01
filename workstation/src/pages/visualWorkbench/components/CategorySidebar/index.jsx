import React, { useState } from 'react'
import { Typography, Button, Input, Modal, ColorPicker, Tooltip, Dropdown, message } from 'antd'
import {
  PlusOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import useWorkbenchState from '../../hooks/useWorkbenchState'
import styles from './index.module.less'

const { Text } = Typography

const CATEGORY_ICONS = ['💰', '📊', '⚠️', '🏆', '🔍', '📈', '🗃️', '🌐', '⚡', '🎯']

// ── 单个类别行 ────────────────────────────────────────────────────────────────
const CategoryRow = ({ category, isActive, onClick }) => {
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(category.name)
  const { renameCategory, removeCategory } = useWorkbenchState()

  const handleRename = () => {
    if (nameVal.trim()) {
      renameCategory(category.id, nameVal.trim())
    } else {
      setNameVal(category.name)
    }
    setEditingName(false)
  }

  const menuItems = [
    {
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: () => { setNameVal(category.name); setEditingName(true) },
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除类别',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: `确认删除"${category.name}"？`,
          content: '该类别下的所有画布和图表将同时删除，此操作不可撤销。',
          okText: '删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: () => removeCategory(category.id),
        })
      },
    },
  ]

  return (
    <div
      className={`${styles.categoryRow} ${isActive ? styles.categoryRowActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.categoryIcon}>{category.icon}</span>
      {editingName ? (
        <Input
          size="small"
          value={nameVal}
          autoFocus
          onChange={(e) => setNameVal(e.target.value)}
          onPressEnter={handleRename}
          onBlur={handleRename}
          className={styles.inlineInput}
          onClick={(e) => e.stopPropagation()}
          suffix={
            <CheckOutlined
              style={{ color: '#1677ff', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); handleRename() }}
            />
          }
        />
      ) : (
        <Text className={styles.categoryName} ellipsis>
          {category.name}
        </Text>
      )}
      <div className={styles.categoryActions} onClick={(e) => e.stopPropagation()}>
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            className={styles.moreBtn}
          />
        </Dropdown>
      </div>
    </div>
  )
}

// ── 新建类别弹窗 ──────────────────────────────────────────────────────────────
const AddCategoryModal = ({ open, onClose }) => {
  const [name, setName] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('📁')
  const [color, setColor] = useState('#1677ff')
  const { addCategory } = useWorkbenchState()

  const handleOk = () => {
    if (!name.trim()) { message.warning('请输入类别名称'); return }
    addCategory(name.trim(), color, selectedIcon)
    setName('')
    setSelectedIcon('📁')
    setColor('#1677ff')
    onClose()
  }

  return (
    <Modal
      title="新建类别"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="创建"
      cancelText="取消"
      width={360}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>类别名称</Text>
          <Input
            placeholder="如：财务工作台、绩效考核..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={handleOk}
            autoFocus
            maxLength={20}
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>图标</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORY_ICONS.map((icon) => (
              <div
                key={icon}
                onClick={() => setSelectedIcon(icon)}
                style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  cursor: 'pointer', border: `2px solid ${selectedIcon === icon ? '#1677ff' : '#e2e8f0'}`,
                  background: selectedIcon === icon ? '#eff6ff' : '#fafafa',
                }}
              >
                {icon}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>主题色</Text>
          <ColorPicker
            value={color}
            onChange={(c) => setColor(c.toHexString())}
            size="small"
            showText
          />
        </div>
      </div>
    </Modal>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
const CategorySidebar = () => {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const { categories, activeCategoryId, categorySidebarOpen, setActiveCategory, closeCategorySidebar } =
    useWorkbenchState()

  return (
    <>
      {/* 遮罩层（点击关闭）*/}
      {categorySidebarOpen && (
        <div className={styles.overlay} onClick={closeCategorySidebar} />
      )}

      {/* 侧边栏 */}
      <div className={`${styles.sidebar} ${categorySidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* 头部 */}
        <div className={styles.sidebarHeader}>
          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>
            工作台类别
          </Text>
          <Tooltip title="关闭">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={closeCategorySidebar}
              className={styles.closeBtn}
            />
          </Tooltip>
        </div>

        {/* 类别列表 */}
        <div className={styles.categoryList}>
          {categories.length === 0 ? (
            <div className={styles.emptyHint}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', textAlign: 'center', lineHeight: 1.7 }}>
                暂无类别<br />点击下方按钮新建第一个类别
              </Text>
            </div>
          ) : (
            categories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                isActive={cat.id === activeCategoryId}
                onClick={() => { setActiveCategory(cat.id); closeCategorySidebar() }}
              />
            ))
          )}

          {/* 新建按钮 */}
          <Button
            type="dashed"
            size="small"
            block
            icon={<PlusOutlined />}
            className={styles.addBtn}
            onClick={(e) => { e.stopPropagation(); setAddModalOpen(true) }}
          >
            新建类别
          </Button>
        </div>

      </div>

      {/* 新建类别弹窗 */}
      <AddCategoryModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </>
  )
}

export default CategorySidebar
