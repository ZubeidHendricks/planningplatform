import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import {
  useModuleRecords,
  useCreateModuleRecord,
  useUpdateModuleStage,
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
  Users,
  ChevronRight,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  'Applied',
  'Screening',
  'Interviewing',
  'Offered',
  'Hired',
  'Rejected',
] as const;

type PipelineStage = (typeof PIPELINE_STAGES)[number];

const STAGE_COLORS: Record<PipelineStage, string> = {
  Applied: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Screening: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Interviewing: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Offered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  Hired: 'bg-green-500/15 text-green-400 border-green-500/30',
  Rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const COLUMN_HEADER_COLORS: Record<PipelineStage, string> = {
  Applied: 'border-t-blue-500',
  Screening: 'border-t-amber-500',
  Interviewing: 'border-t-purple-500',
  Offered: 'border-t-emerald-500',
  Hired: 'border-t-green-500',
  Rejected: 'border-t-red-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-blue-500/15 text-blue-400',
};

const SOURCE_OPTIONS = [
  'LinkedIn',
  'Indeed',
  'Referral',
  'Website',
  'Recruiter',
  'Job Board',
  'Career Fair',
  'Other',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CandidateFormState {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  source: string;
  notes: string;
}

const emptyForm: CandidateFormState = {
  name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  source: '',
  notes: '',
};

export function PipelinePage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CandidateFormState>(emptyForm);
  const [detailRecord, setDetailRecord] = useState<ModuleRecord | null>(null);

  const { data, isLoading } = useModuleRecords(ws, app, 'candidates', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'candidates');
  const updateStage = useUpdateModuleStage(ws, app, 'candidates');

  const records = data?.records ?? [];

  // Group records by stage
  const grouped = useMemo(() => {
    const map: Record<PipelineStage, ModuleRecord[]> = {
      Applied: [],
      Screening: [],
      Interviewing: [],
      Offered: [],
      Hired: [],
      Rejected: [],
    };
    for (const r of records) {
      const stage = (r.stage ?? 'Applied') as PipelineStage;
      if (map[stage]) {
        map[stage].push(r);
      } else {
        map.Applied.push(r);
      }
    }
    return map;
  }, [records]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.name,
      stage: 'Applied',
      priority: 'medium',
      data: {
        email: form.email,
        phone: form.phone,
        department: form.department,
        position: form.position,
        source: form.source,
        notes: form.notes,
      },
    });
    setShowAdd(false);
    setForm(emptyForm);
  };

  const handleMoveStage = (record: ModuleRecord, newStage: string) => {
    updateStage.mutate({ id: record.id, stage: newStage });
  };

  const setField = (field: keyof CandidateFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Recruitment Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Track candidates through your hiring process
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Candidate
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search candidates..."
          className="pl-9"
        />
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((stage) => {
          const stageRecords = grouped[stage];
          return (
            <div
              key={stage}
              className={cn(
                'flex-shrink-0 w-72 rounded-lg border border-border bg-card border-t-2',
                COLUMN_HEADER_COLORS[stage],
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-3 border-b border-border">
                <h3 className="text-sm font-semibold">{stage}</h3>
                <Badge variant="secondary" className="text-xs">
                  {stageRecords.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-320px)] overflow-y-auto">
                {stageRecords.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No candidates
                  </p>
                )}
                {stageRecords.map((record) => {
                  const dept = (record.data.department as string) || '';
                  const days = daysAgo(record.updatedAt);
                  const prio = record.priority || 'medium';
                  // Available stages to move to (all except current)
                  const moveTargets = PIPELINE_STAGES.filter(
                    (s) => s !== stage,
                  );

                  return (
                    <div
                      key={record.id}
                      className="bg-background border border-border rounded-md p-3 cursor-pointer hover:border-muted-foreground/40 transition-colors group"
                      onClick={() => setDetailRecord(record)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetailRecord(record);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium truncate flex-1 pr-2">
                          {record.title}
                        </p>
                        <Badge
                          className={cn(
                            'text-[10px] px-1.5 py-0 border-0 shrink-0',
                            PRIORITY_COLORS[prio] ?? PRIORITY_COLORS.medium,
                          )}
                        >
                          {prio}
                        </Badge>
                      </div>

                      {dept && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {dept}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {days}d
                        </span>

                        {/* Move to dropdown */}
                        <div
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Select
                            onValueChange={(val) => handleMoveStage(record, val)}
                          >
                            <SelectTrigger className="h-6 w-auto gap-1 px-2 text-xs border-dashed opacity-0 group-hover:opacity-100 transition-opacity">
                              <ChevronRight className="h-3 w-3" />
                              <SelectValue placeholder="Move" />
                            </SelectTrigger>
                            <SelectContent>
                              {moveTargets.map((target) => (
                                <SelectItem key={target} value={target}>
                                  {target}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Candidate Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>
              Enter the candidate details to add them to the pipeline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cand-name">Name</Label>
                <Input
                  id="cand-name"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cand-email">Email</Label>
                <Input
                  id="cand-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cand-phone">Phone</Label>
                <Input
                  id="cand-phone"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+27 ..."
                />
              </div>
              <div>
                <Label htmlFor="cand-department">Department</Label>
                <Input
                  id="cand-department"
                  value={form.department}
                  onChange={(e) => setField('department', e.target.value)}
                  placeholder="Engineering"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cand-position">Position</Label>
              <Input
                id="cand-position"
                value={form.position}
                onChange={(e) => setField('position', e.target.value)}
                placeholder="Senior Developer"
              />
            </div>
            <div>
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(val) => setField('source', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((src) => (
                    <SelectItem key={src} value={src}>
                      {src}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cand-notes">Notes</Label>
              <textarea
                id="cand-notes"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <DialogFooter>
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
                {createRecord.isPending ? 'Adding...' : 'Add Candidate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog
        open={!!detailRecord}
        onOpenChange={(open) => {
          if (!open) setDetailRecord(null);
        }}
      >
        <DialogContent className="max-w-md">
          {detailRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{detailRecord.title}</DialogTitle>
                <DialogDescription>Candidate details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STAGE_COLORS[
                        (detailRecord.stage ?? 'Applied') as PipelineStage
                      ] ?? STAGE_COLORS.Applied,
                    )}
                  >
                    {detailRecord.stage ?? 'Applied'}
                  </Badge>
                  <Badge
                    className={cn(
                      'border-0',
                      PRIORITY_COLORS[detailRecord.priority] ??
                        PRIORITY_COLORS.medium,
                    )}
                  >
                    {detailRecord.priority}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {detailRecord.data.email ? (
                    <>
                      <span className="text-muted-foreground">Email</span>
                      <span>{detailRecord.data.email as string}</span>
                    </>
                  ) : null}
                  {detailRecord.data.phone ? (
                    <>
                      <span className="text-muted-foreground">Phone</span>
                      <span>{detailRecord.data.phone as string}</span>
                    </>
                  ) : null}
                  {detailRecord.data.department ? (
                    <>
                      <span className="text-muted-foreground">Department</span>
                      <span>{detailRecord.data.department as string}</span>
                    </>
                  ) : null}
                  {detailRecord.data.position ? (
                    <>
                      <span className="text-muted-foreground">Position</span>
                      <span>{detailRecord.data.position as string}</span>
                    </>
                  ) : null}
                  {detailRecord.data.source ? (
                    <>
                      <span className="text-muted-foreground">Source</span>
                      <span>{detailRecord.data.source as string}</span>
                    </>
                  ) : null}
                  <span className="text-muted-foreground">Applied</span>
                  <span>
                    {new Date(detailRecord.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">Days in stage</span>
                  <span>{daysAgo(detailRecord.updatedAt)}d</span>
                </div>

                {detailRecord.data.notes ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3">
                      {detailRecord.data.notes as string}
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PipelinePage;
