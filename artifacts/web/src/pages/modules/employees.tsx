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
  Users,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMPLOYEE_STATUSES = [
  'Active',
  'Probation',
  'Notice',
  'Terminated',
] as const;

type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

const STATUS_BADGE_CLASSES: Record<EmployeeStatus, string> = {
  Active: 'bg-green-500/15 text-green-400 border-green-500/30',
  Probation: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Notice: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  Terminated: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const DEPARTMENTS = [
  'Engineering',
  'Design',
  'Marketing',
  'Sales',
  'Finance',
  'HR',
  'Operations',
  'Legal',
  'Support',
  'Other',
];

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface EmployeeForm {
  employeeId: string;
  fullName: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: EmployeeForm = {
  employeeId: '',
  fullName: '',
  department: '',
  position: '',
  startDate: '',
  status: 'Active',
  email: '',
  phone: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeesPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'employee', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'employee');
  const updateRecord = useUpdateModuleRecord(ws, app, 'employee');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'employee');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (deptFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) =>
        (r.data.department as string || '').toLowerCase() ===
        deptFilter.toLowerCase(),
    );
  }, [allRecords, deptFilter]);

  const setField = (field: keyof EmployeeForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.fullName,
      status: form.status,
      priority: 'medium',
      data: {
        employeeId: form.employeeId,
        department: form.department,
        position: form.position,
        startDate: form.startDate,
        email: form.email,
        phone: form.phone,
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
      title: form.fullName,
      status: form.status,
      data: {
        ...editRecord.data,
        employeeId: form.employeeId,
        department: form.department,
        position: form.position,
        startDate: form.startDate,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      employeeId: (record.data.employeeId as string) || '',
      fullName: record.title,
      department: (record.data.department as string) || '',
      position: (record.data.position as string) || '',
      startDate: (record.data.startDate as string) || '',
      status: record.status || 'Active',
      email: (record.data.email as string) || '',
      phone: (record.data.phone as string) || '',
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

  const employeeFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="emp-id">Employee ID</Label>
          <Input
            id="emp-id"
            value={form.employeeId}
            onChange={(e) => setField('employeeId', e.target.value)}
            placeholder="EMP-001"
          />
        </div>
        <div>
          <Label htmlFor="emp-name">Full Name</Label>
          <Input
            id="emp-name"
            value={form.fullName}
            onChange={(e) => setField('fullName', e.target.value)}
            placeholder="John Doe"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Department</Label>
          <Select
            value={form.department}
            onValueChange={(val) => setField('department', val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="emp-position">Position</Label>
          <Input
            id="emp-position"
            value={form.position}
            onChange={(e) => setField('position', e.target.value)}
            placeholder="Software Engineer"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="emp-start">Start Date</Label>
          <Input
            id="emp-start"
            type="date"
            value={form.startDate}
            onChange={(e) => setField('startDate', e.target.value)}
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
              {EMPLOYEE_STATUSES.map((s) => (
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
          <Label htmlFor="emp-email">Email</Label>
          <Input
            id="emp-email"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="john@company.com"
          />
        </div>
        <div>
          <Label htmlFor="emp-phone">Phone</Label>
          <Input
            id="emp-phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+27 ..."
          />
        </div>
      </div>
      <div>
        <Label htmlFor="emp-notes">Notes</Label>
        <textarea
          id="emp-notes"
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
          <h2 className="text-lg font-semibold">Employees</h2>
          <p className="text-sm text-muted-foreground">
            Manage your employee directory
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Employee
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="pl-9"
          />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d.toLowerCase()}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No employees found</p>
          <p className="text-sm mt-1">Add your first employee to get started.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Full Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Department
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Position
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Start Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Phone
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((record) => {
                  const status = (record.status || 'Active') as EmployeeStatus;
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {(record.data.employeeId as string) || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.department as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.position as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.data.startDate
                          ? new Date(record.data.startDate as string).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_BADGE_CLASSES[status] ??
                              STATUS_BADGE_CLASSES.Active,
                          )}
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.email as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.phone as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewRecord(record)}
                            aria-label="View employee"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit employee"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete employee"
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

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Enter the new employee details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {employeeFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Employee'}
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
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {employeeFormFields}
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
                <DialogDescription>Employee details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Badge
                  className={cn(
                    'border-0',
                    STATUS_BADGE_CLASSES[
                      (viewRecord.status || 'Active') as EmployeeStatus
                    ] ?? STATUS_BADGE_CLASSES.Active,
                  )}
                >
                  {viewRecord.status || 'Active'}
                </Badge>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Employee ID</span>
                  <span>{(viewRecord.data.employeeId as string) || '-'}</span>
                  <span className="text-muted-foreground">Department</span>
                  <span>{(viewRecord.data.department as string) || '-'}</span>
                  <span className="text-muted-foreground">Position</span>
                  <span>{(viewRecord.data.position as string) || '-'}</span>
                  <span className="text-muted-foreground">Start Date</span>
                  <span>
                    {viewRecord.data.startDate
                      ? new Date(viewRecord.data.startDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Email</span>
                  <span>{(viewRecord.data.email as string) || '-'}</span>
                  <span className="text-muted-foreground">Phone</span>
                  <span>{(viewRecord.data.phone as string) || '-'}</span>
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

export default EmployeesPage;
