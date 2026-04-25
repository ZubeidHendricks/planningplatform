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
  AlertTriangle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRIVER_STATUSES = ['active', 'suspended', 'on-leave'] as const;

type DriverStatus = (typeof DRIVER_STATUSES)[number];

const STATUS_COLORS: Record<DriverStatus, string> = {
  active: 'bg-green-500/15 text-green-400',
  suspended: 'bg-red-500/15 text-red-400',
  'on-leave': 'bg-amber-500/15 text-amber-400',
};

const STATUS_LABELS: Record<DriverStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  'on-leave': 'On Leave',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function licenseExpiryBadge(dateStr: string) {
  if (!dateStr) return null;
  const days = daysUntil(dateStr);
  if (days < 0) {
    return (
      <Badge className="border-0 text-[10px] bg-red-500/15 text-red-400">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Expired
      </Badge>
    );
  }
  if (days <= 30) {
    return (
      <Badge className="border-0 text-[10px] bg-amber-500/15 text-amber-400">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {days}d left
      </Badge>
    );
  }
  return (
    <span className="text-muted-foreground">
      {new Date(dateStr).toLocaleDateString()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface DriverForm {
  name: string;
  licenseNo: string;
  licenseExpiry: string;
  phone: string;
  email: string;
  status: string;
  assignedVehicle: string;
  rating: string;
  notes: string;
}

const emptyForm: DriverForm = {
  name: '',
  licenseNo: '',
  licenseExpiry: '',
  phone: '',
  email: '',
  status: 'active',
  assignedVehicle: '',
  rating: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DriversPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<DriverForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'driver', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'driver');
  const updateRecord = useUpdateModuleRecord(ws, app, 'driver');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'driver');

  const records = data?.records ?? [];

  const setField = (field: keyof DriverForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.name,
      status: form.status,
      priority: 'medium',
      data: {
        licenseNo: form.licenseNo,
        licenseExpiry: form.licenseExpiry,
        phone: form.phone,
        email: form.email,
        assignedVehicle: form.assignedVehicle,
        rating: form.rating ? parseFloat(form.rating) : null,
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
      title: form.name,
      status: form.status,
      data: {
        ...editRecord.data,
        licenseNo: form.licenseNo,
        licenseExpiry: form.licenseExpiry,
        phone: form.phone,
        email: form.email,
        assignedVehicle: form.assignedVehicle,
        rating: form.rating ? parseFloat(form.rating) : null,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      name: record.title,
      licenseNo: (record.data.licenseNo as string) || '',
      licenseExpiry: (record.data.licenseExpiry as string) || '',
      phone: (record.data.phone as string) || '',
      email: (record.data.email as string) || '',
      status: record.status || 'active',
      assignedVehicle: (record.data.assignedVehicle as string) || '',
      rating: record.data.rating != null ? String(record.data.rating) : '',
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

  const driverFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d-name">Name</Label>
          <Input
            id="d-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Full name"
            required
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
              {DRIVER_STATUSES.map((s) => (
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
          <Label htmlFor="d-license">License No</Label>
          <Input
            id="d-license"
            value={form.licenseNo}
            onChange={(e) => setField('licenseNo', e.target.value)}
            placeholder="License number"
          />
        </div>
        <div>
          <Label htmlFor="d-expiry">License Expiry</Label>
          <Input
            id="d-expiry"
            type="date"
            value={form.licenseExpiry}
            onChange={(e) => setField('licenseExpiry', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d-phone">Phone</Label>
          <Input
            id="d-phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+27 ..."
          />
        </div>
        <div>
          <Label htmlFor="d-email">Email</Label>
          <Input
            id="d-email"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="driver@example.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d-vehicle">Assigned Vehicle</Label>
          <Input
            id="d-vehicle"
            value={form.assignedVehicle}
            onChange={(e) => setField('assignedVehicle', e.target.value)}
            placeholder="Registration no."
          />
        </div>
        <div>
          <Label htmlFor="d-rating">Rating (1-5)</Label>
          <Input
            id="d-rating"
            type="number"
            min={1}
            max={5}
            step={0.1}
            value={form.rating}
            onChange={(e) => setField('rating', e.target.value)}
            placeholder="4.5"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="d-notes">Notes</Label>
        <textarea
          id="d-notes"
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
          <h2 className="text-lg font-semibold">Drivers</h2>
          <p className="text-sm text-muted-foreground">
            Manage drivers, licenses, and assignments
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Driver
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or license..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No drivers yet</p>
          <p className="text-sm mt-1">Add your first driver to get started.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    License No
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    License Expiry
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Contact
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Assigned Vehicle
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Rating
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => {
                  const status = (record.status || 'active') as DriverStatus;
                  const licenseExpiry =
                    (record.data.licenseExpiry as string) || '';
                  const phone = (record.data.phone as string) || '';
                  const email = (record.data.email as string) || '';
                  const contact = phone || email || '-';
                  const rating = record.data.rating as number | null;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.licenseNo as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {licenseExpiryBadge(licenseExpiry) ?? (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {contact}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_COLORS[status] ?? STATUS_COLORS.active,
                          )}
                        >
                          {STATUS_LABELS[status] ?? status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.assignedVehicle as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rating != null ? `${rating}/5` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewRecord(record)}
                            aria-label="View driver"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit driver"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete driver"
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

      {/* Add Driver Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Driver</DialogTitle>
            <DialogDescription>
              Add a new driver to your fleet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {driverFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Driver'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Driver Dialog */}
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
            <DialogTitle>Edit Driver</DialogTitle>
            <DialogDescription>Update driver details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {driverFormFields}
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
                <DialogDescription>Driver details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_COLORS[
                        (viewRecord.status || 'active') as DriverStatus
                      ] ?? STATUS_COLORS.active,
                    )}
                  >
                    {STATUS_LABELS[(viewRecord.status || 'active') as DriverStatus] ?? viewRecord.status}
                  </Badge>
                  {viewRecord.data.rating != null ? (
                    <Badge variant="secondary">
                      {String(viewRecord.data.rating)}/5
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">License No</span>
                  <span>{(viewRecord.data.licenseNo as string) || '-'}</span>
                  <span className="text-muted-foreground">License Expiry</span>
                  <span>
                    {(viewRecord.data.licenseExpiry as string)
                      ? licenseExpiryBadge(viewRecord.data.licenseExpiry as string)
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Phone</span>
                  <span>{(viewRecord.data.phone as string) || '-'}</span>
                  <span className="text-muted-foreground">Email</span>
                  <span>{(viewRecord.data.email as string) || '-'}</span>
                  <span className="text-muted-foreground">Assigned Vehicle</span>
                  <span>
                    {(viewRecord.data.assignedVehicle as string) || '-'}
                  </span>
                  <span className="text-muted-foreground">Added</span>
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

export default DriversPage;
