# Veloxis

<p align="center">
  <b>English</b> | <a href="README-zh_CN.md">简体中文</a>
</p>

Veloxis is a self-hosted analytics platform for organizations that need strong control over data, permissions, and execution.

It provides a project-based workspace for dataset ingestion, processing, modeling, visualization, and controlled extension through plugins.

## What Veloxis Is

Veloxis is designed for teams that want to:

- keep analytics infrastructure inside their own environment
- manage projects, datasets, versions, recipes, and workbooks in one platform
- combine governance and semantic modeling with high-throughput ingestion
- evolve toward trusted AI analytics without giving up permission boundaries

This project is not trying to be a full data governance suite. The current V1 baseline is focused on one closed loop:

`ingest -> version -> process -> model -> analyze -> present`

## Platform Capabilities

### 1. Project Workspace

- project-based navigation and analysis context
- separate spaces for datasets, models, recipes, and workbooks
- support for multi-project collaboration

### 2. Dataset Management

- upload CSV / TXT / Excel files
- track dataset versions and ingestion status
- manage field mapping, storage names, and display labels
- preserve processing history for later tracing

### 3. Processing and Recipes

- run ingestion and processing through worker-driven jobs
- define recipe-based transformation logic
- prepare data for downstream analytics and workbook usage

### 4. Modeling and Query

- organize model-ready datasets by project
- expose a semantic query path for analysis use cases
- support future model and join workflows inside the platform

### 5. Workbooks and Visualization

- build project-level workbooks and analysis pages
- support chart-oriented exploration and interactive analysis
- evolve toward reusable workbook patterns and templates

### 6. Access Control and Governance

- tenant and project access boundaries
- RBAC-oriented control model
- version and audit-friendly product structure

### 7. Controlled Extensibility

- official plugins for high-change capabilities
- controlled custom extensions for specific deployments
- plugin direction without turning core security and governance into plugins

## Typical Workflow

1. Create or enter a project workspace.
2. Upload source files and create dataset records.
3. Track ingestion progress and dataset versions.
4. Configure recipe logic when processing is needed.
5. Explore models and run analytics queries.
6. Build workbooks for presentation and repeated analysis.

## Who It Is For

- Data teams that need self-hosted analytics
- Organizations with strict internal access boundaries
- Teams that want one platform for ingestion, processing, modeling, and presentation
- Teams preparing for trusted AI analytics on governed data

## Product Direction

### AI

Veloxis is being positioned as an AI-ready analytics foundation.

The direction is not generic chat-first BI. The direction is trusted analytics where AI capabilities are tied to governed datasets, version context, and project boundaries.

### Plugins

Veloxis is also moving toward a controlled plugin model.

The goal is to keep core platform capabilities stable while making high-change features pluggable.

## Current Product Baseline

The current documented baseline is V1.

V1 focuses on:

- stable deployment and core services
- authentication and project-scoped access boundaries
- dataset ingestion, version tracking, and worker execution
- first-generation models, recipes, and workbook flows

V1 explicitly does not treat open third-party plugin marketplaces as an in-scope promise.

## Repository Layout

```text
. 
├── conf/           Runtime config for Nginx, Cube, and Doris
├── data/           Local volumes and runtime state
├── plugins/        Plugin workspace, conventions, and sample plugins
├── scripts/        Bootstrap and maintenance scripts
├── worker/         Data Worker (Node.js / TypeScript)
└── workstation/    React workstation
```

## Quick Start

### Prerequisites

- Docker
- Docker Compose

### Start the stack

```bash
git clone <your-repo-url>
cd Veloxis
docker compose up -d
```

### Default access

- Workstation: `http://localhost:8080/`
- Admin Console: `http://localhost:8080${ADMIN_BASE_PATH}`

`ADMIN_BASE_PATH` is defined in `.env`.

### Stop the stack

```bash
docker compose down
```

## Development Entry Points

### Frontend

```bash
cd workstation
npm run dev:vite
```

### Worker

```bash
cd worker
npm run dev
```

## License

Veloxis is licensed under the GNU Affero General Public License v3.0 (`AGPL-3.0`).

If you modify the system and provide it as a network service, the AGPL obligations apply.
