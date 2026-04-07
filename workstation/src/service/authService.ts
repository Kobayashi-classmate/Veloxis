import logger from '@/utils/logger'
import { permissionService } from './permissionService'
import request from '@/service/request'

export interface User {
  id: string
  login: string
  name: string
  email: string
  avatar_url: string
  html_url: string
  organization?: string
  tenant?: string
}

export interface LoginRequest {
  email: string
  password: string
  captchaTicket: string
  totp?: string
  otp?: string
}

export interface LoginResponse {
  token: string
  user: User
  expiresIn: number
}

export interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

function isLikelyEmail(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length > 320) return false
  if (value.includes(' ')) return false

  const at = value.indexOf('@')
  if (at <= 0 || at !== value.lastIndexOf('@')) return false

  const dot = value.indexOf('.', at + 2)
  if (dot === -1 || dot >= value.length - 1) return false

  return true
}

function buildTestAccountUser(email: string): User {
  // 用于“测试账号登录”展示；不代表真实用户
  const login = email
  const defaultScope = '集团本部'
  return {
    id: '',
    login,
    name: login,
    email,
    avatar_url: '',
    html_url: '',
    organization: defaultScope,
    tenant: defaultScope,
  }
}

const toScopeString = (value: any): string => {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''

  if (typeof value.id === 'string' && value.id.trim()) return value.id.trim()
  if (typeof value.organization_id === 'string' && value.organization_id.trim()) return value.organization_id.trim()
  if (typeof value.tenant_id === 'string' && value.tenant_id.trim()) return value.tenant_id.trim()
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim()
  if (typeof value.organization_name === 'string' && value.organization_name.trim())
    return value.organization_name.trim()
  if (typeof value.tenant_name === 'string' && value.tenant_name.trim()) return value.tenant_name.trim()

  return ''
}

const resolveUserScope = (user: User | null | undefined): string => {
  if (!user) return ''
  return toScopeString(user.organization) || toScopeString(user.tenant)
}

const normalizeUserScope = (user: User | null): User | null => {
  if (!user) return null

  const scope = resolveUserScope(user)

  return {
    ...user,
    organization: scope,
    tenant: scope,
  }
}

const isAuthStatusError = (error: any): boolean => {
  const status = Number(error?.status || error?.response?.status || 0)
  return status === 401 || status === 403
}

const fetchCurrentUserProfile = async (accessToken: string): Promise<any> => {
  const fieldCandidates = [
    'id,email,first_name,last_name,avatar,organization,organization.id,organization.name,tenant,tenant.id,tenant.name',
    'id,email,first_name,last_name,avatar,organization,organization.id,organization.name,tenant',
    'id,email,first_name,last_name,avatar,organization,organization.id,organization.name',
    'id,email,first_name,last_name,avatar,tenant,tenant.id,tenant.name',
    'id,email,first_name,last_name,avatar,tenant',
  ]

  let lastError: any = null
  for (const fields of fieldCandidates) {
    try {
      const meResp = (await request.get('/users/me', { fields }, {
        headers: { Authorization: `Bearer ${accessToken}` },
        needToken: false,
      } as any)) as any
      return meResp?.data ?? meResp
    } catch (error) {
      if (isAuthStatusError(error)) {
        throw error
      }
      lastError = error
    }
  }

  if (lastError) {
    throw lastError
  }
  throw new Error('Failed to fetch current user profile')
}

// ✅ 修复 3: parseToken - 修正存储格式解析逻辑
function parseToken(jsonLike: unknown): string | null {
  if (typeof jsonLike !== 'string') return null
  try {
    // 尝试解析为对象（新格式：{ token: "xxx" }）
    const obj = JSON.parse(jsonLike)
    if (obj && typeof obj === 'object' && typeof obj.token === 'string') {
      return obj.token
    }
    // 兼容直接字符串格式（旧版本）
    if (typeof obj === 'string') {
      return obj
    }
    return null
  } catch {
    // 如果解析失败，可能本身就是纯字符串 token（最旧版本）
    return jsonLike
  }
}

class AuthService {
  private static instance: AuthService
  private authState: AuthState = {
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true, // 默认开启加载状态，等待 loadFromStorage 完成
  }
  private listeners: ((state: AuthState) => void)[] = []

  private shouldLogoutForAuthFailure(error: any): boolean {
    return !!(error?.isUnauthorized || error?.isAuthExpired || error?.status === 401 || error?.code === 401)
  }

