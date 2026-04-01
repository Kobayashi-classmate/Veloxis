import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Space, Typography } from 'antd'

const { Text } = Typography

const CANVAS_PADDING = 8

const toFixed = (value, digits = 2) => Number(value.toFixed(digits))

const distance = (a, b) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

const buildSummary = (points) => {
  if (!Array.isArray(points) || points.length < 2) return null
  let totalDistance = 0
  let maxJump = 0
  for (let i = 1; i < points.length; i += 1) {
    const seg = distance(points[i], points[i - 1])
    totalDistance += seg
    if (seg > maxJump) maxJump = seg
  }
  return {
    pointCount: points.length,
    durationMs: Math.max(0, points[points.length - 1].t - points[0].t),
    totalDistancePx: toFixed(totalDistance),
    maxJumpPx: toFixed(maxJump),
  }
}

const isNear = (point, target, radius) => distance(point, target) <= radius

const BehaviorCaptcha = ({ challenge, loading, onRefresh, onProofChange }) => {
  const canvasRef = useRef(null)
  const pointerIdRef = useRef(null)
  const drawingRef = useRef(false)
  const startTsRef = useRef(0)
  const [trace, setTrace] = useState([])
  const [status, setStatus] = useState('请按轨迹从起点拖动到终点')

  const puzzle = challenge?.puzzle || null
  const points = useMemo(() => {
    if (!puzzle) return []
    return [puzzle.start, ...(puzzle.checkpoints || []), puzzle.target]
  }, [puzzle])

  const getCanvasPoint = useCallback(
    (event) => {
      const canvas = canvasRef.current
      if (!canvas || !puzzle) return null
      const rect = canvas.getBoundingClientRect()
      const scaleX = puzzle.canvas.width / rect.width
      const scaleY = puzzle.canvas.height / rect.height
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
      }
    },
    [puzzle]
  )

  const resetCurrentTrace = useCallback(
    (message) => {
      setTrace([])
      onProofChange?.(null)
      setStatus(message)
    },
    [onProofChange]
  )

  const handlePointerDown = useCallback(
    (event) => {
      if (!puzzle || loading) return
      const point = getCanvasPoint(event)
      if (!point) return
      const tolerance = Math.max(16, puzzle.tolerancePx)
      if (!isNear(point, puzzle.start, tolerance)) {
        resetCurrentTrace('请从绿色起点开始拖动')
        return
      }
      event.preventDefault()
      pointerIdRef.current = event.pointerId
      drawingRef.current = true
      startTsRef.current = performance.now()
      const first = {
        x: toFixed(point.x),
        y: toFixed(point.y),
        t: 0,
      }
      setTrace([first])
      setStatus('轨迹采集中...')
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    },
    [getCanvasPoint, loading, puzzle, resetCurrentTrace]
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (!drawingRef.current || pointerIdRef.current !== event.pointerId || !puzzle) return
      const point = getCanvasPoint(event)
      if (!point) return
      const t = Math.max(0, performance.now() - startTsRef.current)
      setTrace((prev) => {
        const next = [...prev, { x: toFixed(point.x), y: toFixed(point.y), t: Math.round(t) }]
        return next.length > 500 ? next.slice(next.length - 500) : next
      })
    },
    [getCanvasPoint, puzzle]
  )

  const handlePointerUp = useCallback(
    (event) => {
      if (!drawingRef.current || pointerIdRef.current !== event.pointerId || !challenge || !puzzle) return
      drawingRef.current = false
      pointerIdRef.current = null
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }

      setTrace((currentTrace) => {
        if (currentTrace.length < 16) {
          onProofChange?.(null)
          setStatus('轨迹过短，请重试')
          return []
        }

        const last = currentTrace[currentTrace.length - 1]
        const tolerance = Math.max(16, puzzle.tolerancePx * 1.3)
        if (!isNear(last, puzzle.target, tolerance)) {
          onProofChange?.(null)
          setStatus('未到达终点，请重试')
          return []
        }

        const summary = buildSummary(currentTrace) || undefined
        const behaviorProof = {
          points: currentTrace,
          startedAt: currentTrace[0].t,
          completedAt: currentTrace[currentTrace.length - 1].t,
          summary,
        }

        onProofChange?.({
          challengeId: challenge.challengeId,
          nonce: challenge.nonce,
          behaviorProof,
        })

        setStatus('轨迹采集完成，可以提交')
        return currentTrace
      })
    },
    [challenge, onProofChange, puzzle]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !puzzle) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = puzzle.canvas.width
    const height = puzzle.canvas.height
    canvas.width = width
    canvas.height = height

    ctx.clearRect(0, 0, width, height)

    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#f5faff')
    gradient.addColorStop(1, '#eef5ff')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = '#dbe7ff'
    ctx.lineWidth = 1
    for (let x = CANVAS_PADDING; x <= width - CANVAS_PADDING; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, CANVAS_PADDING)
      ctx.lineTo(x, height - CANVAS_PADDING)
      ctx.stroke()
    }
    for (let y = CANVAS_PADDING; y <= height - CANVAS_PADDING; y += 20) {
      ctx.beginPath()
      ctx.moveTo(CANVAS_PADDING, y)
      ctx.lineTo(width - CANVAS_PADDING, y)
      ctx.stroke()
    }

    ctx.strokeStyle = '#4080ff'
    ctx.lineWidth = 3
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    points.forEach((point, idx) => {
      if (idx === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.stroke()
    ctx.setLineDash([])

    const drawDot = (point, radius, fill, stroke) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = fill
      ctx.fill()
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }

    drawDot(puzzle.start, 8, '#52c41a', '#f6ffed')
    drawDot(puzzle.target, 8, '#ff4d4f', '#fff1f0')

    ctx.strokeStyle = 'rgba(255, 77, 79, 0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(puzzle.target.x, puzzle.target.y, puzzle.tolerancePx, 0, Math.PI * 2)
    ctx.stroke()

    if (trace.length > 1) {
      ctx.strokeStyle = '#1d39c4'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      trace.forEach((point, idx) => {
        if (idx === 0) ctx.moveTo(point.x, point.y)
        else ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()
    }
  }, [points, puzzle, trace])

  if (!puzzle) {
    return (
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fafafa' }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">验证码加载中...</Text>
          <Button size="small" onClick={onRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid #d9e4ff', borderRadius: 8, padding: 10, background: '#f9fbff' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', maxWidth: puzzle.canvas.width, borderRadius: 6, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text type={trace.length > 0 ? 'secondary' : undefined} style={{ fontSize: 12 }}>
          {status}
        </Text>
        <Button size="small" onClick={onRefresh} loading={loading}>
          刷新
        </Button>
      </div>
    </div>
  )
}

export default BehaviorCaptcha
