# Veloxis Analytics Platform - 前端接口文档 (API Reference)

## 架构说明 & 基础配置

**Backend Architect** 提供的核心接口文档。系统采用后端微服务架构（Directus + Cube.js + Doris），为了解决跨域和统一鉴权，所有前端网络请求统一经过 Nginx 反向代理层转发。

### 基础环境
- **本地开发域名/网关**: `http://localhost:8080` (取决于 docker-compose 暴露的端口)
- **线上环境域名**: (以实际生产环境为准)
- **网关路由规则 (Nginx)**:
  - `/api/*` ➡️ 指向控制面后台微服务 (Directus API)。
  - `/cubejs-api/*` ➡️ 指向分析加速层 (Cube.js API)。

### 鉴权规范 (Authentication)
除登录和部分公开接口外，所有请求必须在 HTTP Header 中携带 Access Token。
```http
Authorization: Bearer <your_access_token>
```

#### 租户与多项目上下文
系统采用基于 `project_id` 的多租户数据隔离机制。在调用涉及特定项目数据的业务和分析接口时，需在 Header 传递上下文（尤其是请求 Cube.js 接口）：
```http
X-Project-Id: <uuid-of-project>
X-Tenant-Id: <uuid-of-tenant>
```

---

## 一、 认证与授权模块 (Authentication)

认证服务由 Directus 提供，挂载于 `/api/auth/` 路径下。

### 1. 账号密码登录
**Endpoint**: `POST /api/auth/login`
**Description**: 获取系统的短期 Access Token 和长期 Refresh Token。

**Request Body** (application/json):
```json
{
  "email": "user@example.com",
  "password": "your_secure_password"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "access_token": "ey...",
    "expires": 900000, 
    "refresh_token": "d2...",
    "id_token": "..." 
  }
}
```
*(注意：`expires` 单位通常为毫秒，建议在过期前 1-2 分钟使用 refresh_token 刷新)*

### 2. 刷新 Token
**Endpoint**: `POST /api/auth/refresh`
**Description**: 使用 Refresh Token 获取新的 Access Token（无感刷新）。建议前端在 `axios` 的 response interceptor 中统一拦截 401 错误并自动调用此接口。

**Request Body** (application/json):
```json
{
  "refresh_token": "d2...",
  "mode": "json"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "access_token": "ey...",
    "expires": 900000,
    "refresh_token": "new_refresh_token"
  }
}
```

### 3. 注销登录 (Logout)
**Endpoint**: `POST /api/auth/logout`
**Description**: 登出并作废当前的 Refresh Token。

**Request Body** (application/json):
```json
{
  "refresh_token": "d2..."
}
```

**Response** (200 OK - Empty Data)

### 4. 单点登录/第三方登录跳转 (SSO)
**Endpoint**: `GET /api/auth/login/:provider` (例如 `:provider` 为 `github` / `google`)
**Description**: 引导用户浏览器跳转至该 URL 进行第三方鉴权。鉴权成功后将回调至前台 `AuthCallback` 组件并附带相关 Token 或 code。

---

## 二、 用户模块 (Users)

### 1. 获取当前登录用户信息
**Endpoint**: `GET /api/users/me`
**Description**: 获取当前访问者的用户资料及权限（Role）。

**Headers**:
- `Authorization: Bearer <access_token>`

**Query Parameters** (Directus 支持通过 `fields` 过滤查询字段):
- `?fields=id,first_name,last_name,email,role.name,avatar`

**Response** (200 OK):
```json
{
  "data": {
    "id": "e2da1577-4dfb-402a-9ab1-bf3d573bb1a6",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@example.com",
    "role": {
      "name": "Administrator"
    },
    "avatar": "95a7504e-4f51-40be-bd32-cc5a5196f3c1"
  }
}
```

---

## 三、 业务模型数据 (Metadata & Control Plane)

通过控制面（Directus `/api/items/*`）读取系统核心表信息。这里是典型的 RESTful 格式，支持丰富的 filter 与 fields 参数。

### 1. 获取用户所属项目列表 (Projects)
**Endpoint**: `GET /api/items/projects`
**Description**: 获取当前用户有权访问的所有项目空间。