  private constructor() {
    this.loadFromStorage()
    /** 监听 request.js 触发的 token 失效事件（避免循环依赖）
     *  request.js → dispatchEvent('veloxis:unauthorized') → authService.logout()
     */
    if (typeof window !== 'undefined') {
      window.addEventListener('veloxis:unauthorized', () => {
        /** 触发登出，清除所有状态并跳转 */
        this.logout()
      })
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  private loadFromStorage() {
    try {
      const tokenData = localStorage.getItem('token')
      const refreshTokenData = localStorage.getItem('refreshToken')
      const token = parseToken(tokenData)
      const refreshToken = parseToken(refreshTokenData)

      if (!token) {
        // 没有 token，保持未认证状态
        this.authState.isLoading = false
        return
      }

      if (isLikelyEmail(token)) {
        // 测试账号：用 email 构建虚拟用户
        this.authState = {
          token,
          refreshToken,
          user: buildTestAccountUser(token),
          isAuthenticated: true,
          isLoading: false,
        }
        return
      }

      // 真实 JWT token：解析 payload 重建用户信息
      // 不做签名验证（签名由后端负责），仅读取 payload 字段用于 UI 展示
      const storedUserRaw = localStorage.getItem('auth_user')
      let restoredUser: User | null = null
      if (storedUserRaw) {
        try {
          restoredUser = normalizeUserScope(JSON.parse(storedUserRaw) as User)
        } catch {
          // ignore
        }
      }

      this.authState = {
        token,
        refreshToken,
        user: restoredUser,
        isAuthenticated: true,
        isLoading: false,
      }
    } catch (error) {
      logger.error('Failed to load auth state from storage:', error)
      this.authState.isLoading = false
    }
  }

  private saveToStorage() {
    if (this.authState.token && this.authState.user) {
      localStorage.setItem('token', JSON.stringify({ token: this.authState.token }))
      // 持久化用户信息，供页面刷新后 loadFromStorage 恢复（不含敏感字段）
      localStorage.setItem('auth_user', JSON.stringify(this.authState.user))
      if (this.authState.refreshToken) {
        localStorage.setItem('refreshToken', JSON.stringify({ token: this.authState.refreshToken }))
      }
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('auth_user')
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.authState))
  }

  subscribe(listener: (state: AuthState) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  getState(): AuthState {
    return { ...this.authState }
  }

  updateCurrentUser(partial: Partial<User>): User | null {
    if (!this.authState.user) {
      return null
    }

    const merged: User = { ...this.authState.user }
    Object.keys(partial).forEach((key) => {
      const typedKey = key as keyof User
      const value = partial[typedKey]
      if (value !== undefined) {
        ;(merged as Record<string, any>)[typedKey] = value
      }
    })

    this.authState.user = normalizeUserScope(merged)
    this.saveToStorage()
    this.notifyListeners()

    return this.authState.user
  }

  async setAuthenticated(
    isAuthenticated: boolean,
    user?: User | null,
    token?: string | null,
    refreshToken?: string | null
  ): Promise<void> {
    this.authState.isAuthenticated = isAuthenticated

    if (user !== undefined) {
      this.authState.user = normalizeUserScope(user)
    }

    if (token !== undefined) {
      this.authState.token = token
    }

    if (refreshToken !== undefined) {
      this.authState.refreshToken = refreshToken
    }

    if (!isAuthenticated) {
      this.authState.user = null
      this.authState.token = null
      this.authState.refreshToken = null
    }

    this.saveToStorage()
    this.notifyListeners()

    // 如果已登录，强制同步权限，保证菜单与路由权限为最新
    if (isAuthenticated) {
      try {
        await permissionService.syncPermissions()
      } catch (e: any) {
        logger.warn('同步权限失败:', e)
        // 仅当用户当前仍处于登录态且认证失效（401）时执行登出
        // （避免并发调用导致已登出状态下二次 logout）
        if (this.authState.isAuthenticated && this.shouldLogoutForAuthFailure(e)) {
          this.logout()
        }
      }
    }

    // 保持原有的短延迟行为以兼容订阅者
    return new Promise((resolve) => setTimeout(resolve, 100))
  }

  /**
   * 真实登录：调用后端认证接口
   */
  async login(credentials: LoginRequest): Promise<User> {
    // 防重入：正在登录中静默忽略，不对用户弹出报错
    if (this.authState.isLoading) {
      return Promise.reject(null)
    }

    try {
      this.authState.isLoading = true
      this.notifyListeners()

      // Step 1: 调用 Directus /auth/login，获取 access_token
      // Directus MFA 字段名为 otp，这里兼容前端传入的 totp
      const otp = (credentials.otp ?? credentials.totp ?? '').trim()
      const payload: Record<string, any> = {
        email: credentials.email,
        password: credentials.password,
        captchaTicket: credentials.captchaTicket,
      }
      if (otp) payload.otp = otp

      const loginResp = (await request.post('/auth/login', payload, { needToken: false })) as any
      // Directus 响应格式: { data: { access_token, refresh_token, expires } }
      const loginData = loginResp?.data ?? loginResp
      const accessToken: string = loginData?.access_token ?? loginData?.token
      const refreshToken: string = loginData?.refresh_token

      if (!accessToken) {
        throw new Error('Invalid login response: missing access_token')
      }

      // Step 2: 用 access_token 请求当前用户信息（优先 organization，兼容 tenant）
      const meData = await fetchCurrentUserProfile(accessToken)
      const organizationScope = toScopeString(meData?.organization) || toScopeString(meData?.tenant)

      const user: User = {
        id: meData?.id ?? '',
        login: meData?.email ?? meData?.id ?? '',
        name: meData?.first_name ? `${meData.first_name} ${meData.last_name ?? ''}`.trim() : (meData?.email ?? ''),
        email: meData?.email ?? '',
        avatar_url: meData?.avatar ?? '',
        html_url: '',
        organization: organizationScope,
        tenant: organizationScope,
      }

      this.authState = {
        user,
        token: accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      }

      this.saveToStorage()
      this.notifyListeners()

      try {
        await permissionService.syncPermissions()
      } catch (e: any) {
        logger.warn('同步权限失败:', e)
        // 仅当用户当前仍处于登录态且认证失效（401）时执行登出
        if (this.authState.isAuthenticated && this.shouldLogoutForAuthFailure(e)) {
          this.logout()
        }
      }

      return user
    } catch (error) {
      this.authState.isLoading = false
      this.notifyListeners()
      throw error
    }
  }

  /**
   * 测试账号登录：将 demo 登录态也纳入 authService（避免 Header/菜单逻辑分裂）。
   * - 仅写入 localStorage.token
   * @deprecated 仅用于开发阶段，生产环境应使用 login() 方法
   */
  async setTestAccountAuthenticated(email: string): Promise<void> {
    this.authState = {
      user: buildTestAccountUser(email),
      token: email,
      refreshToken: null, // 测试账号没有refresh token
      isAuthenticated: true,
      isLoading: false,
    }

    this.notifyListeners()

    try {
      await permissionService.syncPermissions()
    } catch (e) {
      logger.warn('同步权限失败:', e)
    }

    return new Promise((resolve) => setTimeout(resolve, 100))
  }

  setLoading(isLoading: boolean): Promise<void> {
    return new Promise((resolve) => {
      this.authState.isLoading = isLoading
      this.notifyListeners()
      setTimeout(resolve, 50)
    })
  }

  logout(): void {
    this.authState = {
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    }

    // Step 1: 清除所有 localStorage 键
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('auth_user')
      // 清除权限相关的键
      localStorage.removeItem('user_permissions')
      localStorage.removeItem('permissions_fetch_time')
      localStorage.removeItem('permissions_auth_key')
      // 清除演示/覆盖相关的键
      localStorage.removeItem('user_role')
      localStorage.removeItem('force_demo_switch')
    } catch (e) {
      logger.warn('移除本地存储键失败:', e)
    }

    // Step 2: 清除权限服务的内存缓存
    try {
      permissionService.logoutCleanup()
    } catch (e) {
      logger.warn('清除权限相关缓存失败:', e)
    }

    // Step 3: 保存空的认证状态
    this.saveToStorage()

    // Step 4: 通知所有监听者——ProtectedRoute 会响应 isAuthenticated=false 并渲染 <Navigate to="/signin">
    // 不再使用 window.location.href 硬跳转，避免销毁 React 组件树导致双重跳转竞态
    this.notifyListeners()
  }

  getToken(): string | null {
    return this.authState.token
  }

  getRefreshToken(): string | null {
    return this.authState.refreshToken
  }

  /**
   * 刷新访问令牌
   */
  async refreshToken(): Promise<boolean> {
    if (!this.authState.refreshToken) {
      logger.warn('No refresh token available')
      return false
    }

    try {
      // 调用 Directus /auth/refresh
      // 添加 _isRefreshRequest 标记，防止refresh请求本身返回401导致循环
      const refreshResp = (await request.post(
        '/auth/refresh',
        {
          refresh_token: this.authState.refreshToken,
        },
        {
          needToken: false,
          _isRefreshRequest: true, // 标记这是刷新请求，避免二次处理
          showError: false, // 不显示刷新失败的错误提示
        }
      )) as any

      const refreshData = refreshResp?.data ?? refreshResp
      const newAccessToken: string = refreshData?.access_token ?? refreshData?.token
      const newRefreshToken: string = refreshData?.refresh_token

      if (!newAccessToken) {
        throw new Error('Invalid refresh response: missing access_token')
      }

      // 更新状态
      this.authState.token = newAccessToken
      if (newRefreshToken) {
        this.authState.refreshToken = newRefreshToken
      }
      this.saveToStorage()
      this.notifyListeners()

      logger.info('Token refreshed successfully')
      return true
    } catch (error) {
      logger.error('Failed to refresh token:', error)
      // 如果刷新失败，且不是因为网络取消等原因，执行登出
      // Invalid user credentials 等业务错误会走到这里
      this.logout()
      return false
    }
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated
  }
}

export const authService = AuthService.getInstance()
