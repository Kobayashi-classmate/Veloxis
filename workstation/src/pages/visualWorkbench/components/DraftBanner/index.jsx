/**
 * DraftBanner — 草稿恢复提示条
 *
 * 当 useCanvasDraft 检测到当前画布存在未恢复的草稿时，在 Canvas 顶部显示该横幅。
 * 用户可选择：
 *   - 恢复草稿（将草稿快照加载到画布，由用户决定是否正式保存）
 *   - 丢弃草稿（删除服务端草稿记录，继续使用当前正式数据）
 */
import React from 'react'
import { Button, Typography } from 'antd'
import { HistoryOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons'
import styles from './index.module.less'

const { Text } = Typography

/**
 * @param {object} props
 * @param {string|null} props.savedAt  - 草稿保存时间（ISO 字符串）
 * @param {function}    props.onRestore - 点击「恢复草稿」回调
 * @param {function}    props.onDiscard - 点击「丢弃草稿」回调
 */
const DraftBanner = ({ savedAt, onRestore, onDiscard }) => {
  const timeStr = savedAt
    ? new Date(savedAt).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '未知时间'

  return (
    <div className={styles.banner}>
      <HistoryOutlined className={styles.bannerIcon} />
      <Text className={styles.bannerText}>
        发现未恢复的草稿（保存于 {timeStr}），是否恢复？
      </Text>
      <div className={styles.bannerActions}>
        <Button
          size="small"
          type="primary"
          icon={<CheckOutlined />}
          className={styles.restoreBtn}
          onClick={onRestore}
        >
          恢复草稿
        </Button>
        <Button
          size="small"
          type="text"
          icon={<DeleteOutlined />}
          className={styles.discardBtn}
          onClick={onDiscard}
          danger
        >
          丢弃
        </Button>
      </div>
    </div>
  )
}

export default DraftBanner
