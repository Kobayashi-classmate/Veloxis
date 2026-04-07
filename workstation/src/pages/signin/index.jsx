import AnimatedIcon from '@stateless/AnimatedIcon'
import BehaviorCaptcha from '@stateless/BehaviorCaptcha'
import TurnstileCaptcha from '@stateless/TurnstileCaptcha'
import Logo from '@assets/images/pro-logo.png'
import VerifyCaptchaBox from './components/VerifyCaptchaBox'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { Form, Input, Button, Typography, Layout, Card, theme, App, Tag, Modal } from 'antd'
import { useStore } from '@/store'
import {
  UserOutlined,
  LockOutlined,
  LockFilled,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  CheckCircleFilled,
} from '@ant-design/icons'
import { useAuth } from '@src/service/useAuth'
import { authService } from '@src/service/authService'
import { permissionService } from '@src/service/permissionService'
import request from '@src/service/request'
import styles from './index.module.less'

const { Title, Text, Paragraph } = Typography
const { Content } = Layout
const VERIFY_ERROR_RESET_MS = 3000
const VERIFY_MODAL_AUTO_CLOSE_MS = 45000
const VERIFY_SUCCESS_EXPIRE_MS = 180000

const normalizeCaptchaProvider = (value) => {
  const provider = String(value || '')
    .trim()
    .toLowerCase()
  return provider === 'turnstile' ? 'turnstile' : 'internal'
}

const resolveCaptchaConfig = (response) => {
  const root = response?.data && typeof response.data === 'object' ? response.data : response || {}
  const provider = normalizeCaptchaProvider(root.provider)
  const turnstileSiteKey = String(root.turnstileSiteKey || '').trim()
  const available = root.available !== false

  return {
    provider,
    turnstileSiteKey: provider === 'turnstile' ? turnstileSiteKey : '',
    available,
  }
}

