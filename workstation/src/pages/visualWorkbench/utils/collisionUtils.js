/**
 * findLegalPosition — 碰撞感知位置搜索
 *
 * 给定一个期望落点（candidate），在 others 矩形列表中寻找最近的不重叠位置。
 * 若候选位置本身无碰撞则直接返回。
 * 若全部方向搜索失败则返回 fallback 位置。
 *
 * @param {{ x, y, w, h }} candidate  — 期望落点
 * @param {Array<{ x, y, w, h }>} others  — 其他图表的矩形列表
 * @param {{ x: number, y: number }} [fallback]  — 回退位置（默认原点）
 * @returns {{ x: number, y: number }}
 */

/**
 * 检查两个矩形是否重叠（边缘相切不算重叠）
 * @param {{ x, y, w, h }} a
 * @param {{ x, y, w, h }} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function findLegalPosition(candidate, others, fallback = { x: 0, y: 0 }) {
  const hasCollision = (pos) => others.some((o) => rectsOverlap({ ...candidate, x: pos.x, y: pos.y }, o))

  if (!hasCollision(candidate)) return { x: candidate.x, y: candidate.y }

  const STEP = 8
  const MAX_RADIUS = 2000

  let bestPos = null
  let bestDist = Infinity

  for (let radius = STEP; radius <= MAX_RADIUS; radius += STEP) {
    const diag = radius * 0.7071 // ≈ radius / √2
    const candidates = [
      { x: candidate.x + radius, y: candidate.y }, // 右
      { x: candidate.x - radius, y: candidate.y }, // 左
      { x: candidate.x, y: candidate.y + radius }, // 下
      { x: candidate.x, y: candidate.y - radius }, // 上
      { x: candidate.x + diag, y: candidate.y + diag }, // 右下
      { x: candidate.x - diag, y: candidate.y + diag }, // 左下
      { x: candidate.x + diag, y: candidate.y - diag }, // 右上
      { x: candidate.x - diag, y: candidate.y - diag }, // 左上
    ].map((p) => ({ x: Math.max(0, Math.round(p.x)), y: Math.max(0, Math.round(p.y)) }))

    for (const pos of candidates) {
      if (!hasCollision(pos)) {
        const dx = pos.x - candidate.x
        const dy = pos.y - candidate.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < bestDist) {
          bestDist = dist
          bestPos = pos
        }
      }
    }

    // 找到候选后再多搜一档，确保拿到全局最近的
    if (bestPos && radius > bestDist + STEP) break
  }

  return bestPos ?? { x: fallback.x, y: fallback.y }
}
