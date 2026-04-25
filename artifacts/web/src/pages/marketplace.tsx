import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  Briefcase,
  Users,
  GraduationCap,
  Truck,
  ShieldCheck,
  DollarSign,
  Shield,
  Heart,
  Rocket,
  Check,
  Search,
  CreditCard,
  Building2,
  X,
  Tag,
  Mail,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';
import {
  useSubscriptions,
  useCreateCheckout,
  type PaymentGateway,
} from '@/lib/hooks/use-billing';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModulePack {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  category: ModuleCategory;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  accentBar: string;
  modules: string[];
  moduleDescriptions: string[];
  tag?: PackTag;
  premium?: boolean;
}

type ModuleCategory =
  | 'HR & People'
  | 'Fleet & Logistics'
  | 'Finance'
  | 'Operations'
  | 'Compliance';

type PackTag = 'Most Popular' | 'Enterprise' | 'New' | 'Best Value';

type BillingCycle = 'monthly' | 'annual';

type PaymentMethod = 'credit-card' | 'eft' | 'payfast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'activated_modules';
const VAT_RATE = 0.15;
const ANNUAL_DISCOUNT = 0.2;

const CATEGORIES: Array<'All' | ModuleCategory> = [
  'All',
  'HR & People',
  'Fleet & Logistics',
  'Finance',
  'Operations',
  'Compliance',
];

const TAG_STYLES: Record<PackTag, string> = {
  'Most Popular': 'bg-blue-100 text-blue-700 border-blue-200',
  Enterprise: 'bg-purple-100 text-purple-700 border-purple-200',
  New: 'bg-green-100 text-green-700 border-green-200',
  'Best Value': 'bg-amber-100 text-amber-700 border-amber-200',
};

