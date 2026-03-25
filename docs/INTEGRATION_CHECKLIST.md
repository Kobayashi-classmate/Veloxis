# 前端Mock数据整合检查表

> 快速参考：如何完全抛弃Mock数据，集成真实后端API

**文档版本**: v1.0
**最后更新**: 2026-03-20
**详见**: [INTERFACE_LOGIC_REVIEW.md](./INTERFACE_LOGIC_REVIEW.md)

---

## 快速概览

| 当前状态 | 目标状态 |
|---------|---------|
| 📍 权限系统 100% Mock | ✅ 完全后端驱动 |
| 📍 登录页硬编码4个账号 | ✅ 真实用户认证 |
| 📍 authService 缺少login方法 | ✅ 完整认证流程 |
| 📍 权限映射在前端 | ✅ 动态权限管理 |

---

## 前置条件

确保后端提供以下接口（参考格式）:

### 必须接口 (P0)

```bash
# 1. 登录
POST /api/auth/login
  Request: { email, password, totp? }
  Response: { code: 0, data: { token, user, expiresIn } }

# 2. 权限查询
GET /api/permissions/current
  Response: { code: 0, data: { userId, username, roles[], permissions[], routes[] } }

# 3. 登出
POST /api/auth/logout
  Response: { code: 0, message: "登出成功" }
```

### 可选接口 (P1+)

```bash
# Token刷新
POST /api/auth/refresh
  Request: { refreshToken }
  Response: { code: 0, data: { token } }

# 角色列表
GET /api/roles
  Response: { code: 0, data: [{ id, code, name, permissions[] }] }

# OAuth授权
GET /api/auth/{provider}/authorize
  Response: { auth_url }
```

---

## 实施步骤

### 第1步：后端API验证 (1小时)

**清单**:
- [ ] 后端 `/api/auth/login` 已实现
- [ ] 后端 `/api/permissions/current` 已实现
- [ ] 已确认JWT token格式
- [ ] 已确认权限码规范 (e.g., `resource:action`)
- [ ] 已测试API响应结构

**验证方法**:
```bash
# 快速测试
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'

curl -X GET http://localhost:3000/api/permissions/current \
  -H "Authorization: Bearer <token>"
```

---

### 第2步：权限API改造 (1-2小时)

**文件**: `workstation/src/service/api/permission.ts`

**改动**:
```typescript
// ❌ 删除
import { mockGetUserPermissions, mockGetRoles } from '../../mock/permission'
const USE_MOCK = ...

// ✅ 改为
export const getUserPermissions = async (userId?: string): Promise<UserPermission> => {
  const response = await request.get('/api/permissions/current',
    userId ? { userId } : {}
  )
  return normalizeUserPermissions(response.data || response)
}

export const getRoles = async (): Promise<Role[]> => {
  const response = await request.get('/api/roles')
  return response.data || response
}
```

**验证**:
```bash
npm run test -- permissionService
```

---

### 第3步：认证服务完善 (2-3小时)

**文件**: `workstation/src/service/authService.ts`

**新增方法**:
```typescript
// 1. 登录
async login(email: string, password: string, totp?: string): Promise<void>

// 2. 登出
async logout(): Promise<void>

// 3. Token刷新
async refreshToken(): Promise<string>

// 4. OAuth回调
async handleOAuthCallback(code: string, state: string): Promise<void>
```

**引入request拦截器处理401**:
```typescript
// request.js 中增加
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // 尝试刷新token
      // 刷新失败则重定向登录
    }
    return Promise.reject(error)
  }
)
```

---

### 第4步：登录页改造 (1-2小时)

**文件**: `workstation/src/pages/signin/index.jsx`

**改动**:
```jsx
// ❌ 删除
import { testAccounts } from '@src/mock/permission'

// ✅ 改为
const handleLogin = async (email, password, totp) => {
  await authService.login(email, password, totp)
  navigate('/')
}

// ✅ 增加OAuth快速登录
const handleOAuthLogin = async (provider) => {
  const { auth_url } = await request.get(`/api/auth/${provider}/authorize`)
  window.location.href = auth_url
}
```

**测试**:
- [ ] 正确的邮箱/密码能登录
- [ ] 错误的密码显示错误信息
- [ ] 登录后重定向到首页
- [ ] OAuth流程完整

---

### 第5步：环境配置 (30分钟)

**文件**: `.env.development`, `.env.production`

```bash
# 设置后端URL (取代Mock mode)
APP_BASE_URL=http://localhost:3000

# 禁用Mock标志
REACT_APP_USE_MOCK=false

# 可选: 权限相关
REACT_APP_TOKEN_EXPIRY=3600000
REACT_APP_PERMISSION_CACHE_TIME=1800000
```

**验证**:
```bash
npm run start
# 应该直接跳转登录，而不是显示Mock账号
```

---

### 第6步：清理Mock依赖 (30分钟)

**删除**:
- [ ] `workstation/src/mock/permission.ts` (整个文件)

