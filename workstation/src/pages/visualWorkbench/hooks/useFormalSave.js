/**
 * useFormalSave — 正式保存逻辑
 *
 * 策略（snapshot_json 架构）：
 *   1. 将当前画布所有图表序列化为 ChartSnapshot[]
 *   2. 一次 PATCH wb_canvases/:id { snapshot_json } — 无论图表数量，永远 1 个请求
 *   3. 保存成功后删除对应画布的草稿（wb_canvas_drafts）
 *   4. 调用 markSaved() 清除 isDirty 标志
 *
 * 使用方式：
 *   const { save, saving } = useFormalSave()
 *   <Button loading={saving} onClick={save}>保存</Button>
 */
import { useState, useCallback } from 'react'
import { message } from 'antd'
import useWorkbenchState from './useWorkbenchState'
import { saveCanvasSnapshot, deleteDraft } from '@src/service/api/workbooks'

export function useFormalSave() {
  const [saving, setSaving] = useState(false)

  const { charts, activeCanvasId, isDirty, markSaved } = useWorkbenchState()

  const save = useCallback(async () => {
    if (!activeCanvasId) {
      message.warning('请先选择一个画布')
      return
    }
    if (!isDirty) {
      message.info('画布已是最新，无需保存')
      return
    }

    setSaving(true)
    const key = 'formal-save'
    message.loading({ content: '正在保存…', key, duration: 0 })

    try {
      // 1. 将当前画布的图表序列化为 ChartSnapshot[]
      const localCharts = charts.filter((ch) => ch.canvasId === activeCanvasId)
      const snapshots = localCharts.map((ch) => ({
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

      // 2. 一次 PATCH — 整张画布，1 个请求
      await saveCanvasSnapshot(activeCanvasId, snapshots)

      // 3. 删除对应草稿（正式保存后草稿失效）
      await deleteDraft(activeCanvasId).catch(() => {}) // 草稿不存在时静默忽略

      // 4. 标记已保存
      markSaved()

      message.success({ content: '已保存', key, duration: 2 })
    } catch (err) {
      console.error('[useFormalSave] save failed:', err)
      message.error({ content: '保存失败，请重试', key, duration: 3 })
    } finally {
      setSaving(false)
    }
  }, [activeCanvasId, charts, isDirty, markSaved])

  return { save, saving }
}
