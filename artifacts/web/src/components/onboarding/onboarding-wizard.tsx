import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import { useCreateApp, type App } from '@/lib/hooks/use-apps';
import { useCreateBlock } from '@/lib/hooks/use-blocks';
import { useCreateBoard, type BoardWidget } from '@/lib/hooks/use-boards';
import { useToastStore } from '@/stores/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Rocket,
  Boxes,
  LayoutGrid,
  TrendingUp,
  List,
  Table2,
  Hash,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  PartyPopper,
  Store,
  Brain,
  BookOpen,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ONBOARDING_KEY = 'onboarding_completed';
const TOTAL_STEPS = 5;

interface BlockTypeOption {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const BLOCK_TYPES: BlockTypeOption[] = [
  {
    id: 'metric',
    name: 'Metric',
    slug: 'revenue-metric',
    description: 'Calculated values with formulas and inputs',
    icon: TrendingUp,
    colorClass: 'text-violet-600',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-300/50 hover:border-violet-400/70',
  },
  {
    id: 'dimension',
    name: 'Dimension List',
    slug: 'region-dimension',
    description: 'Categories like regions, products, or time periods',
    icon: Hash,
    colorClass: 'text-sky-600',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-300/50 hover:border-sky-400/70',
  },
  {
    id: 'transaction',
    name: 'Transaction List',
    slug: 'transaction-list',
    description: 'Line-item records with detailed entries',
    icon: List,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-300/50 hover:border-emerald-400/70',
  },
  {
    id: 'table',
    name: 'Table',
    slug: 'data-table',
    description: 'Structured data grids with rows and columns',
    icon: Table2,
    colorClass: 'text-rose-600',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-300/50 hover:border-rose-400/70',
  },
];

// ---------------------------------------------------------------------------
// Slugify helper
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Confetti animation (CSS-only)
// ---------------------------------------------------------------------------

function ConfettiAnimation() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2 + Math.random() * 2;
        const size = 6 + Math.random() * 6;
        const colors = [
          'bg-violet-400',
          'bg-sky-400',
          'bg-emerald-400',
          'bg-amber-400',
          'bg-rose-400',
          'bg-primary',
        ];
        const color = colors[i % colors.length];
        const rotation = Math.random() * 360;

