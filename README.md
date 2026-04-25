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
| **Runtime** | Node.js >=22, TypeScript 5.9 |
| **API** | Express 5, Drizzle ORM, PostgreSQL 16 |
| **Frontend** | React 19, Vite 6, Tailwind CSS v4, Radix UI |
| **State** | Zustand 5, TanStack React Query 5 |
| **AI** | Anthropic Claude SDK (model generation, analysis, formula suggestions) |
| **Real-time** | Socket.IO 4.8 (presence, live cells, notifications) |
| **Formula Engine** | Custom DSL (lexer → parser → evaluator → DAG) |
| **Charts** | Recharts 3.8 |
| **Grid** | react-window 1.8 (virtualized) |
| **Auth** | jsonwebtoken + bcryptjs (cost 12), RBAC |
| **Exports** | ExcelJS 4.4, PDFKit 0.18, pptxgenjs 4.0 |
| **Email** | Nodemailer 8.0 |
| **Testing** | Vitest 3.2 (54 engine tests) |
| **Styling** | Windows 11 Fluent Design, dark mode, responsive |
| **Package Manager** | pnpm 10.6 with workspaces |

## Monorepo Packages

This project uses a **pnpm workspace** monorepo with 5 internal packages:

### `@planning-platform/web` — React Frontend
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Framework** | `react` | 19.0 | UI framework |
| | `react-dom` | 19.0 | DOM rendering |
| | `react-router` | 7.1 | Client-side routing |
| **Build** | `vite` | 6.0 | Dev server & bundler |
| | `@vitejs/plugin-react` | 4.3 | React Fast Refresh |
| | `tailwindcss` | 4.0 | Utility-first CSS |
| | `@tailwindcss/vite` | 4.0 | Tailwind Vite plugin |
| | `typescript` | 5.9-beta | Type checking |
| **State** | `zustand` | 5.0 | Global state (auth, theme, toast, undo) |
| | `@tanstack/react-query` | 5.62 | Server state & caching |
| **UI Components** | `@radix-ui/react-dialog` | 1.1 | Accessible modals |
| | `@radix-ui/react-dropdown-menu` | 2.1 | Dropdown menus |
| | `@radix-ui/react-select` | 2.1 | Select inputs |
| | `@radix-ui/react-tabs` | 1.1 | Tab navigation |
| | `@radix-ui/react-tooltip` | 1.1 | Tooltips |
| | `@radix-ui/react-toast` | 1.2 | Toast notifications |
| | `@radix-ui/react-popover` | 1.1 | Popovers |
| | `@radix-ui/react-context-menu` | 2.2 | Right-click menus |
| | `@radix-ui/react-switch` | 1.1 | Toggle switches |
| | `@radix-ui/react-avatar` | 1.1 | User avatars |
| | `@radix-ui/react-checkbox` | 1.3 | Checkboxes |
| | `@radix-ui/react-label` | 2.1 | Form labels |
| | `@radix-ui/react-separator` | 1.1 | Visual separators |
| | `@radix-ui/react-slot` | 1.1 | Component composition |
| **Styling** | `class-variance-authority` | 0.7 | Variant-based component styling |
| | `clsx` | 2.1 | Conditional classnames |
| | `tailwind-merge` | 2.6 | Merge Tailwind classes |
| **Icons** | `lucide-react` | 0.460 | 1000+ SVG icons |
| **Data Viz** | `recharts` | 3.8 | Charts (bar, line, pie, area, waterfall) |
| | `react-window` | 1.8 | Virtualized grid rendering |
| | `react-grid-layout` | 1.5 | Board widget layout |
| **Code Editor** | `codemirror` | 6.0 | Formula editor base |
| | `@codemirror/autocomplete` | 6.18 | Formula autocomplete |
| | `@codemirror/lang-javascript` | 6.2 | Syntax highlighting |
| | `@codemirror/language` | 6.10 | Language support |
| | `@codemirror/state` | 6.5 | Editor state |
| | `@codemirror/view` | 6.35 | Editor view |
| | `@lezer/highlight` | 1.2 | Syntax highlighting |
| | `@lezer/lr` | 1.4 | Parser framework |
| **Real-time** | `socket.io-client` | 4.8 | WebSocket client |

### `@planning-platform/api` — Express Backend
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Framework** | `express` | 5.1 | HTTP server |
| | `cors` | 2.8 | Cross-origin requests |
| **Database** | `drizzle-orm` | 0.44 | Type-safe ORM |
| **AI** | `@anthropic-ai/sdk` | 0.90 | Claude AI integration |
| **Auth** | `jsonwebtoken` | 9.0 | JWT token signing/verification |
| | `bcryptjs` | 3.0 | Password hashing (cost 12) |
| **Validation** | `zod` | 3.25 | Schema validation |
| **Exports** | `exceljs` | 4.4 | Excel (.xlsx) generation |
| | `pdfkit` | 0.18 | PDF generation |
| | `pptxgenjs` | 4.0 | PowerPoint generation |
| **Email** | `nodemailer` | 8.0 | Email notifications |
| **Real-time** | `socket.io` | 4.8 | WebSocket server |
| **Build** | `esbuild` | 0.25 | Production bundling |
| | `tsx` | 4.19 | Dev server (watch mode) |
| | `vitest` | 3.2 | Test runner |

### `@planning-platform/engine` — Formula DSL
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Build** | `typescript` | 5.9-beta | Compiler |
| **Testing** | `vitest` | 3.2 | 54 tests (lexer, parser, evaluator, DAG) |
| *Zero runtime dependencies* | | | Pure TypeScript engine |

### `@planning-platform/db` — Database Schema
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **ORM** | `drizzle-orm` | 0.44 | Schema definitions & queries |
| | `drizzle-zod` | 0.7 | Auto-generate Zod schemas from tables |
| | `drizzle-kit` | 0.31 | Migrations & schema push |
| **Driver** | `postgres` | 3.4 | PostgreSQL client (postgres.js) |
| **Validation** | `zod` | 3.25 | Schema validation |
| **IDs** | `@paralleldrive/cuid2` | 2.2 | Collision-resistant unique IDs |

### `@planning-platform/shared` — Shared Types
| Category | Package | Version | Purpose |
|----------|---------|---------|---------|
| **Validation** | `zod` | 3.25 | API input/output schemas |
| *Consumed by API + Web* | | | Single source of truth for types |

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
