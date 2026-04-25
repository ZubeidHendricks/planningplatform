import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import { createDb } from '@planning-platform/db';
import { FormulaEngine } from '@planning-platform/engine';
import { createAuthRouter } from './routes/auth.js';
import { createApplicationsRouter } from './routes/applications.js';
import { createBlocksRouter } from './routes/blocks.js';
import { createCellsRouter } from './routes/cells.js';
import { createDimensionsRouter } from './routes/dimensions.js';
import { createViewsRouter } from './routes/views.js';
import { createBoardsRouter } from './routes/boards.js';
import { createVersionsRouter } from './routes/versions.js';
import { createScenariosRouter } from './routes/scenarios.js';
import { createTemplatesRouter } from './routes/templates.js';
import { createWorkspaceRouter } from './routes/workspace.js';
import { createCommentsRouter } from './routes/comments.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createAIRouter } from './routes/ai.js';
import { createAnalyticsRouter } from './routes/analytics.js';
import { createPermissionsRouter } from './routes/permissions.js';
import { createAuditRouter } from './routes/audit.js';
import { createWorkflowsRouter } from './routes/workflows.js';
import { createExportsRouter } from './routes/exports.js';
import { createEnvironmentsRouter } from './routes/environments.js';
import { createSearchRouter } from './routes/search.js';
import { createModulesRouter } from './routes/modules.js';
import { WorkflowEngine } from './services/workflow-engine.js';
import { RealtimeService } from './services/realtime.js';
import { auditMiddleware } from './middleware/audit.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/planning_platform';

const db = createDb(DATABASE_URL);
const engine = new FormulaEngine();
const workflowEngine = new WorkflowEngine(db);

const app = express();
const httpServer = createServer(app);
const realtime = new RealtimeService(httpServer);

app.use(cors());
app.use(express.json());
app.use(auditMiddleware(db));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', createAuthRouter(db));
app.use('/api', createApplicationsRouter(db));
app.use('/api', createBlocksRouter(db, engine));
app.use('/api', createCellsRouter(db, engine, workflowEngine, realtime));
app.use('/api', createDimensionsRouter(db));
app.use('/api', createViewsRouter(db));
app.use('/api', createBoardsRouter(db));
app.use('/api', createVersionsRouter(db, workflowEngine));
app.use('/api', createScenariosRouter(db));
app.use('/api', createTemplatesRouter(db));
app.use('/api', createWorkspaceRouter(db));
app.use('/api', createCommentsRouter(db));
app.use('/api', createNotificationsRouter(db));
app.use('/api', createAIRouter(db, engine));
app.use('/api', createAnalyticsRouter(db));
app.use('/api', createPermissionsRouter(db));
app.use('/api', createAuditRouter(db));
app.use('/api', createWorkflowsRouter(db));
app.use('/api', createExportsRouter(db));
app.use('/api', createEnvironmentsRouter(db));
app.use('/api', createSearchRouter(db));
app.use('/api', createModulesRouter(db));

httpServer.listen(PORT, () => {
  console.log(`Planning Platform API running on port ${PORT}`);
});

export { realtime };
export default app;
