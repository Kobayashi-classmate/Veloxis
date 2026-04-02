import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Button, Form, Input } from 'antd'
import request from '@src/service/request'
import TurnstileCaptcha from '@stateless/TurnstileCaptcha'

const REQUEST_OPTIONS = {
  needToken: false,
  showError: false,
  addTimestamp: false,
}

const normalizeProvider = (value) => {
  const provider = String(value || '')
    .trim()
    .toLowerCase()
  return provider === 'turnstile' ? 'turnstile' : 'internal'
}

const extractCaptchaTicket = (payload) => {
  if (!payload || typeof payload !== 'object') return ''

  const direct =
    payload.captchaTicket ||
    payload.captcha_ticket ||
    payload.ticket ||
    payload.captcha?.ticket ||
    payload.result?.captchaTicket ||
    payload.result?.captcha_ticket

  if (typeof direct === 'string') return direct.trim()

  if (payload.data && typeof payload.data === 'object') {
    return extractCaptchaTicket(payload.data)
  }

  return ''
}

const AuthBehaviorCaptcha = forwardRef(
  ({ provider = 'internal', action = 'signin', turnstileSiteKey = '', onVerifiableChange, onBusyChange }, ref) => {
    const normalizedProvider = useMemo(() => normalizeProvider(provider), [provider])

    const turnstileRef = useRef(null)
    const [captchaToken, setCaptchaToken] = useState(null)

    const [internalChallengeId, setInternalChallengeId] = useState('')
    const [internalCaptchaQuestion, setInternalCaptchaQuestion] = useState('')
    const [internalCaptchaAnswer, setInternalCaptchaAnswer] = useState('')
    const [internalCaptchaLoading, setInternalCaptchaLoading] = useState(false)

    const [verifying, setVerifying] = useState(false)

    const refreshInternalCaptcha = useCallback(async () => {
      setInternalCaptchaLoading(true)
      try {
        const resp = await request.post('/captcha/challenge', { action }, REQUEST_OPTIONS)
        const payload = resp?.data && typeof resp.data === 'object' ? resp.data : resp

        if (!payload?.challengeId || !payload?.question) {
          throw new Error('验证码加载失败')
        }

        setInternalChallengeId(payload.challengeId)
        setInternalCaptchaQuestion(payload.question)
        setInternalCaptchaAnswer('')
      } catch {
        setInternalChallengeId('')
        setInternalCaptchaQuestion('验证码加载失败，请点击刷新')
      } finally {
        setInternalCaptchaLoading(false)
      }
    }, [action])

    const reset = useCallback(async () => {
      if (normalizedProvider === 'turnstile') {
        setCaptchaToken(null)
        turnstileRef.current?.reset?.()
        return
      }

      await refreshInternalCaptcha()
    }, [normalizedProvider, refreshInternalCaptcha])

    const verifyAndGetTicket = useCallback(async () => {
      setVerifying(true)
      try {
        if (normalizedProvider === 'turnstile') {
          if (!captchaToken) {
            throw new Error('请先完成人机验证')
          }

          const verifyResp = await request.post('/captcha/verify', { token: captchaToken, action }, REQUEST_OPTIONS)
          const ticket = extractCaptchaTicket(verifyResp)
          if (!ticket) {
            throw new Error('验证码校验失败，请重试')
          }
          return ticket
        }

        const answer = String(internalCaptchaAnswer || '').trim()
        if (!internalChallengeId) {
          throw new Error('验证码尚未就绪，请刷新后重试')
        }
        if (!answer) {
          throw new Error('请输入验证码结果')
        }

        const verifyResp = await request.post(
          '/captcha/verify',
          {
            challengeId: internalChallengeId,
            answer,
            action,
          },
          REQUEST_OPTIONS
        )

        const ticket = extractCaptchaTicket(verifyResp)
        if (!ticket) {
          throw new Error('验证码校验失败，请重试')
        }
        return ticket
      } finally {
        setVerifying(false)
      }
    }, [action, captchaToken, internalCaptchaAnswer, internalChallengeId, normalizedProvider])

    useImperativeHandle(
      ref,
      () => ({
        verifyAndGetTicket,
        reset,
      }),
      [reset, verifyAndGetTicket]
    )

    useEffect(() => {
      if (normalizedProvider === 'internal') {
        void refreshInternalCaptcha()
      } else {
        setInternalChallengeId('')
        setInternalCaptchaQuestion('')
        setInternalCaptchaAnswer('')
      }
    }, [normalizedProvider, refreshInternalCaptcha])

    const verifiable = useMemo(() => {
      if (normalizedProvider === 'turnstile') {
        return Boolean(captchaToken)
      }
      return Boolean(internalChallengeId && String(internalCaptchaAnswer || '').trim()) && !internalCaptchaLoading
    }, [captchaToken, internalCaptchaAnswer, internalCaptchaLoading, internalChallengeId, normalizedProvider])

    useEffect(() => {
      onVerifiableChange?.(verifiable)
    }, [onVerifiableChange, verifiable])

    useEffect(() => {
      onBusyChange?.(verifying || internalCaptchaLoading)
    }, [internalCaptchaLoading, onBusyChange, verifying])

    if (normalizedProvider === 'turnstile') {
      return (
        <Form.Item label="人机验证" required style={{ marginBottom: 16 }}>
          <TurnstileCaptcha
            ref={turnstileRef}
            siteKey={turnstileSiteKey}
            action={action}
            onTokenChange={(token) => setCaptchaToken(token || null)}
          />
        </Form.Item>
      )
    }

    return (
      <>
        <Form.Item label="系统验证码" required style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              justifyContent: 'space-between',
              background: '#fafafa',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            <code style={{ fontSize: 14, userSelect: 'none' }}>{internalCaptchaQuestion || '加载中...'}</code>
            <Button size="small" onClick={() => void refreshInternalCaptcha()} loading={internalCaptchaLoading}>
              刷新
            </Button>
          </div>
        </Form.Item>
        <Form.Item required style={{ marginBottom: 16 }}>
          <Input
            value={internalCaptchaAnswer}
            onChange={(e) => setInternalCaptchaAnswer(e.target.value)}
            placeholder="请输入上方计算结果"
            inputMode="numeric"
          />
        </Form.Item>
      </>
    )
  }
)

AuthBehaviorCaptcha.displayName = 'AuthBehaviorCaptcha'

export default AuthBehaviorCaptcha
