import { useState } from 'react';
import { useParams, Link, Outlet, useLocation } from 'react-router';
import { useApp } from '@/lib/hooks/use-apps';
import { useAuthStore } from '@/stores/auth';
import { Blocks, Grid3X3, LayoutDashboard, GitBranch, GitCompare, Workflow, Shield, Users, Kanban, CalendarDays, Briefcase, Truck, UserCheck, MapPin, Fuel, Wrench, CircleDot, AlertTriangle, CalendarOff, ClipboardList, GraduationCap, Star, FileText, ShieldCheck, MessageSquare, Award } from 'lucide-react';
import { getAppIcon } from '@/lib/icon-map';
import { PermissionsPanel } from '@/components/permissions/permissions-panel';
import { PresenceBar } from '@/components/realtime/presence-bar';
import { useRealtimeSync } from '@/hooks/use-realtime';

const planningTabs = [
  { label: 'Blocks', path: '', icon: Blocks },
  { label: 'Dimensions', path: 'dimensions', icon: Grid3X3 },
  { label: 'Boards', path: 'boards', icon: LayoutDashboard },
  { label: 'Versions', path: 'versions', icon: GitBranch },
  { label: 'Scenarios', path: 'scenarios', icon: GitCompare },
  { label: 'Workflows', path: 'workflows', icon: Workflow },
];

type Tab = { label: string; path: string; icon: typeof Blocks };

const recruitmentTabs: Tab[] = [
  { label: 'Pipeline', path: 'pipeline', icon: Kanban },
  { label: 'Candidates', path: 'candidates', icon: Users },
  { label: 'Interviews', path: 'interviews', icon: CalendarDays },
  { label: 'Jobs', path: 'jobs', icon: Briefcase },
];

const hrOpsTabs: Tab[] = [
  { label: 'Employees', path: 'employees', icon: Users },
  { label: 'Leave', path: 'leave-requests', icon: CalendarOff },
  { label: 'Reviews', path: 'performance-reviews', icon: Star },
  { label: 'Documents', path: 'documents', icon: FileText },
];

const trainingTabs: Tab[] = [
  { label: 'Training', path: 'training', icon: GraduationCap },
  { label: 'Certificates', path: 'certificates', icon: Award },
];

const fleetCoreTabs: Tab[] = [
  { label: 'Vehicles', path: 'vehicles', icon: Truck },
  { label: 'Drivers', path: 'drivers', icon: UserCheck },
  { label: 'Trips', path: 'trips', icon: MapPin },
  { label: 'Fuel', path: 'fuel-logs', icon: Fuel },
  { label: 'Repairs', path: 'repairs', icon: Wrench },
];

const fleetComplianceTabs: Tab[] = [
  { label: 'Tyres', path: 'tyres', icon: CircleDot },
  { label: 'Fines', path: 'fines', icon: AlertTriangle },
];

const complianceTabs: Tab[] = [
  { label: 'Compliance', path: 'compliance', icon: ShieldCheck },
];

const engagementTabs: Tab[] = [
  { label: 'Surveys', path: 'surveys', icon: MessageSquare },
];

const moduleTabs: Record<string, Tab[]> = {
  'recruitment-pipeline': recruitmentTabs,
  'talent-acquisition': recruitmentTabs,
  'talent-pipeline': recruitmentTabs,
  'interview-analytics': recruitmentTabs,
  'offer-management': recruitmentTabs,
  'social-screening': recruitmentTabs,
  'workforce-planning': [...hrOpsTabs, ...recruitmentTabs],
  'workforce-intelligence': [...hrOpsTabs, ...recruitmentTabs],
  'employee-onboarding': hrOpsTabs,
  'compensation-benefits': hrOpsTabs,
  'hr-analytics': [...hrOpsTabs, ...recruitmentTabs],
  'succession-planning': [...hrOpsTabs, ...recruitmentTabs],
  'diversity-inclusion': [...hrOpsTabs, ...engagementTabs],
  'employee-wellness': [...hrOpsTabs, ...engagementTabs],
  'employee-engagement': [...hrOpsTabs, ...engagementTabs],
  'performance-management': [...hrOpsTabs, ...trainingTabs],
  'leave-management': hrOpsTabs,
  'payroll-planning': hrOpsTabs,
  'training-development': trainingTabs,
  'training-certification': trainingTabs,
  'communication-analytics': engagementTabs,
  'fleet-management': [...fleetCoreTabs, ...fleetComplianceTabs],
  'fuel-management': [...fleetCoreTabs, ...fleetComplianceTabs],
  'parts-inventory': [...fleetCoreTabs, ...fleetComplianceTabs],
  'repairs-maintenance': [...fleetCoreTabs, ...fleetComplianceTabs],
  'tyre-lifecycle': [...fleetCoreTabs, ...fleetComplianceTabs],
  'route-performance': [...fleetCoreTabs, ...fleetComplianceTabs],
  'weighbridge-ops': [...fleetCoreTabs, ...fleetComplianceTabs],
  'driver-compensation': [...fleetCoreTabs, ...fleetComplianceTabs],
  'fines-compliance': [...fleetCoreTabs, ...fleetComplianceTabs],
  'compliance-risk': complianceTabs,
  'document-management': [{ label: 'Documents', path: 'documents', icon: FileText }],
};

export function AppDetailPage() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: app, isLoading } = useApp(slug, appSlug ?? '');
  const location = useLocation();
  const [showPermissions, setShowPermissions] = useState(false);

  // Join the real-time room for this app
  useRealtimeSync(slug, appSlug);

  const basePath = `/${slug}/apps/${appSlug}`;
  const currentTab = location.pathname.replace(basePath, '').replace(/^\//, '').split('/')[0] ?? '';

  const extraTabs = app?.templateId ? (moduleTabs[app.templateId] ?? []) : [];
  const tabs = [...planningTabs, ...extraTabs];

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!app) {
    return <div className="p-6 text-center text-muted-foreground">Application not found</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-xl px-6 pt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            {(() => { const Icon = getAppIcon(app.icon); return Icon ? <Icon className="h-5 w-5" /> : app.name.charAt(0).toUpperCase(); })()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{app.name}</h1>
            {app.description && <p className="text-sm text-muted-foreground">{app.description}</p>}
          </div>
          <PresenceBar />
          <button
            type="button"
            onClick={() => setShowPermissions((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-border/50 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
          >
            <Shield className="h-4 w-4" />
            Permissions
          </button>
        </div>

        {showPermissions && (
          <div className="mb-4 rounded-3xl border border-border/50 bg-background/80 backdrop-blur-sm shadow-win p-4">
            <PermissionsPanel workspaceSlug={slug} appSlug={appSlug ?? ''} />
          </div>
        )}

        <nav className="flex gap-1">
          {tabs.map(({ label, path, icon: Icon }) => {
            const isActive = currentTab === path;
            return (
              <Link
                key={path}
                to={path ? `${basePath}/${path}` : basePath}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
