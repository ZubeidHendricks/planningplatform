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
  Search,
  FileWarning,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FINE_STATUSES = ['unpaid', 'paid', 'disputed', 'written-off'] as const;

type FineStatus = (typeof FINE_STATUSES)[number];

const STATUS_COLORS: Record<FineStatus, string> = {
  unpaid: 'bg-red-500/15 text-red-400',
  paid: 'bg-green-500/15 text-green-400',
  disputed: 'bg-amber-500/15 text-amber-400',
  'written-off': 'bg-gray-500/15 text-gray-400',
};

const STATUS_LABELS: Record<FineStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  disputed: 'Disputed',
  'written-off': 'Written Off',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isOverdue(dueDateStr: string, status: string): boolean {
  if (!dueDateStr || status === 'paid' || status === 'written-off') return false;
  return new Date(dueDateStr).getTime() < Date.now();
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FineForm {
  reference: string;
  vehicle: string;
  driver: string;
  offence: string;
  amount: string;
  date: string;
  dueDate: string;
  status: string;
  notes: string;
}

const emptyForm: FineForm = {
  reference: '',
  vehicle: '',
  driver: '',
  offence: '',
  amount: '',
  date: '',
  dueDate: '',
  status: 'unpaid',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FinesPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<FineForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'fine', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'fine');
  const updateRecord = useUpdateModuleRecord(ws, app, 'fine');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'fine');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (tabFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
    );
  }, [allRecords, tabFilter]);

  const setField = (field: keyof FineForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.reference || `FINE-${Date.now().toString(36).toUpperCase()}`,
      status: form.status,
      priority: 'medium',
      data: {
        vehicle: form.vehicle,
        driver: form.driver,
        offence: form.offence,
        amount: form.amount ? parseFloat(form.amount) : null,
        date: form.date,
        dueDate: form.dueDate,
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
      title: form.reference,
      status: form.status,
      data: {
        ...editRecord.data,
        vehicle: form.vehicle,
        driver: form.driver,
        offence: form.offence,
        amount: form.amount ? parseFloat(form.amount) : null,
        date: form.date,
        dueDate: form.dueDate,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      reference: record.title,
      vehicle: (record.data.vehicle as string) || '',
      driver: (record.data.driver as string) || '',
      offence: (record.data.offence as string) || '',
      amount: record.data.amount != null ? String(record.data.amount) : '',
      date: (record.data.date as string) || '',
      dueDate: (record.data.dueDate as string) || '',
      status: record.status || 'unpaid',
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
    unpaid: allRecords.filter((r) => r.status === 'unpaid').length,
    paid: allRecords.filter((r) => r.status === 'paid').length,
    disputed: allRecords.filter((r) => r.status === 'disputed').length,
    'written-off': allRecords.filter((r) => r.status === 'written-off').length,
  };

  const fineFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="f-ref">Reference</Label>
          <Input
            id="f-ref"
            value={form.reference}
            onChange={(e) => setField('reference', e.target.value)}
            placeholder="Auto-generated if empty"
          />
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
              {FINE_STATUSES.map((s) => (
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
          <Label htmlFor="f-vehicle">Vehicle</Label>
          <Input
            id="f-vehicle"
            value={form.vehicle}
            onChange={(e) => setField('vehicle', e.target.value)}
            placeholder="Registration no."
          />
        </div>
        <div>
          <Label htmlFor="f-driver">Driver</Label>
          <Input
            id="f-driver"
            value={form.driver}
            onChange={(e) => setField('driver', e.target.value)}
            placeholder="Driver name"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="f-offence">Offence</Label>
        <Input
          id="f-offence"
          value={form.offence}
          onChange={(e) => setField('offence', e.target.value)}
          placeholder="e.g. Speeding, Parking"
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="f-amount">Amount (ZAR)</Label>
          <Input
            id="f-amount"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="f-date">Date</Label>
          <Input
            id="f-date"
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="f-due">Due Date</Label>
          <Input
            id="f-due"
            type="date"
            value={form.dueDate}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="f-notes">Notes</Label>
        <textarea
          id="f-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Additional notes..."
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
          <h2 className="text-lg font-semibold">Fines</h2>
          <p className="text-sm text-muted-foreground">
            Track traffic fines and payment status
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Fine
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fines..."
          className="pl-9"
        />
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="unpaid">Unpaid ({tabCounts.unpaid})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({tabCounts.paid})</TabsTrigger>
          <TabsTrigger value="disputed">
            Disputed ({tabCounts.disputed})
          </TabsTrigger>
          <TabsTrigger value="written-off">
            Written Off ({tabCounts['written-off']})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileWarning className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No fines found</p>
              <p className="text-sm mt-1">
                Add a fine to start tracking.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Reference
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Vehicle
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Driver
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Offence
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Due Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = (record.status || 'unpaid') as FineStatus;
                      const amount = record.data.amount as number | null;
                      const dueDate = (record.data.dueDate as string) || '';
                      const overdue = isOverdue(dueDate, status);

                      return (
                        <tr
                          key={record.id}
                          className={cn(
                            'hover:bg-muted/30 transition-colors',
                            overdue && 'bg-red-500/5',
                          )}
                        >
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              {overdue && (
                                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                              )}
                              {record.title}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.vehicle as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.driver as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.offence as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {amount != null ? formatZAR(amount) : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.date
                              ? new Date(
                                  record.data.date as string,
                                ).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {dueDate ? (
                              <span
                                className={cn(
                                  'text-muted-foreground',
                                  overdue && 'text-red-400 font-medium',
                                )}
                              >
                                {new Date(dueDate).toLocaleDateString()}
                                {overdue && ' (overdue)'}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
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
                                    STATUS_COLORS[status] ??
                                      STATUS_COLORS.unpaid,
                                  )}
                                >
                                  {STATUS_LABELS[status] ?? status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {FINE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit fine"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete fine"
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

      {/* Add Fine Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Fine</DialogTitle>
            <DialogDescription>
              Record a new traffic fine.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {fineFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Fine'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Fine Dialog */}
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
            <DialogTitle>Edit Fine</DialogTitle>
            <DialogDescription>Update fine details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {fineFormFields}
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

export default FinesPage;