**Headers**:
- `Authorization: Bearer <access_token>`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "project_uuid_1",
      "name": "电商核心分析库",
      "description": "电商订单、用户行为等核心数仓",
      "created_at": "2026-03-20T10:00:00Z"
    }
  ]
}
```

### 2. 获取项目下的数据集定义 (Datasets)
**Endpoint**: `GET /api/items/datasets?filter[project_id][_eq]=<project_uuid>`
**Description**: 获取特定项目下的数据模型定义与表元数据。

---

## 四、 OLAP 数据分析查询模块 (Semantic/Cube.js)

数据分析接口走的是 Cube.js (Semantic & Acceleration) 服务，请求挂载在 Nginx `/cubejs-api/` 路径下。

### 1. 执行分析查询 (Query Data)
**Endpoint**: `POST /cubejs-api/v1/load`
**Description**: 执行多维分析查询（聚合、下钻、切片等），自动击中 Redis 缓存或路由到 Doris MPP 引擎。

**Headers**:
- `Authorization: <access_token>` *(需与 Cube 配置验证方式一致，通常也是 JWT)*
- `X-Project-Id: <uuid-of-project>` *(必须，用于多租户路由与行级权限限制)*

**Request Body** (application/json):
```json
{
  "query": {
    "measures": ["Orders.count", "Orders.totalAmount"],
    "dimensions": ["Orders.status", "Orders.createdAt.day"],
    "timeDimensions": [{
      "dimension": "Orders.createdAt",
      "dateRange": ["2026-03-01", "2026-03-20"]
    }],
    "filters": [
      {
        "member": "Users.country",
        "operator": "equals",
        "values": ["CN"]
      }
    ]
  }
}
```

**Response** (200 OK):
```json
{
  "query": { /* original query */ },
  "data": [
    {
      "Orders.status": "completed",
      "Orders.createdAt.day": "2026-03-20T00:00:00.000",
      "Orders.count": 1420,
      "Orders.totalAmount": 156000.50
    }
  ],
  "annotation": {
    "measures": {
      "Orders.count": {
        "title": "订单数量",
        "type": "number"
      }
    }
  }
}
```

### 2. 获取数据模型元数据 (Meta)
**Endpoint**: `GET /cubejs-api/v1/meta`
**Description**: 获取 Cube.js 中定义的所有 Measure(指标)、Dimension(维度) 以及 Cube 列表，通常用于构建前端的可视化拖拽 Builder。

**Headers**:
- `X-Project-Id: <uuid-of-project>`

**Response** (200 OK):
```json
{
  "cubes": [
    {
      "name": "Orders",
      "title": "订单表",
      "measures": [
        {
          "name": "Orders.count",
          "title": "总订单数",
          "type": "number"
        }
      ],
      "dimensions": [ ... ]
    }
  ]
}
```

---

## 五、 数据管道与任务状态 (Data Worker)

此类接口控制后台 ETL 执行引擎的状态，通常也是通过 Directus 控制面作为网关代理或存储中转。

### 1. 触发数据摄入/同步
**Endpoint**: `POST /api/items/jobs`
**Description**: 往控制面写入一条 Job 记录，后台 Webhook 触发 Data Worker 执行数据清洗与 Doris 写入任务。

**Request Body**:
```json
{
  "type": "excel_ingestion",
  "dataset_id": "uuid-dataset-id",
  "file_id": "uuid-seaweedfs-file-id"
}
```

## 六、 附录：错误码与异常处理标准

后端统一采用标准 HTTP Status Code，所有的业务逻辑错误会在 Response Body 的 `errors` 数组中透出。

```json
{
  "errors": [
    {
      "message": "Invalid credentials.",
      "extensions": {
        "code": "INVALID_CREDENTIALS"
      }
    }
  ]
}
```

**常见拦截处理（Axios Interceptors 规范）**:
- **401 Unauthorized**: Token 过期或无效。触发静默刷新 `/api/auth/refresh`。如果刷新失败，清空本地状态并重定向至 `/login`。
- **403 Forbidden**: 用户权限不足（如试图访问无权限的项目）。提示“无权限访问”。
- **404 Not Found**: 资源不存在（API 或 数据记录）。
- **400 Bad Request**: 表单验证失败。根据 `errors[0].extensions.code` 进行高亮。
- **500 / 502 / 504**: 服务器内部错误或代理超时。提示“网络异常，请稍后重试”。

---
*文档版本: 1.0.0*  
*维护者: Backend Architect Agent*
