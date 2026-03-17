# Veloxis Analytics Platform (v1.0-alpha)

Veloxis 是一套专为“自托管、高并发、强合规”设计的企业级敏捷数据分析平台。系统基于 **D/C/D (Directus / Cube.js / Doris)** 核心架构，通过自研的同构化 **Data Worker** 计算大坝，实现从原始数据到多维语义分析的全链路闭环。

---

## 🏗️ 核心架构：D/C/D 巨构

- **Control Plane (Directus)**: 负责多租户隔离、RBAC 权限、元数据建档及 Recipe 任务编排。
- **Semantic Layer (Cube.js)**: 统一指标定义层，提供高性能 GraphQL/REST API，支撑前端复杂透视分析。
- **Compute Engine (Data Worker)**: 基于 Node.js/TypeScript 的高性能计算节点，处理 S3 流式下钻、Excel 极速转换与 Doris 压力灌入。
- **Storage Engine (Apache Doris)**: 分布式 OLAP 存储引擎，承载毫秒级查询响应。

---

## 🚦 当前开发进展 (Progress Report)

目前系统已完成核心引擎的打通，具备了处理海量数据入库的工业级能力。

### 1. 基础设施与网关 [100%]
- [x] 基于 Docker Compose 的全组件编排（10+ 容器协同）。
- [x] Nginx 随机路径安全网关，通过环境变量动态隔离 Directus 管理后台。
- [x] SeaweedFS 对象存储初始化，支持 S3 协议对接。

### 2. 元数据模型 [100%]
- [x] 完成 `Projects` (多租户)、`Datasets`、`Dataset_Versions`、`Recipes` 物理表建模。
- [x] 建立元数据与 Doris 存储层的外键逻辑关联。

### 3. 数据计算引擎 (Data Worker) [85%]
- [x] **Doris 工业级驱动**: 实现支持 307 重定向与 `100-continue` 协议的 Stream Load 客户端。
- [x] **极速转换逻辑**: 内置 Excel-to-CSV 流式处理器。
- [x] **异步调度系统**: 集成 BullMQ + Redis 任务队列，支持横向扩展。
- [x] **性能指标验证**: **实测 100,000 行 Excel 数据入库耗时 1.04 秒**。

### 4. 待办计划 (Next Steps)
- [ ] **全链路点火**: 配置 Directus Flows 触发 Webhook 自动开启入库任务。
- [ ] **语义建模**: 编写 Cube.js Schema，实现基于 `project_id` 的行级数据安全拦截。
- [ ] **算子工厂**: 开发首批内置数据清洗算子（去重、脱敏、格式化）。

---

## 🛠️ 快速验证

### 1. 启动全量集群
```bash
docker compose up -d
```

### 2. 执行 10 万行数据压测
该脚本将读取 `/worker/test_file/test.xlsx`，并在 1 秒左右完成 Doris 入库。
```bash
docker exec veloxis_data_worker npx tsx src/excel-test.ts
```

### 3. 访问管理后台
访问路径：`http://localhost:8080${ADMIN_BASE_PATH}` (具体路径见 `.env`)

---

## 📜 许可证
本项目遵循 **GNU Affero General Public License v3.0 (AGPL-3.0)**。
