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
  Wrench,
  ChevronRight,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPAIR_STAGES = [
  'Reported',
  'Diagnosed',
  'In Progress',
  'Completed',
] as const;

type RepairStage = (typeof REPAIR_STAGES)[number];

const STAGE_COLORS: Record<RepairStage, string> = {
  Reported: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Diagnosed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'In Progress': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  Completed: 'bg-green-500/15 text-green-400 border-green-500/30',
};

const COLUMN_HEADER_COLORS: Record<RepairStage, string> = {
  Reported: 'border-t-blue-500',
  Diagnosed: 'border-t-amber-500',
  'In Progress': 'border-t-purple-500',
  Completed: 'border-t-green-500',
};

const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-blue-500/15 text-blue-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface RepairForm {
  vehicle: string;
  issue: string;
  priority: string;
  mechanic: string;
  estimatedCost: string;
  notes: string;
}

const emptyForm: RepairForm = {
  vehicle: '',
  issue: '',
  priority: 'medium',
  mechanic: '',
  estimatedCost: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RepairsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<RepairForm>(emptyForm);
  const [detailRecord, setDetailRecord] = useState<ModuleRecord | null>(null);

  const { data, isLoading } = useModuleRecords(ws, app, 'repair', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'repair');
  const updateStage = useUpdateModuleStage(ws, app, 'repair');

  const records = data?.records ?? [];

  // Group records by stage
  const grouped = useMemo(() => {
    const map: Record<RepairStage, ModuleRecord[]> = {
      Reported: [],
      Diagnosed: [],
      'In Progress': [],
      Completed: [],
    };
    for (const r of records) {
      const stage = (r.stage ?? 'Reported') as RepairStage;
      if (map[stage]) {
        map[stage].push(r);
      } else {
        map.Reported.push(r);
      }
    }
    return map;
  }, [records]);

  const setField = (field: keyof RepairForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.vehicle,
      stage: 'Reported',
      priority: form.priority,
      data: {
        issue: form.issue,
        mechanic: form.mechanic,
        estimatedCost: form.estimatedCost
          ? parseFloat(form.estimatedCost)
          : null,
        notes: form.notes,
      },
    });
    setShowAdd(false);
    setForm(emptyForm);
  };

  const handleMoveStage = (record: ModuleRecord, newStage: string) => {
    updateStage.mutate({ id: record.id, stage: newStage });
  };

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
          <h2 className="text-lg font-semibold">Repairs</h2>
          <p className="text-sm text-muted-foreground">
            Track vehicle repairs through the workflow
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Report Repair
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search repairs..."
          className="pl-9"
        />
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {REPAIR_STAGES.map((stage) => {
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
                    No repairs
                  </p>
                )}
                {stageRecords.map((record) => {
                  const issue = (record.data.issue as string) || '';
                  const mechanic = (record.data.mechanic as string) || '';
                  const days = daysAgo(record.createdAt);
                  const prio = record.priority || 'medium';
                  const moveTargets = REPAIR_STAGES.filter(
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

                      {issue && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                          {issue}
                        </p>
                      )}

                      {mechanic && (
                        <p className="text-xs text-muted-foreground mb-2">
                          <Wrench className="h-3 w-3 inline mr-1" />
                          {mechanic}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {days}d open
                        </span>

                        {/* Move to dropdown */}
                        <div
                          className="relative"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Select
                            onValueChange={(val) =>
                              handleMoveStage(record, val)
                            }
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

      {/* Add Repair Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report Repair</DialogTitle>
            <DialogDescription>
              Log a new vehicle repair issue.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="r-vehicle">Vehicle Registration</Label>
              <Input
                id="r-vehicle"
                value={form.vehicle}
                onChange={(e) => setField('vehicle', e.target.value)}
                placeholder="CA 123-456"
                required
              />
            </div>
            <div>
              <Label htmlFor="r-issue">Issue Description</Label>
              <textarea
                id="r-issue"
                value={form.issue}
                onChange={(e) => setField('issue', e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(val) => setField('priority', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="r-mechanic">Assigned Mechanic</Label>
                <Input
                  id="r-mechanic"
                  value={form.mechanic}
                  onChange={(e) => setField('mechanic', e.target.value)}
                  placeholder="Mechanic name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="r-cost">Estimated Cost (ZAR)</Label>
              <Input
                id="r-cost"
                type="number"
                step="0.01"
                value={form.estimatedCost}
                onChange={(e) => setField('estimatedCost', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="r-notes">Notes</Label>
              <textarea
                id="r-notes"
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Additional notes..."
                rows={2}
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
                {createRecord.isPending ? 'Reporting...' : 'Report Repair'}
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
                <DialogDescription>Repair details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STAGE_COLORS[
                        (detailRecord.stage ?? 'Reported') as RepairStage
                      ] ?? STAGE_COLORS.Reported,
                    )}
                  >
                    {detailRecord.stage ?? 'Reported'}
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
                  {detailRecord.data.issue ? (
                    <>
                      <span className="text-muted-foreground">Issue</span>
                      <span>{detailRecord.data.issue as string}</span>
                    </>
                  ) : null}
                  {detailRecord.data.mechanic ? (
                    <>
                      <span className="text-muted-foreground">Mechanic</span>
                      <span>{detailRecord.data.mechanic as string}</span>
                    </>
                  ) : null}
                  {detailRecord.data.estimatedCost != null ? (
                    <>
                      <span className="text-muted-foreground">Est. Cost</span>
                      <span>
                        R{' '}
                        {Number(
                          detailRecord.data.estimatedCost,
                        ).toLocaleString('en-ZA', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </>
                  ) : null}
                  <span className="text-muted-foreground">Reported</span>
                  <span>
                    {new Date(detailRecord.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">Days open</span>
                  <span>{daysAgo(detailRecord.createdAt)}d</span>
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

export default RepairsPage;
