# 前端接口逻辑梳理总结

> 🎯 **目标**: 完全抛弃Mock数据，集成真实后端API
> 📅 **生成时间**: 2026-03-20
> 📊 **状态**: 已完成详细分析

---

## 快速导航

| 文档 | 用途 | 阅读时间 |
|-----|------|---------|
| **INTEGRATION_CHECKLIST.md** | 📌 **优先阅读** - 7步迁移指南 | 15分钟 |
| **INTERFACE_LOGIC_REVIEW.md** | 完整分析报告 - 深度参考 | 30分钟 |
| **内存笔记** | 关键信息摘要 | 5分钟 |

---

## 核心问题

**当前状态**: 
- ❌ 权限系统100%依赖Mock数据 (`src/mock/permission.ts`)
- ❌ 登录页硬编码4个测试账号
- ❌ authService缺少login/logout/refresh方法
- ❌ 权限映射在前端维护

**目标状态**:
- ✅ 权限系统后端驱动
- ✅ 真实用户认证
- ✅ 完整认证流程
- ✅ 权限动态管理

---

## Mock数据依赖关系

```
src/mock/permission.ts (硬编码Mock数据)
│
├─→ src/pages/signin/index.jsx (testAccounts)
│   └─ 4个演示账号快速填充
│
├─→ src/service/api/permission.ts (mockGetUserPermissions/mockGetRoles)
│   └─ 100% Mock权限返回
│
└─→ src/service/permissionService.ts (routePermissionMap)
    └─ 权限-路由映射
```

**影响范围**: 5个文件需要改造/删除

---

## 后端接口需求

### 必须实现 (P0)
```
POST /api/auth/login
  Request: { email, password, totp? }
  Response: { code: 0, data: { token, user, expiresIn } }

GET /api/permissions/current
  Response: { code: 0, data: { userId, roles[], permissions[], routes[] } }

POST /api/auth/logout
  Response: { code: 0, message: "登出成功" }
```

### 可选但推荐 (P1)
```
POST /api/auth/refresh
GET /api/roles
```

---

## 4阶段迁移方案

### Phase 1: 权限API去Mock化 (1-2h)
- 修改: `src/service/api/permission.ts`
- 改为: 直接调用 `/api/permissions/current`
- 验证: 权限正确返回

### Phase 2: 认证服务完善 (2-3h)
- 增加: `authService.login(email, password, totp?)`
- 增加: `authService.logout()`
- 增加: `authService.refreshToken()`
- 集成: request拦截器处理401

### Phase 3: 登录页改造 (1-2h)
- 删除: testAccounts快速填充
- 改为: 真实登录表单
- 增加: OAuth快速登录

### Phase 4: 清理Mock (0.5-1h)
- 删除: `src/mock/permission.ts`
- 移除: 所有mock导入
- 验证: 无Mock依赖残留

**总耗时: 8-14小时**

---

## 关键改动点

| 文件 | 改动 | 优先级 |
|-----|------|--------|
| `service/api/permission.ts` | 移除Mock判断, 直接调用后端 | P1 |
| `authService.ts` | 增加login/logout/refresh | P1 |
| `pages/signin/index.jsx` | 删除testAccounts, 真实表单 | P1 |
| `permissionService.ts` | 移除mock导入 | P2 |
| `mock/permission.ts` | **删除** | P3 |

---

## 验收标准

- [ ] 用户能使用真实账号登录
- [ ] 权限系统从后端动态获取
- [ ] Mock数据完全移除
- [ ] 所有现有功能正常工作
- [ ] 权限检查结果与后端一致
- [ ] 登录、权限检查性能<1s

---

## 如何开始

### 第1步: 阅读清单 (5分钟)
```bash
# 打开该文件
less INTEGRATION_CHECKLIST.md
```

### 第2步: 验证后端 (1小时)
```bash
# 确认后端API已实现
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

### 第3步: 按步迁移 (1-2天)
```bash
# 按INTEGRATION_CHECKLIST.md的7个步骤依次进行
```

### 第4步: 测试验证 (2-3小时)
```bash
npm run test
npm run test:e2e
```

---

## 相关文档

| 位置 | 文件名 | 大小 | 用途 |
|-----|--------|------|------|
| 项目根 | `INTEGRATION_CHECKLIST.md` | 9KB | **快速启动** |
| 项目根 | `INTERFACE_LOGIC_REVIEW.md` | 17KB | 完整分析 |
| 内存 | `MEMORY.md` | 3KB | 摘要 |
| 内存 | `API_INTERFACE_ANALYSIS.md` | 6KB | 深度参考 |

---

## 故障排除

**登录后仍显示未授权?**
- 检查 `APP_BASE_URL` 环境变量
- 检查后端 `/api/permissions/current` 响应格式
- 查看浏览器控制台错误

**权限缓存未清理?**
- 确保 `permissionService.logoutCleanup()` 被调用
- 检查 localStorage 是否正确清空

**权限码格式不匹配?**
- 确认前后端权限码定义一致
- 在 `permissionService.ts` 中增加适配层

---

## 时间表

| 周 | 任务 | 状态 |
|----|------|------|
| Week 1 | 后端API设计验证 | ⏳ 待启动 |
| Week 2 | Phase 1-2 实施 | ⏳ 待启动 |
| Week 3 | Phase 3-4 + 测试 | ⏳ 待启动 |
| Week 4 | 文档更新 + UAT | ⏳ 待启动 |

---

## 预期收益

✅ 完全抛弃硬编码数据  
✅ 权限系统与后端完全同步  
✅ 支持多用户真实认证  
✅ 代码库更干净、可维护  
✅ 为生产环境做好准备  

---

## 下一步行动

1. **立即**: 阅读 `INTEGRATION_CHECKLIST.md`
2. **今天**: 确认后端API已实现
3. **本周**: 开始Phase 1迁移

---

**准备好了? 打开 `INTEGRATION_CHECKLIST.md` 开始迁移! 🚀**
