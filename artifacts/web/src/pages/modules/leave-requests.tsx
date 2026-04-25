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
  CalendarDays,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEAVE_TYPES = [
  'Annual',
  'Sick',
  'Family',
  'Maternity',
  'Study',
] as const;

const LEAVE_STATUSES = ['Pending', 'Approved', 'Rejected', 'Cancelled'] as const;

type LeaveStatus = (typeof LEAVE_STATUSES)[number];

const STATUS_BADGE_CLASSES: Record<LeaveStatus, string> = {
  Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Approved: 'bg-green-500/15 text-green-400 border-green-500/30',
  Rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  Cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const diff = e.getTime() - s.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface LeaveForm {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  approver: string;
  notes: string;
}

const emptyForm: LeaveForm = {
  employeeName: '',
  leaveType: 'Annual',
  startDate: '',
  endDate: '',
  approver: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LeaveRequestsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [tabFilter, setTabFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<LeaveForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'leave_request');
  const createRecord = useCreateModuleRecord(ws, app, 'leave_request');
  const updateRecord = useUpdateModuleRecord(ws, app, 'leave_request');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'leave_request');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (tabFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
    );
  }, [allRecords, tabFilter]);

  const setField = (field: keyof LeaveForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.employeeName,
      status: 'Pending',
      priority: 'medium',
      data: {
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        days: calcDays(form.startDate, form.endDate),
        approver: form.approver,
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
      title: form.employeeName,
      data: {
        ...editRecord.data,
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        days: calcDays(form.startDate, form.endDate),
        approver: form.approver,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      employeeName: record.title,
      leaveType: (record.data.leaveType as string) || 'Annual',
      startDate: (record.data.startDate as string) || '',
      endDate: (record.data.endDate as string) || '',
      approver: (record.data.approver as string) || '',
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
    pending: allRecords.filter((r) => r.status === 'Pending').length,
    approved: allRecords.filter((r) => r.status === 'Approved').length,
    rejected: allRecords.filter((r) => r.status === 'Rejected').length,
  };

  const formFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="leave-emp">Employee Name</Label>
        <Input
          id="leave-emp"
          value={form.employeeName}
          onChange={(e) => setField('employeeName', e.target.value)}
          placeholder="Full name"
          required
        />
      </div>
      <div>
        <Label>Leave Type</Label>
        <Select
          value={form.leaveType}
          onValueChange={(val) => setField('leaveType', val)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAVE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="leave-start">Start Date</Label>
          <Input
            id="leave-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="leave-end">End Date</Label>
          <Input
            id="leave-end"
            type="date"
            value={form.endDate}
            onChange={(e) => setField('endDate', e.target.value)}
            required
          />
        </div>
      </div>
      {form.startDate && form.endDate && (
        <p className="text-xs text-muted-foreground">
          {calcDays(form.startDate, form.endDate)} day(s)
        </p>
      )}
      <div>
        <Label htmlFor="leave-approver">Approver</Label>
        <Input
          id="leave-approver"
          value={form.approver}
          onChange={(e) => setField('approver', e.target.value)}
          placeholder="Manager name"
        />
      </div>
      <div>
        <Label htmlFor="leave-notes">Notes</Label>
        <textarea
          id="leave-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Reason for leave..."
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
          <h2 className="text-lg font-semibold">Leave Requests</h2>
          <p className="text-sm text-muted-foreground">
            Manage employee leave requests and approvals
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Leave Request
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({tabCounts.pending})
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved ({tabCounts.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected ({tabCounts.rejected})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No leave requests found</p>
              <p className="text-sm mt-1">
                Submit a leave request to get started.
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
                        Leave Type
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Start Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        End Date
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Days
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Approver
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = (record.status || 'Pending') as LeaveStatus;
                      const days = (record.data.days as number) ?? 0;
                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {record.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.leaveType as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {record.data.startDate
                                ? new Date(record.data.startDate as string).toLocaleDateString()
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {record.data.endDate
                                ? new Date(record.data.endDate as string).toLocaleDateString()
                                : '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {days}
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
                                      STATUS_BADGE_CLASSES.Pending,
                                  )}
                                >
                                  {status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {LEAVE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.approver as string) || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setViewRecord(record)}
                                aria-label="View leave request"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit leave request"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete leave request"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Leave Request</DialogTitle>
            <DialogDescription>
              Submit a new leave request for an employee.
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
                {createRecord.isPending ? 'Submitting...' : 'Submit Request'}
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
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>
              Update the leave request details.
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
                <DialogDescription>Leave request details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Badge
                  className={cn(
                    'border-0',
                    STATUS_BADGE_CLASSES[
                      (viewRecord.status || 'Pending') as LeaveStatus
                    ] ?? STATUS_BADGE_CLASSES.Pending,
                  )}
                >
                  {viewRecord.status || 'Pending'}
                </Badge>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Leave Type</span>
                  <span>{(viewRecord.data.leaveType as string) || '-'}</span>
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
                  <span className="text-muted-foreground">Days</span>
                  <span>{(viewRecord.data.days as number) ?? 0}</span>
                  <span className="text-muted-foreground">Approver</span>
                  <span>{(viewRecord.data.approver as string) || '-'}</span>
                  <span className="text-muted-foreground">Submitted</span>
                  <span>
                    {new Date(viewRecord.createdAt).toLocaleDateString()}
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

export default LeaveRequestsPage;
