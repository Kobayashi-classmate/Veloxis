# 前端接口逻辑梳理 - 完整分析报告

**生成时间**: 2026-03-20
**项目**: Veloxis Analytics Platform
**目标**: 完全抛弃Mock数据，集成真实后端API

---

## 一、核心数据流分析

### 1.1 当前权限系统流程

```
┌──────────────────────────────────────────────────────────────┐
│                    用户登录 (登录页)                           │
│                  src/pages/signin/index.jsx                    │
└────┬─────────────────────────────────────────────────────────┘
     │
     ├─ 快速填充 testAccounts (Mock账号)
     │  └─ @test.com 四个Demo账号
     │
     └─ 自定义邮箱 + 验证码
        └─ authService.setTestAccountAuthenticated(email)
           │
           ├─ 保存token到localStorage
           │  └─ { token: email }  [⚠️ 这是Mock模式]
           │
           └─ 权限同步: permissionService.syncPermissions()
              │
              ├─ permissionService.getPermissions()
              │  └─ permissionAPI.getUserPermissions()
              │     │
              │     ├─ 检查 USE_MOCK flag
              │     │  └─ if YES → mockGetUserPermissions()
              │     │             └─ 返回 mockUserPermissions[roleCode]
              │     │
              │     └─ if NO → request.get('/api/permissions/current')
              │                └─ [当前实现: 总是Mock]
              │
              └─ 保存权限到localStorage
                 └─ user_permissions / permissions_fetch_time / permissions_auth_key


┌──────────────────────────────────────────────────────────────┐
│              路由权限检查 (应用内)                             │
│           routers/utils/index.jsx 中的PermissionGuard          │
└────┬─────────────────────────────────────────────────────────┘
     │
     └─ permissionService.canAccessRoute(route)
        └─ 基于缓存的权限列表检查
           ├─ 超级权限('*:*')直接通过
           ├─ 或查询 routePermissionMap[route]
           └─ 或检查 permissions.routes 列表
```

### 1.2 Mock数据结构

```typescript
// src/mock/permission.ts

mockRoles: Role[]  // 4个预定义角色
├─ super_admin (id: 1)
├─ admin (id: 2)
├─ business_user (id: 4)
└─ user (id: ?)

testAccounts: Record<email, { role, name }>
├─ 'admin@test.com' → super_admin
├─ 'manager@test.com' → admin
├─ 'business@test.com' → business_user
└─ 'user@test.com' → user

mockUserPermissions: Record<roleCode, UserPermission>
├─ super_admin → permissions: ['*:*'], routes: [...all]
├─ admin → permissions: [...specific], routes: [...]
├─ business_user → permissions: [...], routes: [...]
└─ user → permissions: ['home:read', 'dashboard:read'], routes: [...]

routePermissionMap: Record<route, permissionCode>
├─ '/' → 'home:read'
├─ '/dashboard' → 'dashboard:read'
└─ ... (159+ 路由映射)
```

---

## 二、依赖关系详解

### 2.1 Mock导入关系

```
                 ┌─────────────────────────┐
                 │ mock/permission.ts      │
                 │  (Mock数据源)           │
                 └────┬────┬───────┬──────┘
                      │    │       │
        ┌─────────────┘    │       └──────────────┐
        │                  │                       │
        ▼                  ▼                       ▼
    ┌────────────┐  ┌──────────────┐  ┌──────────────────┐
    │signin/     │  │permission.ts │  │permissionService │
    │index.jsx   │  │(api/layer)   │  │                  │
    │            │  │              │  │                  │
    │✅ USE      │  │✅ USE        │  │✅ USE            │
    │  testAccounts              mockGetUserPermissions  │
    └────────────┘  └──────────────┘  └──────────────────┘
         │               │                      │
         └───────────────┴──────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │ authService.set/logout()     │
         │ permissionService.get/check()│
         └──────────────────────────────┘
```

### 2.2 请求链路

