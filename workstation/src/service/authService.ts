import logger from '@/utils/logger'
import { permissionService } from './permissionService'
import request from '@/service/request'

export interface User {
  id: number
  login: string
  name: string
  email: string
  avatar_url: string
  html_url: string
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
    id: 0,
    login,
    name: login,
    email,
    avatar_url: '',
    html_url: '',
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
    isAuthenticated: false,
    isLoading: false,
  }
  private listeners: ((state: AuthState) => void)[] = []

  private constructor() {
    this.loadFromStorage()
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
      const token = parseToken(tokenData)

      if (token && isLikelyEmail(token)) {
        this.authState = {
          token,
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
    } else {
      localStorage.removeItem('token')
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

  async setAuthenticated(isAuthenticated: boolean, user?: User | null, token?: string | null): Promise<void> {
    this.authState.isAuthenticated = isAuthenticated

    if (user !== undefined) {
      this.authState.user = user
    }

    if (token !== undefined) {
      this.authState.token = token
    }

    if (!isAuthenticated) {
      this.authState.user = null
      this.authState.token = null
    }

    this.saveToStorage()
    this.notifyListeners()

    // 如果已登录，强制同步权限，保证菜单与路由权限为最新
    if (isAuthenticated) {
      try {
        await permissionService.syncPermissions()
      } catch (e) {
        logger.warn('同步权限失败:', e)
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

      if (!accessToken) {
        throw new Error('Invalid login response: missing access_token')
      }

      // Step 2: 用 access_token 请求当前用户信息
      const meResp = await request.get('/users/me', {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
        needToken: false,
      } as any) as any
      const meData = meResp?.data ?? meResp

      const user: User = {
        id: meData?.id ?? 0,
        login: meData?.email ?? meData?.id ?? '',
        name: meData?.first_name ? `${meData.first_name} ${meData.last_name ?? ''}`.trim() : (meData?.email ?? ''),
        email: meData?.email ?? '',
        avatar_url: meData?.avatar ?? '',
        html_url: '',
      }

      this.authState = {
        user,
        token: accessToken,
        isAuthenticated: true,
        isLoading: false,
      }

      this.saveToStorage()
      this.notifyListeners()

      try {
        await permissionService.syncPermissions()
      } catch (e) {
        logger.warn('同步权限失败:', e)
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
      isAuthenticated: false,
      isLoading: false,
    }
    // 登出时清理权限相关缓存与覆盖，避免下次登录残留旧权限
    try {
      permissionService.logoutCleanup()
    } catch (e) {
      logger.warn('清除权限相关缓存失败:', e)
    }

    // 清除所有相关的 localStorage 键（token 等）
    try {
      localStorage.removeItem('token')
    } catch (e) {
      logger.warn('移除本地存储键失败:', e)
    }
    this.saveToStorage()
    this.notifyListeners()
    // SPA 跳转到登录页
    if (typeof window !== 'undefined') {
      window.location.href = '#/signin'
    }
  }

  getToken(): string | null {
    return this.authState.token
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated
  }
}

export const authService = AuthService.getInstance()
