# Veloxis Analytics Platform

<p align="center">
  <b>English</b> | <a href="README-zh_CN.md">简体中文</a>
</p>

**Veloxis** is an extensible, secure, and high-performance next-generation analytics platform designed for on-premise and self-hosted environments.

It features a micro-kernel architecture where all data processing, ingestion, and visualization capabilities are implemented through controlled plugins. Powered by **Apache Doris** as the core OLAP engine, Veloxis is built to support high-performance data exploration with 500+ concurrent users.

---

## ✨ Core Features

- **🔌 Fully Pluggable Architecture**: Every feature is a plugin (supporting arbitrary code/dependencies). Global management by administrators; per-project activation/deactivation.
- **🏗️ Secure Sandboxing**: Plugins run in isolated containers with egress disabled by default. All capabilities must be explicitly declared and authorized by administrators.
- **📊 High-Performance OLAP**: Native integration with Apache Doris, optimized for large-scale metrics analysis with dynamic dimensions (JSON/VARIANT).
- **🔄 Automation Recipes**: A unique "Record & Replay" mechanism for data processing. Users can define a sequence of processing steps (Recipes) and decide whether to execute them upon manual data updates.
- **🛡️ Enterprise-Grade Security**:
  - **Invite-only**: Public registration is disabled by default.
  - **Built-in MFA**: TOTP 2FA + Recovery Codes.
  - **Step-up Authentication**: High-risk operations (e.g., plugin modification, policy changes) require "Password + TOTP".
  - **Path Obfuscation**: Installation generates a random admin path prefix without the word "admin".

---

## 🏗️ Core Architecture

Veloxis follows the "Micro-kernel + Plugin Runtime" design principle:

1.  **Veloxis Core (API)**: Manages multi-tenancy, RBAC auditing, DatasetVersion management, and plugin lifecycle.
2.  **Plugin Runtime**: Container-based controlled execution environment ensuring third-party code does not compromise system stability.
3.  **Doris Storage**: Hosts Staging/Serving/Metrics layers with support for dynamic dimensions.
4.  **Recipe Engine**: Responsible for version control of data processing queues and asynchronous job scheduling.

---

## 🚀 Quick Start (v1)

### Requirements
- Docker 20.10+ & Docker Compose 2.0+
- Recommended: 16GB+ RAM (to run Doris and the plugin isolation pool)

### Deployment Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/Kobayashi-classmate/veloxis.git
   cd veloxis
   ```
2. Initialize environment variables (the system generates a random admin path):
   ```bash
   cp .env.example .env
   # Check ADMIN_BASE_PATH in .env
   ```
3. Start:
   ```bash
   docker compose up -d
   ```
4. Initialization:
   Visit `http://localhost:port/<your-random-prefix>/setup` to complete the Bootstrap Admin registration.

---

## 🗺️ Roadmap (v1)

### v1.0 - Core Backbone (Current Goal)
- [ ] **Infrastructure**: Plugin global upload/project activation, TOTP + Step-up 2FA, random admin path.
- [ ] **Data Flow**: Manual CSV/Excel import, Doris tiered storage, fixed schema validation.
- [ ] **Automation**: Pluggable processing operators, Automation Queue (Recipe) editor & manual trigger.
- [ ] **Analytics**: Built-in core chart set, Dashboard template export/import (field re-binding).

### v2.0 - Scale & Extension
- [ ] **Advanced Processing**: Multi-language script modules (Python/Node), Real-time CDC ingestion.
- [ ] **Performance**: Doris clustering support, automated materialized views & pre-aggregation.
- [ ] **Governance**: Automated Data Quality checks, End-to-end data lineage.

### Future Perspectives
- [ ] **AI-Powered**: Natural Language Analytics (NL2SQL).
- [ ] **Marketplace**: Support for third-party developers to submit controlled plugins.

---

## 🤝 Contribution & Feedback

We welcome community participation in refining the Veloxis security backbone and operator ecosystem:

1. **Issue Tracking**: Report security vulnerabilities, performance bottlenecks, or feature suggestions.
2. **Plugin Development**: Refer to `[Plugin Contract & Spec v1]` in the documentation to write professional operators or charts.
3. **Security Auditing**: As the platform allows arbitrary code execution, we welcome penetration testing feedback on our sandbox isolation.

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