```
Frontend Component
       │
       ├─ 认证需求 ──→ authService.login() [❌ 不存在]
       │              或 setTestAccountAuthenticated() [✅ Mock]
       │
       ├─ 权限检查 ──→ permissionService.hasPermission()
       │   └─ permissionService.getPermissions()
       │       └─ permissionAPI.getUserPermissions()
       │           ├─ 如果 USE_MOCK: mockGetUserPermissions()
       │           └─ 否则: request.get('/api/permissions/current')
       │               └─ Axios请求拦截器
       │                  ├─ 加入Authorization头
       │                  ├─ 加密处理
       │                  └─ 超时控制
       │
       └─ 业务数据 ──→ request.get('/api/...') [❌ 待实现]
```

---

## 三、配置依赖分析

### 3.1 环境变量控制

```typescript
// src/service/api/permission.ts

const BASE_URL = getEnv('APP_BASE_URL', '')
const USE_MOCK = getEnvBool('REACT_APP_USE_MOCK', false) || !BASE_URL

// 当满足以下条件时使用Mock:
// 1. 显式设置 REACT_APP_USE_MOCK=true
// 2. 或 APP_BASE_URL 为空(默认开发模式)
```

**问题**: 当前开发环境 `APP_BASE_URL` 可能为空，导致始终使用Mock

### 3.2 localStorage存储依赖

```
┌─ token
│  ├─ 格式(Mock): { token: "user@test.com" }
│  └─ 格式(真实): JWT token string
│
├─ user_permissions
│  └─ 缓存的UserPermission对象
│
├─ permissions_fetch_time
│  └─ 缓存时间戳
│
├─ permissions_auth_key
│  └─ 身份指纹(用于检测切换账号)
│
├─ user_role [可选]
│  └─ 手动覆盖的角色码(仅开发用)
│
└─ force_demo_switch [可选]
   └─ Demo模式强制开关
```

---

## 四、重构方案

### 4.1 Phase 1: 权限API层改造

**文件**: `src/service/api/permission.ts`

**当前代码**:
```typescript
export const getUserPermissions = async (userId?: string): Promise<UserPermission> => {
  if (USE_MOCK) {
    return mockGetUserPermissions(userId)  // ❌ Mock
  }

  try {
    const response = await request.get('/api/permissions/current')
    return normalizeUserPermissions(response.data || response)
  } catch (error) {
    return mockGetUserPermissions(userId)  // ❌ 回退Mock
  }
}
```

**改为**:
```typescript
export const getUserPermissions = async (userId?: string): Promise<UserPermission> => {
  try {
    const response = await request.get('/api/permissions/current',
      userId ? { userId } : {}
    )
    return normalizeUserPermissions(response.data || response)
  } catch (error) {
    console.error('获取权限失败:', error)
    // 返回空权限或缓存回退
    throw error
  }
}
```

**后端API契约**:
```
GET /api/permissions/current

Response 200:
{
  "code": 0,
  "data": {
    "userId": "uuid",
    "username": "用户名",
    "roles": [
      { "id": "role_id", "code": "admin", "name": "管理员" }
    ],
    "permissions": ["user:read", "user:create", "dashboard:*"],
    "routes": ["/", "/dashboard", "/user", ...]
  }
}

Response 401:
{
  "code": 401,
  "message": "未授权"
}
```

### 4.2 Phase 2: 认证服务完善

**文件**: `src/service/authService.ts`

