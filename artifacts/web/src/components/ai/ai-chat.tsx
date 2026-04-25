import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Bot,
  User,
  Sparkles,
  Brain,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useGenerateModel,
  useApplyModel,
  useAnalyzeData,
  type ModelPlan,
  type AnalysisResult,
  type ChartConfig,
  type AnalysisHighlight,
} from '@/lib/hooks/use-ai';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  '#7c3aed',
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#06b6d4',
  '#d946ef',
  '#84cc16',
];

const BLOCK_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  input: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  calculated: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400' },
  assumption: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  output: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  constant: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' },
};

// ---------------------------------------------------------------------------
// Chat Message
// ---------------------------------------------------------------------------

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: React.ReactNode;
}

function ChatMessage({ role, content }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        role === 'user' ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
        )}
      >
        {role === 'user' ? (
          <User className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </div>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline Chart (for analysis results)
// ---------------------------------------------------------------------------

interface InlineChartTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function InlineChartTooltip({ active, payload, label }: InlineChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-md">
      <p className="mb-1 text-xs font-medium text-popover-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-popover-foreground">
            {typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function InlineChart({ config }: { config: ChartConfig }) {
  const data = config.data;
  const xKey = config.xKey;
  const yKeys = config.yKeys;

  const sharedCartesian = (
    <>
      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
        axisLine={{ stroke: 'var(--color-border)' }}
        tickLine={false}
      />
      <YAxis
        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<InlineChartTooltip />} />
    </>
  );

  return (
    <div className="mt-2 rounded-md border border-border bg-background p-2">
      {config.title && (
        <p className="mb-1 text-xs font-medium text-foreground">
          {config.title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        {config.type === 'bar' ? (
          <BarChart data={data}>
            {sharedCartesian}
            {yKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        ) : config.type === 'line' ? (
          <LineChart data={data}>
            {sharedCartesian}
            {yKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        ) : config.type === 'area' ? (
          <AreaChart data={data}>
            <defs>
              {yKeys.map((key, i) => {
                const color = CHART_COLORS[i % CHART_COLORS.length] ?? '#7c3aed';
                return (
                  <linearGradient
                    key={key}
                    id={`ai-gradient-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                );
              })}
            </defs>
            {sharedCartesian}
            {yKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                fill={`url(#ai-gradient-${key})`}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        ) : (
          <PieChart>
            <Pie
              data={data.map((d) => ({
                name: String(d[xKey] ?? ''),
                value: Number(d[yKeys[0] ?? ''] ?? 0),
              }))}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<InlineChartTooltip />} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Highlight Cards
// ---------------------------------------------------------------------------

function HighlightCards({ highlights }: { highlights: AnalysisHighlight[] }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-2">
      {highlights.map((h, i) => (
        <div
          key={i}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {h.metric}
            </span>
            <span className="text-sm font-bold text-foreground">
              {h.value.toLocaleString()}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{h.insight}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Model Plan Preview
// ---------------------------------------------------------------------------

function ModelPlanPreview({
  plan,
  onApply,
  isApplying,
  isApplied,
}: {
  plan: ModelPlan;
  onApply: () => void;
  isApplying: boolean;
  isApplied: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm">{plan.description}</p>

      {/* Dimensions */}
      {plan.dimensions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Dimensions
          </p>
          <div className="space-y-1">
            {plan.dimensions.map((dim) => (
              <div
                key={dim.slug}
                className="flex items-center justify-between rounded-md bg-background border border-border px-2.5 py-1.5"
              >
                <span className="text-xs font-medium text-foreground">
                  {dim.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {dim.members.length} member{dim.members.length !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocks */}
      {plan.blocks.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Blocks
          </p>
          <div className="space-y-1">
            {plan.blocks.map((block) => {
              const typeStyle = BLOCK_TYPE_COLORS[block.blockType] ?? BLOCK_TYPE_COLORS['input']!;
              return (
                <div
                  key={block.slug}
                  className="rounded-md bg-background border border-border px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {block.name}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
                        typeStyle.bg,
                        typeStyle.text,
                      )}
                    >
                      {block.blockType}
                    </span>
                  </div>
                  {block.formula && (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      = {block.formula}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Apply button */}
      <button
        type="button"
        onClick={onApply}
        disabled={isApplying || isApplied}
        className={cn(
          'w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
          isApplied
            ? 'bg-green-600 text-white cursor-default'
            : 'bg-violet-600 text-white hover:bg-violet-700',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isApplied ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Model Applied
          </>
        ) : isApplying ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Applying...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Apply Model
          </>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message entry type
// ---------------------------------------------------------------------------

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelPlan?: ModelPlan;
  analysis?: AnalysisResult;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface AiChatProps {
  workspaceSlug?: string;
  appSlug?: string;
  open: boolean;
  onClose: () => void;
}

export function AiChat({ workspaceSlug, appSlug, open, onClose }: AiChatProps) {
  const [activeTab, setActiveTab] = useState<'modeler' | 'analyst'>('modeler');
  const [modelerMessages, setModelerMessages] = useState<ChatEntry[]>([]);
  const [analystMessages, setAnalystMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [appliedPlanIds, setAppliedPlanIds] = useState<Set<string>>(
    () => new Set(),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const generateModel = useGenerateModel();
  const applyModel = useApplyModel();
  const analyzeData = useAnalyzeData();

  const isAppContext = !!workspaceSlug && !!appSlug;
  const isPending =
    activeTab === 'modeler'
      ? generateModel.isPending
      : analyzeData.isPending;

  const messages =
    activeTab === 'modeler' ? modelerMessages : analystMessages;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus textarea on open / tab switch
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open, activeTab]);

  // Close panel on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const addMessage = useCallback(
    (
      tab: 'modeler' | 'analyst',
      entry: ChatEntry,
    ) => {
      if (tab === 'modeler') {
        setModelerMessages((prev) => [...prev, entry]);
      } else {
        setAnalystMessages((prev) => [...prev, entry]);
      }
    },
    [],
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !isAppContext) return;

    const userEntry: ChatEntry = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    addMessage(activeTab, userEntry);
    setInput('');

    if (activeTab === 'modeler') {
      generateModel.mutate(
        {
          workspaceSlug: workspaceSlug!,
          appSlug: appSlug!,
          description: trimmed,
        },
        {
          onSuccess: (res) => {
            const plan = res.data;
            addMessage('modeler', {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: plan?.description ?? 'Here is the generated model plan:',
              modelPlan: plan ?? undefined,
            });
          },
          onError: (err) => {
            addMessage('modeler', {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Something went wrong: ${err.message}`,
            });
          },
        },
      );
    } else {
      analyzeData.mutate(
        {
          workspaceSlug: workspaceSlug!,
          appSlug: appSlug!,
          question: trimmed,
        },
        {
          onSuccess: (res) => {
            const analysis = res.data;
            addMessage('analyst', {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: analysis?.answer ?? 'Here is the analysis:',
              analysis: analysis ?? undefined,
            });
          },
          onError: (err) => {
            addMessage('analyst', {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `Something went wrong: ${err.message}`,
            });
          },
        },
      );
    }
  }, [
    input,
    isAppContext,
    activeTab,
    workspaceSlug,
    appSlug,
    generateModel,
    analyzeData,
    addMessage,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleApplyPlan = useCallback(
    (entryId: string, plan: ModelPlan) => {
      if (!isAppContext) return;
      applyModel.mutate(
        {
          workspaceSlug: workspaceSlug!,
          appSlug: appSlug!,
          plan,
        },
        {
          onSuccess: () => {
            setAppliedPlanIds((prev) => new Set(prev).add(entryId));
          },
        },
      );
    },
    [isAppContext, workspaceSlug, appSlug, applyModel],
  );

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="AI Assistant"
        aria-modal="true"
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col',
          'border-l border-border bg-card shadow-xl',
          'animate-in slide-in-from-right duration-300',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-violet-500" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">
              AI Assistant
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            aria-label="Close AI panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'modeler' | 'analyst')}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="px-4 pt-2">
            <TabsList className="w-full">
              <TabsTrigger value="modeler" className="flex-1 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Modeler
              </TabsTrigger>
              <TabsTrigger value="analyst" className="flex-1 gap-1.5">
                <Brain className="h-3.5 w-3.5" aria-hidden="true" />
                Analyst
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Modeler tab content */}
          <TabsContent
            value="modeler"
            className="flex flex-1 flex-col overflow-hidden m-0"
          >
            <div
              ref={activeTab === 'modeler' ? scrollRef : undefined}
              className="flex-1 overflow-y-auto"
            >
              {!isAppContext ? (
                <NoAppContext />
              ) : modelerMessages.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="AI Modeler"
                  description='Describe the model you want to build, such as "Build a SaaS revenue model with MRR, churn, and expansion".'
                />
              ) : (
                <div className="py-2">
                  {modelerMessages.map((entry) => (
                    <ChatMessage
                      key={entry.id}
                      role={entry.role}
                      content={
                        entry.modelPlan ? (
                          <ModelPlanPreview
                            plan={entry.modelPlan}
                            onApply={() =>
                              handleApplyPlan(entry.id, entry.modelPlan!)
                            }
                            isApplying={applyModel.isPending}
                            isApplied={appliedPlanIds.has(entry.id)}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{entry.content}</p>
                        )
                      }
                    />
                  ))}
                  {generateModel.isPending && <LoadingBubble />}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Analyst tab content */}
          <TabsContent
            value="analyst"
            className="flex flex-1 flex-col overflow-hidden m-0"
          >
            <div
              ref={activeTab === 'analyst' ? scrollRef : undefined}
              className="flex-1 overflow-y-auto"
            >
              {!isAppContext ? (
                <NoAppContext />
              ) : analystMessages.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="AI Analyst"
                  description='Ask a question about your data, such as "Why did revenue drop in March?" or "Show me top 5 products by revenue".'
                />
              ) : (
                <div className="py-2">
                  {analystMessages.map((entry) => (
                    <ChatMessage
                      key={entry.id}
                      role={entry.role}
                      content={
                        entry.analysis ? (
                          <div>
                            <p className="whitespace-pre-wrap">
                              {entry.analysis.answer}
                            </p>
                            {entry.analysis.chartConfig && (
                              <InlineChart config={entry.analysis.chartConfig} />
                            )}
                            {entry.analysis.highlights &&
                              entry.analysis.highlights.length > 0 && (
                                <HighlightCards
                                  highlights={entry.analysis.highlights}
                                />
                              )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{entry.content}</p>
                        )
                      }
                    />
                  ))}
                  {analyzeData.isPending && <LoadingBubble />}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Input area */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !isAppContext
                  ? 'Open an app to use AI features'
                  : activeTab === 'modeler'
                    ? 'Describe the model you want to build...'
                    : 'Ask a question about your data...'
              }
              disabled={!isAppContext || isPending}
              rows={2}
              className={cn(
                'flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              aria-label={
                activeTab === 'modeler'
                  ? 'Model description input'
                  : 'Analysis question input'
              }
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || !isAppContext || isPending}
              className={cn(
                'inline-flex items-center justify-center rounded-md p-2.5 transition-colors',
                'bg-violet-600 text-white hover:bg-violet-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              aria-label="Send message"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30">
        <Icon className="h-6 w-6 text-violet-600 dark:text-violet-400" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function NoAppContext() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">No App Selected</h3>
      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
        Open an app to use AI features. Navigate to an application to get
        started.
      </p>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
        <Bot className="h-3.5 w-3.5" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
