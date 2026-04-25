import { useState } from 'react';
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
  Circle,
  Pencil,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYRE_POSITIONS = ['FL', 'FR', 'RL', 'RR', 'Spare'] as const;
const TYRE_STATUSES = ['new', 'in-use', 'worn', 'replaced'] as const;

type TyreStatus = (typeof TYRE_STATUSES)[number];

const STATUS_COLORS: Record<TyreStatus, string> = {
  new: 'bg-green-500/15 text-green-400',
  'in-use': 'bg-blue-500/15 text-blue-400',
  worn: 'bg-amber-500/15 text-amber-400',
  replaced: 'bg-gray-500/15 text-gray-400',
};

const STATUS_LABELS: Record<TyreStatus, string> = {
  new: 'New',
  'in-use': 'In Use',
  worn: 'Worn',
  replaced: 'Replaced',
};

const POSITION_LABELS: Record<string, string> = {
  FL: 'Front Left',
  FR: 'Front Right',
  RL: 'Rear Left',
  RR: 'Rear Right',
  Spare: 'Spare',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function treadDepthBadge(depth: number | null | undefined) {
  if (depth == null) return <span className="text-muted-foreground">-</span>;
  if (depth > 4) {
    return (
      <Badge className="border-0 text-[10px] bg-green-500/15 text-green-400">
        {depth} mm
      </Badge>
    );
  }
  if (depth >= 2) {
    return (
      <Badge className="border-0 text-[10px] bg-amber-500/15 text-amber-400">
        {depth} mm
      </Badge>
    );
  }
  return (
    <Badge className="border-0 text-[10px] bg-red-500/15 text-red-400">
      {depth} mm
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface TyreForm {
  serialNo: string;
  brand: string;
  size: string;
  position: string;
  vehicle: string;
  treadDepth: string;
  status: string;
  installDate: string;
  notes: string;
}

const emptyForm: TyreForm = {
  serialNo: '',
  brand: '',
  size: '',
  position: 'FL',
  vehicle: '',
  treadDepth: '',
  status: 'new',
  installDate: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TyresPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<TyreForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'tyre', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'tyre');
  const updateRecord = useUpdateModuleRecord(ws, app, 'tyre');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'tyre');

  const records = data?.records ?? [];

  const setField = (field: keyof TyreForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.serialNo,
      status: form.status,
      priority: 'medium',
      data: {
        brand: form.brand,
        size: form.size,
        position: form.position,
        vehicle: form.vehicle,
        treadDepth: form.treadDepth ? parseFloat(form.treadDepth) : null,
        installDate: form.installDate,
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
      title: form.serialNo,
      status: form.status,
      data: {
        ...editRecord.data,
        brand: form.brand,
        size: form.size,
        position: form.position,
        vehicle: form.vehicle,
        treadDepth: form.treadDepth ? parseFloat(form.treadDepth) : null,
        installDate: form.installDate,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      serialNo: record.title,
      brand: (record.data.brand as string) || '',
      size: (record.data.size as string) || '',
      position: (record.data.position as string) || 'FL',
      vehicle: (record.data.vehicle as string) || '',
      treadDepth:
        record.data.treadDepth != null ? String(record.data.treadDepth) : '',
      status: record.status || 'new',
      installDate: (record.data.installDate as string) || '',
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

  const tyreFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="ty-serial">Serial No</Label>
          <Input
            id="ty-serial"
            value={form.serialNo}
            onChange={(e) => setField('serialNo', e.target.value)}
            placeholder="Tyre serial number"
            required
          />
        </div>
        <div>
          <Label htmlFor="ty-brand">Brand</Label>
          <Input
            id="ty-brand"
            value={form.brand}
            onChange={(e) => setField('brand', e.target.value)}
            placeholder="Bridgestone"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="ty-size">Size</Label>
          <Input
            id="ty-size"
            value={form.size}
            onChange={(e) => setField('size', e.target.value)}
            placeholder="265/70R17"
          />
        </div>
        <div>
          <Label>Position</Label>
          <Select
            value={form.position}
            onValueChange={(val) => setField('position', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYRE_POSITIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p} - {POSITION_LABELS[p]}
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
              {TYRE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="ty-vehicle">Vehicle</Label>
          <Input
            id="ty-vehicle"
            value={form.vehicle}
            onChange={(e) => setField('vehicle', e.target.value)}
            placeholder="Registration no."
          />
        </div>
        <div>
          <Label htmlFor="ty-tread">Tread Depth (mm)</Label>
          <Input
            id="ty-tread"
            type="number"
            step="0.1"
            value={form.treadDepth}
            onChange={(e) => setField('treadDepth', e.target.value)}
            placeholder="8.0"
          />
        </div>
        <div>
          <Label htmlFor="ty-install">Install Date</Label>
          <Input
            id="ty-install"
            type="date"
            value={form.installDate}
            onChange={(e) => setField('installDate', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="ty-notes">Notes</Label>
        <textarea
          id="ty-notes"
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
          <h2 className="text-lg font-semibold">Tyres</h2>
          <p className="text-sm text-muted-foreground">
            Track tyre inventory, condition, and replacements
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Tyre
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by serial no or vehicle..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Circle className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No tyres tracked yet</p>
          <p className="text-sm mt-1">Add your first tyre to get started.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Serial No
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Brand
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Size
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Position
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Tread Depth
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Install Date
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => {
                  const status = (record.status || 'new') as TyreStatus;
                  const treadDepth = record.data.treadDepth as
                    | number
                    | null
                    | undefined;
                  const position = (record.data.position as string) || '';

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.brand as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.size as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {position
                          ? `${position} (${POSITION_LABELS[position] || position})`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.vehicle as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {treadDepthBadge(treadDepth)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_COLORS[status] ?? STATUS_COLORS.new,
                          )}
                        >
                          {STATUS_LABELS[status] ?? status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.data.installDate
                          ? new Date(
                              record.data.installDate as string,
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
                            aria-label="Edit tyre"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete tyre"
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

      {/* Add Tyre Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Tyre</DialogTitle>
            <DialogDescription>
              Register a new tyre in inventory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {tyreFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Tyre'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Tyre Dialog */}
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
            <DialogTitle>Edit Tyre</DialogTitle>
            <DialogDescription>
              Update tyre details or replace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {tyreFormFields}
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

export default TyresPage;