**新增方法**:
```typescript
// 1. 用户名密码登录
async login(email: string, password: string, totp?: string): Promise<void> {
  const response = await request.post('/api/auth/login', {
    email,
    password,
    totp
  })

  const token = response.data?.token || response.token
  const user = response.data?.user || response.user

  await this.setAuthenticated(true, user, token)
}

// 2. OAuth回调处理
async handleOAuthCallback(code: string, state: string): Promise<void> {
  const response = await request.post('/api/auth/callback', {
    code,
    state
  })

  const token = response.data?.token
  const user = response.data?.user

  await this.setAuthenticated(true, user, token)
}

// 3. Token刷新
async refreshToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) throw new Error('No refresh token')

  const response = await request.post('/api/auth/refresh', {
    refreshToken
  })

  const newToken = response.data?.token
  this.authState.token = newToken
  localStorage.setItem('token', JSON.stringify({ token: newToken }))

  return newToken
}

// 4. 登出
logout(): void {
  request.post('/api/auth/logout').catch(e => {
    console.warn('登出请求失败:', e)
  })

  // 本地清理
  this.authState = { ... }
  localStorage.removeItem('token')
  permissionService.logoutCleanup()
}
```

### 4.3 Phase 3: 登录页改造

**文件**: `src/pages/signin/index.jsx`

**当前**:
```jsx
import { testAccounts } from '@src/mock/permission'

// 快速填充Demo账号
const quickItems = Object.entries(testAccounts).map(...)

// 提交登录
const handleLogin = async (email) => {
  if (!testAccounts[email]) return  // ❌ 检查Mock账号
  await authService.setTestAccountAuthenticated(email)  // ❌ Mock登录
}
```

**改为**:
```jsx
// 移除Mock导入
// import { testAccounts } from '@src/mock/permission'

// 真实登录
const handleLogin = async (email, password, totp) => {
  try {
    await authService.login(email, password, totp)  // ✅ 真实后端
    navigate('/')
  } catch (error) {
    message.error(error.message)
  }
}

// OAuth快速登录
const handleOAuthLogin = async (provider) => {
  // 调用后端获取 auth_url
  const { auth_url } = await request.get(`/api/auth/${provider}/authorize`)
  window.location.href = auth_url
}
```

### 4.4 Phase 4: 清理Mock

**删除**:
```
1. src/mock/permission.ts (整个文件)
2. workstation/.gitignore 中可能的 mock 排除规则
```

**修改**:
```typescript
// permissionService.ts
- import { routePermissionMap } from '../mock/permission'
+ import { routePermissionMap } from './api/permission'  // 或从后端获取

// service/api/permission.ts
- import { mockGetUserPermissions, mockGetRoles, mockCheckPermission } from '../../mock/permission'
+ // 删除所有mock导入

// 移除USE_MOCK判断
- if (USE_MOCK) { ... }
```

---

## 五、集成清单

### 5.1 需要后端提供的接口

| 接口 | 方法 | 优先级 | 说明 |
|-----|------|--------|------|
| `/api/auth/login` | POST | P0 | 用户登录 |
| `/api/auth/logout` | POST | P0 | 用户登出 |
| `/api/permissions/current` | GET | P0 | 获取当前用户权限 |
| `/api/roles` | GET | P1 | 获取角色列表 |
| `/api/auth/callback` | POST | P1 | OAuth回调 |
| `/api/auth/refresh` | POST | P1 | Token刷新 |
| `/api/{provider}/authorize` | GET | P2 | OAuth授权URL |

### 5.2 前端待实现

- [ ] `authService.login(email, password, totp?)`
- [ ] `authService.logout()`
- [ ] `authService.refreshToken()`
- [ ] `authService.handleOAuthCallback(code, state)`
- [ ] 登录页OAuth集成
- [ ] Token过期处理(request拦截器)
- [ ] 权限缓存策略优化

### 5.3 环境变量配置

```bash
# .env.development
APP_BASE_URL=http://localhost:3000/api
REACT_APP_USE_MOCK=false  # 关闭Mock

# 可选
REACT_APP_OAUTH_PROVIDERS=github,google
REACT_APP_TOKEN_EXPIRY=3600000  # 1小时
```

---

