# Planning Platform

Enterprise business planning platform with multidimensional formula engine, AI-powered modeling, real-time collaboration, and operational modules — built for the African market and global SMBs.

**Prickly Pair Studios** · Cape Town, South Africa

## Overview

A Pigment-class planning platform at a fraction of the cost. Build financial models, workforce plans, fleet operations, and custom dashboards with a powerful formula engine, drag-and-drop boards, and AI assistance.

### Key Features

- **Formula Engine** — 22+ built-in functions, DAG dependency tracking, cycle detection
- **Multidimensional Grid** — Virtualized pivot grid with inline editing, drag-and-drop dimension assignment
- **AI Modeler & Analyst** — Describe models in English, get auto-generated blocks + formulas (Anthropic Claude)
- **AI Formula Suggestions** — Sparkles button in formula bar suggests/improves formulas contextually
- **Forecasting** — Linear, moving average, and exponential smoothing with confidence intervals
- **Anomaly Detection** — Z-score based detection with severity-tinted cells and hover badges
- **Board Designer** — Drag-and-drop widget layout with 2/3/4 column grids, chart/KPI/grid/text widgets
- **Real-time Collaboration** — Socket.IO presence tracking, live cell updates, cursor positions
- **Version Control** — Budget, Forecast, Actuals, Reforecast with clone and lock
- **Scenario Management** — Lightweight what-if overlays
- **Workflow Automation** — Trigger/action engine for business process automation
- **19 Operational Modules** — HR, recruitment, fleet, finance, compliance, training, engagement
- **Modules Marketplace** — Subscribe to module packs with PayFast/Stripe billing
- **Data Connectors** — CSV, Excel, Google Sheets, REST API, PostgreSQL, MySQL (Xero/Sage coming soon)
- **Command Palette** — Cmd+K global search across apps, blocks, dimensions, boards
- **Keyboard Shortcuts** — Grid navigation, undo/redo (Ctrl+Z/Ctrl+Shift+Z), shortcut help modal
- **Comments & Mentions** — Cell-level comments with orange triangle indicators, @mentions
- **Notifications** — In-app bell + WebSocket push notifications
- **Multi-format Export** — CSV, JSON, PNG, Excel, PDF, PowerPoint
- **Onboarding Wizard** — 5-step guided walkthrough for new users
- **Dark Mode** — Full theme system with light/dark/system toggle
- **Mobile Responsive** — Collapsible sidebar, responsive grids, 44px touch targets
- **Windows 11 Fluent Design** — Mica/acrylic materials, rounded-3xl cards, backdrop-blur, soft shadows

## Project Structure

```
planning-platform/
├── artifacts/
│   ├── api/                Express 5 REST API (20+ route files, 7 services)
│   │   ├── src/
│   │   │   ├── routes/     API endpoints (apps, blocks, cells, boards, AI, billing...)
│   │   │   ├── services/   Business logic (AI, forecasting, anomaly, exports, realtime)
│   │   │   └── middleware/  Auth, tenant isolation, permissions, audit logging
│   │   └── tsconfig.json
│   └── web/                React 19 SPA (Vite + Tailwind v4)
│       └── src/
│           ├── components/  46 components across 20 directories
│           │   ├── ai/      AI chat, forecast panel, anomaly badges
│           │   ├── charts/  Chart widget (6 types), KPI cards
│           │   ├── grid/    Virtualized cell grid with comments + anomalies
│           │   ├── formula/ CodeMirror formula bar with AI suggestions
│           │   ├── pivot/   Drag-and-drop pivot configuration
│           │   ├── import/  CSV import wizard
│           │   ├── export/  Multi-format export dropdown
│           │   ├── onboarding/ 5-step onboarding wizard
│           │   ├── layout/  App shell, responsive sidebar
│           │   ├── ui/      14 Radix-based UI primitives
│           │   └── ...      Command palette, notifications, comments, permissions
│           ├── pages/       15 core pages + 19 module pages
│           ├── hooks/       5 root hooks + 19 library hooks
│           ├── stores/      4 Zustand stores (auth, theme, toast, undo)
│           └── lib/         API client, utilities, icon map, shortcuts
├── lib/
│   ├── engine/             Formula DSL (lexer → parser → evaluator → DAG)
│   │   └── src/            54 tests passing
│   ├── db/                 Drizzle ORM schema + migrations
│   │   └── src/schema/     Tenancy, blocks, views, modules
│   └── shared/             Zod schemas + shared types
├── package.json            pnpm workspace root
└── pnpm-workspace.yaml
```

## Build Progress

