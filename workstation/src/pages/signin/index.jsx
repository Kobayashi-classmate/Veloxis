import AnimatedIcon from '@stateless/AnimatedIcon'
import React, { useEffect, useState, useRef } from 'react'
import useSafeNavigate from '@app-hooks/useSafeNavigate'
import { Form, Input, Button, Typography, Layout, Card, theme, App, Tag, Popover, Modal } from 'antd'
import { useStore } from '@/store'
import { UserOutlined, LockOutlined, LockFilled } from '@ant-design/icons'
import { useAuth } from '@src/service/useAuth'
import { authService } from '@src/service/authService'
import { permissionService } from '@src/service/permissionService'

import SliderCaptcha from '@stateless/SliderCaptcha'
import styles from './index.module.less'

const { Title, Text, Paragraph } = Typography
const { Content } = Layout

const SignIn = () => {
  const { redirectTo } = useSafeNavigate()
  const { message } = App.useApp()
  const { token } = theme.useToken()
  const { isAuthenticated } = useAuth()
  const [form] = Form.useForm()
  const isMobile = useStore((s) => s.isMobile)
  const [captchaOpen, setCaptchaOpen] = useState(false)
  const [captchaKey, setCaptchaKey] = useState(() => Date.now())
  const [submitting, setSubmitting] = useState(false)
  const [totpVisible, setTotpVisible] = useState(false)
  const captchaVerifiedRef = useRef(false)
  const submittingRef = useRef(false) // 同步锁，比 useState 更快，防止并发重入

  const getErrorMessage = (error) => (error instanceof Error && error.message ? error.message : '未知错误')

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      if (!isAuthenticated) return
      try {
        const routes = await permissionService.getAccessibleRoutes()
        let target = '/'
        if (Array.isArray(routes) && routes.length > 0) {
          target = (routes || []).includes('/') ? '/' : routes[0]
        }
        redirectTo(target, { replace: true })
      } catch {
        redirectTo('/', { replace: true })
      }
    }
    redirectIfLoggedIn()
  }, [isAuthenticated, redirectTo])

  useEffect(() => {
    form.resetFields()
  }, [form])

  const onFinish = async (values) => {
    const { email, password, totp } = values

    if (!captchaVerifiedRef.current) {
      captchaVerifiedRef.current = false
      setCaptchaKey(Date.now())
      setCaptchaOpen(true)
      message.info('请完成滑块验证')
      return
    }

    // 同步锁：ref 立即生效，彻底防止并发重入
    if (submittingRef.current) return
    submittingRef.current = true

    let hideLoading
    try {
      setSubmitting(true)
      hideLoading = message.loading('正在登录...', 0)

      // 调用真实登录接口
      await authService.login({ email, password, totp })

      message.success('登录成功！')

      captchaVerifiedRef.current = false
      setCaptchaKey(Date.now())

      const routes = await permissionService.getAccessibleRoutes(true)
      if (routes && routes.length > 0) {
        const safeRoutes = Array.isArray(routes) ? routes : []
        const targetRoute = safeRoutes.includes('/') ? '/' : safeRoutes[0]
        redirectTo(targetRoute)
      } else {
        redirectTo('/403')
      }
    } catch (error) {
      // null 表示 authService 静默拒绝的防重入，不弹错误
      if (error !== null) {
        message.error(`登录失败：${getErrorMessage(error)}`)
        if (getErrorMessage(error).includes('TOTP') || getErrorMessage(error).includes('MFA')) {
          setTotpVisible(true)
        }
      }
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      try {
        if (typeof hideLoading === 'function') hideLoading()
      } catch {}
    }
  }

  const onFinishFailed = () => {}

  const handleLoginClick = async () => {
    try {
      await form.validateFields()
      captchaVerifiedRef.current = false
      setCaptchaKey(Date.now())
      setCaptchaOpen(true)
    } catch {
      // AntD会显示校验错误
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
    '--signin-shadow': token.boxShadowSecondary,
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content className={styles.root} style={cssVars}>
        <div className={styles.bg} aria-hidden="true" />

        <div className={styles.grid} style={{ padding: isMobile ? 16 : 24 }}>
          {!isMobile && (
            <section className={styles.hero}>
              <div className={styles.heroInner}>
                <div className={styles.badgeRow}>
                  <Tag variant="filled" color="processing">
                    AI-ready Console
                  </Tag>
                  <Tag variant="filled">Veloxis Panel</Tag>
                </div>
                <Title level={1} className={styles.heroTitle}>
                  面向 AI 时代的
                  <br />
                  企业级控制台
                </Title>
                <Paragraph className={styles.heroDesc}>大屏沉浸式视觉 · 权限体系 · 可观测的交互反馈</Paragraph>

                <div className={styles.heroPills}>
                  <span className={styles.pill}>Fast Tabs</span>
                  <span className={styles.pill}>Role-based Access</span>
                  <span className={styles.pill}>Vite/Webpack Build</span>
                </div>
              </div>
            </section>
          )}

          <section className={styles.panel}>
            <Card className={styles.card} variant="borderless" styles={{ body: { padding: isMobile ? 16 : 24 } }}>
              <div className={styles.titleBox}>
                <Title level={2} className={styles.title}>
                  登录
                </Title>
                <Text type="secondary">输入邮箱和密码登录</Text>
              </div>
              <Form
                form={form}
                name="signin"
                onFinish={onFinish}
                onFinishFailed={onFinishFailed}
                autoComplete="off"
                layout="vertical"
                size="large"
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

                <Form.Item style={{ marginBottom: 8 }}>
                  {isMobile ? (
                    <>
                      <Button type="primary" block onClick={handleLoginClick} disabled={captchaOpen || submitting}>
                        登录
                      </Button>
                      <Modal
                        centered
                        open={captchaOpen}
                        footer={null}
                        closable={false}
                        onCancel={() => setCaptchaOpen(false)}
                        afterClose={() => {
                          setCaptchaKey(Date.now())
                          captchaVerifiedRef.current = false
                        }}
                        width={'90vw'}
                        style={{ maxWidth: 420 }}
                        styles={{ body: { padding: 8 } }}
                      >
                        <SliderCaptcha
                          key={captchaKey}
                          onSuccess={() => {
                            if (submittingRef.current) return
                            captchaVerifiedRef.current = true
                            setCaptchaOpen(false)
                            form.submit()
                          }}
                          onFail={() => {
                            captchaVerifiedRef.current = false
                          }}
                          onRefresh={() => {
                            captchaVerifiedRef.current = false
                          }}
                        />
                      </Modal>
                    </>
                  ) : (
                    <Popover
                      open={captchaOpen}
                      placement="top"
                      trigger={[]}
                      arrow
                      onOpenChange={(open) => {
                        if (!open) {
                          setCaptchaOpen(false)
                          setCaptchaKey(Date.now())
                          captchaVerifiedRef.current = false
                        }
                      }}
                      content={
                        <div style={{ padding: 4 }}>
                          <SliderCaptcha
                            key={captchaKey}
                            onSuccess={() => {
                              if (submittingRef.current) return
                              captchaVerifiedRef.current = true
                              setCaptchaOpen(false)
                              form.submit()
                            }}
                            onFail={() => {
                              captchaVerifiedRef.current = false
                            }}
                            onRefresh={() => {
                              captchaVerifiedRef.current = false
                            }}
                          />
                        </div>
                      }
                    >
                      <Button type="primary" block onClick={handleLoginClick} disabled={captchaOpen || submitting}>
                        登录
                      </Button>
                    </Popover>
                  )}
                </Form.Item>
              </Form>

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
