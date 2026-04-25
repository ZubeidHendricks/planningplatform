import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  DollarSign,
  Users,
  TrendingUp,
  BarChart3,
  ShoppingCart,
  Building2,
  Truck,
  Shield,
  Rocket,
  Check,
  Briefcase,
  Target,
  GraduationCap,
  ClipboardCheck,
  HeartPulse,
  Video,
  FileText,
  ShieldCheck,
  Brain,
  Handshake,
  Fuel,
  CircleDot,
  Package,
  Wrench,
  Wallet,
  AlertTriangle,
  MapPin,
  Scale,
  CalendarDays,
  ShieldAlert,
  Heart,
  Banknote,
  Award,
  CreditCard,
  MessageSquare,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ElementType;
  color: string;
  features: string[];
  blocks: number;
  boards: number;
}

const templates: Template[] = [
  // ---- HR Modules (from MTN Human Capital) ------------------------------------
  {
    id: 'workforce-planning',
    name: 'Workforce Planning',
    description: 'Plan headcount, compensation, and hiring across departments and roles.',
    category: 'HR',
    icon: Users,
    color: 'bg-blue-500',
    features: ['Headcount by department & level', 'Compensation modeling', 'Hiring & attrition tracking', 'Total HR cost rollup'],
    blocks: 12,
    boards: 1,
  },
  {
    id: 'recruitment-pipeline',
    name: 'Recruitment Pipeline',
    description: 'Track open positions, candidate pipeline, offer rates, and talent acquisition costs.',
    category: 'HR',
    icon: Briefcase,
    color: 'bg-teal-500',
    features: ['Pipeline by stage & department', 'Offer acceptance rate', 'Time to fill tracking', 'Recruiting spend analysis'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'kpi-performance',
    name: 'KPI & Performance',
    description: '360° performance reviews with self, manager, and peer scores across KPI categories.',
    category: 'HR',
    icon: Target,
    color: 'bg-rose-500',
    features: ['Multi-rater scoring', 'Review completion tracking', 'Performance distribution', 'Training cost per hour'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'learning-development',
    name: 'Learning & Development',
    description: 'Plan training programs, track certifications, and manage L&D budgets.',
    category: 'HR',
    icon: GraduationCap,
    color: 'bg-purple-500',
    features: ['Training completion rates', 'Certification tracking', 'Skill gap analysis', 'Budget utilization'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'employee-onboarding',
    name: 'Employee Onboarding',
    description: 'Track onboarding workflows, document collection, and new hire ramp-up metrics.',
    category: 'HR',
    icon: ClipboardCheck,
    color: 'bg-sky-500',
    features: ['Onboarding task completion', 'Document collection status', 'Time to productivity', 'New hire satisfaction'],
    blocks: 12,
    boards: 1,
  },
  {
    id: 'compensation-benefits',
    name: 'Compensation & Benefits',
    description: 'Model salary bands, benefits packages, and total rewards across the organization.',
    category: 'HR',
    icon: HeartPulse,
    color: 'bg-pink-500',
    features: ['Salary band analysis', 'Benefits cost modeling', 'Pay equity ratios', 'Total rewards summary'],
    blocks: 14,
    boards: 1,
  },
  // ---- Finance ----------------------------------------------------------------
  {
    id: 'revenue-planning',
    name: 'Revenue Planning',
    description: 'Model revenue by product, region, and channel with forecasting and what-if analysis.',
    category: 'Finance',
    icon: DollarSign,
    color: 'bg-emerald-500',
    features: ['Revenue by region & product', 'Growth rate drivers', 'Pipeline conversion model', 'Monthly forecast vs actuals'],
    blocks: 5,
    boards: 1,
  },
  {
    id: 'pl-statement',
    name: 'P&L Statement',
    description: 'Complete profit and loss model with revenue, COGS, opex, and bottom line.',
    category: 'Finance',
    icon: TrendingUp,
    color: 'bg-violet-500',
    features: ['Revenue streams', 'Cost of goods sold', 'Operating expenses', 'Net income waterfall'],
    blocks: 11,
    boards: 1,
  },
  {
    id: 'sales-performance',
    name: 'Sales Performance',
    description: 'Track sales KPIs, pipeline, and team performance with quota attainment.',
    category: 'Sales',
    icon: BarChart3,
    color: 'bg-orange-500',
    features: ['Quota vs attainment', 'Pipeline analysis', 'Win/loss tracking', 'Rep performance cards'],
    blocks: 10,
    boards: 4,
  },
  {
    id: 'opex-budget',
    name: 'OPEX Budget',
    description: 'Operating expense budget by department, category, and vendor.',
    category: 'Finance',
    icon: ShoppingCart,
    color: 'bg-red-500',
    features: ['Expense categories', 'Department budgets', 'Vendor tracking', 'Budget vs actuals'],
    blocks: 14,
    boards: 3,
  },
  {
    id: 'real-estate',
    name: 'Real Estate Portfolio',
    description: 'Manage property portfolio with lease tracking and cost analysis.',
    category: 'Operations',
    icon: Building2,
    color: 'bg-cyan-500',
    features: ['Property inventory', 'Lease management', 'Cost per sqm', 'Occupancy tracking'],
    blocks: 8,
    boards: 2,
  },
  {
    id: 'fleet-management',
    name: 'Fleet Management',
    description: 'Track fleet utilization, fuel costs, maintenance, and driver performance across routes.',
    category: 'Operations',
    icon: Truck,
    color: 'bg-amber-500',
    features: ['Utilization & active vehicles', 'Fuel cost & efficiency', 'Maintenance tracking', 'Revenue per load & profit'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'interview-analytics',
    name: 'Interview Analytics',
    description: 'Analyze interview completion rates, scores, sentiment, and cost per hire across departments.',
    category: 'HR',
    icon: Video,
    color: 'bg-fuchsia-500',
    features: ['Completion & no-show rates', 'Avg scores & sentiment', 'Cost per interview', 'Interviewer satisfaction'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'document-management',
    name: 'Document Management',
    description: 'Track document creation, signing workflows, compliance, and automation rates.',
    category: 'Operations',
    icon: FileText,
    color: 'bg-lime-500',
    features: ['Sign completion rate', 'Avg turnaround time', 'Automation rate', 'Compliance scoring'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'social-screening',
    name: 'Social & Background Screening',
    description: 'Monitor background check completion, flag rates, accuracy, and screening costs.',
    category: 'HR',
    icon: ShieldCheck,
    color: 'bg-yellow-500',
    features: ['Check completion rate', 'Flag & escalation tracking', 'Accuracy rate', 'Cost per check'],
    blocks: 12,
    boards: 1,
  },
  {
    id: 'workforce-intelligence',
    name: 'Workforce Intelligence',
    description: 'Executive HR dashboard with attrition, engagement, diversity, and revenue per employee.',
    category: 'HR',
    icon: Brain,
    color: 'bg-emerald-600',
    features: ['Attrition & tenure analysis', 'Engagement & eNPS', 'Diversity & gender ratio', 'Revenue per employee'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'offer-management',
    name: 'Offer Management',
    description: 'Track offer pipeline from creation to acceptance with negotiation and signing bonus analysis.',
    category: 'HR',
    icon: Handshake,
    color: 'bg-orange-600',
    features: ['Acceptance & renege rates', 'Negotiation delta', 'Time to accept', 'Total acquisition cost'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'insurance-planning',
    name: 'Insurance Planning',
    description: 'Insurance portfolio modeling with premium calculations and claims analysis.',
    category: 'Insurance',
    icon: Shield,
    color: 'bg-indigo-500',
    features: ['Policy management', 'Premium modeling', 'Claims tracking', 'Loss ratio analysis'],
    blocks: 16,
    boards: 5,
  },
  // ---- Fleet Operations (from FleetLogix) ------------------------------------
  {
    id: 'fuel-management',
    name: 'Fuel Management',
    description: 'Track fuel purchases, deliveries, tank levels, consumption, and cost per kilometre.',
    category: 'Fleet',
    icon: Fuel,
    color: 'bg-red-600',
    features: ['Purchase & delivery tracking', 'Tank stock reconciliation', 'Fuel efficiency (km/L)', 'Budget variance analysis'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'tyre-lifecycle',
    name: 'Tyre Lifecycle',
    description: 'Manage tyre inventory, tread surveys, scrap rates, and cost per kilometre by brand.',
    category: 'Fleet',
    icon: CircleDot,
    color: 'bg-stone-500',
    features: ['Stock & purchase tracking', 'Tread depth monitoring', 'Scrap rate analysis', 'Cost per km by brand'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'parts-inventory',
    name: 'Parts & Inventory',
    description: 'Track parts stock levels, purchases, usage, turnover rates, and reorder alerts.',
    category: 'Fleet',
    icon: Package,
    color: 'bg-blue-600',
    features: ['Stock turnover rate', 'Reorder level alerts', 'Waste rate tracking', 'Supplier cost analysis'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'repairs-maintenance',
    name: 'Repairs & Maintenance',
    description: 'Log repairs, track parts and labour costs, downtime, and breakdown rates by vehicle class.',
    category: 'Fleet',
    icon: Wrench,
    color: 'bg-zinc-600',
    features: ['Parts & labour cost split', 'Downtime tracking', 'Breakdown rate', 'Warranty recovery'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'driver-compensation',
    name: 'Driver Compensation',
    description: 'Model driver salaries, overtime, bonuses, deductions, and total payroll by grade.',
    category: 'Fleet',
    icon: Wallet,
    color: 'bg-green-600',
    features: ['Gross & net pay modeling', 'Overtime & bonus tracking', 'Deduction breakdown', 'Total cost per driver'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'fines-compliance',
    name: 'Fines & Compliance',
    description: 'Track traffic fines, penalties, dispute outcomes, and repeat offender rates by region.',
    category: 'Fleet',
    icon: AlertTriangle,
    color: 'bg-yellow-600',
    features: ['Outstanding fines tracking', 'Repeat offender rate', 'Dispute recovery rate', 'Regional breakdown'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'route-performance',
    name: 'Route Performance',
    description: 'Analyse trip revenue, fuel efficiency, toll costs, and on-time delivery by route.',
    category: 'Fleet',
    icon: MapPin,
    color: 'bg-violet-600',
    features: ['Revenue & profit per trip', 'Fuel efficiency by route', 'Toll cost tracking', 'On-time delivery rate'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'weighbridge-ops',
    name: 'Weighbridge Operations',
    description: 'Monitor weighments, payload accuracy, overload rates, and compliance by station.',
    category: 'Fleet',
    icon: Scale,
    color: 'bg-slate-600',
    features: ['Payload tracking', 'Overload rate & fines', 'Weight variance analysis', 'Station comparison'],
    blocks: 13,
    boards: 1,
  },
  // ---- HR Extended (from AHC-HR) -----------------------------------------------
  {
    id: 'leave-management',
    name: 'Leave Management',
    description: 'Track leave entitlements, utilization rates, absenteeism, and leave liability by department.',
    category: 'HR',
    icon: CalendarDays,
    color: 'bg-cyan-600',
    features: ['Leave utilization rate', 'Absenteeism tracking', 'Approval rate', 'Leave liability forecast'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'compliance-risk',
    name: 'Compliance & Risk',
    description: 'Monitor BCEA, LRA, EEA, OHSA and POPIA compliance with risk scoring and audit readiness.',
    category: 'HR',
    icon: ShieldAlert,
    color: 'bg-red-700',
    features: ['Violation resolution rate', 'POPIA consent tracking', 'Audit readiness score', 'Legal cost analysis'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'employee-engagement',
    name: 'Employee Engagement',
    description: 'Measure eNPS, wellbeing, culture scores, and sentiment across pulse and annual surveys.',
    category: 'HR',
    icon: Heart,
    color: 'bg-pink-600',
    features: ['eNPS & wellbeing scores', 'Sentiment analysis', 'Action item tracking', 'Retention rate'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'payroll-planning',
    name: 'Payroll Planning',
    description: 'Model gross pay, PAYE, UIF, pension, medical aid deductions, and total cost to company.',
    category: 'Finance',
    icon: Banknote,
    color: 'bg-green-700',
    features: ['Gross & net pay modeling', 'Deduction breakdown', 'Cost per employee', 'Employer contributions'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'training-certification',
    name: 'Training & Certification',
    description: 'Track course completions, assessment pass rates, certificate renewals, and training ROI.',
    category: 'HR',
    icon: Award,
    color: 'bg-amber-600',
    features: ['Completion & pass rates', 'Certificate renewal tracking', 'Cost per completion', 'Learner satisfaction'],
    blocks: 14,
    boards: 1,
  },
  {
    id: 'saas-revenue',
    name: 'SaaS Revenue',
    description: 'Model MRR, ARR, churn, LTV, CAC, and subscriber growth by plan tier and channel.',
    category: 'Finance',
    icon: CreditCard,
    color: 'bg-indigo-600',
    features: ['MRR & ARR tracking', 'Churn rate analysis', 'LTV:CAC ratio', 'Net new MRR'],
    blocks: 15,
    boards: 1,
  },
  {
    id: 'communication-analytics',
    name: 'Communication Analytics',
    description: 'Analyse message delivery, read rates, response rates, and document collection across channels.',
    category: 'Operations',
    icon: MessageSquare,
    color: 'bg-blue-700',
    features: ['Delivery & read rates', 'Response rate tracking', 'Document collection rate', 'Cost per response'],
    blocks: 13,
    boards: 1,
  },
  {
    id: 'talent-pipeline',
    name: 'Talent Pipeline',
    description: 'Track candidate funnel conversion, time-to-hire, cost-per-hire, and source effectiveness.',
    category: 'HR',
    icon: GitBranch,
    color: 'bg-purple-600',
    features: ['Funnel conversion rate', 'Time & cost to hire', 'Source effectiveness', 'Quality of hire'],
    blocks: 14,
    boards: 1,
  },
];

const categories = ['All', ...Array.from(new Set(templates.map((t) => t.category)))];

export function TemplatesPage() {
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('All');
  const [deploying, setDeploying] = useState<string | null>(null);

  const deployMutation = useMutation({
    mutationFn: (body: { templateId: string; name: string; slug: string; description?: string }) =>
      api.post<{ app: { slug: string }; stats: Record<string, number> }>(
        `/${slug}/apps/deploy-template`,
        body,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const filtered = activeCategory === 'All'
    ? templates
    : templates.filter((t) => t.category === activeCategory);

  const deployTemplate = async (template: Template) => {
    setDeploying(template.id);
    try {
      const suffix = Date.now().toString(36).slice(-4);
      const result = await deployMutation.mutateAsync({
        templateId: template.id,
        name: template.name,
        slug: `${template.id}-${suffix}`,
        description: template.description,
      });
      if (result.data?.app?.slug) {
        navigate(`/${slug}/apps/${result.data.app.slug}`);
      }
    } catch (err) {
      console.error('Deploy failed:', err);
      alert(`Deploy failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeploying(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Template Library</h1>
        <p className="text-muted-foreground mt-1">
          Deploy pre-built planning models to get started in minutes
        </p>
      </div>

      <div className="flex items-center gap-3 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Best Practices &middot; Speed to Deployment &middot; Scalability
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((template) => {
          const Icon = template.icon;
          return (
            <div key={template.id} className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-all hover:shadow-md group">
              <div className={cn('h-2', template.color)} />
              <div className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center text-white', template.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground">{template.name}</h3>
                    <span className="text-xs text-muted-foreground">{template.category}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{template.description}</p>
                <ul className="space-y-1.5 mb-4">
                  {template.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="h-3 w-3 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    {template.blocks} blocks &middot; {template.boards} boards
                  </div>
                  <button
                    onClick={() => deployTemplate(template)}
                    disabled={deploying === template.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {deploying === template.id ? (
                      'Deploying...'
                    ) : (
                      <>
                        <Rocket className="h-3 w-3" /> Deploy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