const MODULE_PACKS: ModulePack[] = [
  {
    id: 'recruitment-suite',
    name: 'Recruitment Suite',
    description: 'End-to-end talent acquisition with a kanban pipeline, interview scheduling, job postings, and a searchable candidate database. Track every applicant from sourcing to offer.',
    priceMonthly: 2499,
    category: 'HR & People',
    icon: Briefcase,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    accentBar: 'bg-blue-500',
    modules: ['Candidate Pipeline', 'Interview Scheduler', 'Job Board', 'Candidate Database'],
    moduleDescriptions: ['Kanban board tracking candidates across stages', 'Schedule and score interviews with panel management', 'Post openings, toggle status, track applications', 'Search, filter, and manage your full candidate pool'],
    tag: 'Most Popular',
  },
  {
    id: 'hr-operations',
    name: 'HR Operations',
    description: 'Core HR tools for day-to-day people management. Handle leave requests, maintain employee records, run performance review cycles, and organise HR documents.',
    priceMonthly: 1999,
    category: 'HR & People',
    icon: Users,
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
    accentBar: 'bg-indigo-500',
    modules: ['Leave Management', 'Employee Directory', 'Performance Reviews', 'Document Manager'],
    moduleDescriptions: ['Submit, approve, and track annual/sick/family leave', 'Full employee profiles with department and status', 'Quarterly reviews with star ratings and feedback', 'Store contracts, policies, certificates with expiry alerts'],
  },
  {
    id: 'training-development',
    name: 'Training & Development',
    description: 'Track employee upskilling, manage certifications, and monitor compliance training. Get expiry alerts so nothing slips through the cracks.',
    priceMonthly: 1499,
    category: 'HR & People',
    icon: GraduationCap,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    accentBar: 'bg-purple-500',
    modules: ['Training Tracker', 'Certificate Manager', 'Skills Matrix'],
    moduleDescriptions: ['Enrol employees in courses and track completion', 'Issue and monitor certificates with expiry countdowns', 'Map skills across teams and identify gaps'],
  },
  {
    id: 'fleet-management',
    name: 'Fleet Management',
    description: 'Complete fleet operations suite. Track vehicles, manage drivers, log trips, monitor fuel consumption, and schedule repairs — all in one place.',
    priceMonthly: 3499,
    category: 'Fleet & Logistics',
    icon: Truck,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    accentBar: 'bg-orange-500',
    modules: ['Vehicle Tracker', 'Driver Management', 'Trip Logger', 'Fuel Monitoring', 'Repair Workshop'],
    moduleDescriptions: ['Track registration, mileage, service dates, and status', 'Driver profiles with license expiry warnings', 'Log routes with origin, destination, and distance', 'Record fuel fills with cost analysis per vehicle', 'Kanban repair workflow from reported to completed'],
    tag: 'Enterprise',
  },
  {
    id: 'fleet-compliance',
    name: 'Fleet Compliance',
    description: 'Stay compliant with tyre management, traffic fine tracking, and weighbridge documentation. Avoid penalties and keep your fleet road-legal.',
    priceMonthly: 1999,
    category: 'Fleet & Logistics',
    icon: ShieldCheck,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    accentBar: 'bg-red-500',
    modules: ['Tyre Lifecycle', 'Fines Tracker', 'Weighbridge Logs'],
    moduleDescriptions: ['Track tread depth, position, and replacement schedules', 'Log fines with due dates and overdue alerts', 'Record weighbridge readings for compliance'],
  },
  {
    id: 'finance-essentials',
    name: 'Finance Essentials',
    description: 'Manage invoicing, track expenses, and plan budgets. Simple financial tools that integrate with your planning dashboards.',
    priceMonthly: 1799,
    category: 'Finance',
    icon: DollarSign,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    accentBar: 'bg-green-500',
    modules: ['Invoice Manager', 'Expense Tracker', 'Budget Planner'],
    moduleDescriptions: ['Create and track invoices with payment status', 'Log and categorise business expenses', 'Set budgets by department and track spend'],
  },
  {
    id: 'compliance-risk',
    name: 'Compliance & Risk',
    description: 'Regulatory compliance management with risk assessments and full audit trail. Flag non-compliant items and track remediation.',
    priceMonthly: 2299,
    category: 'Compliance',
    icon: Shield,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    accentBar: 'bg-amber-500',
    modules: ['Compliance Register', 'Risk Assessments', 'Audit Trail'],
    moduleDescriptions: ['Track regulatory requirements with risk levels', 'Assess and score compliance risks by category', 'Full audit log of all compliance activities'],
  },
  {
    id: 'employee-engagement',
    name: 'Employee Engagement',
    description: 'Measure employee sentiment with pulse surveys, track engagement scores, and collect anonymous feedback to improve workplace culture.',
    priceMonthly: 999,
    category: 'HR & People',
    icon: Heart,
    iconColor: 'text-pink-600',
    iconBg: 'bg-pink-100',
    accentBar: 'bg-pink-500',
    modules: ['Pulse Surveys', 'Engagement Analytics', 'Feedback Collection'],
    moduleDescriptions: ['Quick recurring surveys with response tracking', 'Visualise engagement trends over time', 'Anonymous suggestion box and feedback forms'],
    tag: 'New',
  },
  {
    id: 'full-platform',
    name: 'Full Platform',
    description: 'Unlock every module across all categories. The complete operational platform for organisations that need it all — recruitment, HR, fleet, finance, compliance, and engagement.',
    priceMonthly: 9999,
    category: 'Operations',
    icon: Rocket,
    iconColor: 'text-white',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    accentBar: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500',
    modules: ['Everything included -- all modules across all categories'],
    moduleDescriptions: ['All 30+ modules from every category with priority support'],
    tag: 'Best Value',
    premium: true,
  },
];

const PAYMENT_METHODS: Array<{ id: PaymentMethod; label: string; icon: React.ElementType }> = [
  { id: 'credit-card', label: 'Credit Card', icon: CreditCard },
  { id: 'eft', label: 'EFT', icon: Building2 },
  { id: 'payfast', label: 'PayFast', icon: DollarSign },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA')}`;
}