**修改**:
```typescript
// permissionService.ts - 移除mock/permission导入
- import { routePermissionMap } from '../mock/permission'
+ import { routePermissionMap } from './constants'  // 或从后端获取

// service/api/permission.ts - 移除所有mock函数调用
- import { mockCheckPermission } from '../../mock/permission'
+ // 不需要此函数，权限检查在本地完成
```

**验证**:
```bash
# 确保没有import mock/permission
grep -r "mock/permission" workstation/src/

# 应该返回空结果
```

---

### 第7步：测试验证 (2-3小时)

**单元测试**:
```bash
npm run test -- authService
npm run test -- permissionService
```

**集成测试**:
```bash
npm run test:e2e
```

**手动测试场景**:
- [ ] 新用户登录流程
- [ ] 不同角色权限检查
- [ ] 登出后权限清理
- [ ] 权限过期刷新
- [ ] 401响应处理
- [ ] Token过期自动刷新

---

## 关键变更影响分析

### ✅ 向后兼容吗?

**否**。需要统一前后端API契约:

| 项 | 当前(Mock) | 目标(真实) | 迁移成本 |
|----|----------|----------|--------|
| Token格式 | 邮箱字符串 | JWT | 高 |
| 权限获取 | 本地map | 后端API | 高 |
| 登录方式 | Mock自验证 | 后端认证 | 高 |
| 权限缓存 | localStorage | 带失效时间 | 中 |

### 依赖关系检查

```bash
# 查找所有Mock引用
grep -r "mockGetUserPermissions\|mockRoles\|testAccounts" workstation/src/

# 应该只在以下地方出现(迁移完后为0):
# 1. mock/permission.ts (待删除)
# 2. service/api/permission.ts (待改造)
# 3. signin/index.jsx (待改造)
```

---

## 故障排除

### 问题1: 登录后仍显示未授权

**原因**: 权限API仍返回Mock数据

**解决**:
```bash
# 检查 APP_BASE_URL 是否正确设置
echo $APP_BASE_URL

# 检查后端 /api/permissions/current 是否返回正确格式
curl -X GET http://localhost:3000/api/permissions/current \
  -H "Authorization: Bearer <token>" | jq .
```

### 问题2: 登出后权限缓存未清理

**原因**: permissionService.logoutCleanup() 未被调用

**解决**:
```typescript
// authService.logout() 中确保包含
try {
  permissionService.logoutCleanup()
} catch (e) {
  console.warn('权限清理失败:', e)
}
```

### 问题3: 权限码格式不匹配

**原因**: 前后端权限码定义不一致

**解决**:
```typescript
// permissionService.ts 中增加适配层
const normalizePermissionCode = (code: string): PermissionCode => {
  // 转换后端权限码到前端格式
  return code  // 或 code.replace(...) 等
}
```

---

## 验收标准

### 功能验收

- [ ] 用户能使用真实账号登录
- [ ] 权限系统从后端动态获取
- [ ] Mock数据完全移除
- [ ] 所有现有功能正常工作
- [ ] 权限检查结果与后端一致

### 性能验收

- [ ] 登录页加载 < 2s
- [ ] 权限获取 < 1s
- [ ] 路由权限检查 < 100ms
- [ ] localStorage 缓存有效

### 安全验收

- [ ] Token 正确传递 (Authorization header)
- [ ] 敏感信息不在localStorage暴露
- [ ] CSRF/XSS 防护完整
- [ ] 权限边界清晰

---

## 回滚计划

如果迁移出现问题，快速回滚:

```bash
# 恢复Mock模式
git checkout HEAD~1 workstation/src/service/api/permission.ts
git checkout HEAD~1 workstation/src/pages/signin/index.jsx
git checkout HEAD~1 workstation/src/service/authService.ts

# 或设置环境变量回到Mock
REACT_APP_USE_MOCK=true npm run start
```

---

## 时间预算

| 阶段 | 任务 | 时间 | 状态 |
|-----|------|------|------|
| 1 | 后端API验证 | 1h | ⏳ |
| 2 | 权限API改造 | 1-2h | ⏳ |
| 3 | 认证服务完善 | 2-3h | ⏳ |
| 4 | 登录页改造 | 1-2h | ⏳ |
| 5 | 环境配置 | 0.5h | ⏳ |
| 6 | 清理Mock | 0.5h | ⏳ |
| 7 | 测试验证 | 2-3h | ⏳ |
| **总计** | | **8-14h** | |

---

## 参考文档

- 详细分析: [INTERFACE_LOGIC_REVIEW.md](./INTERFACE_LOGIC_REVIEW.md)
- 内存笔记: `/root/.claude/projects/-www-CodeSpace-Veloxis/memory/MEMORY.md`
- API设计参考: `/root/.claude/projects/-www-CodeSpace-Veloxis/memory/API_INTERFACE_ANALYSIS.md`

---

## 联系与支持

有问题或需要帮助?

1. 检查 [INTERFACE_LOGIC_REVIEW.md](./INTERFACE_LOGIC_REVIEW.md) 故障排除章节
2. 查看后端API文档确认接口格式
3. 运行 `npm run test` 验证单元测试
4. 检查浏览器控制台 Network 标签查看请求

---

**准备好开始? 从第1步开始! 👉 [后端API验证](#第1步后端api验证-1小时)**
