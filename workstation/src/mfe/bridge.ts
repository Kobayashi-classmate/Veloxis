export type MfeToastType = 'success' | 'info' | 'warning' | 'error'

export type MfeEventMap = {
  /** 任意端发起 ping，用于验证链路 */
  'mfe:ping': { from: string; at: number }
  /** 收到 ping 的一方可回 pong */
  'mfe:pong': { from: string; to: string; at: number }
  /** 让 Host 执行路由跳转（或由接收方自行决定如何处理） */
  'mfe:navigate': { to: string; from?: string }
  /** 让接收方弹出提示 */
  'mfe:toast': { type: MfeToastType; content: string; from?: string }
  /** 简单共享状态变更（用于 remote↔remote 低耦合通信） */
  'mfe:state': { patch: Record<string, unknown>; state: Record<string, unknown>; from?: string }
}

const BUS_KEY = '__WUI_MFE_EVENT_BUS__'
const STATE_KEY = '__WUI_MFE_SHARED_STATE__'

function getWindow(): any {
  // SSR 防护（此项目主要是浏览器运行，但保持安全）
  if (typeof window === 'undefined') return undefined
  return window as any
}

function getBus(): EventTarget {
  const w = getWindow()
  if (!w) {
    // SSR 下的兜底：避免引用 window 报错
    return new EventTarget()
  }
  if (!w[BUS_KEY]) w[BUS_KEY] = new EventTarget()
  return w[BUS_KEY] as EventTarget
}

export function emitMfeEvent<K extends keyof MfeEventMap>(type: K, detail: MfeEventMap[K]) {
  const bus = getBus()
  bus.dispatchEvent(new CustomEvent(String(type), { detail }))
}

export function onMfeEvent<K extends keyof MfeEventMap>(
  type: K,
  handler: (detail: MfeEventMap[K]) => void
): () => void {
  const bus = getBus()
  const listener = (evt: Event) => {
    const ce = evt as CustomEvent
    handler(ce.detail as MfeEventMap[K])
  }
  bus.addEventListener(String(type), listener)
  return () => bus.removeEventListener(String(type), listener)
}

export function getMfeSharedState(): Record<string, unknown> {
  const w = getWindow()
  if (!w) return {}
  if (!w[STATE_KEY]) w[STATE_KEY] = {}
  return w[STATE_KEY] as Record<string, unknown>
}

export function patchMfeSharedState(patch: Record<string, unknown>, from?: string) {
  const state = getMfeSharedState()
  Object.assign(state, patch)
  emitMfeEvent('mfe:state', { patch, state: { ...state }, from })
}
