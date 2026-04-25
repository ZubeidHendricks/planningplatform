# Planning Platform

Enterprise business planning platform with multidimensional formula engine, pivot grids, and scenario management.

**Prickly Pair Studios** | [Architecture Doc](/home/zubeid/phase1-architecture.md)

## Project Structure

```
planning-platform/
├── artifacts/
│   ├── api/          Express 5 REST API
│   └── web/          React 19 SPA (not started)
├── lib/
│   ├── engine/       Formula DSL engine (lexer, parser, evaluator, DAG) ✅
│   ├── db/           Drizzle ORM schema + migrations ✅
│   ├── shared/       Zod schemas + shared types ✅
│   ├── api-spec/     OpenAPI specification (not started)
│   └── api-client-react/  Orval-generated React Query hooks (not started)
```

## Build Progress

### Phase 1 — Core Engine (Weeks 1-8)

#### COMPLETED
- [x] Monorepo scaffold (pnpm workspaces, artifacts/ + lib/ pattern)
- [x] Root configs (tsconfig.base.json, .gitignore, .env.example)
- [x] **Formula Engine (lib/engine)** — the core IP
  - [x] Lexer: tokenizes numbers, strings, booleans, identifiers, operators, modifiers ([BY SUM:], [FILTER:], etc.)
  - [x] Parser: recursive descent, full operator precedence, function calls, IF expressions, modifier chains
  - [x] Evaluator: arithmetic, comparisons, logical ops, string concat, 20+ built-in functions (SUM, AVG, MIN, MAX, ROUND, SQRT, POWER, string functions, COALESCE, etc.)
  - [x] DAG Manager: dependency tracking, dirty propagation, topological sort, cycle detection
  - [x] FormulaEngine: orchestrates parse → validate → extract deps → recalculate
  - [x] **54 tests passing** (lexer: 11, parser: 16, evaluator: 15, DAG: 7, engine: 5)
- [x] **Database Schema (lib/db)**
  - [x] Tenancy: workspaces, users, workspace_members, applications
  - [x] Blocks: blocks (metric/dimension_list/transaction_list/table), dimensions, dimension_members, block_dimensions, cells (EAV with JSONB coordinates), block_dependencies
  - [x] Views: views (pivot config), boards (widget layout), versions (budget/forecast/actuals)
  - [x] Drizzle Kit config for migrations
- [x] **Shared Types (lib/shared)** — Zod schemas for all API inputs
- [x] **API Server (artifacts/api)**
  - [x] Express 5 app with health check
  - [x] Auth routes: register (bcrypt cost 12, creates workspace), login (JWT)
  - [x] Auth middleware (JWT verification)
  - [x] Tenant middleware (workspace slug resolution + membership check)
  - [x] Block CRUD routes with formula validation and dependency tracking
  - [x] Cell routes with value persistence and DAG recalculation

- [x] **Applications CRUD routes** (create, list, update, delete apps in a workspace)
- [x] **Dimensions CRUD routes** (create/list dimensions, add/remove members, assign dimensions to blocks)
- [x] **Views CRUD routes** (save/load pivot configurations per block)
- [x] **Boards CRUD routes** (create boards, update widget layouts)
- [x] **Versions/Scenarios routes** (create/list/lock budget/forecast/actuals versions)
- [x] **Shared Zod schemas** (validation for views, boards, versions, block-dimensions)
- [x] **Express 5 type fixes** (param helper for `string | string[]` params, JWT signing)

#### TODO — Next Steps
- [ ] Run `pnpm db:push` against a real PostgreSQL database to apply schema
- [ ] Verify API server starts (`pnpm dev:api`)
- [ ] OpenAPI spec (lib/api-spec/openapi.yaml)
- [ ] Orval codegen setup (lib/api-client-react)
- [ ] Frontend scaffold (artifacts/web) — React 19 + Vite + Tailwind v4
- [ ] Grid component (virtualized, pivotable)
- [ ] Formula editor (CodeMirror with autocomplete)
- [ ] Board builder (react-grid-layout)

## Quick Start

```bash
# Install dependencies
pnpm install

# Run engine tests
cd lib/engine && pnpm test

# Start API (requires PostgreSQL)
cp .env.example .env  # Edit DATABASE_URL
pnpm db:push          # Apply schema
pnpm dev:api          # Start Express server on :3001
```

## Tech Stack

- Node.js 24, TypeScript 5.9, Express 5
- Drizzle ORM + drizzle-zod, PostgreSQL 16
- React 19, Vite, Tailwind CSS v4, Radix UI
- Zustand + Orval-generated React Query hooks
- JWT + bcrypt (cost 12), subdomain-based multi-tenancy
- Vitest (unit), Playwright (E2E)
- esbuild for API production builds
