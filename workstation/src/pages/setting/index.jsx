import React from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  ColorPicker,
  Divider,
  Radio,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
  theme,
} from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FixTabPanel from '@stateless/FixTabPanel'
import { useAuth } from '@src/service/useAuth'
import { useProThemeContext } from '@src/theme/hooks'
import { resolveUserDisplayName } from '@src/utils/userDisplayName'
import styles from './index.module.less'

const { Title, Text } = Typography

const PRESET_COLORS = ['#1677ff', '#F5222D', '#FA541C', '#FAAD14', '#13C2C2', '#52C41A', '#2F54EB', '#722ED1']

const Setting = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { themeSettings, updateSettings } = useProThemeContext()

  const {
    token: { colorBgContainer, colorBorder, colorTextSecondary },
  } = theme.useToken()

  const displayName = resolveUserDisplayName(user, t('header.unnamedUser'))
  const showSecondaryEmail = Boolean(user?.email) && user.email !== displayName

  const prefersDark =
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const effectiveThemeMode = themeSettings.themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeSettings.themeMode

  const changeSetting = (key, value) => {
    updateSettings({ [key]: value })
  }

  return (
    <FixTabPanel fill={false}>
      <div
        className={styles.page}
        style={{
          '--setting-surface': colorBgContainer,
          '--setting-border': colorBorder,
          '--setting-muted': colorTextSecondary,
        }}
      >
        <div className={styles.hero}>
          <div>
            <Title level={3} className={styles.heroTitle}>
              {t('header.userSettings')}
            </Title>
            <Text className={styles.heroDesc}>账号信息与界面偏好可在此即时调整并自动持久化。</Text>
          </div>
          <Tag color={effectiveThemeMode === 'dark' ? 'geekblue' : 'blue'}>{`Theme: ${effectiveThemeMode}`}</Tag>
        </div>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card className={styles.accountCard}>
              <div className={styles.accountTop}>
                <Avatar size={72} src={user?.avatar_url || undefined} icon={<UserOutlined />} />
                <div className={styles.accountMeta}>
                  <Title level={4} className={styles.accountName}>
                    {displayName}
                  </Title>
                  {showSecondaryEmail ? <Text className={styles.accountSub}>{user?.email}</Text> : null}
                  {!showSecondaryEmail ? <Text className={styles.accountSub}>{user?.tenant || '-'}</Text> : null}
                </div>
              </div>

              <Space wrap className={styles.accountTags}>
                <Tag color="blue">Email: {user?.email || '-'}</Tag>
                <Tag color="cyan">Tenant: {user?.tenant || '-'}</Tag>
              </Space>

              <Button type="primary" icon={<UserOutlined />} block onClick={() => navigate('/profile')}>
                前往个人资料
              </Button>
            </Card>
          </Col>

          <Col xs={24} xl={16}>
            <Card className={styles.preferenceCard}>
              <div className={styles.section}>
                <Text strong>亮暗模式</Text>
                <Radio.Group
                  value={themeSettings.themeMode}
                  onChange={(e) => changeSetting('themeMode', e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  className={styles.fullWidthRadio}
                >
                  <Radio.Button value="light">{t('settingDrawer.theme.light')}</Radio.Button>
                  <Radio.Button value="system">{t('settingDrawer.theme.system')}</Radio.Button>
                  <Radio.Button value="dark">{t('settingDrawer.theme.dark')}</Radio.Button>
                </Radio.Group>
              </div>

              <Divider />

              <div className={styles.section}>
                <Text strong>导航与布局</Text>
                <Space size={8} wrap className={styles.controlStack}>
                  <Radio.Group
                    value={themeSettings.navTheme}
                    onChange={(e) => changeSetting('navTheme', e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="light">{t('settingDrawer.navTheme.light')}</Radio.Button>
                    <Radio.Button value="dark">{t('settingDrawer.navTheme.dark')}</Radio.Button>
                  </Radio.Group>

                  <Radio.Group
                    value={themeSettings.layout}
                    onChange={(e) => changeSetting('layout', e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="side">{t('settingDrawer.layout.side')}</Radio.Button>
                    <Radio.Button value="top">{t('settingDrawer.layout.top')}</Radio.Button>
                    <Radio.Button value="mix">{t('settingDrawer.layout.mix')}</Radio.Button>
                  </Radio.Group>
                </Space>
              </div>

              <Divider />

              <div className={styles.section}>
                <Text strong>主题色</Text>
                <div className={styles.colorRow}>
                  {PRESET_COLORS.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={styles.colorButton}
                      style={{
                        backgroundColor: item,
                        borderColor: themeSettings.colorPrimary === item ? '#111827' : 'transparent',
                      }}
                      onClick={() => changeSetting('colorPrimary', item)}
                    />
                  ))}
                  <ColorPicker
                    value={themeSettings.colorPrimary}
                    onChange={(value) => changeSetting('colorPrimary', value.toHexString())}
                    showText
                  />
                </div>
              </div>

              <Divider />

              <div className={styles.switchGrid}>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.contentWidth')}</Text>
                  <Switch
                    checked={themeSettings.contentWidth === 'Fixed'}
                    checkedChildren={t('settingDrawer.contentWidthFixed')}
                    unCheckedChildren={t('settingDrawer.contentWidthFluid')}
                    onChange={(checked) => changeSetting('contentWidth', checked ? 'Fixed' : 'Fluid')}
                    disabled={themeSettings.layout === 'side'}
                  />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.other.fixedHeader')}</Text>
                  <Switch checked={themeSettings.fixedHeader} onChange={(checked) => changeSetting('fixedHeader', checked)} />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.other.fixedSider')}</Text>
                  <Switch checked={themeSettings.fixSiderbar} onChange={(checked) => changeSetting('fixSiderbar', checked)} />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.other.compactMode')}</Text>
                  <Switch
                    checked={themeSettings.compactAlgorithm}
                    onChange={(checked) => changeSetting('compactAlgorithm', checked)}
                  />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.other.colorWeak')}</Text>
                  <Switch checked={themeSettings.colorWeak} onChange={(checked) => changeSetting('colorWeak', checked)} />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.other.grayMode')}</Text>
                  <Switch checked={themeSettings.grayMode} onChange={(checked) => changeSetting('grayMode', checked)} />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.effects.pointerFollow')}</Text>
                  <Switch checked={themeSettings.pointerMove} onChange={(checked) => changeSetting('pointerMove', checked)} />
                </div>
                <div className={styles.switchRow}>
                  <Text>{t('settingDrawer.effects.pointerTrail')}</Text>
                  <Switch checked={themeSettings.magicTrail} onChange={(checked) => changeSetting('magicTrail', checked)} />
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </FixTabPanel>
  )
}

export default Setting
