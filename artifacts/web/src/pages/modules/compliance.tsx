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
  ShieldCheck,
  Pencil,
  Trash2,
  Eye,
  AlertTriangle,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'regulatory',
  'safety',
  'environmental',
  'financial',
  'data-privacy',
] as const;

type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  regulatory: 'Regulatory',
  safety: 'Safety',
  environmental: 'Environmental',
  financial: 'Financial',
  'data-privacy': 'Data Privacy',
};

const STATUSES = [
  'compliant',
  'non-compliant',
  'pending-review',
  'expired',
] as const;

type ComplianceStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<ComplianceStatus, string> = {
  compliant: 'Compliant',
  'non-compliant': 'Non-Compliant',
  'pending-review': 'Pending Review',
  expired: 'Expired',
};

const STATUS_COLORS: Record<ComplianceStatus, string> = {
  compliant: 'bg-green-500/15 text-green-400',
  'non-compliant': 'bg-red-500/15 text-red-400',
  'pending-review': 'bg-amber-500/15 text-amber-400',
  expired: 'bg-gray-500/15 text-gray-400',
};

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;

type RiskLevel = (typeof RISK_LEVELS)[number];

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'bg-green-500/15 text-green-400',
  medium: 'bg-yellow-500/15 text-yellow-400',
  high: 'bg-orange-500/15 text-orange-400',
  critical: 'bg-red-500/15 text-red-400',
};

const FILTER_TABS = ['all', 'non-compliant', 'pending-review', 'expired'] as const;

type FilterTab = (typeof FILTER_TABS)[number];

