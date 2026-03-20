# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Veloxis Analytics Platform** is an enterprise-grade agile data analytics platform designed for self-hosting, high concurrency, and strict compliance. It uses a D/C/D hybrid architecture: **Directus** (control plane), **Cube.js** (semantic & acceleration), and **Apache Doris** (storage & analytics), with a centralized **Data Worker** execution engine.

The monorepo contains two main applications:
- **workstation**: React 19 frontend (pro-react-admin based)
- **worker**: Node.js/TypeScript data processing engine with BullMQ job scheduling

## Repository Structure

```
veloxis/
├── workstation/          # Frontend application (React 19)
│   ├── src/
│   │   ├── components/   # Reusable UI components (stateless, stateful, hooks)
│   │   ├── pages/        # Route-based page components
│   │   ├── routers/      # Route configuration
│   │   ├── service/      # API services and request layer
│   │   ├── config/       # Configuration files
│   │   ├── mock/         # Mock data for development
│   │   ├── utils/        # Utility functions
│   │   ├── styles/       # Global styles
│   │   ├── theme/        # Theme configuration
│   │   └── index.tsx     # Application entry point
│   ├── webpack/          # Webpack configuration
│   ├── vite.config.ts    # Vite configuration
│   ├── package.json      # Frontend dependencies
│   └── tsconfig.json     # TypeScript configuration
├── worker/               # Data processing engine (Node.js/TypeScript)
│   ├── src/
│   │   ├── config/       # Configuration
│   │   ├── jobs/         # BullMQ job handlers
│   │   ├── services/     # Business logic (Doris driver, Excel parsing)
│   │   ├── utils/        # Utility functions
│   │   └── index.ts      # Application entry point
│   ├── package.json      # Backend dependencies
│   └── tsconfig.json     # TypeScript configuration
├── conf/                 # Docker Compose configuration
├── data/                 # Data directory for volumes
├── docker-compose.yml    # Full stack orchestration
├── .env                  # Environment variables (template)
├── README.md             # Project documentation
└── DEVELOPMENT_ROADMAP.md # Architecture and roadmap notes
```

## Common Commands

### Frontend (workstation)

**Development**
- `npm run start` - Start dev server with Webpack (main project)
- `npm run start:projectA` - Start projectA (multi-project mode)
- `npm run start:projectB` - Start projectB (multi-project mode)
- `npm run dev:vite` - Start dev server with Vite
- `npm run dev:vite:projectA` - Start projectA with Vite

**Build**
- `npm run build:production` - Build for production (Webpack)
- `npm run build:production:projectB` - Build specific project
- `npm run build:vite` - Build with Vite
- `npm run build:vite:projectB` - Build specific project with Vite

**Testing & Quality**
- `npm run test` - Run Jest tests + coverage
- `npm run test:jest` - Run Jest tests only
- `npm run test:watch` - Run Jest in watch mode
- `npm run test:e2e` - Run Playwright E2E tests
- `npm run lint` - Check code style (ESLint, Stylelint, Prettier)
- `npm run lint:fix` - Auto-fix all linting issues

**Other**
- `npm run preview:vite` - Preview production build
- `npm run serve:dist` - Serve production build locally
- `npm run storybook` - Start Storybook component docs (port 6006)
- `npm run build:lib` - Build component library (@w.ui/wui-react)

### Backend (worker)

**Development**
- `npm run dev` - Start with hot reload (tsx watch)
- `npm run start` - Build and run (requires build first)

**Build**
- `npm run build` - Compile TypeScript to JavaScript

## Architecture & Key Technologies

### Frontend Stack
- **Framework**: React 19 with TypeScript 5
- **UI Library**: Ant Design v6
- **Build Tools**: Webpack v5 + Vite v7 (dual mode)
- **Styling**: Less, Tailwind CSS
- **State Management**: Zustand
- **Testing**: Jest + Playwright
- **Routing**: React Router v7
- **Linting**: ESLint + Prettier + Stylelint

### Backend Stack
- **Runtime**: Node.js with TypeScript
- **Job Queue**: BullMQ (Redis-backed)
- **Data Processing**:
  - Excel parsing (XLSX library + streaming CSV conversion)
  - Doris Stream Load integration (idempotent ingestion)
  - AWS S3 client for file storage (SeaweedFS compatible)
- **Database**: MySQL2 for metadata
- **Logging**: Pino

### Frontend Architecture
- **Multi-project mode**: Use `PROJECT=<name>` env var to build multiple projects from single codebase
- **Path aliases**: `@app`, `@components`, `@hooks`, `@pages`, `@routers`, `@utils`, `@theme` (see `tsconfig.json`)
- **Module Federation**: Webpack MFE support for shell + remote projects
- **Component library**: Components can be independently published as `@w.ui/wui-react` NPM package

