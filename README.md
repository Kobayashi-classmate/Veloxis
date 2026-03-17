# Veloxis Analytics Platform (v1.0-alpha) 🚀

<p align="center">
  <b>English</b> | <a href="README-zh_CN.md">简体中文</a>
</p>

Veloxis is an enterprise-grade agile data analytics platform designed for "**Self-hosting, High concurrency, and Strict compliance**".

By leveraging the innovative **D/C/D (Directus / Cube.js / Doris)** hybrid architecture and a centralized **Data Worker** execution engine, Veloxis addresses the pain points of "mediocre performance, poor scalability, and security black boxes" commonly found in private-cloud BI tools. Veloxis is capable of ingesting millions of rows per second while supporting 500+ concurrent users for complex OLAP interactive analysis.

---

## 🌟 Key Features

- **🚀 Industrial-grade Throughput**: Powered by Doris Stream Load, benching **100,000 Excel rows in just 1.04s**.
- **🛡️ Iron-clad Security**: Built-in TOTP secondary verification, dynamic admin URL obfuscation, and JWT-based tenant-level row-locking.
- **🏗️ D/C/D Hybrid Infrastructure**: Seamlessly integrates Directus for administrative productivity, Cube.js for semantic flexibility, and Apache Doris for extreme computational power.
- **📦 Zero-dependency Self-hosting**: Fully Docker Compose compatible, utilizing SeaweedFS instead of MinIO to avoid licensing risks.
- **🤖 Automation Operators**: Orchestrate data processing logic via "Recipes", supporting official operators and restricted Python sandboxing.

---

## 🏗️ Architecture Deep Dive

Veloxis is powered by three industry-leading engines:

### 1. Control Plane: Directus
*   **Responsibility**: Identity (RBAC), Multi-tenancy, Audit logs, Metadata modeling, Task orchestration.
*   **Value**: Provides extreme management flexibility where all business entities (projects, versions, recipes) are unified.

### 2. Semantic & Acceleration: Cube.js
*   **Responsibility**: Unified metric definitions, Dynamic schema generation, Redis results caching, Query rate-limiting.
*   **Value**: Acts as a breakwater for 500+ concurrent requests, preventing backend overload and providing SQL-rewrite protection.

### 3. Storage & Analytics: Apache Doris
*   **Responsibility**: Massive detail/aggregate storage, Real-time OLAP, High-frequency stream ingestion.
*   **Value**: Features "Version-based Partitioning" supporting sub-second rollbacks and custom data retention policies.

### 4. Execution Engine: Data Worker
*   **Responsibility**: File parsing, Data cleaning, Metric calculation, Doris ingestion.
*   **Stack**: Built with Node.js/TypeScript and BullMQ, featuring streaming Excel-to-CSV processing to minimize memory footprint.

---

## 🛠️ Tech Stack Matrix

| Dimension | Technology |
| :--- | :--- |
| **Admin Console** | Directus (Vue) + PostgreSQL 15 |
| **Query Layer** | Cube.js + Redis 8.6 |
| **OLAP Engine** | Apache Doris 4.0.3-slim |
| **Storage** | SeaweedFS (S3 Compatible) |
| **Frontend** | React 18 + Webpack MF + Echarts + AntV S2 |
| **Task Queue** | BullMQ + Redis |
| **Security** | TOTP (RFC 6238) + Step-up Auth |

---

## 🏁 Progress Report

### 1. Infrastructure & Security [100%]
- [x] Full Docker Compose orchestration and network isolation.
- [x] Dynamic path gateway (Nginx random prefix).
- [x] TOTP binding and Step-up auth for high-risk operations.

### 2. Metadata & Data Flow [100%]
- [x] Physical modeling for Tenants / Projects / Datasets / Versions / Recipes.
- [x] Asset management via SeaweedFS with S3 protocol support.

### 3. Execution Engine (Data Worker) [85%]
- [x] **Doris Industrial Driver**: Encapsulated Stream Load with idempotency support.
- [x] **Turbo Charge**: Implemented streaming Excel-to-CSV converter.
- [x] **Async Scheduling**: BullMQ-based load balancing.

### 4. Roadmap 2026 Q2
- [ ] **Full-link Ignition**: Sync Data Worker tasks with Directus Flows.
- [ ] **Dynamic Modeling**: Automated Cube.js schema generation based on `project_id`.
- [ ] **Dashboard Marketplace**: Export layouts with cross-project data re-binding.

---

## 📦 Quick Start

### 1. Prerequisites
Ensure Docker Compose is installed.

### 2. Launch Cluster
```bash
git clone https://github.com/your-repo/veloxis.git
cd veloxis
docker compose up -d
```

### 3. Access
*   **Workstation**: `http://localhost:8080/`
*   **Admin Console**: `http://localhost:8080${ADMIN_BASE_PATH}` (Refer to `.env`)

---

## 📜 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
Any modification made to the system must be open-sourced if you provide a network service using this platform.