const SignIn = () => {
  const { redirectTo } = useSafeNavigate()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { isAuthenticated } = useAuth()
  const [form] = Form.useForm()
  const isMobile = useStore((s) => s.isMobile)

  const [submitting, setSubmitting] = useState(false)
  const [totpVisible, setTotpVisible] = useState(false)

  const [captchaProvider, setCaptchaProvider] = useState('internal')
  const [captchaTurnstileSiteKey, setCaptchaTurnstileSiteKey] = useState('')
  const [captchaAvailable, setCaptchaAvailable] = useState(true)
  const [captchaConfigLoading, setCaptchaConfigLoading] = useState(true)

  const turnstileRef = useRef(null)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [captchaTicket, setCaptchaTicket] = useState('')
  const [captchaTicketEmail, setCaptchaTicketEmail] = useState('')
  const [captchaModalOpen, setCaptchaModalOpen] = useState(false)
  const [captchaModalSubmitting, setCaptchaModalSubmitting] = useState(false)
  const [verifyUiState, setVerifyUiState] = useState('idle')

  const [internalChallenge, setInternalChallenge] = useState(null)
  const [internalProof, setInternalProof] = useState(null)
  const [internalChallengeLoading, setInternalChallengeLoading] = useState(false)
  const captchaReadyForSubmit =
    captchaProvider === 'turnstile' ? Boolean(captchaToken) : Boolean(internalProof?.behaviorProof)

  const submittingRef = useRef(false)
  const verifyResetTimerRef = useRef(null)
  const verifySuccessTimerRef = useRef(null)
  const modalAutoCloseTimerRef = useRef(null)
  const modalCountdownTimerRef = useRef(null)
  const [captchaModalRemainSec, setCaptchaModalRemainSec] = useState(Math.ceil(VERIFY_MODAL_AUTO_CLOSE_MS / 1000))

  const getErrorMessage = (error) => (error instanceof Error && error.message ? error.message : '请求未完成')
  const getErrorCode = (error) =>
    error?.code || error?.response?.data?.errors?.[0]?.extensions?.code || error?.response?.data?.code || ''

  const shouldPromptTotp = (error) => {
    const code = String(getErrorCode(error)).toUpperCase()
    if (['TFA_REQUIRED', 'MFA_REQUIRED', 'INVALID_OTP'].includes(code)) return true
    const msg = getErrorMessage(error).toLowerCase()
    return msg.includes('otp') || msg.includes('totp') || msg.includes('mfa') || msg.includes('2fa')
  }

  const clearCaptchaTicket = useCallback(() => {
    setCaptchaTicket('')
    setCaptchaTicketEmail('')
  }, [])

  const clearVerifyResetTimer = useCallback(() => {
    if (verifyResetTimerRef.current) {
      clearTimeout(verifyResetTimerRef.current)
      verifyResetTimerRef.current = null
    }
  }, [])

  const clearVerifySuccessTimer = useCallback(() => {
    if (verifySuccessTimerRef.current) {
      clearTimeout(verifySuccessTimerRef.current)
      verifySuccessTimerRef.current = null
    }
  }, [])

  const clearModalAutoCloseTimers = useCallback(() => {
    if (modalAutoCloseTimerRef.current) {
      clearTimeout(modalAutoCloseTimerRef.current)
      modalAutoCloseTimerRef.current = null
    }
    if (modalCountdownTimerRef.current) {
      clearInterval(modalCountdownTimerRef.current)
      modalCountdownTimerRef.current = null
    }
  }, [])

  const triggerVerifyErrorState = useCallback(() => {
    clearVerifyResetTimer()
    clearVerifySuccessTimer()
    setVerifyUiState('error')
    verifyResetTimerRef.current = setTimeout(() => {
      setVerifyUiState('idle')
      verifyResetTimerRef.current = null
    }, VERIFY_ERROR_RESET_MS)
  }, [clearVerifyResetTimer, clearVerifySuccessTimer])

  const refreshInternalChallenge = useCallback(async () => {
    if (captchaProvider !== 'internal') return
    setInternalChallengeLoading(true)
    setInternalProof(null)
    try {
      const resp = await request.post(
        '/captcha/challenge',
        { action: 'signin' },
        { needToken: false, showError: false, addTimestamp: false }
      )
      if (!resp?.success || !resp?.challengeId || !resp?.nonce || !resp?.puzzle) {
        throw new Error('校验资源加载失败')
      }
      setInternalChallenge(resp)
    } catch {
      setInternalChallenge(null)
    } finally {
      setInternalChallengeLoading(false)
    }
  }, [captchaProvider])

  const loadCaptchaConfig = useCallback(async () => {
    setCaptchaConfigLoading(true)
    try {
      const resp = await request.get('/captcha/config', {}, { needToken: false, showError: false, addTimestamp: false })
      const parsed = resolveCaptchaConfig(resp)
      setCaptchaProvider(parsed.provider)
      setCaptchaTurnstileSiteKey(parsed.turnstileSiteKey)
      setCaptchaAvailable(parsed.available && (parsed.provider !== 'turnstile' || !!parsed.turnstileSiteKey))
    } catch {
      setCaptchaProvider('internal')
      setCaptchaTurnstileSiteKey('')
      setCaptchaAvailable(true)
    } finally {
      setCaptchaConfigLoading(false)
    }
  }, [])

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      try {
        const currentState = authService.getState()
        if (currentState.isLoading) return
        if (!currentState.isAuthenticated || !currentState.token) {
          permissionService.logoutCleanup()
          return
        }
        navigate('/', { replace: true })
      } catch {
        try {
          permissionService.logoutCleanup()
        } catch {
          /* ignore */
        }
      }
    }
    redirectIfLoggedIn()
  }, [isAuthenticated, navigate])

  useEffect(() => {
    form.resetFields()
  }, [form])

  useEffect(() => {
    void loadCaptchaConfig()
  }, [loadCaptchaConfig])

  useEffect(() => {
    setCaptchaToken(null)
    setInternalProof(null)
    clearCaptchaTicket()
    clearVerifyResetTimer()
    clearVerifySuccessTimer()
    setVerifyUiState('idle')
  }, [captchaAvailable, captchaProvider, clearCaptchaTicket, clearVerifyResetTimer, clearVerifySuccessTimer])

  useEffect(() => () => clearVerifyResetTimer(), [clearVerifyResetTimer])
  useEffect(() => () => clearVerifySuccessTimer(), [clearVerifySuccessTimer])
  useEffect(() => () => clearModalAutoCloseTimers(), [clearModalAutoCloseTimers])

  useEffect(() => {
    if (!captchaModalOpen) return
    if (captchaProvider === 'internal' && captchaAvailable) {
      void refreshInternalChallenge()
    }
  }, [captchaAvailable, captchaModalOpen, captchaProvider, refreshInternalChallenge])

  const verifyCaptchaAndGetTicket = useCallback(
    async (email) => {
      if (!captchaAvailable) {
        throw new Error('校验服务不可用')
      }

      if (captchaProvider === 'turnstile') {
        if (!captchaToken) {
          throw new Error('请先完成登录校验')
        }
        const resp = await request.post(
          '/captcha/verify',
          { token: captchaToken, action: 'signin', subject: email },
          { needToken: false, showError: false, addTimestamp: false }
        )
        if (!resp?.success || !resp?.captchaTicket) {
          throw new Error('校验未通过，请重新尝试')
        }
        return resp.captchaTicket
      }

      if (!internalChallenge?.challengeId || !internalChallenge?.nonce || !internalProof?.behaviorProof) {
        throw new Error('请先完成当前登录校验')
      }

      const resp = await request.post(
        '/captcha/verify',
        {
          challengeId: internalChallenge.challengeId,
          nonce: internalChallenge.nonce,
          behaviorProof: internalProof.behaviorProof,
          action: 'signin',
          subject: email,
        },
        { needToken: false, showError: false, addTimestamp: false }
      )
      if (!resp?.success || !resp?.captchaTicket) {
        throw new Error('校验未通过，请重新尝试')
      }
      return resp.captchaTicket
    },
    [captchaAvailable, captchaProvider, captchaToken, internalChallenge, internalProof]
  )

  const resetCaptchaWidgets = useCallback(() => {
    if (captchaProvider === 'turnstile') {
      setCaptchaToken(null)
      turnstileRef.current?.reset?.()
      return
    }
    setInternalChallenge(null)
    setInternalProof(null)
  }, [captchaProvider])

  const scheduleVerifySuccessExpiry = useCallback(() => {
    clearVerifySuccessTimer()
    verifySuccessTimerRef.current = setTimeout(() => {
      clearCaptchaTicket()
      resetCaptchaWidgets()
      setVerifyUiState('idle')
      verifySuccessTimerRef.current = null
    }, VERIFY_SUCCESS_EXPIRE_MS)
  }, [clearCaptchaTicket, clearVerifySuccessTimer, resetCaptchaWidgets])

  const handleCaptchaTimeout = useCallback(() => {
    clearModalAutoCloseTimers()
    setCaptchaModalOpen(false)
    setCaptchaModalSubmitting(false)
    clearCaptchaTicket()
    triggerVerifyErrorState()
    resetCaptchaWidgets()
    message.warning('校验已超时，请重新完成登录校验')
  }, [clearCaptchaTicket, clearModalAutoCloseTimers, message, resetCaptchaWidgets, triggerVerifyErrorState])

  useEffect(() => {
    clearModalAutoCloseTimers()
    if (!captchaModalOpen) {
      setCaptchaModalRemainSec(Math.ceil(VERIFY_MODAL_AUTO_CLOSE_MS / 1000))
      return
    }
    const timeoutSec = Math.ceil(VERIFY_MODAL_AUTO_CLOSE_MS / 1000)
    const deadlineTs = Date.now() + VERIFY_MODAL_AUTO_CLOSE_MS
    setCaptchaModalRemainSec(timeoutSec)
    modalCountdownTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000))
      setCaptchaModalRemainSec(remaining)
    }, 1000)
    modalAutoCloseTimerRef.current = setTimeout(() => {
      handleCaptchaTimeout()
    }, VERIFY_MODAL_AUTO_CLOSE_MS)
    return () => clearModalAutoCloseTimers()
  }, [captchaModalOpen, clearModalAutoCloseTimers, handleCaptchaTimeout])

  const openCaptchaModal = useCallback(() => {
    if (captchaConfigLoading) return
    if (!captchaAvailable) {
      message.error('校验服务暂不可用，请稍后重试')
      clearCaptchaTicket()
      triggerVerifyErrorState()
      return
    }
    clearModalAutoCloseTimers()
    clearVerifyResetTimer()
    clearVerifySuccessTimer()
    setVerifyUiState('loading')
    setCaptchaModalOpen(true)
    setCaptchaModalSubmitting(false)
    resetCaptchaWidgets()
  }, [
    captchaAvailable,
    captchaConfigLoading,
    clearCaptchaTicket,
    clearModalAutoCloseTimers,
    clearVerifyResetTimer,
    clearVerifySuccessTimer,
    message,
    resetCaptchaWidgets,
    triggerVerifyErrorState,
  ])

  const closeCaptchaModal = useCallback(() => {
    clearModalAutoCloseTimers()
    clearVerifySuccessTimer()
    setCaptchaModalOpen(false)
    setCaptchaModalSubmitting(false)
    clearCaptchaTicket()
    triggerVerifyErrorState()
    resetCaptchaWidgets()
  }, [
    clearCaptchaTicket,
    clearModalAutoCloseTimers,
    clearVerifySuccessTimer,
    resetCaptchaWidgets,
    triggerVerifyErrorState,
  ])

  const handleCaptchaConfirm = useCallback(() => {
    if (!captchaReadyForSubmit) {
      message.warning('请先完成当前登录校验')
      return
    }

    clearModalAutoCloseTimers()
    clearVerifyResetTimer()
    clearCaptchaTicket()
    setCaptchaModalSubmitting(false)
    setCaptchaModalOpen(false)
    setVerifyUiState('success')
    scheduleVerifySuccessExpiry()
    message.success('登录校验已完成，请继续提交')
  }, [
    captchaReadyForSubmit,
    clearCaptchaTicket,
    clearModalAutoCloseTimers,
    clearVerifyResetTimer,
    message,
    scheduleVerifySuccessExpiry,
  ])

  const handleCaptchaToggle = useCallback(
    (nextChecked) => {
      if (nextChecked) {
        openCaptchaModal()
        return
      }
      clearVerifyResetTimer()
      clearVerifySuccessTimer()
      setVerifyUiState('idle')
      clearCaptchaTicket()
      resetCaptchaWidgets()
    },
    [clearCaptchaTicket, clearVerifyResetTimer, clearVerifySuccessTimer, openCaptchaModal, resetCaptchaWidgets]
  )

  const onFinish = async (values) => {
    const { email, password, totp } = values
    if (submittingRef.current) return
    submittingRef.current = true

    let hideLoading
    try {
      setSubmitting(true)
      hideLoading = message.loading('正在验证身份并登录...', 0)

      const normalizedEmail = String(email || '').trim()
      if (verifyUiState !== 'success' || !captchaReadyForSubmit) {
        message.warning('请先完成登录校验后再继续')
        openCaptchaModal()
        return
      }

      const ticket = await verifyCaptchaAndGetTicket(normalizedEmail)
      setCaptchaTicket(ticket)
      setCaptchaTicketEmail(normalizedEmail)

      await authService.login({ email, password, totp, captchaTicket: ticket })

      message.success('登录成功，正在进入工作台')
      navigate('/')
    } catch (error) {
      if (error !== null) {
        message.error(`登录未完成：${getErrorMessage(error)}`)
        if (shouldPromptTotp(error)) {
          setTotpVisible(true)
        }
      }
      clearVerifySuccessTimer()
      triggerVerifyErrorState()
      clearCaptchaTicket()
      resetCaptchaWidgets()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      try {
        if (typeof hideLoading === 'function') hideLoading()
      } catch {
        /* ignore */
      }
    }
  }

  const cssVars = {
    '--signin-bg': token.colorBgBase,
    '--signin-panel': token.colorBgContainer,
    '--signin-panel-2': token.colorBgLayout,
    '--signin-border': token.colorBorderSecondary,
    '--signin-text': token.colorText,
    '--signin-text-2': token.colorTextSecondary,
    '--signin-primary': token.colorPrimary,
    '--signin-primary-2': token.colorInfo,
    '--signin-success': token.colorSuccess,
    '--signin-danger': token.colorError,
    '--signin-shadow': token.boxShadowSecondary,
  }

  const verifyModalWidth = captchaProvider === 'internal' ? 420 : 520
  const captchaVerified = Boolean(captchaTicket)
  const captchaChallengeCompleted = verifyUiState === 'success' && captchaReadyForSubmit
  const verifyBoxState = captchaConfigLoading
    ? 'loading'
    : !captchaAvailable
      ? 'unavailable'
      : verifyUiState === 'loading'
        ? 'loading'
        : verifyUiState === 'error'
          ? 'error'
          : captchaVerified || verifyUiState === 'success'
            ? 'success'
            : 'idle'
  const verifyMainText =
    verifyBoxState === 'loading'
      ? '正在处理登录校验...'
      : verifyBoxState === 'success'
        ? '当前请求已验证'
        : verifyBoxState === 'error'
          ? '校验未通过'
          : verifyBoxState === 'unavailable'
            ? '校验服务不可用'
            : '验证本次登录'
  const verifyVendorName = captchaProvider === 'turnstile' ? 'Cloudflare' : 'Veloxis'
  const verifyVendorSub = captchaProvider === 'turnstile' ? 'Turnstile' : 'Access Guard'
  const verifyStatusText = captchaConfigLoading
    ? '登录校验准备中'
    : !captchaAvailable
      ? '登录校验暂不可用'
      : captchaVerified || captchaChallengeCompleted
        ? '登录校验已完成'
        : '需要完成登录校验'
  const verifyStatusDesc = captchaConfigLoading
    ? '正在同步校验策略，请稍候'
    : !captchaAvailable
      ? '请稍后重试或联系管理员检查服务状态'
      : captchaVerified || captchaChallengeCompleted
        ? '当前账号可直接提交登录请求'
        : '勾选下方校验框后继续'
  const verifyStatusClass =
    captchaVerified || captchaChallengeCompleted
      ? styles.securityStripOk
      : !captchaAvailable
        ? styles.securityStripDanger
        : styles.securityStripPending
  const verifyHintText = captchaConfigLoading
    ? '校验策略加载中，请稍候'
    : verifyBoxState === 'loading'
      ? captchaModalOpen
        ? '请在弹窗内完成校验'
        : '正在确认校验结果，请稍候...'
      : verifyBoxState === 'error'
        ? '校验未通过，请重新发起'
        : verifyBoxState === 'unavailable'
          ? '校验服务暂不可用，请稍后重试'
          : verifyBoxState === 'success'
            ? '校验已完成，点击“进入系统”即可继续'
            : '点击复选框并完成弹窗校验'
  const verifyHintTone =
    verifyBoxState === 'error' || verifyBoxState === 'unavailable'
      ? 'danger'
      : verifyBoxState === 'success'
        ? 'success'
        : 'muted'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content className={styles.root} style={cssVars}>
        <div className={styles.bg} aria-hidden="true" />

        <div className={styles.grid} style={{ padding: isMobile ? 16 : 24 }}>
          {!isMobile && (
            <section className={styles.hero}>
              <div className={styles.heroInner}>
                <div className={styles.heroKicker}>VELOXIS WORKSPACE ACCESS</div>
                <Title level={1} className={styles.heroTitle}>
                  以统一入口连接项目、数据与团队协作
                </Title>
                <Paragraph className={styles.heroDesc}>
                  Veloxis
                  为组织提供清晰的访问控制、稳定的登录校验与连续的工作台体验，让成员在同一入口下推进业务与管理任务。
                </Paragraph>

                <div className={styles.capabilityGrid}>
                  <article className={styles.capabilityItem}>
                    <span className={styles.capabilityIcon}>
                      <SafetyCertificateOutlined />
                    </span>
                    <div>
                      <div className={styles.capabilityTitle}>项目级访问控制</div>
                      <div className={styles.capabilityDesc}>成员、角色与操作范围统一收敛</div>
                    </div>
                  </article>
                  <article className={styles.capabilityItem}>
                    <span className={styles.capabilityIcon}>
                      <ThunderboltOutlined />
                    </span>
                    <div>
                      <div className={styles.capabilityTitle}>连续工作台体验</div>
                      <div className={styles.capabilityDesc}>常用任务在同一工作区内持续推进</div>
                    </div>
                  </article>
                  <article className={styles.capabilityItem}>
                    <span className={styles.capabilityIcon}>
                      <ApiOutlined />
                    </span>
                    <div>
                      <div className={styles.capabilityTitle}>可信登录校验</div>
                      <div className={styles.capabilityDesc}>登录请求、验证状态与结果反馈清晰可见</div>
                    </div>
                  </article>
                </div>

                <div className={styles.heroPills}>
                  <Tag color="processing" bordered={false}>
                    Governed Workspace
                  </Tag>
                  <Tag bordered={false}>Team Access</Tag>
                  <Tag bordered={false}>Trusted Sign-in</Tag>
                </div>
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <Card className={styles.card} variant="borderless" styles={{ body: { padding: isMobile ? 16 : 24 } }}>
              <div className={styles.brandRow}>
                <div className={styles.brandIdentity}>
                  <img src={Logo} alt="Veloxis" className={styles.brandLogo} />
                  <div className={styles.brandText}>
                    <span className={styles.brandName}>Veloxis</span>
                    <span className={styles.brandSub}>Workspace Access</span>
                  </div>
                </div>
                <Tag color={captchaVerified || captchaChallengeCompleted ? 'success' : 'processing'} bordered={false}>
                  {captchaVerified || captchaChallengeCompleted ? '已验证' : '受保护'}
                </Tag>
              </div>

              <div className={styles.titleBox}>
                <Title level={2} className={styles.title}>
                  进入工作台
                </Title>
                <Text type="secondary">使用组织账号访问项目空间、数据资产与管理能力</Text>
              </div>

              <div className={`${styles.securityStrip} ${verifyStatusClass}`}>
                <CheckCircleFilled className={styles.securityIcon} />
                <div className={styles.securityTextWrap}>
                  <span className={styles.securityMain}>{verifyStatusText}</span>
                  <span className={styles.securitySub}>{verifyStatusDesc}</span>
                </div>
              </div>

              <Form
                form={form}
                name="signin"
                onFinish={onFinish}
                autoComplete="off"
                layout="vertical"
                size="large"
                onValuesChange={(changedValues) => {
                  if (Object.prototype.hasOwnProperty.call(changedValues, 'email')) {
                    const nextEmail = String(changedValues.email || '').trim()
                    if (captchaTicket && nextEmail !== captchaTicketEmail) {
                      clearVerifySuccessTimer()
                      setVerifyUiState('idle')
                      clearCaptchaTicket()
                      resetCaptchaWidgets()
                    }
                  }
                }}
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: '请输入登录邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' },
                  ]}
                >
                  <Input
                    prefix={
                      <AnimatedIcon variant="spin" mode="hover">
                        <UserOutlined />
                      </AnimatedIcon>
                    }
                    placeholder="邮箱地址"
                  />
                </Form.Item>

                <Form.Item name="password" rules={[{ required: true, message: '请输入登录密码' }]}>
                  <Input.Password
                    prefix={
                      <AnimatedIcon variant="spin" mode="hover">
                        <LockOutlined />
                      </AnimatedIcon>
                    }
                    placeholder="登录密码"
                  />
                </Form.Item>

                {totpVisible && (
                  <Form.Item name="totp" rules={[{ required: true, message: '请输入两步验证码' }]}>
                    <Input
                      prefix={
                        <AnimatedIcon variant="spin" mode="hover">
                          <LockFilled />
                        </AnimatedIcon>
                      }
                      placeholder="两步验证码（6位）"
                      maxLength={6}
                    />
                  </Form.Item>
                )}

                <Form.Item label="登录校验" required style={{ marginBottom: 16 }}>
                  <VerifyCaptchaBox
                    state={verifyBoxState}
                    disabled={
                      captchaConfigLoading ||
                      !captchaAvailable ||
                      submitting ||
                      captchaVerified ||
                      verifyUiState === 'loading' ||
                      verifyUiState === 'error' ||
                      verifyUiState === 'success'
                    }
                    label={verifyMainText}
                    hint={verifyHintText}
                    hintTone={verifyHintTone}
                    providerName={verifyVendorName}
                    providerSub={verifyVendorSub}
                    onToggle={handleCaptchaToggle}
                  />
                </Form.Item>

                <Form.Item style={{ marginBottom: 8 }}>
                  <Button
                    className={styles.submitBtn}
                    type="primary"
                    block
                    htmlType="submit"
                    disabled={submitting || captchaConfigLoading || !captchaAvailable || !captchaChallengeCompleted}
                  >
                    进入系统
                  </Button>
                </Form.Item>
              </Form>

              <Modal
                title="完成登录校验"
                className={styles.verifyModal}
                open={captchaModalOpen}
                destroyOnClose={false}
                centered
                width={verifyModalWidth}
                maskClosable={!captchaModalSubmitting}
                closable={!captchaModalSubmitting}
                onCancel={closeCaptchaModal}
                onOk={() => void handleCaptchaConfirm()}
                okText="确认校验"
                cancelText="稍后再试"
                okButtonProps={{
                  loading: captchaModalSubmitting,
                  disabled:
                    captchaConfigLoading ||
                    !captchaAvailable ||
                    (captchaProvider === 'internal' && internalChallengeLoading) ||
                    !captchaReadyForSubmit,
                }}
                cancelButtonProps={{ disabled: captchaModalSubmitting }}
              >
                <div className={styles.verifyModalBody}>
                  <Text type="secondary" className={styles.verifyModalLead}>
                    请完成下方校验以继续登录。校验通过后，本次登录请求会获得安全凭证。
                  </Text>
                  {captchaConfigLoading ? (
                    <Text type="secondary">正在加载校验组件...</Text>
                  ) : !captchaAvailable ? (
                    <Text type="danger">校验服务暂不可用，请稍后重试</Text>
                  ) : captchaProvider === 'turnstile' ? (
                    <TurnstileCaptcha
                      ref={turnstileRef}
                      siteKey={captchaTurnstileSiteKey}
                      action="signin"
                      onTokenChange={setCaptchaToken}
                    />
                  ) : (
                    <BehaviorCaptcha
                      key={internalChallenge?.challengeId || 'captcha-empty'}
                      challenge={internalChallenge}
                      loading={internalChallengeLoading}
                      onProofChange={setInternalProof}
                    />
                  )}
                </div>
              </Modal>

              <div className={styles.footerRow}>
                <Text type="secondary">还没有组织账号？</Text>
                <Button type="link" className={styles.registerBtn} onClick={() => redirectTo('/signup')}>
                  申请开通
                </Button>
              </div>
            </Card>
          </section>
        </div>
      </Content>
    </Layout>
  )
}

export default SignIn
