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
  Truck,
  Pencil,
  Trash2,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VEHICLE_TYPES = ['Truck', 'Van', 'Car', 'Bakkie', 'Bus'] as const;
const VEHICLE_STATUSES = ['active', 'maintenance', 'retired'] as const;

type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

const STATUS_COLORS: Record<VehicleStatus, string> = {
  active: 'bg-green-500/15 text-green-400',
  maintenance: 'bg-amber-500/15 text-amber-400',
  retired: 'bg-red-500/15 text-red-400',
};

const STATUS_LABELS: Record<VehicleStatus, string> = {
  active: 'Active',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface VehicleForm {
  registration: string;
  make: string;
  model: string;
  year: string;
  type: string;
  status: string;
  assignedDriver: string;
  mileage: string;
  nextServiceDate: string;
  notes: string;
}

const emptyForm: VehicleForm = {
  registration: '',
  make: '',
  model: '',
  year: '',
  type: 'Truck',
  status: 'active',
  assignedDriver: '',
  mileage: '',
  nextServiceDate: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VehiclesPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<VehicleForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'vehicle', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'vehicle');
  const updateRecord = useUpdateModuleRecord(ws, app, 'vehicle');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'vehicle');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (tabFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
    );
  }, [allRecords, tabFilter]);

  const setField = (field: keyof VehicleForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.registration,
      status: form.status,
      priority: 'medium',
      data: {
        make: form.make,
        model: form.model,
        year: parseInt(form.year, 10) || null,
        type: form.type,
        assignedDriver: form.assignedDriver,
        mileage: parseInt(form.mileage, 10) || 0,
        nextServiceDate: form.nextServiceDate,
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
      title: form.registration,
      status: form.status,
      data: {
        ...editRecord.data,
        make: form.make,
        model: form.model,
        year: parseInt(form.year, 10) || null,
        type: form.type,
        assignedDriver: form.assignedDriver,
        mileage: parseInt(form.mileage, 10) || 0,
        nextServiceDate: form.nextServiceDate,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      registration: record.title,
      make: (record.data.make as string) || '',
      model: (record.data.model as string) || '',
      year: String((record.data.year as number) || ''),
      type: (record.data.type as string) || 'Truck',
      status: record.status || 'active',
      assignedDriver: (record.data.assignedDriver as string) || '',
      mileage: String((record.data.mileage as number) || ''),
      nextServiceDate: (record.data.nextServiceDate as string) || '',
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
    active: allRecords.filter((r) => r.status === 'active').length,
    maintenance: allRecords.filter((r) => r.status === 'maintenance').length,
    retired: allRecords.filter((r) => r.status === 'retired').length,
  };

  const vehicleFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="v-reg">Registration</Label>
          <Input
            id="v-reg"
            value={form.registration}
            onChange={(e) => setField('registration', e.target.value)}
            placeholder="CA 123-456"
            required
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            value={form.type}
            onValueChange={(val) => setField('type', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="v-make">Make</Label>
          <Input
            id="v-make"
            value={form.make}
            onChange={(e) => setField('make', e.target.value)}
            placeholder="Toyota"
          />
        </div>
        <div>
          <Label htmlFor="v-model">Model</Label>
          <Input
            id="v-model"
            value={form.model}
            onChange={(e) => setField('model', e.target.value)}
            placeholder="Hilux"
          />
        </div>
        <div>
          <Label htmlFor="v-year">Year</Label>
          <Input
            id="v-year"
            type="number"
            value={form.year}
            onChange={(e) => setField('year', e.target.value)}
            placeholder="2024"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
              {VEHICLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="v-driver">Assigned Driver</Label>
          <Input
            id="v-driver"
            value={form.assignedDriver}
            onChange={(e) => setField('assignedDriver', e.target.value)}
            placeholder="Driver name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="v-mileage">Mileage (km)</Label>
          <Input
            id="v-mileage"
            type="number"
            value={form.mileage}
            onChange={(e) => setField('mileage', e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="v-service">Next Service Date</Label>
          <Input
            id="v-service"
            type="date"
            value={form.nextServiceDate}
            onChange={(e) => setField('nextServiceDate', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="v-notes">Notes</Label>
        <textarea
          id="v-notes"
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
          <h2 className="text-lg font-semibold">Vehicles</h2>
          <p className="text-sm text-muted-foreground">
            Manage your fleet vehicles and track their status
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Vehicle
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by registration..."
          className="pl-9"
        />
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="active">Active ({tabCounts.active})</TabsTrigger>
          <TabsTrigger value="maintenance">
            Maintenance ({tabCounts.maintenance})
          </TabsTrigger>
          <TabsTrigger value="retired">
            Retired ({tabCounts.retired})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No vehicles found</p>
              <p className="text-sm mt-1">
                Add your first vehicle to get started.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Registration
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Make/Model
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Year
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Assigned Driver
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Mileage
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Next Service
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = (record.status || 'active') as VehicleStatus;
                      const make = (record.data.make as string) || '';
                      const model = (record.data.model as string) || '';
                      const makeModel = [make, model].filter(Boolean).join(' ') || '-';

                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {record.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {makeModel}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.year as number) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.type as string) || '-'}
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
                            {(record.data.assignedDriver as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.mileage
                              ? `${Number(record.data.mileage).toLocaleString()} km`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.nextServiceDate
                              ? new Date(
                                  record.data.nextServiceDate as string,
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
                                aria-label="View vehicle"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit vehicle"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete vehicle"
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

      {/* Add Vehicle Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
            <DialogDescription>
              Add a new vehicle to your fleet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {vehicleFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Vehicle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
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
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>Update vehicle details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {vehicleFormFields}
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
                <DialogDescription>Vehicle details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_COLORS[
                        (viewRecord.status || 'active') as VehicleStatus
                      ] ?? STATUS_COLORS.active,
                    )}
                  >
                    {STATUS_LABELS[(viewRecord.status || 'active') as VehicleStatus] ?? viewRecord.status}
                  </Badge>
                  {viewRecord.data.type ? (
                    <Badge variant="secondary">
                      {viewRecord.data.type as string}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Make</span>
                  <span>{(viewRecord.data.make as string) || '-'}</span>
                  <span className="text-muted-foreground">Model</span>
                  <span>{(viewRecord.data.model as string) || '-'}</span>
                  <span className="text-muted-foreground">Year</span>
                  <span>{(viewRecord.data.year as number) || '-'}</span>
                  <span className="text-muted-foreground">Assigned Driver</span>
                  <span>
                    {(viewRecord.data.assignedDriver as string) || '-'}
                  </span>
                  <span className="text-muted-foreground">Mileage</span>
                  <span>
                    {viewRecord.data.mileage
                      ? `${Number(viewRecord.data.mileage).toLocaleString()} km`
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Next Service</span>
                  <span>
                    {viewRecord.data.nextServiceDate
                      ? new Date(
                          viewRecord.data.nextServiceDate as string,
                        ).toLocaleDateString()
                      : '-'}
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

export default VehiclesPage;
