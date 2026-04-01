/**
 * useCanvasDraft — 草稿自动保存 + 草稿恢复
 *
 * 策略：
 *   - 每隔 AUTO_SAVE_INTERVAL ms 检查 isDirty；若脏则将当前画布图表序列化并 upsert 到
 *     wb_canvas_drafts（不影响正式数据）
 *   - 页面切换到后台（visibilitychange）时立即触发一次自动保存
 *   - 画布切换时（activeCanvasId 变化）主动从服务端 getDraft，若存在草稿则通过
 *     setBannerState 通知宿主显示提示条，等待用户决策
 *   - restoreDraft(canvasId)：将草稿 snapshot_json 反序列化并注入 Zustand store
 *   - discardDraft(canvasId)：删除草稿，不改变当前 store 状态
 *
 * 返回：
 *   { bannerState, restoreDraft, discardDraft, autoSaving }
 *   bannerState: { visible: bool, canvasId: string|null, savedAt: string|null }
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { message } from 'antd'
import useWorkbenchState from './useWorkbenchState'
import { getDraft, upsertDraft, deleteDraft } from '@src/service/api/workbooks'

const AUTO_SAVE_INTERVAL = 30_000 // 30 秒

export function useCanvasDraft() {
  const [autoSaving, setAutoSaving] = useState(false)
  const [bannerState, setBannerState] = useState({
    visible: false,
    canvasId: null,
    savedAt: null,
  })

  const {
    activeCanvasId,
    charts,
    isDirty,
    setChartsForCanvas,
    markDirty,
  } = useWorkbenchState()

  // 防止并发草稿写入
  const savingRef = useRef(false)

  // ── 将当前画布图表序列化为 ChartSnapshot[] ──────────────────────────────────
  const buildSnapshots = useCallback(
    (canvasId) => {
      return charts
        .filter((ch) => ch.canvasId === canvasId)
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
          allowOverlap: ch.allowOverlap ?? true,
          order: ch.order ?? 0,
        }))
    },
    [charts]
  )

  // ── 自动保存单次执行 ─────────────────────────────────────────────────────────
  const doAutoSave = useCallback(
    async (canvasId) => {
      if (!canvasId || !isDirty || savingRef.current) return
      savingRef.current = true
      setAutoSaving(true)
      const key = 'auto-draft-save'
      try {
        const snapshots = buildSnapshots(canvasId)
        await upsertDraft(canvasId, snapshots)
        message.success({ content: '草稿已自动保存', key, duration: 2 })
      } catch {
        // 草稿保存失败静默处理，不打扰用户
      } finally {
        savingRef.current = false
        setAutoSaving(false)
      }
    },
    [isDirty, buildSnapshots]
  )

  // ── 定时器：每 AUTO_SAVE_INTERVAL 触发一次 ─────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      doAutoSave(activeCanvasId)
    }, AUTO_SAVE_INTERVAL)
    return () => clearInterval(timer)
  }, [activeCanvasId, doAutoSave])

  // ── visibilitychange：切后台时立即保存 ─────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        doAutoSave(activeCanvasId)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [activeCanvasId, doAutoSave])

  // ── 画布切换：检查是否存在草稿 ─────────────────────────────────────────────
  useEffect(() => {
    if (!activeCanvasId) {
      setBannerState({ visible: false, canvasId: null, savedAt: null })
      return
    }
    // 异步查草稿，不阻塞 UI
    getDraft(activeCanvasId).then((draft) => {
      if (draft) {
        setBannerState({ visible: true, canvasId: activeCanvasId, savedAt: draft.saved_at })
      } else {
        setBannerState({ visible: false, canvasId: null, savedAt: null })
      }
    })
  }, [activeCanvasId])

  // ── 恢复草稿：将草稿快照注入 store ─────────────────────────────────────────
  const restoreDraft = useCallback(
    async (canvasId) => {
      try {
        const draft = await getDraft(canvasId)
        if (!draft) {
          message.warning('草稿已不存在')
          setBannerState({ visible: false, canvasId: null, savedAt: null })
          return
        }
        if (!draft.snapshot_json) {
          message.warning('草稿内容为空，无法恢复')
          setBannerState({ visible: false, canvasId: null, savedAt: null })
          return
        }
        // Directus 可能将 JSON TEXT 字段自动反序列化为对象，需兼容两种情况
        const snapshots = typeof draft.snapshot_json === 'string'
          ? JSON.parse(draft.snapshot_json)
          : draft.snapshot_json
        if (!Array.isArray(snapshots)) {
          message.warning('草稿格式异常，无法恢复')
          setBannerState({ visible: false, canvasId: null, savedAt: null })
          return
        }
        // setChartsForCanvas 内部已调用 normalizeSnapshot，直接传原始 snapshot 数组
        setChartsForCanvas(canvasId, snapshots)
        markDirty()
        setBannerState({ visible: false, canvasId: null, savedAt: null })
        message.success('草稿已恢复，请检查后选择"保存"以正式提交')
      } catch (err) {
        console.error('[restoreDraft] failed:', err)
        message.error('草稿恢复失败')
      }
    },
    [setChartsForCanvas, markDirty]
  )

  // ── 丢弃草稿：从服务端删除草稿记录 ─────────────────────────────────────────
  const discardDraft = useCallback(
    async (canvasId) => {
      try {
        await deleteDraft(canvasId)
        setBannerState({ visible: false, canvasId: null, savedAt: null })
        message.info('草稿已丢弃')
      } catch {
        message.error('草稿丢弃失败')
      }
    },
    []
  )

  return { bannerState, restoreDraft, discardDraft, autoSaving }
}
