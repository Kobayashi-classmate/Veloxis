/**
 * useLeaveInterception — 离开页面时拦截未保存更改
 *
 * 两个拦截点：
 *   1. React Router v6 的 useBlocker：拦截 SPA 内部路由跳转（如点击"返回"）
 *      - "保存草稿并离开"：先 upsertDraft，再 blocker.proceed()
 *      - "直接离开"：跳过保存直接 blocker.proceed()
 *      - "留在此页"：blocker.reset()
 *   2. window.beforeunload：拦截强刷 / 关闭标签页
 *
 * 防重弹窗：isMountedRef 确保组件卸载后不再操作 state；
 *           blocker 操作全部通过 blockerRef 访问最新引用，
 *           避免 Modal.confirm 闭包持有陈旧 blocker 导致的
 *           "A router only supports one blocker at a time" 警告。
 *
 * 弹窗实现：使用受控 React state（showModal）代替 Modal.confirm() imperative API，
 *           彻底消除 afterClose 等异步回调中的陈旧引用问题。
 */
import { useEffect, useCallback, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Modal, Button, Space } from 'antd'
import useWorkbenchState from './useWorkbenchState'
import { upsertDraft } from '@src/service/api/workbooks'

export function useLeaveInterception() {
  const { isDirty, activeCanvasId, charts } = useWorkbenchState()

  // ── refs（不触发重渲染，供回调稳定读取）────────────────────────────────────
  const isDirtyRef = useRef(isDirty)
  useEffect(() => { isDirtyRef.current = isDirty }, [isDirty])

  const chartsRef = useRef(charts)
  useEffect(() => { chartsRef.current = charts }, [charts])

  const activeCanvasIdRef = useRef(activeCanvasId)
  useEffect(() => { activeCanvasIdRef.current = activeCanvasId }, [activeCanvasId])

  /** 组件是否仍挂载（防止卸载后 setState） */
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  const [saving, setSaving] = useState(false)

  // ── blocker：稳定回调，通过 isDirtyRef 读最新值 ───────────────────────────
  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }) =>
      isDirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
    [] // intentionally stable — reads ref at call time
  )

  const blocker = useBlocker(shouldBlock)

  /** 弹窗可见状态：直接派生自 blocker.state，无需额外 state 或 effect 同步 */
  const showModal = blocker.state === 'blocked'

  /**
   * blockerRef 确保弹窗按钮回调始终操作最新的 blocker 对象，
   * 而非闭包里快照的旧引用。
   */
  const blockerRef = useRef(blocker)
  useEffect(() => { blockerRef.current = blocker }, [blocker])

  // ── 弹窗动作 ─────────────────────────────────────────────────────────────

  const buildSnapshots = () =>
    chartsRef.current
      .filter((ch) => ch.canvasId === activeCanvasIdRef.current)
      .map((ch) => ({
        id: ch.id,
        canvasId: ch.canvasId,
        type: ch.type,
        title: ch.title,
        x: ch.x,
        y: ch.y,
        w: ch.w,
        h: ch.h,
        option: ch.option,
        colorTheme: ch.colorTheme ?? 'default',
        showLegend: ch.showLegend ?? true,
        showLabel: ch.showLabel ?? false,
        allowOverlap: ch.allowOverlap ?? false,
        order: ch.order ?? 0,
      }))

  const handleStay = () => {
    blockerRef.current?.reset?.()
  }

  const handleLeave = () => {
    blockerRef.current?.proceed?.()
  }

  const handleSaveAndLeave = async () => {
    setSaving(true)
    try {
      const snapshots = buildSnapshots()
      if (activeCanvasIdRef.current && snapshots.length > 0) {
        await upsertDraft(activeCanvasIdRef.current, snapshots)
      }
    } catch { /* 草稿保存失败不阻止离开 */ }
    if (isMountedRef.current) setSaving(false)
    blockerRef.current?.proceed?.()
  }

  // ── beforeunload：强刷 / 关闭标签页 ────────────────────────────────────────
  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (e) => {
      try {
        const snapshots = buildSnapshots()
        if (activeCanvasIdRef.current && snapshots.length > 0) {
          upsertDraft(activeCanvasIdRef.current, snapshots)
        }
      } catch { /* 忽略 */ }
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])
  // 注：buildSnapshots 通过 ref 读取最新数据，无需列为依赖

  // ── 受控弹窗 JSX（通过 Modal 组件而非 Modal.confirm() 渲染）────────────────
  // 返回弹窗节点供父组件挂载，或直接利用 React Portal 在此渲染
  // 由于 hook 不能返回 JSX，将弹窗状态暴露供消费方使用
  return {
    leaveModal: (
      <Modal
        open={showModal}
        title="离开前是否保存草稿？"
        maskClosable={false}
        keyboard={false}
        closable={false}
        footer={
          <Space>
            <Button onClick={handleStay} disabled={saving}>
              留在此页
            </Button>
            <Button onClick={handleLeave} disabled={saving}>
              直接离开
            </Button>
            <Button type="primary" onClick={handleSaveAndLeave} loading={saving}>
              保存草稿并离开
            </Button>
          </Space>
        }
      >
        你有未保存的更改。离开后数据将丢失，建议先保存草稿。
      </Modal>
    ),
  }
}
