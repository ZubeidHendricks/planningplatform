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
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRIP_STATUSES = ['planned', 'in-progress', 'completed', 'cancelled'] as const;

type TripStatus = (typeof TRIP_STATUSES)[number];

const STATUS_COLORS: Record<TripStatus, string> = {
  planned: 'bg-blue-500/15 text-blue-400',
  'in-progress': 'bg-amber-500/15 text-amber-400',
  completed: 'bg-green-500/15 text-green-400',
  cancelled: 'bg-red-500/15 text-red-400',
};

const STATUS_LABELS: Record<TripStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface TripForm {
  tripId: string;
  vehicle: string;
  driver: string;
  origin: string;
  destination: string;
  distance: string;
  status: string;
  date: string;
  notes: string;
}

const emptyForm: TripForm = {
  tripId: '',
  vehicle: '',
  driver: '',
  origin: '',
  destination: '',
  distance: '',
  status: 'planned',
  date: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TripsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [tabFilter, setTabFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<TripForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'route', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'route');
  const updateRecord = useUpdateModuleRecord(ws, app, 'route');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'route');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (tabFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) => r.status.toLowerCase() === tabFilter.toLowerCase(),
    );
  }, [allRecords, tabFilter]);

  const setField = (field: keyof TripForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.tripId || `TRIP-${Date.now().toString(36).toUpperCase()}`,
      status: form.status,
      priority: 'medium',
      data: {
        vehicle: form.vehicle,
        driver: form.driver,
        origin: form.origin,
        destination: form.destination,
        distance: form.distance ? parseFloat(form.distance) : null,
        date: form.date,
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
      title: form.tripId,
      status: form.status,
      data: {
        ...editRecord.data,
        vehicle: form.vehicle,
        driver: form.driver,
        origin: form.origin,
        destination: form.destination,
        distance: form.distance ? parseFloat(form.distance) : null,
        date: form.date,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      tripId: record.title,
      vehicle: (record.data.vehicle as string) || '',
      driver: (record.data.driver as string) || '',
      origin: (record.data.origin as string) || '',
      destination: (record.data.destination as string) || '',
      distance: record.data.distance != null ? String(record.data.distance) : '',
      status: record.status || 'planned',
      date: (record.data.date as string) || '',
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
    planned: allRecords.filter((r) => r.status === 'planned').length,
    'in-progress': allRecords.filter((r) => r.status === 'in-progress').length,
    completed: allRecords.filter((r) => r.status === 'completed').length,
  };

  const tripFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="t-id">Trip ID</Label>
          <Input
            id="t-id"
            value={form.tripId}
            onChange={(e) => setField('tripId', e.target.value)}
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
              {TRIP_STATUSES.map((s) => (
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
          <Label htmlFor="t-vehicle">Vehicle</Label>
          <Input
            id="t-vehicle"
            value={form.vehicle}
            onChange={(e) => setField('vehicle', e.target.value)}
            placeholder="Registration no."
          />
        </div>
        <div>
          <Label htmlFor="t-driver">Driver</Label>
          <Input
            id="t-driver"
            value={form.driver}
            onChange={(e) => setField('driver', e.target.value)}
            placeholder="Driver name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="t-origin">Origin</Label>
          <Input
            id="t-origin"
            value={form.origin}
            onChange={(e) => setField('origin', e.target.value)}
            placeholder="Departure point"
            required
          />
        </div>
        <div>
          <Label htmlFor="t-dest">Destination</Label>
          <Input
            id="t-dest"
            value={form.destination}
            onChange={(e) => setField('destination', e.target.value)}
            placeholder="Arrival point"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="t-distance">Distance (km)</Label>
          <Input
            id="t-distance"
            type="number"
            value={form.distance}
            onChange={(e) => setField('distance', e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <Label htmlFor="t-date">Date</Label>
          <Input
            id="t-date"
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="t-notes">Notes</Label>
        <textarea
          id="t-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Trip notes..."
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
          <h2 className="text-lg font-semibold">Trips</h2>
          <p className="text-sm text-muted-foreground">
            Plan and track fleet trips and routes
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Trip
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trips..."
          className="pl-9"
        />
      </div>

      {/* Filter tabs */}
      <Tabs value={tabFilter} onValueChange={setTabFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({tabCounts.all})</TabsTrigger>
          <TabsTrigger value="planned">
            Planned ({tabCounts.planned})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({tabCounts['in-progress']})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({tabCounts.completed})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabFilter} className="mt-4">
          {filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No trips found</p>
              <p className="text-sm mt-1">
                Add your first trip to get started.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Trip ID
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Vehicle
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Driver
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Origin
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Destination
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Distance
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((record) => {
                      const status = (record.status || 'planned') as TripStatus;

                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {record.title}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.vehicle as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.driver as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.origin as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {(record.data.destination as string) || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.distance != null
                              ? `${Number(record.data.distance).toLocaleString()} km`
                              : '-'}
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
                                      STATUS_COLORS.planned,
                                  )}
                                >
                                  {STATUS_LABELS[status] ?? status}
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {TRIP_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {record.data.date
                              ? new Date(
                                  record.data.date as string,
                                ).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEdit(record)}
                                aria-label="Edit trip"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDelete(record.id)}
                                aria-label="Delete trip"
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

      {/* Add Trip Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Trip</DialogTitle>
            <DialogDescription>
              Schedule a new trip for your fleet.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {tripFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Trip'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Trip Dialog */}
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
            <DialogTitle>Edit Trip</DialogTitle>
            <DialogDescription>Update trip details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {tripFormFields}
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

export default TripsPage;
