import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'

type ThemeMode = 'light' | 'dark' | 'auto'

type TurnstileRenderOptions = {
  sitekey: string
  action?: string
  theme?: ThemeMode
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
  'timeout-callback'?: () => void
}

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | number
  reset: (id?: string | number) => void
  remove: (id?: string | number) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __turnstileLoaderPromise__?: Promise<TurnstileApi>
  }
}

const TURNSTILE_SCRIPT_ID = 'veloxis-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const loadTurnstile = async (): Promise<TurnstileApi> => {
  if (window.turnstile) return window.turnstile
  if (window.__turnstileLoaderPromise__) return window.__turnstileLoaderPromise__

  window.__turnstileLoaderPromise__ = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.turnstile) resolve(window.turnstile)
        else reject(new Error('turnstile script loaded but api unavailable'))
      })
      existing.addEventListener('error', () => reject(new Error('failed to load turnstile script')))
      return
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('turnstile script loaded but api unavailable'))
    }
    script.onerror = () => reject(new Error('failed to load turnstile script'))
    document.head.appendChild(script)
  })

  return window.__turnstileLoaderPromise__
}

export type TurnstileCaptchaRef = {
  reset: () => void
}

type TurnstileCaptchaProps = {
  siteKey: string
  action?: string
  theme?: ThemeMode
  onTokenChange?: (token: string | null) => void
}

const TurnstileCaptcha = forwardRef<TurnstileCaptchaRef, TurnstileCaptchaProps>(
  ({ siteKey, action = 'signin', theme = 'auto', onTokenChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | number | null>(null)
    const [error, setError] = useState('')

    const reset = useCallback(() => {
      if (window.turnstile && widgetIdRef.current !== null) {
        window.turnstile.reset(widgetIdRef.current)
      }
      onTokenChange?.(null)
    }, [onTokenChange])

    useImperativeHandle(ref, () => ({ reset }), [reset])

    useEffect(() => {
      let disposed = false

      if (!siteKey) {
        onTokenChange?.(null)
        return () => {}
      }

      ;(async () => {
        try {
          const turnstile = await loadTurnstile()
          if (disposed || !containerRef.current) return

          if (widgetIdRef.current !== null) {
            turnstile.remove(widgetIdRef.current)
            widgetIdRef.current = null
          }

          widgetIdRef.current = turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action,
            theme,
            callback: (token) => onTokenChange?.(token),
            'expired-callback': () => onTokenChange?.(null),
            'error-callback': () => {
              setError('验证码组件异常，请刷新后重试')
              onTokenChange?.(null)
            },
            'timeout-callback': () => onTokenChange?.(null),
          })
        } catch (e: any) {
          setError(e?.message || '验证码组件加载失败')
          onTokenChange?.(null)
        }
      })()

      return () => {
        disposed = true
        if (window.turnstile && widgetIdRef.current !== null) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }
      }
    }, [action, onTokenChange, siteKey, theme])

    return (
      <div>
        <div ref={containerRef} style={{ minHeight: 66 }} />
        {error ? (
          <div style={{ marginTop: 8, color: '#cf1322', fontSize: 12 }} role="alert">
            {error}
          </div>
        ) : null}
      </div>
    )
  }
)

TurnstileCaptcha.displayName = 'TurnstileCaptcha'

export default TurnstileCaptcha