### Authentication Flow
- OAuth integration (GitHub example in config)
- TOTP-based step-up authentication for sensitive operations
- JWT-based tenant-level row-locking
- Permission system with RBAC support

### Service Layer
- Centralized API service with request interceptors
- Concurrent request control, auto-retry, duplicate prevention
- Global error handling with message deduplication

## Important Configuration Files

**Frontend**
- `src/config/` - App configuration, auth settings
- `src/routers/` - Route definitions with permission guards
- `src/service/` - API request layer and service methods
- `vite.config.ts` / `webpack/` - Build configuration
- `.env.development` / `.env.dev` - Environment variables

**Backend**
- `worker/src/config/` - Redis, database, Doris configuration
- `worker/src/jobs/` - BullMQ job processor definitions
- `worker/src/services/` - Doris driver and file processing logic

## Development Workflow

### Adding a Page
1. Create component in `src/pages/<feature>/`
2. Add route to `src/routers/modules/` (e.g., `auth.routes.jsx`)
3. Add permission check in route guards if needed

### Adding a Component
- Place in `src/components/stateless/` (no state) or `src/components/stateful/` (with state)
- Add TypeScript types
- Can be exported to library via `src/components/index.ts`

### Adding an API Endpoint
1. Create service method in `src/service/` (e.g., `userService.ts`)
2. Use centralized `request` module for HTTP calls
3. Export from service index for consumption in components

### Multi-Project Mode
- Create `src/projects/<projectName>/` directory
- Add `index.tsx` entry point (can reuse main entry logic)
- Optionally add `routers/` to override main routing
- Build with: `npm run build:production:projectName`
- Start with: `npm run start:projectName`

## Git Workflow & Commit Conventions

- **Conventional commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format
- **Branches**: Feature branches from `main`
- **Pre-commit hooks**: Automatic linting + formatting via Husky
- **Commitizen**: Use `git cz` for interactive commit messages if preferred

Examples:
- `feat(workstation): add dark mode toggle`
- `fix(worker): handle malformed CSV in streaming parser`
- `docs(api): update authentication flow diagram`
- `chore: update dependencies`

## Key Development Notes

### Frontend
- **Path aliases must match**: Keep `vite.config.ts`, `webpack/paths.js`, and `tsconfig.json` paths in sync
- **Component exports**: Use `src/components/index.ts` to maintain export registry for library publishing
- **Mock data**: Use MSW (Mock Service Worker) in `src/mock/` for development without backend
- **KeepAlive caching**: Tabs use CSS visibility (not DOM removal) for performance
- **Responsive**: Mobile-first design, test on breakpoints

### Backend
- **Stream Load idempotency**: Doris ingestion includes version tracking for safe retries
- **Excel streaming**: Large files processed via CSV stream to minimize memory
- **Job scheduling**: BullMQ handles async processing; check Redis connection for job queue health
- **Error handling**: Comprehensive logging via Pino; check logs for data ingestion failures

## Testing

- **Unit tests**: `npm run test:jest`
- **E2E tests**: `npm run test:e2e` (Playwright, located in `tests/` directory)
- **Coverage**: `npm run test:coverage` generates coverage reports

## Performance & Optimization

- **Bundle analysis**: `npm run analyze:build` (Webpack) or `USE_ANALYZE=1 npm run build:vite`
- **Lighthouse**: `npm run lighthouse` (requires dev server running)
- **Component library publishing**: Pre-built library reduces bundle size in consuming apps

## Deployment

- **Docker Compose**: Full stack in `docker-compose.yml` (Directus, Cube.js, Doris, Redis, SeaweedFS)
- **Frontend production**: `npm run build:production && npm run serve:dist`
- **Backend**: Node.js service behind load balancer (handles data worker tasks)
- **Environment**: See `.env` file for required variables (API keys, database credentials)

## Troubleshooting

**Build fails with path alias errors**: Ensure `tsconfig.json`, `vite.config.ts`, and `webpack/paths.js` are synchronized

**Tests timeout**: Increase Jest timeout in `jest.config.js` or check for hanging network requests

**Hot reload not working**: Restart webpack dev server; check for file watcher limits (`ulimit -n`)

**Worker jobs stuck**: Check Redis connection and BullMQ board; ensure database credentials are correct

## Resources

- Main README: [README.md](README.md)
- Frontend specifics: [workstation/README.md](workstation/README.md)
- Development roadmap: [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)
- Frontend roadmap: [FRONTEND_ROADMAP.md](FRONTEND_ROADMAP.md)
- Repository: https://github.com/your-repo/veloxis
