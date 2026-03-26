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
  tenant?: string
}

export interface LoginRequest {
  email: string
  password: string
  totp?: string
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
  return {
    id: '',
    login,
    name: login,
    email,
    avatar_url: '',
    html_url: '',
    tenant: '集团本部',
  }
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
    isLoading: false,
  }
  private listeners: ((state: AuthState) => void)[] = []

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

      if (token && isLikelyEmail(token)) {
        this.authState = {
          token,
          refreshToken,
          user: buildTestAccountUser(token),
          isAuthenticated: true,
          isLoading: false,
        }
      }
    } catch (error) {
      logger.error('Failed to load auth state from storage:', error)
    }
  }

  private saveToStorage() {
    if (this.authState.token && this.authState.user) {
      localStorage.setItem('token', JSON.stringify({ token: this.authState.token }))
      if (this.authState.refreshToken) {
        localStorage.setItem('refreshToken', JSON.stringify({ token: this.authState.refreshToken }))
      }
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
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

  async setAuthenticated(isAuthenticated: boolean, user?: User | null, token?: string | null, refreshToken?: string | null): Promise<void> {
    this.authState.isAuthenticated = isAuthenticated

    if (user !== undefined) {
      this.authState.user = user
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
        // 如果获取权限报 401/403，说明登录态有问题，直接清理
        if (e?.isUnauthorized || e?.status === 401 || e?.status === 403 || e?.code === 401) {
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
      const loginResp = await request.post('/auth/login', credentials) as any
      // Directus 响应格式: { data: { access_token, refresh_token, expires } }
      const loginData = loginResp?.data ?? loginResp
      const accessToken: string = loginData?.access_token ?? loginData?.token
      const refreshToken: string = loginData?.refresh_token

      if (!accessToken) {
        throw new Error('Invalid login response: missing access_token')
      }

      // Step 2: 用 access_token 请求当前用户信息
      const meResp = await request.get('/users/me', { fields: 'id,email,first_name,last_name,avatar,tenant' }, {
        headers: { Authorization: `Bearer ${accessToken}` },
        needToken: false,
      } as any) as any
      const meData = meResp?.data ?? meResp

      const user: User = {
        id: meData?.id ?? '',
        login: meData?.email ?? meData?.id ?? '',
        name: meData?.first_name ? `${meData.first_name} ${meData.last_name ?? ''}`.trim() : (meData?.email ?? ''),
        email: meData?.email ?? '',
        avatar_url: meData?.avatar ?? '',
        html_url: '',
        tenant: meData?.tenant ?? '',
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
        // 如果获取权限报 401/403，说明登录态有问题，直接清理
        if (e?.isUnauthorized || e?.status === 401 || e?.status === 403 || e?.code === 401) {
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

    // Step 1: 首先清除所有 localStorage 键（确保存储层清洁）
    try {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
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

    // Step 4: 通知所有监听者状态已变化
    this.notifyListeners()

    // Step 5: SPA 跳转到登录页（确保所有清理工作已完成）
    if (typeof window !== 'undefined') {
      // 使用短延迟确保所有状态更新已完成
      setTimeout(() => {
        window.location.href = '#/signin'
      }, 50)
    }
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
      const refreshResp = await request.post('/auth/refresh', {
        refresh_token: this.authState.refreshToken
      }, {
        needToken: false,
        _isRefreshRequest: true, // 标记这是刷新请求，避免二次处理
        showError: false, // 不显示刷新失败的错误提示
      }) as any

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
