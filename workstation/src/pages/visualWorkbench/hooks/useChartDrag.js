import { useRef, useCallback } from 'react'

/**
 * useChartDrag — 图表卡片拖移 + 右下角缩放
 *
 * @param {object} params
 * @param {string}   params.chartId
 * @param {number}   params.x        当前 x 坐标
 * @param {number}   params.y        当前 y 坐标
 * @param {number}   params.w        当前宽度
 * @param {number}   params.h        当前高度
 * @param {Function} params.onMove   (x, y) => void
 * @param {Function} params.onResize (w, h) => void
 */
export function useChartDrag({ chartId, x, y, w, h, onMove, onResize }) {
  const dragState = useRef(null)
  const resizeState = useRef(null)

  // ── 拖移（标题栏 mousedown）──────────────────────────────────────────────────
  const onDragStart = useCallback(
    (e) => {
      e.stopPropagation()
      // 只响应左键
      if (e.button !== 0) return

      const startX = e.clientX - x
      const startY = e.clientY - y

      dragState.current = { startX, startY }

      const onMouseMove = (ev) => {
        if (!dragState.current) return
        const newX = Math.max(0, ev.clientX - dragState.current.startX)
        const newY = Math.max(0, ev.clientY - dragState.current.startY)
        onMove(newX, newY)
      }

      const onMouseUp = () => {
        dragState.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [x, y, onMove]
  )

  // ── 缩放（右下角手柄 mousedown）─────────────────────────────────────────────
  const onResizeStart = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      if (e.button !== 0) return

      const startClientX = e.clientX
      const startClientY = e.clientY
      const startW = w
      const startH = h

      resizeState.current = { startClientX, startClientY, startW, startH }

      const onMouseMove = (ev) => {
        if (!resizeState.current) return
        const dw = ev.clientX - resizeState.current.startClientX
        const dh = ev.clientY - resizeState.current.startClientY
        const newW = Math.max(200, resizeState.current.startW + dw)
        const newH = Math.max(160, resizeState.current.startH + dh)
        onResize(newW, newH)
      }

      const onMouseUp = () => {
        resizeState.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [w, h, onResize]
  )

  return { onDragStart, onResizeStart }
}

/**
 * useConfigPanelDrag — 浮动配置面板标题栏拖移
 *
 * @param {object} params
 * @param {number}   params.x       面板当前 x
 * @param {number}   params.y       面板当前 y
 * @param {Function} params.onMove  (x, y) => void
 */
export function useConfigPanelDrag({ x, y, onMove }) {
  const dragState = useRef(null)

  const onDragStart = useCallback(
    (e) => {
      if (e.button !== 0) return
      e.preventDefault()

      const startX = e.clientX - x
      const startY = e.clientY - y
      dragState.current = { startX, startY }

      const panelW = 340
      const panelH = 480

      const onMouseMove = (ev) => {
        if (!dragState.current) return
        const newX = Math.max(0, Math.min(window.innerWidth - panelW, ev.clientX - dragState.current.startX))
        const newY = Math.max(0, Math.min(window.innerHeight - panelH, ev.clientY - dragState.current.startY))
        onMove(newX, newY)
      }

      const onMouseUp = () => {
        dragState.current = null
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [x, y, onMove]
  )

  return { onDragStart }
}
