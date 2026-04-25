import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import {
  useModuleRecords,
  useCreateModuleRecord,
  useUpdateModuleRecord,
  useDeleteModuleRecord,
  type ModuleRecord,
} from '@/lib/hooks/use-modules';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  ClipboardList,
  Pencil,
  Trash2,
  Eye,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SURVEY_TYPES = [
  'engagement',
  'satisfaction',
  'pulse',
  'exit',
  'onboarding',
] as const;

type SurveyType = (typeof SURVEY_TYPES)[number];

const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  engagement: 'Engagement',
  satisfaction: 'Satisfaction',
  pulse: 'Pulse',
  exit: 'Exit',
  onboarding: 'Onboarding',
};

const SURVEY_STATUSES = ['draft', 'active', 'closed'] as const;

type SurveyStatus = (typeof SURVEY_STATUSES)[number];

const STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
};

const STATUS_COLORS: Record<SurveyStatus, string> = {
  draft: 'bg-gray-500/15 text-gray-400',
  active: 'bg-green-500/15 text-green-400',
  closed: 'bg-blue-500/15 text-blue-400',
};

const SCORE_CATEGORIES = [
  'Overall',
  'Communication',
  'Leadership',
  'Work-Life Balance',
  'Growth',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function responseRateColor(rate: number): string {
  if (rate >= 75) return 'text-green-400';
  if (rate >= 50) return 'text-amber-400';
  return 'text-red-400';
}

function scoreColor(score: number): string {
  if (score >= 4) return 'text-green-400';
  if (score >= 3) return 'text-amber-400';
  if (score >= 2) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBarWidth(score: number): string {
  return `${Math.min(100, (score / 5) * 100)}%`;
}

function scoreBarColor(score: number): string {
  if (score >= 4) return 'bg-green-500';
  if (score >= 3) return 'bg-amber-500';
  if (score >= 2) return 'bg-orange-500';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface SurveyForm {
  name: string;
  surveyType: string;
  status: string;
  startDate: string;
  endDate: string;
  targetResponses: string;
  responsesCount: string;
  avgScore: string;
  description: string;
  scoreBreakdown: string;
}

const emptyForm: SurveyForm = {
  name: '',
  surveyType: 'engagement',
  status: 'draft',
  startDate: '',
  endDate: '',
  targetResponses: '',
  responsesCount: '0',
  avgScore: '',
  description: '',
  scoreBreakdown: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SurveysPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [form, setForm] = useState<SurveyForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'survey_response', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'survey_response');
  const updateRecord = useUpdateModuleRecord(ws, app, 'survey_response');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'survey_response');

  const records = data?.records ?? [];

  // Summary stats
  const stats = useMemo(() => {
    const active = records.filter((r) => r.status === 'active').length;
    const totalResponses = records.reduce(
      (sum, r) => sum + ((r.data.responsesCount as number) || 0),
      0,
    );
    const scoresArr = records
      .map((r) => r.data.avgScore as number)
      .filter((s) => s != null && s > 0);
    const avgScore =
      scoresArr.length > 0
        ? scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length
        : 0;
    return { active, totalResponses, avgScore };
  }, [records]);

  const setField = (field: keyof SurveyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse score breakdown
    let breakdown: Record<string, number> = {};
    if (form.scoreBreakdown) {
      try {
        breakdown = JSON.parse(form.scoreBreakdown);
      } catch {
        // Ignore parse errors, store empty
      }
    }

    await createRecord.mutateAsync({
      title: form.name,
      status: form.status,
      priority: 'medium',
      data: {
        surveyType: form.surveyType,
        startDate: form.startDate,
        endDate: form.endDate,
        targetResponses: parseInt(form.targetResponses, 10) || 0,
        responsesCount: parseInt(form.responsesCount, 10) || 0,
        avgScore: parseFloat(form.avgScore) || 0,
        description: form.description,
        scoreBreakdown: breakdown,
      },
    });
    setShowAdd(false);
    setForm(emptyForm);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;

    let breakdown: Record<string, number> = {};
    if (form.scoreBreakdown) {
      try {
        breakdown = JSON.parse(form.scoreBreakdown);
      } catch {
        breakdown =
          (editRecord.data.scoreBreakdown as Record<string, number>) || {};
      }
    }

    await updateRecord.mutateAsync({
      id: editRecord.id,
      title: form.name,
      status: form.status,
      data: {
        ...editRecord.data,
        surveyType: form.surveyType,
        startDate: form.startDate,
        endDate: form.endDate,
        targetResponses: parseInt(form.targetResponses, 10) || 0,
        responsesCount: parseInt(form.responsesCount, 10) || 0,
        avgScore: parseFloat(form.avgScore) || 0,
        description: form.description,
        scoreBreakdown: breakdown,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    const breakdown = record.data.scoreBreakdown as Record<string, number> | undefined;
    setForm({
      name: record.title,
      surveyType: (record.data.surveyType as string) || 'engagement',
      status: record.status || 'draft',
      startDate: (record.data.startDate as string) || '',
      endDate: (record.data.endDate as string) || '',
      targetResponses: String((record.data.targetResponses as number) || ''),
      responsesCount: String((record.data.responsesCount as number) || 0),
      avgScore: String((record.data.avgScore as number) || ''),
      description: (record.data.description as string) || '',
      scoreBreakdown: breakdown ? JSON.stringify(breakdown, null, 2) : '',
    });
    setEditRecord(record);
  };

  const handleDelete = (id: string) => {
    deleteRecord.mutate(id);
  };

  const toggleExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Shared form fields
  const surveyFormFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="survey-name">Survey Name</Label>
        <Input
          id="survey-name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Q1 Employee Engagement Survey"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select
            value={form.surveyType}
            onValueChange={(val) => setField('surveyType', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURVEY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {SURVEY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={form.status}
            onValueChange={(val) => setField('status', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURVEY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="survey-start">Start Date</Label>
          <Input
            id="survey-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="survey-end">End Date</Label>
          <Input
            id="survey-end"
            type="date"
            value={form.endDate}
            onChange={(e) => setField('endDate', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="survey-target">Target Responses</Label>
          <Input
            id="survey-target"
            type="number"
            min={0}
            value={form.targetResponses}
            onChange={(e) => setField('targetResponses', e.target.value)}
            placeholder="100"
          />
        </div>
        <div>
          <Label htmlFor="survey-responses">Responses</Label>
          <Input
            id="survey-responses"
            type="number"
            min={0}
            value={form.responsesCount}
            onChange={(e) => setField('responsesCount', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="survey-avg">Avg Score (1-5)</Label>
          <Input
            id="survey-avg"
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={form.avgScore}
            onChange={(e) => setField('avgScore', e.target.value)}
            placeholder="4.2"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="survey-desc">Description</Label>
        <textarea
          id="survey-desc"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Survey description..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <Label htmlFor="survey-breakdown">
          Score Breakdown (JSON)
        </Label>
        <textarea
          id="survey-breakdown"
          value={form.scoreBreakdown}
          onChange={(e) => setField('scoreBreakdown', e.target.value)}
          placeholder={'{\n  "Overall": 4.2,\n  "Communication": 3.8,\n  "Leadership": 4.0\n}'}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Optional. Enter category scores as JSON key-value pairs.
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Surveys</h2>
          <p className="text-sm text-muted-foreground">
            Create, manage, and analyse employee surveys
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Survey
        </Button>
      </div>

      {/* Quick stats */}
      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">Active Surveys</p>
            <p className="text-2xl font-semibold">{stats.active}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Total Responses
            </p>
            <p className="text-2xl font-semibold">
              {stats.totalResponses.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">
              Avg Score (all)
            </p>
            <p className={cn('text-2xl font-semibold', scoreColor(stats.avgScore))}>
              {stats.avgScore > 0 ? stats.avgScore.toFixed(1) : '-'}
              <span className="text-sm text-muted-foreground font-normal">
                /5
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search surveys..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No surveys yet</p>
          <p className="text-sm mt-1">
            Create your first survey to start collecting feedback.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-8" />
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Survey Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Responses
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Avg Score
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Start Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    End Date
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => {
                  const status = (record.status || 'draft') as SurveyStatus;
                  const surveyType =
                    (record.data.surveyType as SurveyType) || 'engagement';
                  const responsesCount =
                    (record.data.responsesCount as number) || 0;
                  const targetResponses =
                    (record.data.targetResponses as number) || 0;
                  const avgScore = (record.data.avgScore as number) || 0;
                  const responseRate =
                    targetResponses > 0
                      ? Math.round((responsesCount / targetResponses) * 100)
                      : 0;
                  const isExpanded = expandedRow === record.id;
                  const breakdown =
                    (record.data.scoreBreakdown as Record<string, number>) ||
                    {};
                  const hasBreakdown = Object.keys(breakdown).length > 0;

                  return (
                    <>
                      <tr
                        key={record.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3">
                          {hasBreakdown && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(record.id)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={
                                isExpanded
                                  ? 'Collapse score breakdown'
                                  : 'Expand score breakdown'
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {record.title}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-[10px]">
                            {SURVEY_TYPE_LABELS[surveyType] || surveyType}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-foreground">
                            {responsesCount}
                          </span>
                          {targetResponses > 0 && (
                            <span className="text-muted-foreground">
                              /{targetResponses}
                            </span>
                          )}
                          {targetResponses > 0 && (
                            <span
                              className={cn(
                                'ml-2 text-xs',
                                responseRateColor(responseRate),
                              )}
                            >
                              {responseRate}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {avgScore > 0 ? (
                            <span className={cn('font-medium', scoreColor(avgScore))}>
                              {avgScore.toFixed(1)}
                              <span className="text-muted-foreground font-normal">
                                /5
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={cn(
                              'border-0 text-[10px]',
                              STATUS_COLORS[status] ?? STATUS_COLORS.draft,
                            )}
                          >
                            {STATUS_LABELS[status] || status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {record.data.startDate
                            ? new Date(
                                record.data.startDate as string,
                              ).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {record.data.endDate
                            ? new Date(
                                record.data.endDate as string,
                              ).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setViewRecord(record)}
                              aria-label="View survey"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(record)}
                              aria-label="Edit survey"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(record.id)}
                              aria-label="Delete survey"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {/* Expandable score breakdown row */}
                      {isExpanded && hasBreakdown && (
                        <tr key={`${record.id}-breakdown`}>
                          <td
                            colSpan={9}
                            className="px-8 py-4 bg-muted/20 border-b border-border"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <BarChart3 className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm font-medium">
                                Score Breakdown
                              </p>
                            </div>
                            <div className="space-y-2 max-w-md">
                              {Object.entries(breakdown).map(
                                ([category, score]) => (
                                  <div
                                    key={category}
                                    className="flex items-center gap-3"
                                  >
                                    <span className="text-sm text-muted-foreground w-32 shrink-0">
                                      {category}
                                    </span>
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={cn(
                                          'h-full rounded-full transition-all',
                                          scoreBarColor(score),
                                        )}
                                        style={{
                                          width: scoreBarWidth(score),
                                        }}
                                      />
                                    </div>
                                    <span
                                      className={cn(
                                        'text-sm font-medium w-8 text-right',
                                        scoreColor(score),
                                      )}
                                    >
                                      {score.toFixed(1)}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Survey</DialogTitle>
            <DialogDescription>
              Create a new survey to collect employee feedback.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {surveyFormFields}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdd(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createRecord.isPending}>
                {createRecord.isPending ? 'Adding...' : 'Add Survey'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => {
          if (!open) {
            setEditRecord(null);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Survey</DialogTitle>
            <DialogDescription>Update survey details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {surveyFormFields}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditRecord(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateRecord.isPending}>
                {updateRecord.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog
        open={!!viewRecord}
        onOpenChange={(open) => {
          if (!open) setViewRecord(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {viewRecord && (() => {
            const vStatus = (viewRecord.status || 'draft') as SurveyStatus;
            const vType = (viewRecord.data.surveyType as SurveyType) || 'engagement';
            const vResponses = (viewRecord.data.responsesCount as number) || 0;
            const vTarget = (viewRecord.data.targetResponses as number) || 0;
            const vAvg = (viewRecord.data.avgScore as number) || 0;
            const vRate = vTarget > 0 ? Math.round((vResponses / vTarget) * 100) : 0;
            const vBreakdown = (viewRecord.data.scoreBreakdown as Record<string, number>) || {};

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{viewRecord.title}</DialogTitle>
                  <DialogDescription>Survey details</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'border-0',
                        STATUS_COLORS[vStatus] ?? STATUS_COLORS.draft,
                      )}
                    >
                      {STATUS_LABELS[vStatus] || vStatus}
                    </Badge>
                    <Badge variant="secondary">
                      {SURVEY_TYPE_LABELS[vType] || vType}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Responses</span>
                    <span>
                      {vResponses}
                      {vTarget > 0 && ` / ${vTarget}`}
                      {vTarget > 0 && (
                        <span className={cn('ml-2', responseRateColor(vRate))}>
                          ({vRate}%)
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">Avg Score</span>
                    <span className={cn(vAvg > 0 ? scoreColor(vAvg) : '')}>
                      {vAvg > 0 ? `${vAvg.toFixed(1)}/5` : '-'}
                    </span>
                    <span className="text-muted-foreground">Start Date</span>
                    <span>
                      {viewRecord.data.startDate
                        ? new Date(viewRecord.data.startDate as string).toLocaleDateString()
                        : '-'}
                    </span>
                    <span className="text-muted-foreground">End Date</span>
                    <span>
                      {viewRecord.data.endDate
                        ? new Date(viewRecord.data.endDate as string).toLocaleDateString()
                        : '-'}
                    </span>
                    <span className="text-muted-foreground">Created</span>
                    <span>
                      {new Date(viewRecord.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Score breakdown in detail */}
                  {Object.keys(vBreakdown).length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Score Breakdown</p>
                      <div className="space-y-2">
                        {Object.entries(vBreakdown).map(([category, score]) => (
                          <div key={category} className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground w-32 shrink-0">
                              {category}
                            </span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  scoreBarColor(score),
                                )}
                                style={{ width: scoreBarWidth(score) }}
                              />
                            </div>
                            <span
                              className={cn(
                                'text-sm font-medium w-8 text-right',
                                scoreColor(score),
                              )}
                            >
                              {score.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewRecord.data.description ? (
                    <div>
                      <p className="text-sm font-medium mb-1">Description</p>
                      <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                        {viewRecord.data.description as string}
                      </p>
                    </div>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const rec = viewRecord;
                      setViewRecord(null);
                      openEdit(rec);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SurveysPage;
