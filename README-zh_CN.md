# Veloxis Analytics Platform (v1.0-alpha) 🚀

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

Veloxis 是一套专为“**自托管、高并发、强合规**”设计的企业级敏捷数据分析平台。

系统采用创新的 **D/C/D (Directus / Cube.js / Doris)** 混合架构，通过同构化的 **Data Worker** 计算大坝，解决了传统 BI 工具在私有化部署场景下“性能平庸、扩展性差、安全黑盒”的痛点。Veloxis 能够秒级处理百万级原始数据入库，并支撑 500+ 用户同时进行复杂的 OLAP 交互分析。

---

## 🌟 核心特性 (Key Features)

- **🚀 工业级吞吐**: 利用 Doris Stream Load 协议，实测 10 万行 Excel 入库仅需 1.04 秒。
- **🛡️ 铁幕安全隔离**: 内置 TOTP 二次验证、管理后台路径动态加固、基于 JWT 的租户级行锁隔离。
- **🏗️ D/C/D 混合架构**: 完美融合了 Directus 的管控生产力、Cube.js 的语义层灵活性与 Doris 的极致算力。
- **📦 零依赖自托管**: 适配 Docker Compose，抛弃所有带协议风险的组件（如 MinIO 换为 SeaweedFS），一键私有化部署。
- **🤖 自动化算子**: 通过 Recipe（配方）模式编排数据处理逻辑，支持官方算子与受限 Python 脚本执行。

---

## 🏗️ 架构深度解析 (Architecture Deep Dive)

Veloxis 的核心是由三个顶尖引擎构成的闭环：

### 1. 控制面 (Control Plane): Directus
*   **职责**: 身份验证 (RBAC)、多租户隔离、审计日志、元数据建模、任务编排。
*   **价值**: 提供了极致的管控灵活性，所有业务实体（项目、版本、算子）均由 Directus 统一管理。

### 2. 语义与加速层 (Semantic Layer): Cube.js
*   **职责**: 统一指标定义、动态 Schema 生成、Redis 结果缓存、并发查询限流。
*   **价值**: 作为 500+ 并发的防波堤，确保复杂的分析请求不会击穿底层数据库，并提供租户级的 SQL 重写保护。

### 3. 存储与计算引擎 (OLAP Engine): Apache Doris
*   **职责**: 海量明细/聚合存储、实时 OLAP 分析、高频流式写入。
*   **价值**: 采用“版本分区（Version-based Partition）”设计，支持数据秒级回滚与自定义保留策略。

### 4. 计算大坝 (Execution Engine): Data Worker
*   **职责**: 文件解析、字段清洗、指标计算、Doris 灌入。
*   **技术**: 基于 Node.js/TypeScript 与 BullMQ，支持流式 Excel 转换，极大降低内存开销。

---

## 🛠️ 技术栈矩阵 (Tech Stack)

| 维度 | 技术选型 |
| :--- | :--- |
| **管控后台** | Directus (Vue) + PostgreSQL 15 |
| **查询层** | Cube.js + Redis 8.6 |
| **分析引擎** | Apache Doris 4.0.3-slim |
| **对象存储** | SeaweedFS (S3 Compatible) |
| **前端终端** | React 18 + Webpack MF + ECharts + AntV S2 |
| **任务队列** | BullMQ + Redis |
| **安全方案** | TOTP (RFC 6238) + Step-up Auth |

---

## 🏁 开发进度 (Progress Report)

### 1. 基础设施与安全 [100%]
- [x] Docker Compose 全组件编排与网络隔离。
- [x] 动态路径安全网关（Nginx 随机前缀）。
- [x] TOTP 绑定与高危操作二次验证逻辑。

### 2. 元数据与数据流 [100%]
- [x] 租户/项目/数据集/版本/配方 物理建模。
- [x] SeaweedFS 资产管理与 S3 协议对接。

### 3. 计算引擎 (Data Worker) [85%]
- [x] **Doris 工业级驱动**: 封装 Stream Load，支持幂等写入。
- [x] **极速转换**: 实现 Excel-to-CSV 流式处理器。
- [x] **异步调度**: BullMQ 任务队列平衡负载。

### 4. 2026 Q2 路线图 (Roadmap)
- [ ] **全链路点火**: Directus Flows 同步驱动 Worker 任务。
- [ ] **动态建模**: 跑通基于 `project_id` 的 Cube.js Schema 自动生成。
- [ ] **模板复用**: 开发看板布局导出与跨项目重绑定功能。

---

## 📦 快速开始 (Quick Start)

### 1. 环境准备
确保宿主机已安装 Docker Compose。

### 2. 启动集群
```bash
git clone https://github.com/your-repo/veloxis.git
cd veloxis
docker compose up -d
```

### 3. 访问系统
*   **商务终端**: `http://localhost:8080/`
*   **管理后台**: `http://localhost:8080${ADMIN_BASE_PATH}` (具体见 `.env`)

---

## 📜 许可证 (License)

本项目遵循 **GNU Affero General Public License v3.0 (AGPL-3.0)** 协议。
这意味着在任何通过网络提供服务的场景下，您必须开源对本系统进行的修改部分。