### Phase 1 — Core Engine ✅
- Formula DSL with 22+ built-in functions (SUM, AVG, IF, COALESCE, string functions...)
- DAG-based dependency tracking with cycle detection
- 4 block types: Metric, Dimension List, Transaction List, Table
- Auth + multi-tenancy (JWT + bcrypt, workspace isolation)
- 54 engine tests passing

### Phase 2 — Planning Features ✅
- Version management (Budget/Forecast/Actuals with clone + lock)
- Scenario overlays for what-if analysis
- Drag-and-drop board designer with full widget library
- Chart widgets (bar, line, waterfall, pie, area, combined, KPI)
- Page selectors (global board filters)
- Comments with @mentions
- Notifications (in-app + WebSocket)

### Phase 3 — AI Intelligence ✅
- AI Modeler Agent (describe in English → auto-build model)
- AI Analyst Agent (ask questions → get charts/insights)
- AI Formula Suggestions (contextual suggestions in formula bar)
- Statistical forecasting (linear, moving average, exponential smoothing)
- Anomaly detection with severity-tinted grid cells

### Phase 4 — Enterprise ✅
- Data connectors (CSV, Excel, Google Sheets, REST API, PostgreSQL, MySQL)
- Workflow automation (trigger/action engine)
- Environment management (dev/prod)
- Fine-grained permissions + audit trail
- Multi-format export (CSV, JSON, PNG, Excel, PDF, PowerPoint)

### Phase 5 — Real-Time & Polish ✅
- WebSocket real-time layer (Socket.IO): live cell updates, presence, cursors
- Command palette (Cmd+K): global search
- Keyboard shortcuts with help modal
- Undo/redo with 50-entry stack + toolbar buttons
- Dark mode with flash prevention
- Notification center with unread badges
- Onboarding wizard (5-step guided setup)
- Mobile responsive layout
- Windows 11 Fluent Design system

### Phase 6 — Operational Modules ✅
- 19 module pages: recruitment pipeline, candidates, interviews, jobs, vehicles, drivers, trips, fuel logs, repairs, tyres, fines, employees, leave requests, performance reviews, documents, training, certificates, compliance, surveys
- Modules Marketplace with 9 module packs (R 999 – R 9,999/mo)
- PayFast/Stripe billing integration
- Billing management in settings (subscriptions, invoices, usage)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run engine tests
cd lib/engine && pnpm test

# Set up database
cp .env.example .env    # Edit DATABASE_URL
pnpm db:push            # Apply schema to PostgreSQL

# Start API server
pnpm dev:api            # Express on :3001

# Start frontend
cd artifacts/web && pnpm dev   # Vite on :5173
```

### Default Login
```
Email:    zubeid.hendricks@gmail.com
Password: password123
Workspace: pps
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js, TypeScript 5.9 |
| **API** | Express 5, Drizzle ORM, PostgreSQL 16 |
| **Frontend** | React 19, Vite, Tailwind CSS v4, Radix UI |
| **State** | Zustand, React Query (TanStack Query) |
| **AI** | Anthropic Claude (model generation, analysis, formula suggestions) |
| **Real-time** | Socket.IO (presence, live cells, notifications) |
| **Formula Engine** | Custom DSL (lexer → parser → evaluator → DAG) |
| **Charts** | Recharts |
| **Grid** | react-window (virtualized) |
| **Auth** | JWT + bcrypt (cost 12), RBAC |
| **Exports** | ExcelJS, PDFKit, pptxgenjs |
| **Testing** | Vitest (54 engine tests) |
| **Styling** | Windows 11 Fluent Design, dark mode, responsive |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React 19 SPA                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Pivot    │ │ Board    │ │ Formula  │ │ AI     │ │
│  │ Grid     │ │ Designer │ │ Bar      │ │ Chat   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │          React Query + Zustand Stores            ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────┘
                      │ REST + WebSocket
┌─────────────────────▼───────────────────────────────┐
│                 Express 5 API                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Auth &   │ │ Block &  │ │ AI &     │ │ Real-  │ │
│  │ Tenant   │ │ Cell     │ │ Forecast │ │ time   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │           Formula Engine (DAG)                   ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────┐
│              PostgreSQL 16                           │
│  Workspaces · Apps · Blocks · Cells · Dimensions    │
│  Boards · Views · Versions · Scenarios · Modules    │
└─────────────────────────────────────────────────────┘
```

## Market

- **Target**: $12.2B FP&A market (11.2% CAGR)
- **Pricing**: R 8,500 – R 85,000/month (vs Pigment's $100-500K/year)
- **Focus**: African market first, then global SMBs
- **Differentiator**: AI-native, vertical templates, 10x lower price

## License

Proprietary — Prickly Pair Studios (Pty) Ltd
