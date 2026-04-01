import AnimatedIcon from '@stateless/AnimatedIcon'
import BehaviorCaptcha from '@stateless/BehaviorCaptcha'
import TurnstileCaptcha from '@stateless/TurnstileCaptcha'
import Logo from '@assets/images/pro-logo.png'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { Form, Input, Button, Typography, Layout, Card, theme, App, Tag, Modal, Checkbox } from 'antd'
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

  const [internalChallenge, setInternalChallenge] = useState(null)
  const [internalProof, setInternalProof] = useState(null)
  const [internalChallengeLoading, setInternalChallengeLoading] = useState(false)

  const submittingRef = useRef(false)

  const getErrorMessage = (error) => (error instanceof Error && error.message ? error.message : '未知错误')
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
        throw new Error('验证码加载失败')
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
  }, [captchaAvailable, captchaProvider, clearCaptchaTicket])

  useEffect(() => {
    if (!captchaModalOpen) return
    if (captchaProvider === 'internal' && captchaAvailable) {
      void refreshInternalChallenge()
    }
  }, [captchaAvailable, captchaModalOpen, captchaProvider, refreshInternalChallenge])

  const verifyCaptchaAndGetTicket = useCallback(
    async (email) => {
      if (!captchaAvailable) {
        throw new Error('验证码服务不可用')
      }

      if (captchaProvider === 'turnstile') {
        if (!captchaToken) {
          throw new Error('请先完成人机验证')
        }
        const resp = await request.post(
          '/captcha/verify',
          { token: captchaToken, action: 'signin', subject: email },
          { needToken: false, showError: false, addTimestamp: false }
        )
        if (!resp?.success || !resp?.captchaTicket) {
          throw new Error('验证码校验失败，请重试')
        }
        return resp.captchaTicket
      }

      if (!internalChallenge?.challengeId || !internalChallenge?.nonce || !internalProof?.behaviorProof) {
        throw new Error('请先完成行为验证码')
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
        throw new Error('验证码校验失败，请重试')
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
    setInternalProof(null)
    void refreshInternalChallenge()
  }, [captchaProvider, refreshInternalChallenge])

  const openCaptchaModal = useCallback(() => {
    if (captchaConfigLoading) return
    if (!captchaAvailable) {
      message.error('验证码服务暂不可用，请稍后重试')
      return
    }
    setCaptchaModalOpen(true)
    setCaptchaModalSubmitting(false)
    resetCaptchaWidgets()
  }, [captchaAvailable, captchaConfigLoading, message, resetCaptchaWidgets])

  const closeCaptchaModal = useCallback(() => {
    setCaptchaModalOpen(false)
    setCaptchaModalSubmitting(false)
    resetCaptchaWidgets()
  }, [resetCaptchaWidgets])

  const handleCaptchaConfirm = useCallback(async () => {
    try {
      setCaptchaModalSubmitting(true)
      const { email } = await form.validateFields(['email'])
      const normalizedEmail = String(email || '').trim()
      const ticket = await verifyCaptchaAndGetTicket(normalizedEmail)
      setCaptchaTicket(ticket)
      setCaptchaTicketEmail(normalizedEmail)
      message.success('验证成功，已勾选“通过验证”状态')
      setCaptchaModalOpen(false)
      setCaptchaModalSubmitting(false)
      resetCaptchaWidgets()
    } catch (error) {
      if (error?.errorFields) {
        message.warning('请先填写有效邮箱后再进行安全验证')
      } else if (error instanceof Error) {
        message.error(error.message)
      }
    } finally {
      setCaptchaModalSubmitting(false)
    }
  }, [form, message, resetCaptchaWidgets, verifyCaptchaAndGetTicket])

  const handleCaptchaCheckboxChange = useCallback(
    (event) => {
      const checked = Boolean(event?.target?.checked)
      if (checked) {
        openCaptchaModal()
        return
      }
      clearCaptchaTicket()
      resetCaptchaWidgets()
    },
    [clearCaptchaTicket, openCaptchaModal, resetCaptchaWidgets]
  )

  const onFinish = async (values) => {
    const { email, password, totp } = values
    if (submittingRef.current) return
    submittingRef.current = true

    let hideLoading
    try {
      setSubmitting(true)
      hideLoading = message.loading('正在登录...', 0)

      if (!captchaTicket || captchaTicketEmail !== String(email || '').trim()) {
        message.warning('请先完成当前账号的安全验证')
        setCaptchaModalOpen(true)
        return
      }

      await authService.login({ email, password, totp, captchaTicket })

      message.success('登录成功！')
      navigate('/')
    } catch (error) {
      if (error !== null) {
        message.error(`登录失败：${getErrorMessage(error)}`)
        if (shouldPromptTotp(error)) {
          setTotpVisible(true)
        }
      }
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

  const captchaReadyForSubmit = captchaProvider === 'turnstile' ? Boolean(captchaToken) : Boolean(internalProof?.behaviorProof)
  const captchaVerified = Boolean(captchaTicket)
  const verifyMainText = captchaVerified ? '您已通过验证' : '我不是机器人'
  const verifyVendorName = captchaProvider === 'turnstile' ? 'Cloudflare' : 'Veloxis'
  const verifyVendorSub = captchaProvider === 'turnstile' ? 'Turnstile' : 'Security'
  const verifyStatusText = captchaConfigLoading
    ? '安全策略加载中'
    : !captchaAvailable
      ? '验证码服务暂不可用'
      : captchaVerified
        ? '安全验证已通过'
        : '等待完成安全验证'
  const verifyStatusDesc = captchaConfigLoading
    ? '正在同步验证码策略，请稍候'
    : !captchaAvailable
      ? '服务恢复后可重新登录'
      : captchaVerified
        ? '当前账号可直接提交登录'
        : '请先勾选并完成验证弹窗'
  const verifyStatusClass = captchaVerified
    ? styles.securityStripOk
    : !captchaAvailable
      ? styles.securityStripDanger
      : styles.securityStripPending
  const verifyHintText = captchaConfigLoading
    ? '验证码配置加载中...'
    : !captchaAvailable
      ? '验证码服务暂不可用，请稍后重试'
      : captchaVerified
        ? '验证已完成，可直接点击登录'
        : '点击复选框并在弹窗内完成验证'
  const verifyHintClass = captchaConfigLoading
    ? styles.verifyHintMuted
    : !captchaAvailable
      ? styles.verifyHintDanger
      : captchaVerified
        ? styles.verifyHintSuccess
        : styles.verifyHintMuted

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content className={styles.root} style={cssVars}>
        <div className={styles.bg} aria-hidden="true" />

        <div className={styles.grid} style={{ padding: isMobile ? 16 : 24 }}>
          {!isMobile && (
            <section className={styles.hero}>
              <div className={styles.heroInner}>
                <div className={styles.heroKicker}>VELOXIS CONTROL PLANE</div>
                <Title level={1} className={styles.heroTitle}>
                  统一权限、可观测性与 AI 协作的企业工作台
                </Title>
                <Paragraph className={styles.heroDesc}>
                  Veloxis Panel 面向复杂业务场景，提供从登录安全、角色权限到多标签页工作流的一体化控制体验。
                </Paragraph>

                <div className={styles.capabilityGrid}>
                  <article className={styles.capabilityItem}>
                    <span className={styles.capabilityIcon}>
                      <SafetyCertificateOutlined />
                    </span>
                    <div>
                      <div className={styles.capabilityTitle}>RBAC 权限闭环</div>
                      <div className={styles.capabilityDesc}>路由 / 菜单 / 按钮三级访问控制</div>
                    </div>
                  </article>
                  <article className={styles.capabilityItem}>
                    <span className={styles.capabilityIcon}>
                      <ThunderboltOutlined />
                    </span>
                    <div>
                      <div className={styles.capabilityTitle}>高效工作流</div>
                      <div className={styles.capabilityDesc}>KeepAlive Tabs 与低打断切换体验</div>
                    </div>
                  </article>
                  <article className={styles.capabilityItem}>
                    <span className={styles.capabilityIcon}>
                      <ApiOutlined />
                    </span>
                    <div>
                      <div className={styles.capabilityTitle}>可观测服务层</div>
                      <div className={styles.capabilityDesc}>请求重试、去重与错误反馈机制</div>
                    </div>
                  </article>
                </div>

                <div className={styles.heroPills}>
                  <Tag color="processing" bordered={false}>
                    AI-ready Console
                  </Tag>
                  <Tag bordered={false}>Veloxis Panel</Tag>
                  <Tag bordered={false}>Secure Auth</Tag>
                </div>
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <Card className={styles.card} variant="borderless" styles={{ body: { padding: isMobile ? 16 : 24 } }}>
              <div className={styles.brandRow}>
                <div className={styles.brandIdentity}>
                  <img src={Logo} alt="Veloxis Panel" className={styles.brandLogo} />
                  <div className={styles.brandText}>
                    <span className={styles.brandName}>Veloxis Panel</span>
                    <span className={styles.brandSub}>Enterprise Console</span>
                  </div>
                </div>
                <Tag color={captchaVerified ? 'success' : 'processing'} bordered={false}>
                  {captchaVerified ? 'Verified' : 'Protected'}
                </Tag>
              </div>

              <div className={styles.titleBox}>
                <Title level={2} className={styles.title}>
                  欢迎登录
                </Title>
                <Text type="secondary">使用企业账号访问你的 Veloxis 工作台</Text>
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
                      clearCaptchaTicket()
                    }
                  }
                }}
              >
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: '请输入邮箱!' },
                    { type: 'email', message: '请输入有效的邮箱格式!' },
                  ]}
                >
                  <Input
                    prefix={
                      <AnimatedIcon variant="spin" mode="hover">
                        <UserOutlined />
                      </AnimatedIcon>
                    }
                    placeholder="邮箱"
                  />
                </Form.Item>

                <Form.Item name="password" rules={[{ required: true, message: '请输入密码!' }]}>
                  <Input.Password
                    prefix={
                      <AnimatedIcon variant="spin" mode="hover">
                        <LockOutlined />
                      </AnimatedIcon>
                    }
                    placeholder="密码"
                  />
                </Form.Item>

                {totpVisible && (
                  <Form.Item name="totp" rules={[{ required: true, message: '请输入两步验证码!' }]}>
                    <Input
                      prefix={
                        <AnimatedIcon variant="spin" mode="hover">
                          <LockFilled />
                        </AnimatedIcon>
                      }
                      placeholder="两步验证码（6位数字）"
                      maxLength={6}
                    />
                  </Form.Item>
                )}

                <Form.Item label="安全验证" required style={{ marginBottom: 16 }}>
                  <div className={styles.verifyCheckWrap}>
                    <div className={styles.verifyCheckMainRow}>
                      <Checkbox
                        className={styles.verifyCheckControl}
                        checked={captchaVerified}
                        onChange={handleCaptchaCheckboxChange}
                        disabled={captchaConfigLoading || !captchaAvailable || submitting}
                      >
                        <span className={styles.verifyCheckLabel}>{verifyMainText}</span>
                      </Checkbox>

                      <div className={styles.verifyProvider}>
                        <span className={styles.verifyProviderLogo} aria-hidden="true" />
                        <div className={styles.verifyProviderText}>
                          <span className={styles.verifyProviderName}>{verifyVendorName}</span>
                          <span className={styles.verifyProviderSub}>{verifyVendorSub}</span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.verifyCheckHint}>
                      <span className={`${styles.verifyHintText} ${verifyHintClass}`}>{verifyHintText}</span>
                      <span className={styles.verifyTermsText}>Privacy • Terms</span>
                    </div>
                  </div>
                </Form.Item>

                <Form.Item style={{ marginBottom: 8 }}>
                  <Button
                    className={styles.submitBtn}
                    type="primary"
                    block
                    htmlType="submit"
                    disabled={
                      submitting ||
                      captchaConfigLoading ||
                      !captchaAvailable ||
                      !captchaVerified
                    }
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>

              <Modal
                title="安全验证"
                open={captchaModalOpen}
                destroyOnClose={false}
                maskClosable={!captchaModalSubmitting}
                closable={!captchaModalSubmitting}
                onCancel={closeCaptchaModal}
                onOk={() => void handleCaptchaConfirm()}
                okText="完成验证"
                cancelText="取消"
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
                {captchaConfigLoading ? (
                  <Text type="secondary">验证码配置加载中...</Text>
                ) : !captchaAvailable ? (
                  <Text type="danger">验证码服务暂不可用，请稍后重试</Text>
                ) : captchaProvider === 'turnstile' ? (
                  <TurnstileCaptcha ref={turnstileRef} siteKey={captchaTurnstileSiteKey} action="signin" onTokenChange={setCaptchaToken} />
                ) : (
                  <BehaviorCaptcha
                    key={internalChallenge?.challengeId || 'captcha-empty'}
                    challenge={internalChallenge}
                    loading={internalChallengeLoading}
                    onRefresh={() => void refreshInternalChallenge()}
                    onProofChange={setInternalProof}
                  />
                )}
              </Modal>

              <div className={styles.footerRow}>
                <Text type="secondary">还没有账号？</Text>
                <Button type="link" className={styles.registerBtn} onClick={() => redirectTo('/signup')}>
                  去注册
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