        return (
          <div
            key={i}
            className={cn('absolute rounded-sm opacity-0', color)}
            style={{
              left: `${left}%`,
              top: '-10px',
              width: `${size}px`,
              height: `${size * 0.6}px`,
              transform: `rotate(${rotation}deg)`,
              animation: `confetti-fall ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) rotate(0deg) scale(1);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(500px) rotate(720deg) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Dots
// ---------------------------------------------------------------------------

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isComplete = stepNum < current;
        return (
          <div
            key={i}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              isActive
                ? 'w-8 bg-primary'
                : isComplete
                  ? 'w-2 bg-primary/60'
                  : 'w-2 bg-muted-foreground/20',
            )}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step wrapper with slide animation
// ---------------------------------------------------------------------------

function StepContainer({
  children,
  direction,
}: {
  children: React.ReactNode;
  direction: 'forward' | 'backward';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reset animation
    el.classList.remove('animate-slide-in-left', 'animate-slide-in-right');
    // Force reflow
    void el.offsetWidth;
    el.classList.add(
      direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left',
    );
  }, [direction, children]);

  return (
    <div ref={ref} className="animate-slide-in-right">
      {children}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 mb-6">
        <Rocket className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">Welcome to the Planning Platform</h2>
      <p className="mt-3 max-w-md text-muted-foreground leading-relaxed">
        Build powerful financial models, revenue plans, and operational dashboards.
        Let us walk you through the essentials in under a minute.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-sm">
        {[
          { icon: Boxes, label: 'Planning Models', color: 'text-violet-500 bg-violet-500/10' },
          { icon: LayoutGrid, label: 'Visual Boards', color: 'text-sky-500 bg-sky-500/10' },
          { icon: Brain, label: 'AI-Powered', color: 'text-emerald-500 bg-emerald-500/10' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/50 p-4">
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', color)}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      <Button onClick={onNext} size="lg" className="mt-8 min-w-[200px]">
        Get Started
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Create App
// ---------------------------------------------------------------------------

function StepCreateApp({
  onNext,
  onCreated,
}: {
  onNext: () => void;
  onCreated: (app: App) => void;
}) {
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);
  const createApp = useCreateApp();
  const addToast = useToastStore((s) => s.addToast);

  const [appName, setAppName] = useState('Revenue Plan');
  const [appDesc, setAppDesc] = useState('Forecast revenue across products and regions');

  const handleCreate = useCallback(async () => {
    if (!workspaceSlug || !appName.trim()) return;

    try {
      const res = await createApp.mutateAsync({
        workspaceSlug,
        name: appName.trim(),
        slug: slugify(appName.trim()),
        description: appDesc.trim() || undefined,
      });

      if (res.data) {
        onCreated(res.data);
        addToast('Application created!', 'success');
        onNext();
      }
    } catch {
      addToast('Failed to create application. You can try again or skip this step.', 'error');
    }
  }, [workspaceSlug, appName, appDesc, createApp, onCreated, onNext, addToast]);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-500/10 mb-5">
        <Boxes className="h-8 w-8 text-violet-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Create Your First App</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Applications organize your planning models, data, and dashboards in one place.
      </p>

      <div className="mt-6 w-full max-w-sm space-y-4 text-left">
        <div className="space-y-2">
          <Label htmlFor="onboarding-app-name">Application Name</Label>
          <Input
            id="onboarding-app-name"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="e.g. Revenue Plan"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="onboarding-app-desc">Description (optional)</Label>
          <Input
            id="onboarding-app-desc"
            value={appDesc}
            onChange={(e) => setAppDesc(e.target.value)}
            placeholder="Brief description of this application"
          />
        </div>
      </div>

      <Button
        onClick={handleCreate}
        size="lg"
        className="mt-6 min-w-[200px]"
        disabled={!appName.trim() || createApp.isPending}
      >
        {createApp.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            Create Application
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Add Block
// ---------------------------------------------------------------------------

function StepAddBlock({
  onNext,
  createdApp,
}: {
  onNext: () => void;
  createdApp: App | null;
}) {
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);
  const createBlock = useCreateBlock();
  const addToast = useToastStore((s) => s.addToast);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const handleSelect = useCallback(
    async (blockType: BlockTypeOption) => {
      if (!workspaceSlug || !createdApp) {
        // If no app was created (user skipped step 2), just advance
        setSelectedType(blockType.id);
        addToast('Skipped block creation (no app selected). You can add blocks later.', 'info');
        setTimeout(onNext, 600);
        return;
      }

      setSelectedType(blockType.id);

      try {
        await createBlock.mutateAsync({
          workspaceSlug,
          appSlug: createdApp.slug,
          name: blockType.name,
          slug: blockType.slug,
          blockType: blockType.id,
        });
        addToast(`${blockType.name} block created!`, 'success');
        setTimeout(onNext, 600);
      } catch {
        addToast('Failed to create block. You can add blocks later.', 'error');
        setTimeout(onNext, 1000);
      }
    },
    [workspaceSlug, createdApp, createBlock, addToast, onNext],
  );

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/10 mb-5">
        <LayoutGrid className="h-8 w-8 text-sky-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Add a Block</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Blocks are the building pieces of your model. Choose a type to get started.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-md">
        {BLOCK_TYPES.map((bt) => {
          const Icon = bt.icon;
          const isSelected = selectedType === bt.id;
          return (
            <button
              key={bt.id}
              type="button"
              onClick={() => handleSelect(bt)}
              disabled={createBlock.isPending}
              className={cn(
                'group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-200',
                'hover:shadow-win hover:-translate-y-0.5',
                isSelected
                  ? cn('ring-2 ring-primary border-primary/50 bg-primary/5', bt.borderClass)
                  : cn('border-border/50 bg-card/70', bt.borderClass),
              )}
            >
              {isSelected && (
                <div className="absolute right-2 top-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', bt.bgClass)}>
                <Icon className={cn('h-5 w-5', bt.colorClass)} />
              </div>
              <span className="text-sm font-semibold text-foreground">{bt.name}</span>
              <span className="text-xs text-muted-foreground leading-snug">{bt.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Build Dashboard
// ---------------------------------------------------------------------------

function StepBuildDashboard({
  onNext,
  createdApp,
}: {
  onNext: () => void;
  createdApp: App | null;
}) {
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);
  const createBoard = useCreateBoard();
  const addToast = useToastStore((s) => s.addToast);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!workspaceSlug || !createdApp) {
      addToast('Skipped board creation. You can create boards later.', 'info');
      onNext();
      return;
    }

    setIsCreating(true);

    const sampleLayout: BoardWidget[] = [
      {
        id: crypto.randomUUID(),
        type: 'kpi',
        title: 'Total Revenue',
        x: 0,
        y: 0,
        w: 4,
        h: 2,
        config: { format: 'currency', prefix: '$' },
      },
      {
        id: crypto.randomUUID(),
        type: 'chart',
        title: 'Revenue Trend',
        x: 4,
        y: 0,
        w: 8,
        h: 4,
        config: { chartType: 'line' },
      },
      {
        id: crypto.randomUUID(),
        type: 'grid',
        title: 'Data Grid',
        x: 0,
        y: 2,
        w: 4,
        h: 4,
        config: {},
      },
    ];

    try {
      await createBoard.mutateAsync({
        workspaceSlug,
        appSlug: createdApp.slug,
        name: 'Overview Dashboard',
        slug: 'overview-dashboard',
        description: 'Your starter dashboard with key KPIs',
        layout: sampleLayout,
      });
      addToast('Dashboard created!', 'success');
      onNext();
    } catch {
      addToast('Failed to create dashboard. You can add one later.', 'error');
      onNext();
    } finally {
      setIsCreating(false);
    }
  }, [workspaceSlug, createdApp, createBoard, addToast, onNext]);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 mb-5">
        <LayoutGrid className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Build a Dashboard</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Dashboards let you visualize your data with KPIs, charts, and grids.
        We will create a starter board for you.
      </p>

      {/* Preview mockup */}
      <div className="mt-6 w-full max-w-sm rounded-2xl border border-border/50 bg-card/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-muted-foreground">Overview Dashboard</span>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {/* KPI card mockup */}
          <div className="col-span-4 rounded-xl bg-violet-500/10 border border-violet-200/30 p-3">
            <div className="text-[10px] text-muted-foreground">Total Revenue</div>
            <div className="mt-1 text-sm font-bold text-violet-600">$124,500</div>
          </div>
          {/* Chart mockup */}
          <div className="col-span-8 row-span-2 flex items-end rounded-xl bg-sky-500/10 border border-sky-200/30 p-3 gap-1">
            {[40, 55, 35, 60, 80, 65, 90, 75].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-sky-400/60"
                style={{ height: `${h}%`, minHeight: '4px' }}
              />
            ))}
          </div>
          {/* Grid mockup */}
          <div className="col-span-4 rounded-xl bg-muted/50 border border-border/30 p-3">
            <div className="space-y-1.5">
              {[1, 2, 3].map((r) => (
                <div key={r} className="h-1.5 rounded-full bg-muted-foreground/15" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={handleCreate}
        size="lg"
        className="mt-6 min-w-[200px]"
        disabled={isCreating}
      >
        {isCreating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            Create Starter Board
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: All Set
// ---------------------------------------------------------------------------

function StepAllSet({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <ConfettiAnimation />

      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 mb-6">
        <PartyPopper className="h-10 w-10 text-amber-500" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">You are All Set!</h2>
      <p className="mt-3 max-w-sm text-muted-foreground">
        Your workspace is ready. Explore everything the platform has to offer.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-3 w-full max-w-md">
        {[
          {
            icon: Store,
            label: 'Explore Marketplace',
            desc: 'Templates & integrations',
            color: 'text-violet-500 bg-violet-500/10',
          },
          {
            icon: Brain,
            label: 'Try AI Modeler',
            desc: 'Build models with AI',
            color: 'text-sky-500 bg-sky-500/10',
          },
          {
            icon: BookOpen,
            label: 'Documentation',
            desc: 'Guides & tutorials',
            color: 'text-emerald-500 bg-emerald-500/10',
          },
        ].map(({ icon: Icon, label, desc, color }) => (
          <button
            key={label}
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/50 p-4 transition-all duration-200 hover:shadow-win hover:-translate-y-0.5 hover:border-primary/30"
          >
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', color)}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs font-semibold text-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground">{desc}</span>
          </button>
        ))}
      </div>

      <Button onClick={onFinish} size="lg" className="mt-8 min-w-[200px]">
        <Sparkles className="h-4 w-4" />
        Go to Dashboard
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Wizard Component
// ---------------------------------------------------------------------------

export interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [createdApp, setCreatedApp] = useState<App | null>(null);

  const goNext = useCallback(() => {
    if (step >= TOTAL_STEPS) {
      // Mark onboarding as complete
      try {
        localStorage.setItem(ONBOARDING_KEY, 'true');
      } catch {
        // Incognito / SSR
      }
      onComplete();
      return;
    }
    setDirection('forward');
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [step, onComplete]);

  const goBack = useCallback(() => {
    setDirection('backward');
    setStep((s) => Math.max(s - 1, 1));
  }, []);

  const handleSkipAll = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // Incognito / SSR
    }
    onComplete();
  }, [onComplete]);

  const handleAppCreated = useCallback((app: App) => {
    setCreatedApp(app);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkipAll();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSkipAll]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding wizard"
    >
      <div className="relative w-full max-w-lg mx-4 rounded-3xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-win-lg">
        {/* Close / Skip button */}
        <button
          type="button"
          onClick={handleSkipAll}
          className="absolute right-4 top-4 z-10 rounded-xl p-2 text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-accent/50"
          aria-label="Skip onboarding"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="pt-6 px-6">
          <ProgressDots current={step} total={TOTAL_STEPS} />
        </div>

        {/* Step content */}
        <div className="px-6 py-8">
          <StepContainer direction={direction}>
            {step === 1 && <StepWelcome onNext={goNext} />}
            {step === 2 && (
              <StepCreateApp onNext={goNext} onCreated={handleAppCreated} />
            )}
            {step === 3 && (
              <StepAddBlock onNext={goNext} createdApp={createdApp} />
            )}
            {step === 4 && (
              <StepBuildDashboard onNext={goNext} createdApp={createdApp} />
            )}
            {step === 5 && <StepAllSet onFinish={goNext} />}
          </StepContainer>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between border-t border-border/30 px-6 py-4">
          <div>
            {step > 1 && step < TOTAL_STEPS && (
              <Button variant="ghost" size="sm" onClick={goBack}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step > 1 && step < TOTAL_STEPS && (
              <Button variant="ghost" size="sm" onClick={goNext} className="text-muted-foreground">
                Skip
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Step {step} of {TOTAL_STEPS}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
