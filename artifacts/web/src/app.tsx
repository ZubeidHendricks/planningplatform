import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { LoginPage } from '@/components/auth/login-page';
import { RegisterPage } from '@/components/auth/register-page';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout/app-layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { ToastContainer } from '@/components/toast-container';
import { ShortcutHelp } from '@/components/shortcuts/shortcut-help';
import { CommandPalette } from '@/components/command-palette/command-palette';

const Dashboard = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.Dashboard })));
const ApplicationsPage = lazy(() => import('@/pages/applications').then((m) => ({ default: m.ApplicationsPage })));
const AppDetailPage = lazy(() => import('@/pages/app-detail').then((m) => ({ default: m.AppDetailPage })));
const BlockDetailPage = lazy(() => import('@/pages/block-detail').then((m) => ({ default: m.BlockDetailPage })));
const BoardDetailPage = lazy(() => import('@/pages/board-detail').then((m) => ({ default: m.BoardDetailPage })));
const BlocksTab = lazy(() => import('@/pages/blocks-tab').then((m) => ({ default: m.BlocksTab })));
const DimensionsTab = lazy(() => import('@/pages/dimensions-tab').then((m) => ({ default: m.DimensionsTab })));
const BoardsTab = lazy(() => import('@/pages/boards-tab').then((m) => ({ default: m.BoardsTab })));
const VersionsTab = lazy(() => import('@/pages/versions-tab').then((m) => ({ default: m.VersionsTab })));
const ScenariosTab = lazy(() => import('@/pages/scenarios-tab').then((m) => ({ default: m.ScenariosTab })));
const WorkflowsTab = lazy(() => import('@/pages/workflows-tab').then((m) => ({ default: m.WorkflowsTab })));
const TemplatesPage = lazy(() => import('@/pages/templates').then((m) => ({ default: m.TemplatesPage })));
const MarketplacePage = lazy(() => import('@/pages/marketplace').then((m) => ({ default: m.MarketplacePage })));
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })));
const IntegrationsPage = lazy(() => import('@/pages/integrations').then((m) => ({ default: m.IntegrationsPage })));
const AuditLogPage = lazy(() => import('@/pages/audit-log').then((m) => ({ default: m.AuditLogPage })));
const PipelinePage = lazy(() => import('@/pages/modules/pipeline').then((m) => ({ default: m.PipelinePage })));
const CandidatesPage = lazy(() => import('@/pages/modules/candidates').then((m) => ({ default: m.CandidatesPage })));
const InterviewsPage = lazy(() => import('@/pages/modules/interviews').then((m) => ({ default: m.InterviewsPage })));
const JobsPage = lazy(() => import('@/pages/modules/jobs').then((m) => ({ default: m.JobsPage })));
const VehiclesPage = lazy(() => import('@/pages/modules/vehicles').then((m) => ({ default: m.VehiclesPage })));
const DriversPage = lazy(() => import('@/pages/modules/drivers').then((m) => ({ default: m.DriversPage })));
const TripsPage = lazy(() => import('@/pages/modules/trips').then((m) => ({ default: m.TripsPage })));
const FuelLogsPage = lazy(() => import('@/pages/modules/fuel-logs').then((m) => ({ default: m.FuelLogsPage })));
const RepairsPage = lazy(() => import('@/pages/modules/repairs').then((m) => ({ default: m.RepairsPage })));
const TyresPage = lazy(() => import('@/pages/modules/tyres').then((m) => ({ default: m.TyresPage })));
const FinesPage = lazy(() => import('@/pages/modules/fines').then((m) => ({ default: m.FinesPage })));
const LeaveRequestsPage = lazy(() => import('@/pages/modules/leave-requests').then((m) => ({ default: m.LeaveRequestsPage })));
const EmployeesPage = lazy(() => import('@/pages/modules/employees').then((m) => ({ default: m.EmployeesPage })));
const TrainingPage = lazy(() => import('@/pages/modules/training').then((m) => ({ default: m.TrainingPage })));
const PerformanceReviewsPage = lazy(() => import('@/pages/modules/performance-reviews').then((m) => ({ default: m.PerformanceReviewsPage })));
const DocumentsPage = lazy(() => import('@/pages/modules/documents').then((m) => ({ default: m.DocumentsPage })));
const CompliancePage = lazy(() => import('@/pages/modules/compliance').then((m) => ({ default: m.CompliancePage })));
const SurveysPage = lazy(() => import('@/pages/modules/surveys').then((m) => ({ default: m.SurveysPage })));
const CertificatesPage = lazy(() => import('@/pages/modules/certificates').then((m) => ({ default: m.CertificatesPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export function App() {
  return (
    <>
    <Suspense fallback={<PageLoader />}>
      <ErrorBoundary>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />

            {/* Workspace-scoped routes */}
            <Route path=":workspaceSlug/templates" element={<TemplatesPage />} />
            <Route path=":workspaceSlug/marketplace" element={<MarketplacePage />} />
            <Route path=":workspaceSlug/settings" element={<SettingsPage />} />
            <Route path=":workspaceSlug/integrations" element={<IntegrationsPage />} />
            <Route path=":workspaceSlug/audit" element={<AuditLogPage />} />
            <Route path=":workspaceSlug/apps" element={<ApplicationsPage />} />
            <Route path=":workspaceSlug/apps/:appSlug" element={<AppDetailPage />}>
              <Route index element={<BlocksTab />} />
              <Route path="dimensions" element={<DimensionsTab />} />
              <Route path="boards" element={<BoardsTab />} />
              <Route path="versions" element={<VersionsTab />} />
              <Route path="scenarios" element={<ScenariosTab />} />
              <Route path="workflows" element={<WorkflowsTab />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="candidates" element={<CandidatesPage />} />
              <Route path="interviews" element={<InterviewsPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="vehicles" element={<VehiclesPage />} />
              <Route path="drivers" element={<DriversPage />} />
              <Route path="trips" element={<TripsPage />} />
              <Route path="fuel-logs" element={<FuelLogsPage />} />
              <Route path="repairs" element={<RepairsPage />} />
              <Route path="tyres" element={<TyresPage />} />
              <Route path="fines" element={<FinesPage />} />
              <Route path="leave-requests" element={<LeaveRequestsPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="training" element={<TrainingPage />} />
              <Route path="performance-reviews" element={<PerformanceReviewsPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="compliance" element={<CompliancePage />} />
              <Route path="surveys" element={<SurveysPage />} />
              <Route path="certificates" element={<CertificatesPage />} />
            </Route>
            <Route
              path=":workspaceSlug/apps/:appSlug/blocks/:blockId"
              element={<BlockDetailPage />}
            />
            <Route
              path=":workspaceSlug/apps/:appSlug/boards/:boardSlug"
              element={<BoardDetailPage />}
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </Suspense>
    <ToastContainer />
    <ShortcutHelp />
    <CommandPalette />
    </>
  );
}
