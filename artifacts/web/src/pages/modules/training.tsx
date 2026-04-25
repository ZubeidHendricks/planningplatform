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
  GraduationCap,
  Eye,
  AlertTriangle,
  Award,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRAINING_CATEGORIES = [
  'Compliance',
  'Technical',
  'Leadership',
  'Safety',
] as const;

const TRAINING_STATUSES = [
  'Enrolled',
  'In Progress',
  'Completed',
  'Expired',
] as const;

type TrainingStatus = (typeof TRAINING_STATUSES)[number];

const STATUS_BADGE_CLASSES: Record<TrainingStatus, string> = {
  Enrolled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'In Progress': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  Expired: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpiringSoon(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  const daysUntil = diff / (1000 * 60 * 60 * 24);
  return daysUntil > 0 && daysUntil <= 30;
}

function isExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface TrainingForm {
  courseName: string;
  employee: string;
  category: string;
  status: string;
  startDate: string;
  completionDate: string;
  expiryDate: string;
  score: string;
  certificate: string;
  notes: string;
}

const emptyForm: TrainingForm = {
  courseName: '',
  employee: '',
  category: 'Technical',
  status: 'Enrolled',
  startDate: '',
  completionDate: '',
  expiryDate: '',
  score: '',
  certificate: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrainingPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [tabFilter, setTabFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<TrainingForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'training_course');
  const createRecord = useCreateModuleRecord(ws, app, 'training_course');
  const updateRecord = useUpdateModuleRecord(ws, app, 'training_course');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'training_course');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (tabFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
    );
  }, [allRecords, tabFilter]);

  const setField = (field: keyof TrainingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.courseName,
      status: form.status,
      priority: 'medium',
      data: {
        employee: form.employee,
        category: form.category,
        startDate: form.startDate,
        completionDate: form.completionDate,
        expiryDate: form.expiryDate,
        score: form.score ? parseInt(form.score, 10) : null,
        certificate: form.certificate,
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
      title: form.courseName,
      status: form.status,
      data: {
        ...editRecord.data,
        employee: form.employee,
        category: form.category,
        startDate: form.startDate,
        completionDate: form.completionDate,
        expiryDate: form.expiryDate,
        score: form.score ? parseInt(form.score, 10) : null,
        certificate: form.certificate,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      courseName: record.title,
      employee: (record.data.employee as string) || '',
      category: (record.data.category as string) || 'Technical',
      status: record.status || 'Enrolled',
      startDate: (record.data.startDate as string) || '',
      completionDate: (record.data.completionDate as string) || '',
      expiryDate: (record.data.expiryDate as string) || '',
      score: record.data.score != null ? String(record.data.score) : '',
      certificate: (record.data.certificate as string) || '',
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
    'in progress': allRecords.filter((r) => r.status === 'In Progress').length,
    completed: allRecords.filter((r) => r.status === 'Completed').length,
    expired: allRecords.filter((r) => r.status === 'Expired').length,
  };

  const formFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="train-course">Course Name</Label>
        <Input
          id="train-course"
          value={form.courseName}
          onChange={(e) => setField('courseName', e.target.value)}
          placeholder="Course title"
          required
        />
      </div>
      <div>
        <Label htmlFor="train-emp">Employee</Label>
        <Input
          id="train-emp"
          value={form.employee}
          onChange={(e) => setField('employee', e.target.value)}
          placeholder="Employee name"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select
            value={form.category}
            onValueChange={(val) => setField('category', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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
              {TRAINING_STATUSES.map((s) => (
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
          <Label htmlFor="train-start">Start Date</Label>
          <Input
            id="train-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="train-complete">Completion Date</Label>
          <Input
            id="train-complete"
            type="date"
            value={form.completionDate}
            onChange={(e) => setField('completionDate', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="train-expiry">Expiry Date</Label>
          <Input
            id="train-expiry"
            type="date"
            value={form.expiryDate}
            onChange={(e) => setField('expiryDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="train-score">Score (%)</Label>
          <Input
            id="train-score"
            type="number"
            min={0}
            max={100}
            value={form.score}
            onChange={(e) => setField('score', e.target.value)}
            placeholder="0-100"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="train-cert">Certificate Reference</Label>
        <Input
          id="train-cert"
          value={form.certificate}
          onChange={(e) => setField('certificate', e.target.value)}
          placeholder="Certificate ID or URL"
        />
      </div>
      <div>
        <Label htmlFor="train-notes">Notes</Label>
        <textarea
          id="train-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={3}
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
          <h2 className="text-lg font-semibold">Training</h2>
          <p className="text-sm text-muted-foreground">
            Track employee training courses and certifications
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Training Record
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="in progress">
            In Progress ({tabCounts['in progress']})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({tabCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="expired">
            Expired ({tabCounts.expired})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No training records found</p>
              <p className="text-sm mt-1">
                Add a training record to get started.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Course
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Start Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Completion
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Certificate
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = (record.status || 'Enrolled') as TrainingStatus;
                      const score = record.data.score as number | null;
                      const expiryDate = record.data.expiryDate as string | undefined;
                      const expiring = isExpiringSoon(expiryDate);
                      const expired = isExpired(expiryDate);

                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {record.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.employee as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.category as string) || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              className={cn(
                                'border-0 text-[10px]',
                                STATUS_BADGE_CLASSES[status] ??
                                  STATUS_BADGE_CLASSES.Enrolled,
                              )}
                            >
                              {status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.startDate
                              ? new Date(record.data.startDate as string).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.completionDate
                              ? new Date(record.data.completionDate as string).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {score != null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      score >= 80
                                        ? 'bg-green-500'
                                        : score >= 50
                                          ? 'bg-amber-500'
                                          : 'bg-red-500',
                                    )}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {score}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {record.data.certificate ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                  <Award className="h-3 w-3" />
                                  Yes
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                              {(expired || expiring) && (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-0.5 text-[10px] ml-1',
                                    expired
                                      ? 'text-red-400'
                                      : 'text-amber-400',
                                  )}
                                  title={
                                    expired
                                      ? 'Certificate expired'
                                      : 'Expiring within 30 days'
                                  }
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  {expired ? 'Expired' : 'Expiring'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewRecord(record)}
                                aria-label="View training record"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit training record"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete training record"
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
            <DialogTitle>Add Training Record</DialogTitle>
            <DialogDescription>
              Record a new training course for an employee.
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
                {createRecord.isPending ? 'Adding...' : 'Add Record'}
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
            <DialogTitle>Edit Training Record</DialogTitle>
            <DialogDescription>
              Update training record details.
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
        <DialogContent className="max-w-md">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{viewRecord.title}</DialogTitle>
                <DialogDescription>Training record details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_BADGE_CLASSES[
                        (viewRecord.status || 'Enrolled') as TrainingStatus
                      ] ?? STATUS_BADGE_CLASSES.Enrolled,
                    )}
                  >
                    {viewRecord.status || 'Enrolled'}
                  </Badge>
                  {viewRecord.data.category ? (
                    <Badge variant="secondary">
                      {String(viewRecord.data.category)}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Employee</span>
                  <span>{(viewRecord.data.employee as string) || '-'}</span>
                  <span className="text-muted-foreground">Start Date</span>
                  <span>
                    {viewRecord.data.startDate
                      ? new Date(viewRecord.data.startDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Completion</span>
                  <span>
                    {viewRecord.data.completionDate
                      ? new Date(viewRecord.data.completionDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Expiry Date</span>
                  <span>
                    {viewRecord.data.expiryDate
                      ? new Date(viewRecord.data.expiryDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Score</span>
                  <span>
                    {viewRecord.data.score != null
                      ? `${viewRecord.data.score}%`
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Certificate</span>
                  <span>
                    {(viewRecord.data.certificate as string) || '-'}
                  </span>
                </div>

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

export default TrainingPage;
