import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { App, Button, Input, Modal, Space, Tag, Typography } from 'antd'
import styles from './index.module.less'

const { Text } = Typography

const levelColorMap = {
  low: 'blue',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
}

const levelTextMap = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
}

const CONFIRM_TEXT = 'CONFIRM'

const AdminDangerAction = ({
  actionKey,
  label,
  target,
  description,
  riskLevel = 'high',
  disabled,
  disabledReason,
  actor,
  onConfirm,
}) => {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const auditPayload = useMemo(
    () => ({
      action_key: actionKey,
      target_id: target,
      risk_level: riskLevel,
      actor,
      action_time: new Date().toISOString(),
      confirmation: 'manual_confirm_required',
      source: 'admin_console_ui',
    }),
    [actionKey, actor, riskLevel, target]
  )

  const handleOpen = () => {
    if (disabled) {
      if (disabledReason) {
        message.warning(disabledReason)
      }
      return
    }

    setOpen(true)
    setConfirmInput('')
  }

  const handleConfirm = async () => {
    if (confirmInput.trim().toUpperCase() !== CONFIRM_TEXT) {
      message.error('请输入 CONFIRM 以完成二次确认。')
      return
    }

    setSubmitting(true)

    try {
      if (onConfirm) {
        await onConfirm(auditPayload)
      }
      message.success('操作已通过二次确认，审计记录已进入提交队列。')
      setOpen(false)
    } catch (error) {
      message.error(error?.message || '操作提交失败，请稍后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button danger onClick={handleOpen} disabled={disabled}>
        {label}
      </Button>
      <Modal
        title="高危操作确认"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleConfirm}
        okText="确认执行"
        cancelText="取消"
        confirmLoading={submitting}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div className={styles.riskMeta}>
            <Text className={styles.riskMetaLabel}>操作</Text>
            <Text className={styles.riskMetaValue}>{label}</Text>
            <Text className={styles.riskMetaLabel}>目标</Text>
            <Text className={styles.riskMetaValue}>{target || '-'}</Text>
            <Text className={styles.riskMetaLabel}>风险级别</Text>
            <Tag color={levelColorMap[riskLevel] || 'orange'}>{levelTextMap[riskLevel] || 'HIGH'}</Tag>
            <Text className={styles.riskMetaLabel}>说明</Text>
            <Text className={styles.riskMetaValue}>{description}</Text>
          </div>

          <div>
            <Text strong>审计提交预览</Text>
            <div className={styles.auditPreview}>{JSON.stringify(auditPayload, null, 2)}</div>
          </div>

          <div className={styles.confirmHint}>输入 {CONFIRM_TEXT} 以完成二次确认</div>
          <Input
            className={styles.confirmInput}
            value={confirmInput}
            onChange={(event) => setConfirmInput(event.target.value)}
            placeholder="请输入 CONFIRM"
            maxLength={24}
          />
        </Space>
      </Modal>
    </>
  )
}

AdminDangerAction.propTypes = {
  actionKey: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  target: PropTypes.string,
  description: PropTypes.string,
  riskLevel: PropTypes.oneOf(['low', 'medium', 'high', 'critical']),
  disabled: PropTypes.bool,
  disabledReason: PropTypes.string,
  actor: PropTypes.string,
  onConfirm: PropTypes.func,
}

export default AdminDangerAction
