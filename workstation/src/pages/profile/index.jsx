import React from 'react'
import { Avatar, Button, Card, Col, Form, Input, Row, Space, Tag, Typography, message, theme } from 'antd'
import { ReloadOutlined, SaveOutlined, UndoOutlined, UserOutlined } from '@ant-design/icons'
import FixTabPanel from '@stateless/FixTabPanel'
import { useTranslation } from 'react-i18next'
import { authService } from '@src/service/authService'
import { getMyProfile, updateMyProfile } from '@src/service/api/profile'
import styles from './index.module.less'

const { Title, Text } = Typography

const toFormValues = (profile) => ({
  first_name: profile?.first_name ?? '',
  last_name: profile?.last_name ?? '',
  email: profile?.email ?? '',
  organization: profile?.organization ?? '',
})

const toDisplayName = ({ first_name, last_name, email, login }) => {
  const fullName = [first_name, last_name]
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .join(' ')

  return fullName || email || login || ''
}

const getErrorMessage = (error, fallback) => {
  const serverMessage = error?.response?.data?.errors?.[0]?.message
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.trim()
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  return fallback
}

const Profile = () => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const [profile, setProfile] = React.useState(null)

  const {
    token: { colorBgContainer, colorBorder, colorTextSecondary },
  } = theme.useToken()

  const firstName = Form.useWatch('first_name', form)
  const lastName = Form.useWatch('last_name', form)

  const currentDisplayName = React.useMemo(
    () =>
      toDisplayName({
        first_name: firstName,
        last_name: lastName,
        email: profile?.email,
        login: authService.getState().user?.login,
      }) || t('header.unnamedUser'),
    [firstName, lastName, profile?.email, t]
  )

  const checkDirty = React.useCallback(
    (values) => {
      if (!profile) return false
      const firstNameChanged = (values?.first_name ?? '').trim() !== (profile.first_name ?? '')
      const lastNameChanged = (values?.last_name ?? '').trim() !== (profile.last_name ?? '')
      return firstNameChanged || lastNameChanged
    },
    [profile]
  )

  const loadProfile = React.useCallback(async () => {
    setLoading(true)

    try {
      const latest = await getMyProfile()
      setProfile(latest)
      form.setFieldsValue(toFormValues(latest))
      setDirty(false)
    } catch (error) {
      messageApi.error(getErrorMessage(error, '获取个人资料失败，请稍后重试'))
    } finally {
      setLoading(false)
    }
  }, [form, messageApi])

  React.useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleValuesChange = React.useCallback(
    (_, allValues) => {
      setDirty(checkDirty(allValues))
    },
    [checkDirty]
  )

  const handleReset = React.useCallback(() => {
    form.setFieldsValue(toFormValues(profile))
    setDirty(false)
  }, [form, profile])

  const handleSave = React.useCallback(async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)

      const saved = await updateMyProfile({
        first_name: values.first_name,
        last_name: values.last_name,
      })

      setProfile(saved)
      form.setFieldsValue(toFormValues(saved))
      setDirty(false)

      const currentUser = authService.getState().user
      const fallbackLogin = currentUser?.login || ''
      authService.updateCurrentUser({
        name: toDisplayName({
          first_name: saved.first_name,
          last_name: saved.last_name,
          email: saved.email,
          login: fallbackLogin,
        }),
        email: saved.email,
        login: saved.email || fallbackLogin,
        avatar_url: saved.avatar,
        organization: saved.organization,
      })

      messageApi.success('个人资料保存成功')
    } catch (error) {
      if (error?.errorFields) {
        return
      }
      messageApi.error(getErrorMessage(error, '保存失败，请稍后重试'))
    } finally {
      setSaving(false)
    }
  }, [form, messageApi])

  return (
    <FixTabPanel fill={false}>
      {contextHolder}
      <div
        className={styles.page}
        style={{
          '--profile-surface': colorBgContainer,
          '--profile-border': colorBorder,
          '--profile-muted': colorTextSecondary,
        }}
      >
        <div className={styles.hero}>
          <div>
            <Title level={3} className={styles.heroTitle}>
              {t('menu.profile')}
            </Title>
            <Text className={styles.heroDesc}>维护你的基础资料，保存后将同步刷新右上角头像下拉显示。</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadProfile} loading={loading || saving}>
            刷新资料
          </Button>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card loading={loading} className={styles.summaryCard}>
              <div className={styles.summaryTop}>
                <Avatar size={72} icon={<UserOutlined />} src={profile?.avatar || undefined} />
                <div>
                  <Title level={4} className={styles.summaryName}>
                    {currentDisplayName}
                  </Title>
                  <Text className={styles.summaryEmail}>{profile?.email || '-'}</Text>
                </div>
              </div>
              <Space wrap>
                <Tag color="blue">ID: {profile?.id || '-'}</Tag>
                <Tag color="cyan">组织: {profile?.organization || '-'}</Tag>
              </Space>
            </Card>
          </Col>

          <Col xs={24} xl={16}>
            <Card loading={loading} className={styles.formCard}>
              <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
                autoComplete="off"
                requiredMark={false}
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="名 (First Name)"
                      name="first_name"
                      rules={[{ max: 50, message: '长度不能超过 50 个字符' }]}
                    >
                      <Input placeholder="请输入名" allowClear maxLength={50} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="姓 (Last Name)"
                      name="last_name"
                      rules={[{ max: 50, message: '长度不能超过 50 个字符' }]}
                    >
                      <Input placeholder="请输入姓" allowClear maxLength={50} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item label="邮箱 (只读)" name="email">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item label="组织 (只读)" name="organization">
                      <Input disabled />
                    </Form.Item>
                  </Col>
                </Row>

                <div className={styles.actionRow}>
                  <Space>
                    <Button icon={<UndoOutlined />} onClick={handleReset} disabled={!dirty || saving || loading}>
                      重置
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSave}
                      loading={saving}
                      disabled={!dirty}
                    >
                      保存
                    </Button>
                  </Space>
                </div>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </FixTabPanel>
  )
}

export default Profile
