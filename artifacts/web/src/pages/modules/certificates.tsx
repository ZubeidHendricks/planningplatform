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
  Award,
  Pencil,
  Trash2,
  Eye,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CERT_STATUSES = [
  'valid',
  'expiring-soon',
  'expired',
  'revoked',
] as const;

type CertStatus = (typeof CERT_STATUSES)[number];

const STATUS_LABELS: Record<CertStatus, string> = {
  valid: 'Valid',
  'expiring-soon': 'Expiring Soon',
  expired: 'Expired',
  revoked: 'Revoked',
};

const STATUS_COLORS: Record<CertStatus, string> = {
  valid: 'bg-green-500/15 text-green-400',
  'expiring-soon': 'bg-amber-500/15 text-amber-400',
  expired: 'bg-red-500/15 text-red-400',
  revoked: 'bg-gray-500/15 text-gray-400',
};

const FILTER_TABS = ['all', 'valid', 'expiring-soon', 'expired'] as const;

type FilterTab = (typeof FILTER_TABS)[number];

const FILTER_TAB_LABELS: Record<FilterTab, string> = {
  all: 'All',
  valid: 'Valid',
  'expiring-soon': 'Expiring Soon',
  expired: 'Expired',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function isExpiringSoon(dateStr: string | undefined, days = 60): boolean {
  if (!dateStr) return false;
  const d = daysUntil(dateStr);
  return d >= 0 && d <= days;
}

function expiryBadge(
  expiryDate: string | undefined,
  status: CertStatus,
): { label: string; className: string } | null {
  if (status === 'revoked') return null;
  if (!expiryDate) return null;

  if (isExpired(expiryDate)) {
    return {
      label: 'EXPIRED',
      className: 'bg-red-500/15 text-red-400',
    };
  }

  const days = daysUntil(expiryDate);

  if (days <= 7) {
    return {
      label: `${days}d left`,
      className: 'bg-red-500/15 text-red-400',
    };
  }

  if (days <= 30) {
    return {
      label: `${days}d left`,
      className: 'bg-orange-500/15 text-orange-400',
    };
  }

  if (days <= 60) {
    return {
      label: `${days}d left`,
      className: 'bg-amber-500/15 text-amber-400',
    };
  }

  return null;
}

/**
 * Derive status from expiry date when creating/editing so the status
 * stays consistent with the actual date.
 */
function deriveStatus(expiryDate: string, manualStatus: string): string {
  if (manualStatus === 'revoked') return 'revoked';
  if (!expiryDate) return manualStatus;
  if (isExpired(expiryDate)) return 'expired';
  if (isExpiringSoon(expiryDate)) return 'expiring-soon';
  return 'valid';
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface CertificateForm {
  name: string;
  holder: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  certificateNo: string;
  notes: string;
}

const emptyForm: CertificateForm = {
  name: '',
  holder: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  status: 'valid',
  certificateNo: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CertificatesPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<CertificateForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'certificate', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'certificate');
  const updateRecord = useUpdateModuleRecord(ws, app, 'certificate');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'certificate');

  const allRecords = data?.records ?? [];

  // Compute effective status from expiry dates
  const recordsWithStatus = useMemo(() => {
    return allRecords.map((r) => {
      const expiry = r.data.expiryDate as string | undefined;
      const rawStatus = r.status || 'valid';
      const effectiveStatus = expiry
        ? deriveStatus(expiry, rawStatus)
        : rawStatus;
      return { ...r, _effectiveStatus: effectiveStatus as CertStatus };
    });
  }, [allRecords]);

  // Filter by tab
  const filteredRecords = useMemo(() => {
    if (activeTab === 'all') return recordsWithStatus;
    return recordsWithStatus.filter((r) => r._effectiveStatus === activeTab);
  }, [recordsWithStatus, activeTab]);

  // Counts
  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: recordsWithStatus.length,
      valid: 0,
      'expiring-soon': 0,
      expired: 0,
    };
    for (const r of recordsWithStatus) {
      if (r._effectiveStatus === 'valid') counts.valid++;
      if (r._effectiveStatus === 'expiring-soon') counts['expiring-soon']++;
      if (r._effectiveStatus === 'expired') counts.expired++;
    }
    return counts;
  }, [recordsWithStatus]);

  // Bulk alerts
  const expiredCount = tabCounts.expired;
  const expiringCount = tabCounts['expiring-soon'];

  const setField = (field: keyof CertificateForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const computedStatus = deriveStatus(form.expiryDate, form.status);
    await createRecord.mutateAsync({
      title: form.name,
      status: computedStatus,
      priority: 'medium',
      data: {
        holder: form.holder,
        issuer: form.issuer,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        certificateNo: form.certificateNo,
        notes: form.notes,
      },
    });
    setShowAdd(false);
    setForm(emptyForm);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    const computedStatus = deriveStatus(form.expiryDate, form.status);
    await updateRecord.mutateAsync({
      id: editRecord.id,
      title: form.name,
      status: computedStatus,
      data: {
        ...editRecord.data,
        holder: form.holder,
        issuer: form.issuer,
        issueDate: form.issueDate,
        expiryDate: form.expiryDate,
        certificateNo: form.certificateNo,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      name: record.title,
      holder: (record.data.holder as string) || '',
      issuer: (record.data.issuer as string) || '',
      issueDate: (record.data.issueDate as string) || '',
      expiryDate: (record.data.expiryDate as string) || '',
      status: record.status || 'valid',
      certificateNo: (record.data.certificateNo as string) || '',
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
  const certificateFormFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="cert-name">Certificate Name</Label>
        <Input
          id="cert-name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="ISO 27001 Certification"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cert-holder">Employee / Asset</Label>
          <Input
            id="cert-holder"
            value={form.holder}
            onChange={(e) => setField('holder', e.target.value)}
            placeholder="John Smith / Server Room A"
          />
        </div>
        <div>
          <Label htmlFor="cert-issuer">Issuer</Label>
          <Input
            id="cert-issuer"
            value={form.issuer}
            onChange={(e) => setField('issuer', e.target.value)}
            placeholder="Certification Body"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cert-issue-date">Issue Date</Label>
          <Input
            id="cert-issue-date"
            type="date"
            value={form.issueDate}
            onChange={(e) => setField('issueDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cert-expiry-date">Expiry Date</Label>
          <Input
            id="cert-expiry-date"
            type="date"
            value={form.expiryDate}
            onChange={(e) => setField('expiryDate', e.target.value)}
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
              {CERT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-adjusted based on expiry date.
          </p>
        </div>
        <div>
          <Label htmlFor="cert-no">Certificate No</Label>
          <Input
            id="cert-no"
            value={form.certificateNo}
            onChange={(e) => setField('certificateNo', e.target.value)}
            placeholder="CERT-2025-001"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="cert-notes">Notes</Label>
        <textarea
          id="cert-notes"
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
          <h2 className="text-lg font-semibold">Certificates</h2>
          <p className="text-sm text-muted-foreground">
            Track certifications, licences, and their expiry dates
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Certificate
        </Button>
      </div>

      {/* Bulk expiry alerts */}
      {(expiredCount > 0 || expiringCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-6">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <ShieldAlert className="h-4 w-4" />
              {expiredCount} expired certificate{expiredCount !== 1 ? 's' : ''}
            </div>
          )}
          {expiringCount > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <Clock className="h-4 w-4" />
              {expiringCount} certificate{expiringCount !== 1 ? 's' : ''}{' '}
              expiring within 60 days
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
          placeholder="Search certificates..."
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
          <Award className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No certificates found</p>
          <p className="text-sm mt-1">
            Add your first certificate to start tracking.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Certificate Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Employee / Asset
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Issuer
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Issue Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Expiry Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Certificate No
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRecords.map((record) => {
                  const effectiveStatus = record._effectiveStatus;
                  const expiryDate = record.data.expiryDate as
                    | string
                    | undefined;
                  const badge = expiryBadge(expiryDate, effectiveStatus);

                  return (
                    <tr
                      key={record.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        effectiveStatus === 'expired' && 'bg-red-500/5',
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.holder as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.issuer as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {record.data.issueDate
                          ? new Date(
                              record.data.issueDate as string,
                            ).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-muted-foreground',
                              effectiveStatus === 'expired' &&
                                'text-red-400 font-medium',
                              effectiveStatus === 'expiring-soon' &&
                                'text-amber-400 font-medium',
                            )}
                          >
                            {expiryDate
                              ? new Date(expiryDate).toLocaleDateString()
                              : '-'}
                          </span>
                          {badge && (
                            <Badge
                              className={cn(
                                'border-0 text-[10px] px-1.5 py-0',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_COLORS[effectiveStatus] ??
                              STATUS_COLORS.valid,
                          )}
                        >
                          {STATUS_LABELS[effectiveStatus] || effectiveStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {(record.data.certificateNo as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewRecord(record)}
                            aria-label="View certificate"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit certificate"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete certificate"
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
            <DialogTitle>Add Certificate</DialogTitle>
            <DialogDescription>
              Enter the certificate or licence details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {certificateFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Certificate'}
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
            <DialogTitle>Edit Certificate</DialogTitle>
            <DialogDescription>
              Update certificate details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {certificateFormFields}
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
          {viewRecord && (() => {
            const vExpiry = viewRecord.data.expiryDate as string | undefined;
            const vRawStatus = viewRecord.status || 'valid';
            const vStatus = vExpiry
              ? deriveStatus(vExpiry, vRawStatus)
              : vRawStatus;
            const vBadge = expiryBadge(
              vExpiry,
              vStatus as CertStatus,
            );

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{viewRecord.title}</DialogTitle>
                  <DialogDescription>Certificate details</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'border-0',
                        STATUS_COLORS[vStatus as CertStatus] ??
                          STATUS_COLORS.valid,
                      )}
                    >
                      {STATUS_LABELS[vStatus as CertStatus] || vStatus}
                    </Badge>
                    {vBadge && (
                      <Badge
                        className={cn('border-0 text-xs', vBadge.className)}
                      >
                        {vBadge.label}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-muted-foreground">
                      Employee / Asset
                    </span>
                    <span>{(viewRecord.data.holder as string) || '-'}</span>
                    <span className="text-muted-foreground">Issuer</span>
                    <span>{(viewRecord.data.issuer as string) || '-'}</span>
                    <span className="text-muted-foreground">Certificate No</span>
                    <span className="font-mono text-xs">
                      {(viewRecord.data.certificateNo as string) || '-'}
                    </span>
                    <span className="text-muted-foreground">Issue Date</span>
                    <span>
                      {viewRecord.data.issueDate
                        ? new Date(
                            viewRecord.data.issueDate as string,
                          ).toLocaleDateString()
                        : '-'}
                    </span>
                    <span className="text-muted-foreground">Expiry Date</span>
                    <span
                      className={cn(
                        vStatus === 'expired' && 'text-red-400 font-medium',
                        vStatus === 'expiring-soon' &&
                          'text-amber-400 font-medium',
                      )}
                    >
                      {vExpiry
                        ? new Date(vExpiry).toLocaleDateString()
                        : '-'}
                      {vExpiry &&
                        !isExpired(vExpiry) &&
                        ` (${daysUntil(vExpiry)} days remaining)`}
                    </span>
                    <span className="text-muted-foreground">Created</span>
                    <span>
                      {new Date(viewRecord.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {viewRecord.data.notes ? (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Notes
                      </p>
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
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CertificatesPage;