## 六、风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 后端权限API不可用 | 用户无法登录 | 提供本地缓存回退、增加重试机制 |
| Token过期处理缺失 | 请求突然失败 | request拦截器检测401，自动刷新或重定向 |
| 权限格式不匹配 | 权限检查失效 | 统一定义权限码规范(resource:action) |
| Mock数据依赖未完全清理 | 线上仍使用Mock | 完整搜索、测试环境验证 |
| 用户切换后权限残留 | 权限泄露 | 使用auth_key指纹检测、强制刷新 |

---

## 七、测试计划

### 7.1 单元测试
```typescript
// authService.test.ts
- login: 正常登录、密码错误、MFA、超时
- logout: 权限清理、token移除、localStorage清空
- refreshToken: 刷新成功、刷新失败回退

// permissionService.test.ts
- getPermissions: 缓存、过期、auth_key变化
- hasPermission: 精确匹配、通配符、超级权限
- canAccessRoute: 路由权限、超级权限、权限不足
```

### 7.2 集成测试
```
1. 登录流程: 填表 → 验证 → 获取权限 → 重定向
2. 权限检查: 路由防护 → 菜单显示 → 操作按钮
3. 权限切换: 登出 → 登录(不同角色) → 权限更新
4. 错误处理: 401 → 重新登录、权限获取失败 → 缓存回退
```

### 7.3 E2E测试
```
Playwright:
- 完整登录→操作→登出流程
- 权限不足访问路由
- Token过期自动刷新
- OAuth快速登录
```

---

## 八、实施时间表

| 阶段 | 任务 | 时间 | 产物 |
|-----|------|------|------|
| 1 | 后端API设计 | Week 1 | API文档 |
| 2 | 权限API改造 | Week 2 | 去Mock版本 |
| 3 | 认证服务完善 | Week 2 | login/logout/refresh |
| 4 | 登录页改造 | Week 3 | OAuth集成 |
| 5 | 测试与修复 | Week 3-4 | 测试报告 |
| 6 | 文档更新 | Week 4 | README更新 |

---

## 九、关键问题清单

需要与后端确认:

- [ ] JWT token payload格式?
- [ ] 权限码规范是否为 `resource:action` 形式?
- [ ] 是否需要TOTP MFA?
- [ ] Token刷新机制(refresh_token)?
- [ ] OAuth提供商(GitHub/Google/etc)?
- [ ] 权限缓存失效时间?
- [ ] 是否需要行级权限(Row-Level Security)?
- [ ] 是否需要动态菜单API?
- [ ] 权限变更是否实时推送还是轮询?

---

## 附录: 代码示例

### A. 新的authService登录流程

```typescript
class AuthService {
  async login(email: string, password: string, totp?: string): Promise<void> {
    this.authState.isLoading = true
    this.notifyListeners()

    try {
      const response = await request.post('/api/auth/login', {
        email,
        password,
        totp,
      })

      const { token, user } = response.data || response
      await this.setAuthenticated(true, user, token)

    } catch (error) {
      logger.error('登录失败:', error)
      throw new Error(error?.message || '登录失败')
    } finally {
      this.authState.isLoading = false
      this.notifyListeners()
    }
  }

  logout(): void {
    // 通知后端
    request.post('/api/auth/logout').catch(err => {
      logger.warn('登出请求失败:', err)
    })

    // 本地清理
    this.authState = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    }

    try {
      permissionService.logoutCleanup()
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
    } catch (e) {
      logger.warn('本地清理失败:', e)
    }

    this.notifyListeners()
    window.location.hash = '#/signin'
  }
}
```

### B. request拦截器处理401

```typescript
// 在request.js中增加
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config

    // 401 Unauthorized - 尝试刷新token
    if (error.response?.status === 401) {
      try {
        const newToken = await authService.refreshToken()
        config.headers.Authorization = `Bearer ${newToken}`
        return axiosInstance(config)
      } catch {
        // 刷新失败，重定向登录
        authService.logout()
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)
```

---

**文档版本**: v1.0
**最后更新**: 2026-03-20
**状态**: 待实施
