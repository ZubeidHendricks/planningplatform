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
  ArrowUpDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGES = [
  'Applied',
  'Screening',
  'Interviewing',
  'Offered',
  'Hired',
  'Rejected',
] as const;

const PRIORITIES = ['high', 'medium', 'low'] as const;

const SOURCE_OPTIONS = [
  'LinkedIn',
  'Indeed',
  'Referral',
  'Website',
  'Recruiter',
  'Job Board',
  'Career Fair',
  'Other',
];

const STAGE_COLORS: Record<string, string> = {
  Applied: 'bg-blue-500/15 text-blue-400',
  Screening: 'bg-amber-500/15 text-amber-400',
  Interviewing: 'bg-purple-500/15 text-purple-400',
  Offered: 'bg-emerald-500/15 text-emerald-400',
  Hired: 'bg-green-500/15 text-green-400',
  Rejected: 'bg-red-500/15 text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-blue-500/15 text-blue-400',
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface CandidateForm {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  source: string;
  stage: string;
  priority: string;
  notes: string;
}

const emptyForm: CandidateForm = {
  name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  source: '',
  stage: 'Applied',
  priority: 'medium',
  notes: '',
};

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type SortField =
  | 'title'
  | 'email'
  | 'department'
  | 'position'
  | 'stage'
  | 'priority'
  | 'createdAt';
type SortDir = 'asc' | 'desc';

function sortRecords(
  records: ModuleRecord[],
  field: SortField,
  dir: SortDir,
): ModuleRecord[] {
  return [...records].sort((a, b) => {
    let aVal: string;
    let bVal: string;

    switch (field) {
      case 'title':
        aVal = a.title;
        bVal = b.title;
        break;
      case 'email':
        aVal = (a.data.email as string) || '';
        bVal = (b.data.email as string) || '';
        break;
      case 'department':
        aVal = (a.data.department as string) || '';
        bVal = (b.data.department as string) || '';
        break;
      case 'position':
        aVal = (a.data.position as string) || '';
        bVal = (b.data.position as string) || '';
        break;
      case 'stage':
        aVal = a.stage || '';
        bVal = b.stage || '';
        break;
      case 'priority':
        aVal = a.priority;
        bVal = b.priority;
        break;
      case 'createdAt':
        aVal = a.createdAt;
        bVal = b.createdAt;
        break;
      default:
        aVal = '';
        bVal = '';
    }

    const cmp = aVal.localeCompare(bVal);
    return dir === 'asc' ? cmp : -cmp;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CandidatesPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<CandidateForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'candidates', {
    search: search || undefined,
  });
  const createRecord = useCreateModuleRecord(ws, app, 'candidates');
  const updateRecord = useUpdateModuleRecord(ws, app, 'candidates');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'candidates');

  const allRecords = data?.records ?? [];

  const sortedRecords = useMemo(
    () => sortRecords(allRecords, sortField, sortDir),
    [allRecords, sortField, sortDir],
  );

  const setField = (field: keyof CandidateForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.name,
      stage: form.stage,
      priority: form.priority,
      data: {
        email: form.email,
        phone: form.phone,
        department: form.department,
        position: form.position,
        source: form.source,
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
      stage: form.stage,
      priority: form.priority,
      data: {
        ...editRecord.data,
        email: form.email,
        phone: form.phone,
        department: form.department,
        position: form.position,
        source: form.source,
        notes: form.notes,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      name: record.title,
      email: (record.data.email as string) || '',
      phone: (record.data.phone as string) || '',
      department: (record.data.department as string) || '',
      position: (record.data.position as string) || '',
      source: (record.data.source as string) || '',
      stage: record.stage || 'Applied',
      priority: record.priority || 'medium',
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

  // Reusable form JSX
  const candidateFormFields = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cand-name">Name</Label>
          <Input
            id="cand-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <Label htmlFor="cand-email">Email</Label>
          <Input
            id="cand-email"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cand-phone">Phone</Label>
          <Input
            id="cand-phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+27 ..."
          />
        </div>
        <div>
          <Label htmlFor="cand-dept">Department</Label>
          <Input
            id="cand-dept"
            value={form.department}
            onChange={(e) => setField('department', e.target.value)}
            placeholder="Engineering"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="cand-pos">Position</Label>
        <Input
          id="cand-pos"
          value={form.position}
          onChange={(e) => setField('position', e.target.value)}
          placeholder="Senior Developer"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Source</Label>
          <Select
            value={form.source}
            onValueChange={(val) => setField('source', val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map((src) => (
                <SelectItem key={src} value={src}>
                  {src}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Stage</Label>
          <Select
            value={form.stage}
            onValueChange={(val) => setField('stage', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select
            value={form.priority}
            onValueChange={(val) => setField('priority', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="cand-notes">Notes</Label>
        <textarea
          id="cand-notes"
          value={form.notes}
          onChange={(e) => setField('notes', e.target.value)}
          placeholder="Additional notes..."
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
    </div>
  );

  const SortHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <th className="text-left px-4 py-3 font-medium text-muted-foreground">
      <button
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => toggleSort(field)}
        type="button"
      >
        {children}
        <ArrowUpDown
          className={cn(
            'h-3 w-3',
            sortField === field ? 'text-foreground' : 'opacity-40',
          )}
        />
      </button>
    </th>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Candidates</h2>
          <p className="text-sm text-muted-foreground">
            Manage and track all candidates in your pipeline
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add Candidate
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {/* Table */}
      {sortedRecords.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No candidates yet</p>
          <p className="text-sm mt-1">Add your first candidate to get started.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <SortHeader field="title">Name</SortHeader>
                  <SortHeader field="email">Email</SortHeader>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Phone
                  </th>
                  <SortHeader field="department">Department</SortHeader>
                  <SortHeader field="position">Position</SortHeader>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Source
                  </th>
                  <SortHeader field="stage">Stage</SortHeader>
                  <SortHeader field="priority">Priority</SortHeader>
                  <SortHeader field="createdAt">Applied</SortHeader>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRecords.map((record) => {
                  const stage = record.stage || 'Applied';
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.email as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.phone as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.department as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.position as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.source as string) || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STAGE_COLORS[stage] ?? STAGE_COLORS.Applied,
                          )}
                        >
                          {stage}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            PRIORITY_COLORS[record.priority] ??
                              PRIORITY_COLORS.medium,
                          )}
                        >
                          {record.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setViewRecord(record)}
                            aria-label="View candidate"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit candidate"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete candidate"
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>
              Enter candidate information to add them to the pipeline.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {candidateFormFields}
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
                {createRecord.isPending ? 'Adding...' : 'Add Candidate'}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
            <DialogDescription>Update candidate information.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {candidateFormFields}
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
                <DialogDescription>Candidate details</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STAGE_COLORS[viewRecord.stage || 'Applied'] ??
                        STAGE_COLORS.Applied,
                    )}
                  >
                    {viewRecord.stage || 'Applied'}
                  </Badge>
                  <Badge
                    className={cn(
                      'border-0',
                      PRIORITY_COLORS[viewRecord.priority] ??
                        PRIORITY_COLORS.medium,
                    )}
                  >
                    {viewRecord.priority}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span>{(viewRecord.data.email as string) || '-'}</span>
                  <span className="text-muted-foreground">Phone</span>
                  <span>{(viewRecord.data.phone as string) || '-'}</span>
                  <span className="text-muted-foreground">Department</span>
                  <span>{(viewRecord.data.department as string) || '-'}</span>
                  <span className="text-muted-foreground">Position</span>
                  <span>{(viewRecord.data.position as string) || '-'}</span>
                  <span className="text-muted-foreground">Source</span>
                  <span>{(viewRecord.data.source as string) || '-'}</span>
                  <span className="text-muted-foreground">Applied</span>
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
                    setViewRecord(null);
                    openEdit(viewRecord);
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

export default CandidatesPage;
