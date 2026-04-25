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
  Briefcase,
  Pencil,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract'] as const;
const JOB_STATUSES = ['Open', 'Closed', 'Draft'] as const;

type JobStatus = (typeof JOB_STATUSES)[number];

const STATUS_COLORS: Record<JobStatus, string> = {
  Open: 'bg-green-500/15 text-green-400',
  Closed: 'bg-red-500/15 text-red-400',
  Draft: 'bg-gray-500/15 text-gray-400',
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface JobForm {
  title: string;
  department: string;
  location: string;
  jobType: string;
  positions: string;
  description: string;
  requirements: string;
  salaryRange: string;
  status: string;
}

const emptyForm: JobForm = {
  title: '',
  department: '',
  location: '',
  jobType: 'Full-time',
  positions: '1',
  description: '',
  requirements: '',
  salaryRange: '',
  status: 'Draft',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function JobsPage() {
  const { workspaceSlug, appSlug } = useParams();
  const ws = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';

  const [showPost, setShowPost] = useState(false);
  const [editRecord, setEditRecord] = useState<ModuleRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<ModuleRecord | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm);

  const { data, isLoading } = useModuleRecords(ws, app, 'jobs');
  const createRecord = useCreateModuleRecord(ws, app, 'jobs');
  const updateRecord = useUpdateModuleRecord(ws, app, 'jobs');
  const deleteRecord = useDeleteModuleRecord(ws, app, 'jobs');

  const records = data?.records ?? [];

  const setField = (field: keyof JobForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRecord.mutateAsync({
      title: form.title,
      status: form.status,
      priority: 'medium',
      data: {
        department: form.department,
        location: form.location,
        jobType: form.jobType,
        positions: parseInt(form.positions, 10) || 1,
        description: form.description,
        requirements: form.requirements,
        salaryRange: form.salaryRange,
        applications: 0,
      },
    });
    setShowPost(false);
    setForm(emptyForm);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    await updateRecord.mutateAsync({
      id: editRecord.id,
      title: form.title,
      status: form.status,
      data: {
        ...editRecord.data,
        department: form.department,
        location: form.location,
        jobType: form.jobType,
        positions: parseInt(form.positions, 10) || 1,
        description: form.description,
        requirements: form.requirements,
        salaryRange: form.salaryRange,
      },
    });
    setEditRecord(null);
    setForm(emptyForm);
  };

  const openEdit = (record: ModuleRecord) => {
    setForm({
      title: record.title,
      department: (record.data.department as string) || '',
      location: (record.data.location as string) || '',
      jobType: (record.data.jobType as string) || 'Full-time',
      positions: String((record.data.positions as number) || 1),
      description: (record.data.description as string) || '',
      requirements: (record.data.requirements as string) || '',
      salaryRange: (record.data.salaryRange as string) || '',
      status: record.status || 'Draft',
    });
    setEditRecord(record);
  };

  const toggleStatus = (record: ModuleRecord) => {
    const newStatus = record.status === 'Open' ? 'Closed' : 'Open';
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

  // Shared form JSX
  const jobFormFields = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="job-title">Title</Label>
        <Input
          id="job-title"
          value={form.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="Senior Software Engineer"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="job-dept">Department</Label>
          <Input
            id="job-dept"
            value={form.department}
            onChange={(e) => setField('department', e.target.value)}
            placeholder="Engineering"
          />
        </div>
        <div>
          <Label htmlFor="job-loc">Location</Label>
          <Input
            id="job-loc"
            value={form.location}
            onChange={(e) => setField('location', e.target.value)}
            placeholder="Cape Town, SA / Remote"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Type</Label>
          <Select
            value={form.jobType}
            onValueChange={(val) => setField('jobType', val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOB_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="job-positions">Positions</Label>
          <Input
            id="job-positions"
            type="number"
            min={1}
            value={form.positions}
            onChange={(e) => setField('positions', e.target.value)}
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
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="job-salary">Salary Range</Label>
        <Input
          id="job-salary"
          value={form.salaryRange}
          onChange={(e) => setField('salaryRange', e.target.value)}
          placeholder="e.g. R500k - R750k"
        />
      </div>
      <div>
        <Label htmlFor="job-desc">Description</Label>
        <textarea
          id="job-desc"
          value={form.description}
          onChange={(e) => setField('description', e.target.value)}
          placeholder="Job description..."
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <Label htmlFor="job-req">Requirements</Label>
        <textarea
          id="job-req"
          value={form.requirements}
          onChange={(e) => setField('requirements', e.target.value)}
          placeholder="Requirements..."
          rows={4}
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
          <h2 className="text-lg font-semibold">Jobs</h2>
          <p className="text-sm text-muted-foreground">
            Manage job postings and track applications
          </p>
        </div>
        <Button onClick={() => setShowPost(true)} size="sm">
          <Plus className="h-3.5 w-3.5" />
          Post Job
        </Button>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No jobs posted yet</p>
          <p className="text-sm mt-1">
            Create your first job posting to start attracting candidates.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Department
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Location
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Positions
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Applications
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Posted
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((record) => {
                  const status = (record.status || 'Draft') as JobStatus;
                  const applications =
                    (record.data.applications as number) ?? 0;

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{record.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.department as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.location as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.jobType as string) || '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(record.data.positions as number) ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {applications}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            'border-0 text-[10px]',
                            STATUS_COLORS[status] ?? STATUS_COLORS.Draft,
                          )}
                        >
                          {status}
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
                            aria-label="View job"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => toggleStatus(record)}
                            aria-label={
                              status === 'Open' ? 'Close job' : 'Reopen job'
                            }
                          >
                            {status === 'Open' ? (
                              <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(record)}
                            aria-label="Edit job"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(record.id)}
                            aria-label="Delete job"
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

      {/* Post Job Dialog */}
      <Dialog open={showPost} onOpenChange={setShowPost}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Post Job</DialogTitle>
            <DialogDescription>
              Create a new job listing for your team.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            {jobFormFields}
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowPost(false);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createRecord.isPending}>
                {createRecord.isPending ? 'Posting...' : 'Post Job'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
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
            <DialogTitle>Edit Job</DialogTitle>
            <DialogDescription>Update job listing details.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            {jobFormFields}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewRecord && (
            <>
              <DialogHeader>
                <DialogTitle>{viewRecord.title}</DialogTitle>
                <DialogDescription>Job details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'border-0',
                      STATUS_COLORS[
                        (viewRecord.status || 'Draft') as JobStatus
                      ] ?? STATUS_COLORS.Draft,
                    )}
                  >
                    {viewRecord.status || 'Draft'}
                  </Badge>
                  {viewRecord.data.jobType ? (
                    <Badge variant="secondary">
                      {viewRecord.data.jobType as string}
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Department</span>
                  <span>
                    {(viewRecord.data.department as string) || '-'}
                  </span>
                  <span className="text-muted-foreground">Location</span>
                  <span>{(viewRecord.data.location as string) || '-'}</span>
                  <span className="text-muted-foreground">Positions</span>
                  <span>{(viewRecord.data.positions as number) ?? '-'}</span>
                  <span className="text-muted-foreground">Applications</span>
                  <span>{(viewRecord.data.applications as number) ?? 0}</span>
                  <span className="text-muted-foreground">Salary Range</span>
                  <span>
                    {(viewRecord.data.salaryRange as string) || '-'}
                  </span>
                  <span className="text-muted-foreground">Posted</span>
                  <span>
                    {new Date(viewRecord.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {viewRecord.data.description ? (
                  <div>
                    <p className="text-sm font-medium mb-1">Description</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                      {viewRecord.data.description as string}
                    </p>
                  </div>
                ) : null}

                {viewRecord.data.requirements ? (
                  <div>
                    <p className="text-sm font-medium mb-1">Requirements</p>
                    <p className="text-sm bg-muted/30 rounded-md p-3 whitespace-pre-wrap">
                      {viewRecord.data.requirements as string}
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
                <Button
                  variant={viewRecord.status === 'Open' ? 'destructive' : 'default'}
                  onClick={() => {
                    toggleStatus(viewRecord);
                    setViewRecord(null);
                  }}
                >
                  {viewRecord.status === 'Open' ? 'Close Job' : 'Reopen Job'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobsPage;