const FILTER_TAB_LABELS: Record<FilterTab, string> = {
  all: 'All',
  'non-compliant': 'Non-Compliant',
  'pending-review': 'Pending Review',
  expired: 'Expired',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isOverdue(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function isUpcomingSoon(dateStr: string | undefined, days = 30): boolean {
  if (!dateStr) return false;
  const d = daysUntil(dateStr);
  return d >= 0 && d <= days;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface ComplianceForm {
  name: string;
  category: string;
  requirement: string;
  owner: string;
  status: string;
  lastAuditDate: string;
  nextReviewDate: string;
  riskLevel: string;
  notes: string;
}

const emptyForm: ComplianceForm = {
  name: '',
  category: 'regulatory',
  requirement: '',
  owner: '',
  status: 'pending-review',
  lastAuditDate: '',
  nextReviewDate: '',
  riskLevel: 'medium',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompliancePage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<ComplianceForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'compliance_item', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'compliance_item');
  const updateRecord = useUpdateModuleRecord(ws, app, 'compliance_item');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'compliance_item');

  const allRecords = data?.records ?? [];

  // Filter by active tab
  const filteredRecords = useMemo(() => {
    if (activeTab === 'all') return allRecords;
    return allRecords.filter((r) => r.status === activeTab);
  }, [allRecords, activeTab]);

  // Counts per tab
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: allRecords.length,
      'non-compliant': 0,
      'pending-review': 0,
      expired: 0,
    };
    for (const r of allRecords) {
      if (r.status === 'non-compliant') counts['non-compliant']++;
      if (r.status === 'pending-review') counts['pending-review']++;
      if (r.status === 'expired') counts.expired++;
    }
    return counts;
  }, [allRecords]);

  // Overdue / upcoming alerts
  const overdueCount = useMemo(
    () =>
      allRecords.filter((r) =>
        isOverdue(r.data.nextReviewDate as string | undefined),
      ).length,
    [allRecords],
  );

  const upcomingCount = useMemo(
    () =>
      allRecords.filter(
        (r) =>
          !isOverdue(r.data.nextReviewDate as string | undefined) &&
          isUpcomingSoon(r.data.nextReviewDate as string | undefined),
      ).length,
    [allRecords],
  );

  const setField = (field: keyof ComplianceForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.name,
      status: form.status,
      priority: form.riskLevel,
      data: {
        category: form.category,
        requirement: form.requirement,
        owner: form.owner,
        lastAuditDate: form.lastAuditDate,
        nextReviewDate: form.nextReviewDate,
        riskLevel: form.riskLevel,
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
      priority: form.riskLevel,
      data: {
        ...editRecord.data,
        category: form.category,
        requirement: form.requirement,
        owner: form.owner,
        lastAuditDate: form.lastAuditDate,
        nextReviewDate: form.nextReviewDate,
        riskLevel: form.riskLevel,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      name: record.title,
      category: (record.data.category as string) || 'regulatory',
      requirement: (record.data.requirement as string) || '',
      owner: (record.data.owner as string) || '',
      status: record.status || 'pending-review',
      lastAuditDate: (record.data.lastAuditDate as string) || '',
      nextReviewDate: (record.data.nextReviewDate as string) || '',
      riskLevel: (record.data.riskLevel as string) || 'medium',
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

  // Shared form fields
  const complianceFormFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="comp-name">Item Name</Label>
        <Input
          id="comp-name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="POPIA Data Protection"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select
            value={form.category}
            onValueChange={(val) => setField('category', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="comp-owner">Owner</Label>
          <Input
            id="comp-owner"
            value={form.owner}
            onChange={(e) => setField('owner', e.target.value)}
            placeholder="Compliance Officer"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="comp-req">Requirement</Label>
        <textarea
          id="comp-req"
          value={form.requirement}
          onChange={(e) => setField('requirement', e.target.value)}
          placeholder="Describe the compliance requirement..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
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
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Risk Level</Label>
          <Select
            value={form.riskLevel}
            onValueChange={(val) => setField('riskLevel', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_LEVELS.map((r) => (
                <SelectItem key={r} value={r}>
                  {RISK_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="comp-last-audit">Last Audit Date</Label>
          <Input
            id="comp-last-audit"
            type="date"
            value={form.lastAuditDate}
            onChange={(e) => setField('lastAuditDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="comp-next-review">Next Review Date</Label>
          <Input
            id="comp-next-review"
            type="date"
            value={form.nextReviewDate}
            onChange={(e) => setField('nextReviewDate', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="comp-notes">Notes</Label>
        <textarea
          id="comp-notes"
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
          <h2 className="text-lg font-semibold">Compliance</h2>
          <p className="text-sm text-muted-foreground">
            Track regulatory requirements, audits, and compliance status
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Compliance Item
        </Button>
      </div>

      {/* Alert banners */}
      {(overdueCount > 0 || upcomingCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {overdueCount} overdue review{overdueCount !== 1 ? 's' : ''}
            </div>
          )}
          {upcomingCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <Clock className="h-4 w-4" />
              {upcomingCount} review{upcomingCount !== 1 ? 's' : ''} due within
              30 days
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search compliance items..."
          className="pl-9"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {FILTER_TAB_LABELS[tab]}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({tabCounts[tab]})
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No compliance items found</p>
          <p className="text-sm mt-1">
            Add your first compliance item to start tracking.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Item Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Owner
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Risk Level
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Last Audit
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Next Review
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((record) => {
                  const status = (record.status || 'pending-review') as ComplianceStatus;
                  const riskLevel = (record.data.riskLevel as RiskLevel) || 'medium';
                  const category = (record.data.category as Category) || 'regulatory';
                  const nextReview = record.data.nextReviewDate as string | undefined;
                  const reviewOverdue = isOverdue(nextReview);
                  const reviewSoon = !reviewOverdue && isUpcomingSoon(nextReview);

                  return (
                    <tr
                      key={record.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        reviewOverdue && 'bg-red-500/5',
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {CATEGORY_LABELS[category] || category}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.owner as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_COLORS[status] ?? STATUS_COLORS['pending-review'],
                          )}
                        >
                          {STATUS_LABELS[status] || status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            RISK_COLORS[riskLevel] ?? RISK_COLORS.medium,
                          )}
                        >
                          {RISK_LABELS[riskLevel] || riskLevel}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.data.lastAuditDate
                          ? new Date(
                              record.data.lastAuditDate as string,
                            ).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-muted-foreground',
                            reviewOverdue && 'text-red-400 font-medium',
                            reviewSoon && 'text-amber-400 font-medium',
                          )}
                        >
                          {nextReview
                            ? new Date(nextReview).toLocaleDateString()
                            : '-'}
                        </span>
                        {reviewOverdue && (
                          <span className="ml-1.5 text-[10px] text-red-400">
                            OVERDUE
                          </span>
                        )}
                        {reviewSoon && (
                          <span className="ml-1.5 text-[10px] text-amber-400">
                            {daysUntil(nextReview!)}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewRecord(record)}
                            aria-label="View compliance item"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit compliance item"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete compliance item"
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
            <DialogTitle>Add Compliance Item</DialogTitle>
            <DialogDescription>
              Enter the compliance requirement details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {complianceFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Item'}
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
            <DialogTitle>Edit Compliance Item</DialogTitle>
            <DialogDescription>Update compliance item details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {complianceFormFields}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{viewRecord.title}</DialogTitle>
                <DialogDescription>Compliance item details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_COLORS[
                        (viewRecord.status || 'pending-review') as ComplianceStatus
                      ] ?? STATUS_COLORS['pending-review'],
                    )}
                  >
                    {STATUS_LABELS[(viewRecord.status || 'pending-review') as ComplianceStatus] || viewRecord.status}
                  </Badge>
                  <Badge
                    className={cn(
                      'border-0',
                      RISK_COLORS[
                        (viewRecord.data.riskLevel as RiskLevel) || 'medium'
                      ] ?? RISK_COLORS.medium,
                    )}
                  >
                    {RISK_LABELS[(viewRecord.data.riskLevel as RiskLevel) || 'medium']} Risk
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <span>
                    {CATEGORY_LABELS[(viewRecord.data.category as Category) || 'regulatory'] || String(viewRecord.data.category)}
                  </span>
                  <span className="text-muted-foreground">Owner</span>
                  <span>{(viewRecord.data.owner as string) || '-'}</span>
                  <span className="text-muted-foreground">Last Audit</span>
                  <span>
                    {viewRecord.data.lastAuditDate
                      ? new Date(viewRecord.data.lastAuditDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Next Review</span>
                  <span
                    className={cn(
                      isOverdue(viewRecord.data.nextReviewDate as string | undefined) && 'text-red-400 font-medium',
                      isUpcomingSoon(viewRecord.data.nextReviewDate as string | undefined) && 'text-amber-400 font-medium',
                    )}
                  >
                    {viewRecord.data.nextReviewDate
                      ? new Date(viewRecord.data.nextReviewDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(viewRecord.createdAt).toLocaleDateString()}</span>
                </div>

                {viewRecord.data.requirement ? (
                  <div>
                    <p className="text-sm font-medium mb-1">Requirement</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                      {viewRecord.data.requirement as string}
                    </p>
                  </div>
                ) : null}

                {viewRecord.data.notes ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
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

export default CompliancePage;
