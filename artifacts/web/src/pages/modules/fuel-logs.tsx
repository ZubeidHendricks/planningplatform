import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import {
  useModuleRecords,
  useCreateModuleRecord,
  useDeleteModuleRecord,
  type ModuleRecord,
} from '@/lib/hooks/use-modules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Fuel,
  Trash2,
  TrendingUp,
  DollarSign,
  Droplets,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isCurrentMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FuelLogForm {
  date: string;
  vehicle: string;
  driver: string;
  litres: string;
  cost: string;
  odometer: string;
  station: string;
  receiptNo: string;
  notes: string;
}

const emptyForm: FuelLogForm = {
  date: '',
  vehicle: '',
  driver: '',
  litres: '',
  cost: '',
  odometer: '',
  station: '',
  receiptNo: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FuelLogsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FuelLogForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'fuel_record', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'fuel_record');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'fuel_record');

  const records = data?.records ?? [];

  // Summary stats for current month
  const monthlyStats = useMemo(() => {
    const monthRecords = records.filter((r) =>
      isCurrentMonth((r.data.date as string) || r.createdAt),
    );
    const totalLitres = monthRecords.reduce(
      (sum, r) => sum + (Number(r.data.litres) || 0),
      0,
    );
    const totalCost = monthRecords.reduce(
      (sum, r) => sum + (Number(r.data.cost) || 0),
      0,
    );
    const avgCostPerLitre = totalLitres > 0 ? totalCost / totalLitres : 0;
    return { totalLitres, totalCost, avgCostPerLitre };
  }, [records]);

  const setField = (field: keyof FuelLogForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = `${form.vehicle || 'Vehicle'} - ${form.date || new Date().toISOString().split('T')[0]}`;
    await createRecord.mutateAsync({
      title: label,
      status: 'logged',
      priority: 'medium',
      data: {
        date: form.date,
        vehicle: form.vehicle,
        driver: form.driver,
        litres: form.litres ? parseFloat(form.litres) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        odometer: form.odometer ? parseInt(form.odometer, 10) : null,
        station: form.station,
        receiptNo: form.receiptNo,
        notes: form.notes,
      },
    });
    setShowAdd(false);
    setForm(emptyForm);
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

  const fuelLogFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fl-date">Date</Label>
          <Input
            id="fl-date"
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="fl-vehicle">Vehicle</Label>
          <Input
            id="fl-vehicle"
            value={form.vehicle}
            onChange={(e) => setField('vehicle', e.target.value)}
            placeholder="Registration no."
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="fl-driver">Driver</Label>
          <Input
            id="fl-driver"
            value={form.driver}
            onChange={(e) => setField('driver', e.target.value)}
            placeholder="Driver name"
          />
        </div>
        <div>
          <Label htmlFor="fl-station">Station</Label>
          <Input
            id="fl-station"
            value={form.station}
            onChange={(e) => setField('station', e.target.value)}
            placeholder="Fuel station"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="fl-litres">Litres</Label>
          <Input
            id="fl-litres"
            type="number"
            step="0.01"
            value={form.litres}
            onChange={(e) => setField('litres', e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="fl-cost">Cost (ZAR)</Label>
          <Input
            id="fl-cost"
            type="number"
            step="0.01"
            value={form.cost}
            onChange={(e) => setField('cost', e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <Label htmlFor="fl-odometer">Odometer</Label>
          <Input
            id="fl-odometer"
            type="number"
            value={form.odometer}
            onChange={(e) => setField('odometer', e.target.value)}
            placeholder="km"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="fl-receipt">Receipt No</Label>
        <Input
          id="fl-receipt"
          value={form.receiptNo}
          onChange={(e) => setField('receiptNo', e.target.value)}
          placeholder="Receipt number"
        />
      </div>
      <div>
        <Label htmlFor="fl-notes">Notes</Label>
        <textarea
          id="fl-notes"
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
          <h2 className="text-lg font-semibold">Fuel Logs</h2>
          <p className="text-sm text-muted-foreground">
            Track fuel purchases and consumption
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Fuel Log
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Droplets className="h-4 w-4" />
            Total Litres (This Month)
          </div>
          <p className="text-2xl font-semibold">
            {monthlyStats.totalLitres.toLocaleString('en-ZA', {
              maximumFractionDigits: 1,
            })}{' '}
            L
          </p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            Total Cost (This Month)
          </div>
          <p className="text-2xl font-semibold">
            {formatZAR(monthlyStats.totalCost)}
          </p>
        </div>
        <div className="border border-border rounded-lg p-4 bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            Avg Cost/L (This Month)
          </div>
          <p className="text-2xl font-semibold">
            {monthlyStats.avgCostPerLitre > 0
              ? formatZAR(monthlyStats.avgCostPerLitre)
              : '-'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fuel logs..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Fuel className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No fuel logs yet</p>
          <p className="text-sm mt-1">
            Add your first fuel log to start tracking.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Vehicle
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Driver
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Litres
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Cost (ZAR)
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Odometer
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Station
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Receipt No
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => {
                  const litres = record.data.litres as number | null;
                  const cost = record.data.cost as number | null;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.data.date
                          ? new Date(
                              record.data.date as string,
                            ).toLocaleDateString()
                          : new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {(record.data.vehicle as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.driver as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {litres != null
                          ? `${litres.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {cost != null ? formatZAR(cost) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {record.data.odometer != null
                          ? `${Number(record.data.odometer).toLocaleString()} km`
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.station as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.receiptNo as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete fuel log"
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

      {/* Add Fuel Log Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Fuel Log</DialogTitle>
            <DialogDescription>
              Record a new fuel purchase.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {fuelLogFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Log'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FuelLogsPage;
