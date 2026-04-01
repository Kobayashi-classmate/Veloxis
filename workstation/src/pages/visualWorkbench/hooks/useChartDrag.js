import { useRef, useCallback } from 'react'
import useWorkbenchState from './useWorkbenchState'
import { rectsOverlap, findLegalPosition } from '../utils/collisionUtils'

/**
 * useChartDrag — 图表卡片拖移 + 右下角缩放
 *
 * 优化策略：拖动/缩放期间完全脱离 React 渲染路径
 *   - mousemove 直接操作 DOM transform/size，零 Zustand 更新，零重渲，零 HTTP 请求
 *   - mouseup 时才写一次 store（通过 onMoveEnd / onResizeEnd 回调）
 *
 * @param {object}   params
 * @param {string}   params.chartId
 * @param {number}   params.x          当前 x 坐标（画布坐标系，未缩放）
 * @param {number}   params.y          当前 y 坐标（画布坐标系，未缩放）
 * @param {number}   params.w          当前宽度
 * @param {number}   params.h          当前高度
 * @param {boolean}  params.allowOverlap 是否允许叠加到其他图表上方（默认 false）
 * @param {Function} params.onMoveEnd   (x, y) => void  — mouseup 时调一次
 * @param {Function} params.onResizeEnd (w, h) => void  — mouseup 时调一次
 *
 * @returns {{ itemRef, onDragStart, onResizeStart }}
 *   itemRef 由 hook 内部创建，调用方把它挂到根 DOM 节点即可
 */

export function useChartDrag({ chartId, x, y, w, h, allowOverlap = false, onMoveEnd, onResizeEnd }) {
  // hook 自己持有 DOM ref，避免 react-hooks/immutability 报错
  const itemRef = useRef(null)
  const dragState = useRef(null)
  const resizeState = useRef(null)

  // 从 store 读取当前缩放比例
  const canvasZoom = useWorkbenchState((s) => s.canvasZoom)

  // ── 拖移（标题栏 mousedown）──────────────────────────────────────────────────
  const onDragStart = useCallback(
    (e) => {
      e.stopPropagation()
      if (e.button !== 0) return

      const scale = canvasZoom / 100
      const startOffsetX = e.clientX - x * scale
      const startOffsetY = e.clientY - y * scale

      const el = itemRef.current
      if (el) el.style.willChange = 'transform'

      dragState.current = { startOffsetX, startOffsetY, scale, finalX: x, finalY: y }

      const onMouseMove = (ev) => {
        if (!dragState.current) return
        const { startOffsetX: sox, startOffsetY: soy, scale: sc } = dragState.current
        const newX = Math.max(0, (ev.clientX - sox) / sc)
        const newY = Math.max(0, (ev.clientY - soy) / sc)
        dragState.current.finalX = newX
        dragState.current.finalY = newY

        // 直接写 DOM，绕过 React diff
        if (el) {
          el.style.transform = `translate(${(newX - x) * sc}px, ${(newY - y) * sc}px)`
        }
      }

      const onMouseUp = () => {
        if (!dragState.current) return
        const { finalX: fx, finalY: fy } = dragState.current
        dragState.current = null

        if (el) {
          el.style.transform = ''
          el.style.willChange = ''
        }

        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)

        if (!allowOverlap) {
          // 取得其他图表的矩形
          const otherCharts = useWorkbenchState.getState().charts.filter(
            (ch) => ch.id !== chartId
          )
          const others = otherCharts.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }))

          // 寻找最近合法落点（若无碰撞直接用 fx/fy，有碰撞时搜索最近空位）
          const legalPos = findLegalPosition(
            { x: fx, y: fy, w, h },
            others,
            { x, y } // 回退到原始位置
          )
          onMoveEnd(legalPos.x, legalPos.y)
        } else {
          onMoveEnd(fx, fy)
        }
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [x, y, w, h, chartId, allowOverlap, onMoveEnd, canvasZoom]
  )

  // ── 缩放（右下角手柄 mousedown）─────────────────────────────────────────────
  // allowOverlap=true  → 缩放后直接写 store，允许叠加其他图表
  // allowOverlap=false → mouseup 时检测碰撞，若发生碰撞则还原为拖前尺寸（不写 store）
  const onResizeStart = useCallback(
    (e) => {
      e.stopPropagation()
      e.preventDefault()
      if (e.button !== 0) return

      const scale = canvasZoom / 100
      const startClientX = e.clientX
      const startClientY = e.clientY
      const el = itemRef.current

      if (el) el.style.willChange = 'width, height'

      resizeState.current = { startClientX, startClientY, scale, finalW: w, finalH: h }

      const onMouseMove = (ev) => {
        if (!resizeState.current) return
        const { startClientX: scx, startClientY: scy, scale: sc } = resizeState.current
        const newW = Math.max(200, w + (ev.clientX - scx) / sc)
        const newH = Math.max(160, h + (ev.clientY - scy) / sc)
        resizeState.current.finalW = newW
        resizeState.current.finalH = newH

        if (el) {
          el.style.width = `${newW}px`
          el.style.height = `${newH}px`
        }
      }

      const onMouseUp = () => {
        if (!resizeState.current) return
        const { finalW: fw, finalH: fh } = resizeState.current
        resizeState.current = null

        if (el) el.style.willChange = ''

        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)

        if (!allowOverlap) {
          // 碰撞检测：若新尺寸与其他图表重叠，则 DOM 还原并不写 store
          const otherCharts = useWorkbenchState.getState().charts.filter(
            (ch) => ch.id !== chartId
          )
          const collision = otherCharts.some((o) =>
            rectsOverlap({ x, y, w: fw, h: fh }, { x: o.x, y: o.y, w: o.w, h: o.h })
          )
          if (collision) {
            // 还原 DOM 到原始尺寸，不写 store
            if (el) {
              el.style.width = `${w}px`
              el.style.height = `${h}px`
            }
            return
          }
        }

        onResizeEnd(fw, fh)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [x, y, w, h, chartId, allowOverlap, onResizeEnd, canvasZoom]
  )

  return { itemRef, onDragStart, onResizeStart }
}

/**
 * useConfigPanelDrag — 浮动配置面板标题栏拖移
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
