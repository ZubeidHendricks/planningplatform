import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useApps, type App } from '@/lib/hooks/use-apps';
import { useBlocks } from '@/lib/hooks/use-blocks';
import { useDimensions } from '@/lib/hooks/use-dimensions';
import { useBoards } from '@/lib/hooks/use-boards';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Boxes,
  LayoutGrid,
  Activity,
  Plus,
  BookTemplate,
  ArrowRight,
  Clock,
  Layers,
  Hash,
  TrendingUp,
  PanelTop,
  Sparkles,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { getAppIcon } from '@/lib/icon-map';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';

// ------------------------------------------------------------------
// Stat card
// ------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  iconColor?: string;
}

function StatCard({ title, value, description, icon: Icon, iconColor }: StatCardProps) {
  return (
    <Card className="rounded-3xl bg-card/70 backdrop-blur-xl shadow-win border border-border/50 hover:shadow-win-lg transition-all duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-2xl',
            iconColor ?? 'bg-primary/10 text-primary'
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------
// Application card
// ------------------------------------------------------------------

interface AppCardProps {
  app: App;
  workspaceSlug: string;
}

function AppCard({ app, workspaceSlug }: AppCardProps) {
  const AppIcon = getAppIcon(app.icon);
  const initial = app.name.charAt(0).toUpperCase();
  const updatedDate = new Date(app.updatedAt);
  const formattedDate = updatedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Generate a consistent color from app name
  const colorIndex = app.name.charCodeAt(0) % 5;
  const colors = [
    'bg-violet-500/15 text-violet-600 border-violet-200/50',
    'bg-emerald-500/15 text-emerald-600 border-emerald-200/50',
    'bg-sky-500/15 text-sky-600 border-sky-200/50',
    'bg-amber-500/15 text-amber-600 border-amber-200/50',
    'bg-rose-500/15 text-rose-600 border-rose-200/50',
  ];

  return (
    <Link
      to={`/${workspaceSlug}/apps/${app.slug}`}
      className="group block"
    >
      <Card className="rounded-3xl bg-card/70 backdrop-blur-xl shadow-win border border-border/50 transition-all duration-300 hover:shadow-win-lg hover:scale-[1.01] group-hover:-translate-y-0.5">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-lg font-bold',
                colors[colorIndex]
              )}
            >
              {AppIcon ? <AppIcon className="h-5 w-5" /> : initial}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {app.name}
              </CardTitle>
              {app.description && (
                <CardDescription className="mt-0.5 line-clamp-2 text-xs">
                  {app.description}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formattedDate}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ------------------------------------------------------------------
// Getting started section for empty workspaces
// ------------------------------------------------------------------

interface GettingStartedStep {
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
  completed: boolean;
}

function GettingStartedSection({
  steps,
  workspaceSlug,
}: {
  steps: GettingStartedStep[];
  workspaceSlug: string;
}) {
  const allDone = steps.every((s) => s.completed);

  if (allDone) return null;

  return (
    <Card className="rounded-3xl border-dashed bg-card/70 backdrop-blur-xl shadow-win border-border/50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">Getting Started</CardTitle>
        </div>
        <CardDescription>
          Follow these steps to set up your workspace and start planning.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => {
            const StepIcon = step.icon;
            return (
              <div
                key={step.step}
                className={cn(
                  'flex items-start gap-3 rounded-2xl border p-3 transition-colors',
                  step.completed
                    ? 'border-emerald-200/50 bg-emerald-500/5'
                    : 'border-border/50 bg-card/70 hover:bg-accent/50'
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    step.completed
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    step.step
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.completed ? 'text-emerald-700 line-through' : 'text-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <Button asChild size="sm">
            <Link to={`/${workspaceSlug}/apps?new=true`}>
              <Plus className="h-3.5 w-3.5" />
              Create Your First Application
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------
// Quick access item
// ------------------------------------------------------------------

function QuickAccessItem({
  name,
  type,
  href,
  updatedAt,
}: {
  name: string;
  type: string;
  href: string;
  updatedAt: string;
}) {
  const date = new Date(updatedAt);
  const relative = getRelativeTime(date);

  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl p-3 transition-all duration-300 hover:bg-accent hover:border-primary/20 hover:-translate-y-0.5 hover:shadow-win"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <PanelTop className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {type} · {relative}
        </p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}

// ------------------------------------------------------------------
// Relative time helper
// ------------------------------------------------------------------

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ------------------------------------------------------------------
// Dashboard page
// ------------------------------------------------------------------

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);

  const { data: apps = [], isLoading: appsLoading } = useApps(workspaceSlug ?? undefined);

  // ------------------------------------------------------------------
  // Onboarding state
  // ------------------------------------------------------------------
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem('onboarding_completed');
    } catch {
      return false;
    }
  });

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleRestartTutorial = useCallback(() => {
    try {
      localStorage.removeItem('onboarding_completed');
    } catch {
      // Incognito / SSR
    }
    setShowOnboarding(true);
  }, []);

  const firstAppSlug = apps[0]?.slug;
  const { data: firstAppDims } = useDimensions(workspaceSlug ?? '', firstAppSlug ?? '', { enabled: !!firstAppSlug });
  const { data: firstAppBlocks } = useBlocks(workspaceSlug ?? '', firstAppSlug ?? '', { enabled: !!firstAppSlug });
  const { data: firstAppBoards } = useBoards(workspaceSlug ?? '', firstAppSlug ?? '', { enabled: !!firstAppSlug });

  const greeting = user ? `Welcome back, ${user.firstName}` : 'Welcome back';

  // Compute stats from real data
  const appCount = apps.length;

  // Recently modified apps (sorted by updatedAt desc)
  const recentApps = useMemo(() => {
    return [...apps]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }, [apps]);

  // Most recent activity date
  const lastActivity = useMemo(() => {
    if (apps.length === 0) return null;
    const sorted = [...apps].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const first = sorted[0];
    return first ? new Date(first.updatedAt) : null;
  }, [apps]);

  const lastActivityStr = lastActivity ? getRelativeTime(lastActivity) : '--';

  // Getting started steps
  const gettingStartedSteps: GettingStartedStep[] = [
    {
      step: 1,
      title: 'Create an Application',
      description: 'Applications organize your planning models and data.',
      icon: Boxes,
      completed: appCount > 0,
    },
    {
      step: 2,
      title: 'Add Dimensions',
      description: 'Define the axes of your data: time, products, regions.',
      icon: Hash,
      completed: (firstAppDims?.length ?? 0) > 0,
    },
    {
      step: 3,
      title: 'Build Metrics',
      description: 'Create calculated metrics with formulas and inputs.',
      icon: TrendingUp,
      completed: (firstAppBlocks?.length ?? 0) > 0,
    },
    {
      step: 4,
      title: 'Create Boards',
      description: 'Build dashboards and views to visualize your data.',
      icon: PanelTop,
      completed: (firstAppBoards?.length ?? 0) > 0,
    },
  ];

  // Show onboarding when user has no apps and hasn't completed it
  const shouldShowOnboarding = showOnboarding && !appsLoading && apps.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 sm:space-y-8 px-3 py-4 sm:p-6 lg:p-8">
      {/* Onboarding wizard overlay */}
      {shouldShowOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      )}

      {/* Page heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {greeting}
          </h1>
          <p className="mt-1 text-sm sm:text-base text-muted-foreground">
            Here&apos;s an overview of your workspace.
          </p>
        </div>
        {workspaceSlug && (
          <Button asChild size="sm" className="self-start sm:self-auto">
            <Link to={`/${workspaceSlug}/apps?new=true`}>
              <Plus className="h-4 w-4" />
              New Application
            </Link>
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Applications"
          value={appsLoading ? '...' : appCount}
          description={
            appCount === 1
              ? '1 application in this workspace'
              : `${appCount} applications in this workspace`
          }
          icon={Boxes}
          iconColor="bg-violet-500/10 text-violet-600"
        />
        <StatCard
          title="Application Models"
          value={appsLoading ? '...' : appCount}
          description="Active planning models"
          icon={Layers}
          iconColor="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          title="Recent Activity"
          value={lastActivityStr}
          description={lastActivity ? 'Last workspace change' : 'No recent activity yet'}
          icon={Activity}
          iconColor="bg-amber-500/10 text-amber-600"
        />
      </div>

      {/* Getting started (only when no apps or few apps) */}
      {!appsLoading && appCount < 2 && workspaceSlug && (
        <GettingStartedSection
          steps={gettingStartedSteps}
          workspaceSlug={workspaceSlug}
        />
      )}

      {/* Applications grid */}
      {apps.length > 0 && workspaceSlug && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Your Applications
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/${workspaceSlug}/apps`}>
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {recentApps.map((app) => (
              <AppCard key={app.id} app={app} workspaceSlug={workspaceSlug} />
            ))}
          </div>
        </div>
      )}

      {/* Quick access */}
      {apps.length > 0 && workspaceSlug && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Quick Access
          </h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {recentApps.slice(0, 3).map((app) => (
              <QuickAccessItem
                key={app.id}
                name={app.name}
                type="Application"
                href={`/${workspaceSlug}/apps/${app.slug}`}
                updatedAt={app.updatedAt}
              />
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link
              to={
                workspaceSlug
                  ? `/${workspaceSlug}/apps?new=true`
                  : '/apps?new=true'
              }
            >
              <Plus className="h-4 w-4" />
              New Application
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link
              to={
                workspaceSlug ? `/${workspaceSlug}/apps` : '/'
              }
            >
              <BookTemplate className="h-4 w-4" />
              Browse Applications
            </Link>
          </Button>
        </div>
      </div>

      {/* Empty state: recent activity */}
      {apps.length === 0 && !appsLoading && (
        <Card className="rounded-3xl bg-card/70 backdrop-blur-xl shadow-win border border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>
              Your latest changes and updates will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border/50">
              <p className="text-sm text-muted-foreground">
                No activity to show yet. Create your first application to get
                started.
              </p>
            </div>
            {!showOnboarding && (
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestartTutorial}
                  className="text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restart Tutorial
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
