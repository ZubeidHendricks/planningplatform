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
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERVIEW_TYPES = ['Phone', 'Video', 'Panel', 'Technical'] as const;
const INTERVIEW_STATUSES = ['Scheduled', 'Completed', 'Cancelled'] as const;
const DURATION_OPTIONS = ['30', '45', '60', '90'] as const;

type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

const STATUS_BADGE_CLASSES: Record<InterviewStatus, string> = {
  Scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  Cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface InterviewForm {
  candidate: string;
  position: string;
  interviewType: string;
  dateTime: string;
  duration: string;
  interviewer: string;
  notes: string;
}

const emptyForm: InterviewForm = {
  candidate: '',
  position: '',
  interviewType: 'Video',
  dateTime: '',
  duration: '60',
  interviewer: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InterviewsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [tabFilter, setTabFilter] = useState('all');
  const [showSchedule, setShowSchedule] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<InterviewForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'interviews');
  const createRecord = useCreateModuleRecord(ws, app, 'interviews');
  const updateRecord = useUpdateModuleRecord(ws, app, 'interviews');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'interviews');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (tabFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
    );
  }, [allRecords, tabFilter]);

  const setField = (field: keyof InterviewForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.candidate,
      status: 'Scheduled',
      priority: 'medium',
      data: {
        position: form.position,
        interviewType: form.interviewType,
        dateTime: form.dateTime,
        duration: form.duration,
        interviewer: form.interviewer,
        notes: form.notes,
        score: null,
      },
    });
    setShowSchedule(false);
    setForm(emptyForm);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    await updateRecord.mutateAsync({
      id: editRecord.id,
      title: form.candidate,
      status: editRecord.status,
      data: {
        ...editRecord.data,
        position: form.position,
        interviewType: form.interviewType,
        dateTime: form.dateTime,
        duration: form.duration,
        interviewer: form.interviewer,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      candidate: record.title,
      position: (record.data.position as string) || '',
      interviewType: (record.data.interviewType as string) || 'Video',
      dateTime: (record.data.dateTime as string) || '',
      duration: (record.data.duration as string) || '60',
      interviewer: (record.data.interviewer as string) || '',
      notes: (record.data.notes as string) || '',
    });
    setEditRecord(record);
  };

  const handleStatusChange = (record: ModuleRecord, newStatus: string) => {
    updateRecord.mutate({
      id: record.id,
      status: newStatus,
    });
  };

  const handleScoreChange = (record: ModuleRecord, score: string) => {
    const parsed = parseInt(score, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 10) return;
    updateRecord.mutate({
      id: record.id,
      data: { ...record.data, score: parsed },
    });
  };

  const handleDelete = (id: string) => {
    deleteRecord.mutate(id);
  };

  const formatDateTime = (dt: string) => {
    if (!dt) return '-';
    try {
      return new Date(dt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return dt;
    }
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
    scheduled: allRecords.filter((r) => r.status === 'Scheduled').length,
    completed: allRecords.filter((r) => r.status === 'Completed').length,
    cancelled: allRecords.filter((r) => r.status === 'Cancelled').length,
  };

  // Shared form JSX for schedule & edit dialogs
  const formFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="int-cand">Candidate</Label>
          <Input
            id="int-cand"
            value={form.candidate}
            onChange={(e) => setField('candidate', e.target.value)}
            placeholder="Candidate name"
            required
          />
        </div>
        <div>
          <Label htmlFor="int-pos">Position</Label>
          <Input
            id="int-pos"
            value={form.position}
            onChange={(e) => setField('position', e.target.value)}
            placeholder="Senior Developer"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Interview Type</Label>
          <Select
            value={form.interviewType}
            onValueChange={(val) => setField('interviewType', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVIEW_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Duration</Label>
          <Select
            value={form.duration}
            onValueChange={(val) => setField('duration', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="int-dt">Date & Time</Label>
        <Input
          id="int-dt"
          type="datetime-local"
          value={form.dateTime}
          onChange={(e) => setField('dateTime', e.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="int-interviewer">Interviewer</Label>
        <Input
          id="int-interviewer"
          value={form.interviewer}
          onChange={(e) => setField('interviewer', e.target.value)}
          placeholder="Interviewer name"
        />
      </div>
      <div>
        <Label htmlFor="int-notes">Notes</Label>
        <textarea
          id="int-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Interview notes..."
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
          <h2 className="text-lg font-semibold">Interviews</h2>
          <p className="text-sm text-muted-foreground">
            Schedule and track candidate interviews
          </p>
        </div>
        <Button onClick={() => setShowSchedule(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Schedule Interview
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="scheduled">
            Scheduled ({tabCounts.scheduled})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({tabCounts.completed})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({tabCounts.cancelled})
          </TabsTrigger>
        </TabsList>

        {/* Single content area for all tabs since filtering is done in-memory */}
        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No interviews found</p>
              <p className="text-sm mt-1">
                Schedule your first interview to get started.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Candidate
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Position
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Duration
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Interviewer
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Score
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = record.status as InterviewStatus;
                      const score = record.data.score as number | null;
                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {record.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.position as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.interviewType as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(
                              (record.data.dateTime as string) || '',
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.duration
                              ? `${record.data.duration} min`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.interviewer as string) || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Select
                              value={status}
                              onValueChange={(val) =>
                                handleStatusChange(record, val)
                              }
                            >
                              <SelectTrigger className="h-7 w-28 px-2 text-xs border-0 bg-transparent">
                                <Badge
                                  className={cn(
                                    'border-0 text-[10px]',
                                    STATUS_BADGE_CLASSES[status] ??
                                      STATUS_BADGE_CLASSES.Scheduled,
                                  )}
                                >
                                  {status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {INTERVIEW_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            {status === 'Completed' ? (
                              <Input
                                type="number"
                                min={1}
                                max={10}
                                value={score ?? ''}
                                onChange={(e) =>
                                  handleScoreChange(record, e.target.value)
                                }
                                className="h-7 w-16 text-xs text-center"
                                placeholder="-"
                              />
                            ) : score !== null && score !== undefined ? (
                              <span className="text-muted-foreground">
                                {score}/10
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit interview"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete interview"
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

      {/* Schedule Dialog */}
      <Dialog open={showSchedule} onOpenChange={setShowSchedule}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
            <DialogDescription>
              Set up a new interview for a candidate.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSchedule}>
            {formFields}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowSchedule(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createRecord.isPending}>
                {createRecord.isPending ? 'Scheduling...' : 'Schedule'}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Interview</DialogTitle>
            <DialogDescription>
              Update the interview details.
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
    </div>
  );
}

export default InterviewsPage;
