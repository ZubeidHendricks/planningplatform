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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardCheck,
  Eye,
  Star,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REVIEW_PERIODS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const REVIEW_STATUSES = ['Draft', 'Submitted', 'Acknowledged'] as const;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  CURRENT_YEAR - 1,
  CURRENT_YEAR,
  CURRENT_YEAR + 1,
].map(String);

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  Draft: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  Submitted: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Acknowledged: 'bg-green-500/15 text-green-400 border-green-500/30',
};

// ---------------------------------------------------------------------------
// Inline star rating display
// ---------------------------------------------------------------------------

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= rating
              ? 'fill-amber-400 text-amber-400'
              : 'fill-none text-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface ReviewForm {
  employee: string;
  period: string;
  year: string;
  reviewer: string;
  rating: string;
  status: string;
  dueDate: string;
  strengths: string;
  improvements: string;
  notes: string;
}

const emptyForm: ReviewForm = {
  employee: '',
  period: 'Q1',
  year: String(CURRENT_YEAR),
  reviewer: '',
  rating: '3',
  status: 'Draft',
  dueDate: '',
  strengths: '',
  improvements: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerformanceReviewsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [tabFilter, setTabFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<ReviewForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'survey_response');
  const createRecord = useCreateModuleRecord(ws, app, 'survey_response');
  const updateRecord = useUpdateModuleRecord(ws, app, 'survey_response');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'survey_response');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    let results = allRecords;
    if (tabFilter !== 'all') {
      results = results.filter(
        (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
      );
    }
    if (periodFilter !== 'all') {
      results = results.filter(
        (r) => (r.data.period as string) === periodFilter,
      );
    }
    return results;
  }, [allRecords, tabFilter, periodFilter]);

  const setField = (field: keyof ReviewForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.employee,
      status: form.status,
      priority: 'medium',
      data: {
        period: form.period,
        year: form.year,
        reviewer: form.reviewer,
        rating: parseInt(form.rating, 10),
        dueDate: form.dueDate,
        strengths: form.strengths,
        improvements: form.improvements,
        notes: form.notes,
      },
    });
    setShowAdd(false);
    setForm(emptyForm);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    await updateRecord.mutateAsync({
      id: editRecord.id,
      title: form.employee,
      status: form.status,
      data: {
        ...editRecord.data,
        period: form.period,
        year: form.year,
        reviewer: form.reviewer,
        rating: parseInt(form.rating, 10),
        dueDate: form.dueDate,
        strengths: form.strengths,
        improvements: form.improvements,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      employee: record.title,
      period: (record.data.period as string) || 'Q1',
      year: (record.data.year as string) || String(CURRENT_YEAR),
      reviewer: (record.data.reviewer as string) || '',
      rating: record.data.rating != null ? String(record.data.rating) : '3',
      status: record.status || 'Draft',
      dueDate: (record.data.dueDate as string) || '',
      strengths: (record.data.strengths as string) || '',
      improvements: (record.data.improvements as string) || '',
      notes: (record.data.notes as string) || '',
    });
    setEditRecord(record);
  };

  const handleDelete = (id: string) => {
    deleteRecord.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const tabCounts: Record<string, number> = {
    all: allRecords.length,
    draft: allRecords.filter((r) => r.status === 'Draft').length,
    submitted: allRecords.filter((r) => r.status === 'Submitted').length,
    acknowledged: allRecords.filter((r) => r.status === 'Acknowledged').length,
  };

  const formFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="rev-emp">Employee</Label>
        <Input
          id="rev-emp"
          value={form.employee}
          onChange={(e) => setField('employee', e.target.value)}
          placeholder="Employee name"
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Period</Label>
          <Select
            value={form.period}
            onValueChange={(val) => setField('period', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_PERIODS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Year</Label>
          <Select
            value={form.year}
            onValueChange={(val) => setField('year', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
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
              {REVIEW_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rev-reviewer">Reviewer</Label>
          <Input
            id="rev-reviewer"
            value={form.reviewer}
            onChange={(e) => setField('reviewer', e.target.value)}
            placeholder="Manager name"
          />
        </div>
        <div>
          <Label htmlFor="rev-due">Due Date</Label>
          <Input
            id="rev-due"
            type="date"
            value={form.dueDate}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label>Overall Rating</Label>
        <div className="flex items-center gap-2 mt-1">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setField('rating', String(val))}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              aria-label={`${val} star${val !== 1 ? 's' : ''}`}
            >
              <Star
                className={cn(
                  'h-6 w-6 transition-colors',
                  val <= parseInt(form.rating, 10)
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-none text-muted-foreground/30 hover:text-amber-400/50',
                )}
              />
            </button>
          ))}
          <span className="text-sm text-muted-foreground ml-2">
            {form.rating}/5
          </span>
        </div>
      </div>
      <div>
        <Label htmlFor="rev-strengths">Strengths</Label>
        <textarea
          id="rev-strengths"
          value={form.strengths}
          onChange={(e) => setField('strengths', e.target.value)}
          placeholder="Key strengths observed..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <Label htmlFor="rev-improvements">Areas for Improvement</Label>
        <textarea
          id="rev-improvements"
          value={form.improvements}
          onChange={(e) => setField('improvements', e.target.value)}
          placeholder="Areas to develop..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <Label htmlFor="rev-notes">Additional Notes</Label>
        <textarea
          id="rev-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Any other comments..."
          rows={2}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Performance Reviews</h2>
          <p className="text-sm text-muted-foreground">
            Manage employee performance reviews and ratings
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Review
        </Button>
      </div>

      {/* Period filter */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={periodFilter} onValueChange={setPeriodFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {REVIEW_PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="draft">
            Draft ({tabCounts.draft})
          </TabsTrigger>
          <TabsTrigger value="submitted">
            Submitted ({tabCounts.submitted})
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged ({tabCounts.acknowledged})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No performance reviews found</p>
              <p className="text-sm mt-1">
                Create a review to get started.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Review Period
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Reviewer
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Overall Rating
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Due Date
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = (record.status || 'Draft') as ReviewStatus;
                      const rating = (record.data.rating as number) ?? 0;
                      const period = (record.data.period as string) || '';
                      const year = (record.data.year as string) || '';

                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {record.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {period && year ? `${period} ${year}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.reviewer as string) || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <StarRating rating={rating} />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={cn(
                                'border-0 text-[10px]',
                                STATUS_BADGE_CLASSES[status] ??
                                  STATUS_BADGE_CLASSES.Draft,
                              )}
                            >
                              {status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.dueDate
                              ? new Date(record.data.dueDate as string).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewRecord(record)}
                                aria-label="View review"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit review"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete review"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Performance Review</DialogTitle>
            <DialogDescription>
              Create a new performance review for an employee.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {formFields}
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
                {createRecord.isPending ? 'Creating...' : 'Create Review'}
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
            <DialogTitle>Edit Performance Review</DialogTitle>
            <DialogDescription>
              Update performance review details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {formFields}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{viewRecord.title}</DialogTitle>
                <DialogDescription>Performance review details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_BADGE_CLASSES[
                        (viewRecord.status || 'Draft') as ReviewStatus
                      ] ?? STATUS_BADGE_CLASSES.Draft,
                    )}
                  >
                    {viewRecord.status || 'Draft'}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Period</span>
                  <span>
                    {viewRecord.data.period && viewRecord.data.year
                      ? `${viewRecord.data.period} ${viewRecord.data.year}`
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Reviewer</span>
                  <span>{(viewRecord.data.reviewer as string) || '-'}</span>
                  <span className="text-muted-foreground">Due Date</span>
                  <span>
                    {viewRecord.data.dueDate
                      ? new Date(viewRecord.data.dueDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Overall Rating</span>
                  <span>
                    <StarRating rating={(viewRecord.data.rating as number) ?? 0} />
                  </span>
                </div>

                {viewRecord.data.strengths ? (
                  <div>
                    <p className="text-sm font-medium mb-1">Strengths</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                      {viewRecord.data.strengths as string}
                    </p>
                  </div>
                ) : null}

                {viewRecord.data.improvements ? (
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Areas for Improvement
                    </p>
                    <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                      {viewRecord.data.improvements as string}
                    </p>
                  </div>
                ) : null}

                {viewRecord.data.notes ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3">
                      {viewRecord.data.notes as string}
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PerformanceReviewsPage;
