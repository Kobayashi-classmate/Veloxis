# Veloxis Analytics Platform - 平台开发路径图 (Development Roadmap)

## 📌 项目概述 (Project Overview)
Veloxis 是一套专为“数据密集型交互、高并发访问、强安全合规”设计的自托管（Self-Hosted）企业级敏捷数据分析平台。采用核心的 **D/C/D (Directus / Cube.js / Doris)** 混合架构，辅以集中式的 **Data Worker** 执行引擎。

---

## 🚀 当前总体开发进度 (Current Progress Summary)
**当前阶段：后端闭环验证已全部完成，[阶段五] 进行中。**
核心 D/C/D 架构已贯通。从 Directus 用户操作 -> 触发 Webhook -> Data Worker 解析与 Doris 高并发入库 -> 动态生成 Cube.js Schema -> CubeStore 预聚合与租户级权限管控，整个端到端生命周期已经得到程序化验证。前端工作台脚手架已搭建，数据源管理核心业务视图已上线。

---

## 🗺️ 详细开发路径规划 (Detailed Roadmap)

### 🟢 阶段一：基础设施与底层架构基建 (Infrastructure & Core Setup)
**状态：已完成 (Done)**
本阶段目标是确保所有底层组件在完全内网隔离的环境下成功启动，并建立起基础的通信网络。
- [x] **容器化编排 (Docker Compose)**: 编写并调优 `docker-compose.yml`，管理所有服务的启动拓扑。
- [x] **对象存储替换**: 使用开源无版权包袱的 SeaweedFS 替代 MinIO，配置 S3 兼容 API。
- [x] **OLAP 引擎就绪**: 部署 Apache Doris (FE & BE 节点)，建立高性能列式存储基础。
- [x] **语义层与控制面就绪**: 启动 Directus (结合 PostgreSQL) 和 Cube.js (结合 Redis 与 CubeStore)。
- [x] **异步处理基建**: 启动基于 Node.js/TypeScript 和 BullMQ 的 Data Worker 引擎。
- [x] **网关配置**: 启动 Nginx 作为统一流量入口 (监听 8080 端口)。

### 🟢 阶段二：数据摄入与处理管道 (Data Ingestion & Processing)
**状态：核心完成 (Core Done)**
本阶段目标是实现业务数据的极速导入、清洗与入库。
- [x] **基础解析测试**: 编写基础脚本（如 `excel-test.ts`）测试千万级/十万级 Excel/CSV 文件的解析。
- [x] **对象存储集成**: 实现用户上传文件至 SeaweedFS，Worker 从 SeaweedFS 拉取文件流。
- [x] **高吞吐入库 (Stream Load)**: 完善 Data Worker 到 Doris 的 HTTP Stream Load 机制，确保高并发写入的稳定性与错误重试机制。
- [x] **任务调度与队列 (BullMQ)**: 完善文件解析、数据清洗、数据入库任务的队列化管理，实现任务状态追踪（Pending, Processing, Completed, Failed）。
- [ ] **自动化清洗队列 (Automation Queue)**: 设计并开发基础的数据清洗算子（过滤、映射、聚合）。

### 🟢 阶段三：语义加速层映射 (Semantic Layer & Query Acceleration)
**状态：核心完成 (Core Done)**
本阶段目标是连接前端与 Doris，实现动态数据建模与查询加速。
- [x] **Cube.js Doris 方言适配**: 确保 Cube.js 能够正确将逻辑查询下推翻译为 Doris 优化的 SQL。
- [x] **两级缓存体系建设**: 成功打通 Redis 结果缓存和 CubeStore 预聚合引擎，实现针对大盘数据的 Rollup 缓存。
- [x] **动态 Schema 生成**: 根据 Directus 中维护的元数据与业务表结构，通过 Data Worker 动态生成并挂载至 `conf/cube/model/` 中的数据模型（Cubes），支持热重载。
- [x] **多租户数据隔离**: 在 Cube.js 的查询上下文中强制注入 `project_id` 等租户标识，并在 `queryRewrite` 中拦截和绑定行级数据隔离。

### 🟢 阶段四：控制面与企业级安全铁幕 (Control Plane & Security)
**状态：后端完成 (Backend Done)**
本阶段目标是利用 Directus 构建坚不可摧的元数据管理和系统权限控制。
- [x] **Directus 初始模型化**: 编写并执行初始化脚本 (`init-directus.mjs`, `init-relations.mjs`)，创建项目所需的核心集合和字段。
- [x] **元数据工作流 (Flows/Webhooks)**: 构建了基于 Directus Flows 的数据上报管道，触发 Data Worker 异步工作流。
- [ ] **多租户与 RBAC 体系整合**: 建立表级/行级权限策略，确保用户仅可访问其被授权的数据和看板。
- [ ] **高级安全特性**: 实现 TOTP (时间一次性密码) 二步验证机制（高危操作拦截）。

### 🟡 阶段五：前端可视化与业务交互层 (Frontend & Presentation)
**状态：进行中 (In Progress)**
本阶段目标是提供敏捷、流畅、现代化的数据分析工作台 (Workstation)。
- [x] **工作台脚手架搭建**: 搭建前端 React/TypeScript 项目框架，接入 Directus JWT 鉴权与 Cube.js 客户端上下文。
- [x] **数据源与数据集管理 UI**: 提供可视化的文件上传、数据集定义、清洗队列连通界面。
- [ ] **动态图表与看板构建器**: 基于 Cube.js API，提供丰富的可视化图表组件，支持拖拽布局。
- [ ] **模板复用系统 (Template Dashboard)**: 实现看板布局和指标逻辑的脱敏保存与跨项目一键克隆复用功能。

---

## 📈 下一步行动建议 (Next Action Items)
1. **清洗算子研发**: 为 Data Worker 增加数据转换（如字段重命名、类型强转）的 ETL 算子支持。
2. **动态图表构建器**: 开发前端仪表盘的可视化组件，与动态生成的 Cube.js Schema 进行联调。