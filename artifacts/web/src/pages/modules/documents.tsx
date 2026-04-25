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
  Pencil,
  Trash2,
  FileText,
  Eye,
  AlertTriangle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOCUMENT_TYPES = [
  'Contract',
  'Policy',
  'Certificate',
  'Letter',
  'ID',
] as const;

const DOCUMENT_STATUSES = [
  'Current',
  'Expired',
  'Pending Review',
] as const;

type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const STATUS_BADGE_CLASSES: Record<DocumentStatus, string> = {
  Current: 'bg-green-500/15 text-green-400 border-green-500/30',
  Expired: 'bg-red-500/15 text-red-400 border-red-500/30',
  'Pending Review': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isExpiringSoon(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const now = new Date();
  const diff = expiry.getTime() - now.getTime();
  const daysUntil = diff / (1000 * 60 * 60 * 24);
  return daysUntil > 0 && daysUntil <= 30;
}

function isExpired(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface DocumentForm {
  documentName: string;
  documentType: string;
  employee: string;
  expiryDate: string;
  status: string;
  reference: string;
  notes: string;
}

const emptyForm: DocumentForm = {
  documentName: '',
  documentType: 'Contract',
  employee: '',
  expiryDate: '',
  status: 'Current',
  reference: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<DocumentForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'document', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'document');
  const updateRecord = useUpdateModuleRecord(ws, app, 'document');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'document');

  const allRecords = data?.records ?? [];

  const filteredRecords = useMemo(() => {
    if (typeFilter === 'all') return allRecords;
    return allRecords.filter(
      (r) =>
        (r.data.documentType as string || '').toLowerCase() ===
        typeFilter.toLowerCase(),
    );
  }, [allRecords, typeFilter]);

  const setField = (field: keyof DocumentForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.documentName,
      status: form.status,
      priority: 'medium',
      data: {
        documentType: form.documentType,
        employee: form.employee,
        expiryDate: form.expiryDate,
        reference: form.reference,
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
      title: form.documentName,
      status: form.status,
      data: {
        ...editRecord.data,
        documentType: form.documentType,
        employee: form.employee,
        expiryDate: form.expiryDate,
        reference: form.reference,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      documentName: record.title,
      documentType: (record.data.documentType as string) || 'Contract',
      employee: (record.data.employee as string) || '',
      expiryDate: (record.data.expiryDate as string) || '',
      status: record.status || 'Current',
      reference: (record.data.reference as string) || '',
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

  const formFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="doc-name">Document Name</Label>
        <Input
          id="doc-name"
          value={form.documentName}
          onChange={(e) => setField('documentName', e.target.value)}
          placeholder="Document title"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select
            value={form.documentType}
            onValueChange={(val) => setField('documentType', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
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
              {DOCUMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="doc-emp">Employee</Label>
        <Input
          id="doc-emp"
          value={form.employee}
          onChange={(e) => setField('employee', e.target.value)}
          placeholder="Employee name"
        />
      </div>
      <div>
        <Label htmlFor="doc-expiry">Expiry Date</Label>
        <Input
          id="doc-expiry"
          type="date"
          value={form.expiryDate}
          onChange={(e) => setField('expiryDate', e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="doc-ref">Reference / URL</Label>
        <Input
          id="doc-ref"
          value={form.reference}
          onChange={(e) => setField('reference', e.target.value)}
          placeholder="File reference or URL"
        />
      </div>
      <div>
        <Label htmlFor="doc-notes">Notes</Label>
        <textarea
          id="doc-notes"
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
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Manage employee documents and certifications
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Document
        </Button>
      </div>

      {/* Search & filter */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by document name..."
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t.toLowerCase()}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">Add your first document to get started.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Document Name
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Employee
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Upload Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Expiry Date
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
                  const status = (record.status || 'Current') as DocumentStatus;
                  const expiryDate = record.data.expiryDate as string | undefined;
                  const expiring = isExpiringSoon(expiryDate);
                  const expired = isExpired(expiryDate);

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          {record.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.documentType as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.employee as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">
                            {expiryDate
                              ? new Date(expiryDate).toLocaleDateString()
                              : '-'}
                          </span>
                          {(expired || expiring) && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 text-[10px] ml-1',
                                expired
                                  ? 'text-red-400'
                                  : 'text-amber-400',
                              )}
                              title={
                                expired
                                  ? 'Document expired'
                                  : 'Expiring within 30 days'
                              }
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {expired ? 'Expired' : 'Expiring'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_BADGE_CLASSES[status] ??
                              STATUS_BADGE_CLASSES.Current,
                          )}
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewRecord(record)}
                            aria-label="View document"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit document"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete document"
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>
              Record a new employee document.
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
                {createRecord.isPending ? 'Adding...' : 'Add Document'}
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
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>Update document details.</DialogDescription>
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
                <DialogDescription>Document details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_BADGE_CLASSES[
                        (viewRecord.status || 'Current') as DocumentStatus
                      ] ?? STATUS_BADGE_CLASSES.Current,
                    )}
                  >
                    {viewRecord.status || 'Current'}
                  </Badge>
                  {viewRecord.data.documentType ? (
                    <Badge variant="secondary">
                      {String(viewRecord.data.documentType)}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Employee</span>
                  <span>{(viewRecord.data.employee as string) || '-'}</span>
                  <span className="text-muted-foreground">Upload Date</span>
                  <span>
                    {new Date(viewRecord.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-muted-foreground">Expiry Date</span>
                  <span>
                    {viewRecord.data.expiryDate
                      ? new Date(viewRecord.data.expiryDate as string).toLocaleDateString()
                      : '-'}
                  </span>
                  <span className="text-muted-foreground">Reference</span>
                  <span>{(viewRecord.data.reference as string) || '-'}</span>
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

export default DocumentsPage;