function getActivatedPacks(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveActivatedPacks(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | ModuleCategory>('All');
  const [selectedPack, setSelectedPack] = useState<ModulePack | null>(null);
  const [learnMorePack, setLearnMorePack] = useState<ModulePack | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit-card');
  const [promoCode, setPromoCode] = useState('');
  const [localActivatedPacks, setLocalActivatedPacks] = useState<string[]>([]);
  const addToast = useToastStore((s) => s.addToast);
  const workspaceSlug = useAuthStore((s) => s.workspaceSlug);

  // --- Billing hooks ---
  const { data: subscriptions } = useSubscriptions(workspaceSlug ?? undefined);
  const createCheckout = useCreateCheckout();
  const [searchParams, setSearchParams] = useSearchParams();

  // Build the set of activated pack IDs from subscriptions (primary) + localStorage (fallback)
  const subscribedPackIds = useMemo(() => {
    const ids = new Set<string>();
    if (subscriptions) {
      for (const sub of subscriptions) {
        if (sub.status === 'active' || sub.status === 'trialing') {
          ids.add(sub.packId);
        }
      }
    }
    return ids;
  }, [subscriptions]);

  // Load localStorage fallback on mount
  useEffect(() => {
    setLocalActivatedPacks(getActivatedPacks());
  }, []);

  // Handle ?payment=success&pack=X query param from checkout redirect
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const packId = searchParams.get('pack');
    if (paymentStatus === 'success' && packId) {
      addToast('Payment successful! Your module pack is now active.', 'success');
      // Also save to localStorage as fallback
      const updated = [...new Set([...getActivatedPacks(), packId])];
      setLocalActivatedPacks(updated);
      saveActivatedPacks(updated);
      // Clean the URL
      searchParams.delete('payment');
      searchParams.delete('pack');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, addToast, setSearchParams]);

  // Filter packs by category and search
  const filteredPacks = useMemo(() => {
    return MODULE_PACKS.filter((pack) => {
      const matchesCategory = activeCategory === 'All' || pack.category === activeCategory;
      if (!matchesCategory) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        pack.name.toLowerCase().includes(q) ||
        pack.modules.some((m) => m.toLowerCase().includes(q)) ||
        pack.category.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchQuery]);

  // Pricing calculations
  const getEffectivePrice = (priceMonthly: number, cycle: BillingCycle) => {
    if (cycle === 'annual') {
      return priceMonthly * (1 - ANNUAL_DISCOUNT);
    }
    return priceMonthly;
  };

  const handleSubscribe = (pack: ModulePack) => {
    if (isActivated(pack.id)) return;
    setSelectedPack(pack);
    setBillingCycle('monthly');
    setPaymentMethod('credit-card');
    setPromoCode('');
  };

  const handleConfirmPay = () => {
    if (!selectedPack || !workspaceSlug) return;

    // Map UI payment method to gateway
    const gatewayMap: Record<PaymentMethod, PaymentGateway> = {
      'credit-card': 'stripe',
      'eft': 'payfast',
      'payfast': 'payfast',
    };

    createCheckout.mutate(
      {
        workspaceSlug,
        packId: selectedPack.id,
        billingCycle,
        gateway: gatewayMap[paymentMethod],
        promoCode: promoCode.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          const url = res.data?.url;
          if (url) {
            // Redirect to hosted checkout (PayFast or Stripe)
            window.location.href = url;
          } else {
            // Fallback: activate locally (demo / offline mode)
            const updated = [...new Set([...localActivatedPacks, selectedPack.id])];
            setLocalActivatedPacks(updated);
            saveActivatedPacks(updated);
            setSelectedPack(null);
            addToast(
              'Module pack activated! Deploy a template to start using your modules.',
              'success',
            );
          }
        },
        onError: () => {
          // Fallback: activate locally so the app works in demo/offline mode
          const updated = [...new Set([...localActivatedPacks, selectedPack.id])];
          setLocalActivatedPacks(updated);
          saveActivatedPacks(updated);
          setSelectedPack(null);
          addToast(
            'Module pack activated in demo mode (billing service unavailable).',
            'info',
          );
        },
      },
    );
  };

  // Check subscriptions first; fall back to localStorage for demo/offline
  const isActivated = (packId: string) =>
    subscribedPackIds.has(packId) || localActivatedPacks.includes(packId);

  return (
    <div className="px-3 py-4 sm:p-6 max-w-6xl mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Modules Marketplace</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Extend your planning apps with operational modules
        </p>

        {/* Search bar */}
        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search modules, packs, or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search modules"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Category filter tabs                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px]',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Module pack cards grid                                              */}
      {/* ------------------------------------------------------------------ */}
      {filteredPacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">No module packs found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try a different search term or category
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPacks.map((pack) => {
            const Icon = pack.icon;
            const activated = isActivated(pack.id);

            return (
              <div
                key={pack.id}
                className={cn(
                  'bg-card/70 backdrop-blur-xl border rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-win-lg group',
                  pack.premium
                    ? 'border-amber-300 ring-1 ring-amber-200/50 hover:border-amber-400'
                    : 'border-border hover:border-primary/40',
                )}
              >
                {/* Top accent bar */}
                <div className={cn('h-2', pack.accentBar)} />

                <div className={cn('p-5', pack.premium && 'bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/10')}>
                  {/* Icon + name + tag */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                        pack.iconBg,
                      )}
                    >
                      <Icon className={cn('h-5 w-5', pack.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{pack.name}</h3>
                        {pack.tag && (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                              TAG_STYLES[pack.tag],
                            )}
                          >
                            {pack.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{pack.category}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className={cn('text-xl font-bold', pack.premium ? 'text-amber-600' : 'text-foreground')}>
                      {formatZAR(pack.priceMonthly)}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>

                  {/* Module list */}
                  <ul className="space-y-1.5 mb-4">
                    {pack.modules.map((mod) => (
                      <li key={mod} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="h-3 w-3 text-primary shrink-0" />
                        {mod}
                      </li>
                    ))}
                  </ul>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {activated ? (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-md text-xs font-medium border border-green-200">
                          <Check className="h-3 w-3" /> Active
                        </span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                        >
                          Manage
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSubscribe(pack)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors min-h-[44px]',
                            pack.premium
                              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90',
                          )}
                        >
                          Subscribe
                        </button>
                        <button
                          type="button"
                          onClick={() => setLearnMorePack(pack)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                        >
                          Learn More
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Enterprise CTA banner                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="mt-12 rounded-3xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-win p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Need custom modules?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Contact us for a tailored solution built for your organisation's specific requirements.
          </p>
        </div>
        <a
          href="mailto:sales@planningplatform.co.za"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors min-h-[44px] shrink-0"
        >
          <Mail className="h-4 w-4 shrink-0" />
          <span className="truncate">sales@planningplatform.co.za</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
        </a>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Purchase dialog                                                     */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!selectedPack} onOpenChange={(open) => !open && setSelectedPack(null)}>
        <DialogContent className="max-w-md">
          {selectedPack && (
            <PurchaseDialog
              pack={selectedPack}
              billingCycle={billingCycle}
              setBillingCycle={setBillingCycle}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              onConfirm={handleConfirmPay}
              isPending={createCheckout.isPending}
              getEffectivePrice={getEffectivePrice}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Learn More dialog                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={!!learnMorePack} onOpenChange={(open) => !open && setLearnMorePack(null)}>
        <DialogContent className="max-w-lg">
          {learnMorePack && (() => {
            const LMIcon = learnMorePack.icon;
            const activated = isActivated(learnMorePack.id);
            return (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className={cn('h-11 w-11 rounded-2xl flex items-center justify-center shrink-0', learnMorePack.iconBg)}>
                      <LMIcon className={cn('h-5 w-5', learnMorePack.iconColor)} />
                    </div>
                    <div>
                      <DialogTitle>{learnMorePack.name}</DialogTitle>
                      <DialogDescription>{learnMorePack.category}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <p className="text-sm text-muted-foreground leading-relaxed">{learnMorePack.description}</p>

                <div className="flex items-baseline gap-1 mt-1">
                  <span className={cn('text-2xl font-bold', learnMorePack.premium ? 'text-amber-600' : 'text-foreground')}>
                    {formatZAR(learnMorePack.priceMonthly)}
                  </span>
                  <span className="text-sm text-muted-foreground">/mo</span>
                  <span className="ml-2 text-xs text-muted-foreground">(save 20% on annual)</span>
                </div>

                <div className="mt-2">
                  <h4 className="text-sm font-semibold text-foreground mb-3">Included Modules</h4>
                  <ul className="space-y-3">
                    {learnMorePack.modules.map((mod, i) => (
                      <li key={mod} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{mod}</p>
                          {learnMorePack.moduleDescriptions[i] && (
                            <p className="text-xs text-muted-foreground mt-0.5">{learnMorePack.moduleDescriptions[i]}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3 mt-2">
                  {activated ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 rounded-2xl text-sm font-medium border border-green-200">
                      <Check className="h-4 w-4" /> Already Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLearnMorePack(null);
                        handleSubscribe(learnMorePack);
                      }}
                      className={cn(
                        'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200',
                        learnMorePack.premium
                          ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90',
                      )}
                    >
                      Subscribe Now
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setLearnMorePack(null)}
                    className="px-4 py-2.5 rounded-2xl text-sm font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
                  >
                    Close
                  </button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Purchase dialog sub-component
// ---------------------------------------------------------------------------

interface PurchaseDialogProps {
  pack: ModulePack;
  billingCycle: BillingCycle;
  setBillingCycle: (cycle: BillingCycle) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  promoCode: string;
  setPromoCode: (code: string) => void;
  onConfirm: () => void;
  isPending: boolean;
  getEffectivePrice: (price: number, cycle: BillingCycle) => number;
}

function PurchaseDialog({
  pack,
  billingCycle,
  setBillingCycle,
  paymentMethod,
  setPaymentMethod,
  promoCode,
  setPromoCode,
  onConfirm,
  isPending,
  getEffectivePrice,
}: PurchaseDialogProps) {
  const Icon = pack.icon;
  const effectiveMonthly = getEffectivePrice(pack.priceMonthly, billingCycle);
  const subtotal = billingCycle === 'annual' ? effectiveMonthly * 12 : effectiveMonthly;
  const vat = subtotal * VAT_RATE;
  const total = subtotal + vat;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Subscribe to {pack.name}</DialogTitle>
        <DialogDescription>
          Review your selection and complete the purchase
        </DialogDescription>
      </DialogHeader>

      {/* Pack summary */}
      <div className="flex items-start gap-3 rounded-md border border-border bg-muted/50 p-3">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', pack.iconBg)}>
          <Icon className={cn('h-4 w-4', pack.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{pack.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pack.modules.length} module{pack.modules.length !== 1 ? 's' : ''} included
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {pack.modules.map((mod) => (
              <span
                key={mod}
                className="inline-flex items-center rounded-md bg-background border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {mod}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Billing cycle toggle */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Billing Cycle</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'rounded-md border px-3 py-2 text-sm font-medium transition-colors text-center',
              billingCycle === 'monthly'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/30',
            )}
          >
            Monthly
            <span className="block text-xs mt-0.5 font-normal">
              {formatZAR(pack.priceMonthly)}/mo
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={cn(
              'rounded-md border px-3 py-2 text-sm font-medium transition-colors text-center relative',
              billingCycle === 'annual'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/30',
            )}
          >
            <span className="absolute -top-2 right-2 inline-flex items-center rounded-full bg-green-100 text-green-700 border border-green-200 px-1.5 py-0 text-[9px] font-semibold">
              Save 20%
            </span>
            Annual
            <span className="block text-xs mt-0.5 font-normal">
              <span className="line-through text-muted-foreground/60 mr-1">
                {formatZAR(pack.priceMonthly)}
              </span>
              {formatZAR(getEffectivePrice(pack.priceMonthly, 'annual'))}/mo
            </span>
          </button>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Payment Method</label>
        <div className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((method) => {
            const MethodIcon = method.icon;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => setPaymentMethod(method.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs font-medium transition-colors',
                  paymentMethod === method.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30',
                )}
              >
                <MethodIcon className="h-4 w-4" />
                {method.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Promo code */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Promo Code</label>
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter code"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="flex-1"
          />
          <button
            type="button"
            disabled={!promoCode.trim()}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Tag className="h-3.5 w-3.5" />
            Apply
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Subtotal ({billingCycle === 'annual' ? '12 months' : '1 month'})
          </span>
          <span className="text-foreground font-medium">{formatZAR(Math.round(subtotal))}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">VAT (15%)</span>
          <span className="text-foreground font-medium">{formatZAR(Math.round(vat))}</span>
        </div>
        <div className="border-t border-border pt-1.5 flex justify-between text-sm">
          <span className="text-foreground font-semibold">Total</span>
          <span className="text-foreground font-bold text-base">{formatZAR(Math.round(total))}</span>
        </div>
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
          pack.premium
            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting to payment...
          </>
        ) : (
          'Confirm & Pay'
        )}
      </button>

      {/* Fine print */}
      <p className="text-[11px] text-muted-foreground/70 text-center">
        Cancel anytime. 14-day money-back guarantee.
      </p>
    </>
  );
}
