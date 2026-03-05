# Veloxis Analytics Platform

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

---

**Veloxis** 是一款专为自建环境（On-premise / Self-hosted）打造的、高扩展性与高安全性的下一代数据分析平台。

它采用微内核（Micro-kernel）架构，将所有数据处理、接入与展示能力通过“受控插件”实现。内置 **Apache Doris** 作为核心 OLAP 引擎，旨在支撑 500+ 并发下的高性能数据探索。

---

## ✨ 核心特性

- **🔌 全插件化架构**：功能模块即插件（支持任意代码/依赖）。管理员全局上传/卸载，项目按需独立启停。
- **🏗️ 强隔离安全沙箱**：插件在独立容器中运行，默认禁止出网。所有能力调用需明文声明并经管理员授权。
- **📊 高性能分析存储**：内置 Apache Doris，专为大规模动态维度指标（Metrics）分析优化，支持天级聚合。
- **🔄 自动化处理队列 (Recipe)**：独特的“操作录制与回放”机制。用户可自定义数据清洗步骤队列，在手动更新数据后自主决定是否回放。
- **🛡️ 深度安全防护**：
  - **Invite-only**：默认关闭开放注册。
  - **MFA 内置**：TOTP 两步验证 + 恢复码。
  - **Step-up 二次确认**：高危操作（如修改插件、变更策略）强制要求“密码 + TOTP”。
  - **地址隐匿**：安装时随机生成不含“admin”词语的后台路径前缀。

---

## 🏗️ 核心架构

Veloxis 遵循“微内核 + 插件运行时”的设计原则：

1.  **Veloxis Core (API)**：负责多租户隔离、RBAC 审计、数据集版本（DatasetVersion）管理与插件生命周期。
2.  **Plugin Runtime**：基于容器化的受控执行环境，确保第三方代码不影响宿主系统稳定性。
3.  **Doris Storage**：承载 Staging/Serving/Metrics 三层分析数据，支持 JSON/VARIANT 动态维度。
4.  **Recipe Engine**：负责数据处理队列的版本控制与异步作业调度。

---

## 🚀 快速开始 (v1)

### 环境要求
- Docker 20.10+ & Docker Compose 2.0+
- 建议配置：16GB+ RAM (用于运行 Doris 与插件隔离池)

### 部署步骤
1. 克隆仓库：
   ```bash
   git clone https://github.com/your-repo/veloxis.git
   cd veloxis
   ```
2. 初始化环境变量（系统将自动生成随机后台访问前缀）：
   ```bash
   cp .env.example .env
   # 检查并确认 .env 中的 ADMIN_BASE_PATH 随机值
   ```
3. 启动：
   ```bash
   docker compose up -d
   ```
4. 初始化：
   访问 `http://localhost:port/<your-random-prefix>/setup` 完成首个管理员（Bootstrap Admin）注册。

---

## 🗺️ 路线图 (Roadmap)

### v1.0 - 核心基座与闭环 (当前目标)
- [ ] **底座能力**：插件全局上传/项目启停、TOTP + Step-up 二次确认、随机后台路径。
- [ ] **数据流**：CSV/Excel 手动导入、Doris 分层存储、固定 Schema 校验。
- [ ] **自动化**：数据处理算子插件化、Automation Queue (Recipe) 编辑与手动触发。
- [ ] **分析展示**：内置基础图表集、看板模板导出/导入（字段重绑定）。

### v2.0 - 性能与扩展
- [ ] **进阶处理**：多语言脚本处理模块 (Python/Node)、实时 CDC 数据接入。
- [ ] **性能增强**：Doris 集群化部署支持、物化视图与预聚合自动化。
- [ ] **治理增强**：自动化数据质量校验 (Data Quality)、全链路数据血缘。

### 未来展望
- [ ] **AI 增强**：基于大模型的辅助分析 (NL2SQL)。
- [ ] **生态市场**：支持第三方开发者提交受控插件的 Marketplace。

---

## 🤝 贡献与反馈

我们欢迎社区参与并共同完善 Veloxis 的安全底座与算子生态：

1. **提交 Issue**：发现安全漏洞、性能瓶颈或功能建议请及时反馈。
2. **编写插件**：请参考文档库中的 `[插件合同与规范 v1]` 编写专业的数据处理算子或图表。
3. **安全审计**：由于平台支持执行任意代码，我们欢迎针对沙箱隔离能力的渗透测试建议。

---

## 📜 许可证 (License)

本项目遵循 **GNU Affero General Public License v3.0 (AGPL-3.0)**。

