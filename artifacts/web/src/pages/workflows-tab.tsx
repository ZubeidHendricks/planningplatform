import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import {
  useWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useDeleteWorkflow,
  useRunWorkflow,
  type Workflow,
} from '@/lib/hooks/use-enterprise';
import { Switch } from '@/components/ui/switch';
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
  Trash2,
  Pencil,
  Play,
  Zap,
  Clock,
  Bell,
  Mail,
  Globe,
  MousePointerClick,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------
// Trigger / Action configuration
// ------------------------------------------------------------------

const TRIGGER_TYPES = [
  { value: 'cell_change', label: 'Cell Change', icon: Zap, color: 'bg-amber-100 text-amber-700' },
  { value: 'version_lock', label: 'Version Lock', icon: Zap, color: 'bg-violet-100 text-violet-700' },
  { value: 'schedule', label: 'Schedule', icon: Clock, color: 'bg-blue-100 text-blue-700' },
  { value: 'manual', label: 'Manual', icon: MousePointerClick, color: 'bg-slate-100 text-slate-700' },
];

const ACTION_TYPES = [
  { value: 'notify', label: 'Notify', icon: Bell, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'email', label: 'Email', icon: Mail, color: 'bg-sky-100 text-sky-700' },
  { value: 'webhook', label: 'Webhook', icon: Globe, color: 'bg-orange-100 text-orange-700' },
];

function getTriggerMeta(type: string) {
  return TRIGGER_TYPES.find((t) => t.value === type) ?? TRIGGER_TYPES[3]!;
}

function getActionMeta(type: string) {
  return ACTION_TYPES.find((a) => a.value === type) ?? ACTION_TYPES[0]!;
}

// ------------------------------------------------------------------
// Workflow form (create / edit)
// ------------------------------------------------------------------

interface WorkflowFormState {
  name: string;
  description: string;
  triggerType: string;
  triggerConfig: string;
  actionType: string;
  actionConfig: string;
}

const EMPTY_FORM: WorkflowFormState = {
  name: '',
  description: '',
  triggerType: 'manual',
  triggerConfig: '{}',
  actionType: 'notify',
  actionConfig: '{}',
};

function workflowToForm(wf: Workflow): WorkflowFormState {
  return {
    name: wf.name,
    description: wf.description ?? '',
    triggerType: wf.triggerType,
    triggerConfig: JSON.stringify(wf.triggerConfig, null, 2),
    actionType: wf.actionType,
    actionConfig: JSON.stringify(wf.actionConfig, null, 2),
  };
}

// ------------------------------------------------------------------
// Trigger config help text
// ------------------------------------------------------------------

function getTriggerConfigPlaceholder(type: string): string {
  switch (type) {
    case 'cell_change':
      return '{"blockId": "block-uuid"}';
    case 'schedule':
      return '{"cron": "0 9 * * 1"}';
    case 'version_lock':
      return '{}';
    case 'manual':
    default:
      return '{}';
  }
}

function getActionConfigPlaceholder(type: string): string {
  switch (type) {
    case 'notify':
      return '{"userIds": ["user-uuid-1"]}';
    case 'email':
      return '{"to": ["user@example.com"]}';
    case 'webhook':
      return '{"url": "https://example.com/webhook"}';
    default:
      return '{}';
  }
}

// ------------------------------------------------------------------
// Workflow card component
// ------------------------------------------------------------------

function WorkflowCard({
  workflow,
  workspaceSlug,
  appSlug,
}: {
  workflow: Workflow;
  workspaceSlug: string;
  appSlug: string;
}) {
  const updateWorkflow = useUpdateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const runWorkflow = useRunWorkflow();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<WorkflowFormState>(workflowToForm(workflow));

  const triggerMeta = getTriggerMeta(workflow.triggerType);
  const actionMeta = getActionMeta(workflow.actionType);
  const TriggerIcon = triggerMeta.icon;
  const ActionIcon = actionMeta.icon;

  const handleToggle = useCallback(
    (checked: boolean) => {
      updateWorkflow.mutate({
        workspaceSlug,
        appSlug,
        workflowId: workflow.id,
        isActive: checked ? 1 : 0,
      });
    },
    [workspaceSlug, appSlug, workflow.id, updateWorkflow],
  );

  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      let parsedTriggerConfig: Record<string, unknown>;
      let parsedActionConfig: Record<string, unknown>;
      try {
        parsedTriggerConfig = JSON.parse(form.triggerConfig) as Record<string, unknown>;
        parsedActionConfig = JSON.parse(form.actionConfig) as Record<string, unknown>;
      } catch {
        return;
      }
      updateWorkflow.mutate({
        workspaceSlug,
        appSlug,
        workflowId: workflow.id,
        name: form.name,
        description: form.description || undefined,
        triggerType: form.triggerType,
        triggerConfig: parsedTriggerConfig,
        actionType: form.actionType,
        actionConfig: parsedActionConfig,
      });
      setEditing(false);
    },
    [workspaceSlug, appSlug, workflow.id, form, updateWorkflow],
  );

  return (
    <>
      <div className="border border-border rounded-lg p-4 hover:shadow-sm transition-shadow group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{workflow.name}</h3>
              {!workflow.isActive && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                  Inactive
                </span>
              )}
            </div>
            {workflow.description && (
              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                {workflow.description}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  triggerMeta.color,
                )}
              >
                <TriggerIcon className="h-3 w-3" />
                {triggerMeta.label}
              </span>
              <span className="text-muted-foreground text-xs">then</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  actionMeta.color,
                )}
              >
                <ActionIcon className="h-3 w-3" />
                {actionMeta.label}
              </span>
            </div>
            {workflow.lastRunAt && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Last run: {new Date(workflow.lastRunAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={!!workflow.isActive}
              onCheckedChange={handleToggle}
              aria-label={`Toggle ${workflow.name} workflow`}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
          <button
            onClick={() =>
              runWorkflow.mutate({
                workspaceSlug,
                appSlug,
                workflowId: workflow.id,
              })
            }
            disabled={runWorkflow.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
            title="Run now"
          >
            <Play className="h-3 w-3" />
            {runWorkflow.isPending ? 'Running...' : 'Run Now'}
          </button>
          <button
            onClick={() => {
              setForm(workflowToForm(workflow));
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            onClick={() =>
              deleteWorkflow.mutate({
                workspaceSlug,
                appSlug,
                workflowId: workflow.id,
              })
            }
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>
              Update the workflow trigger and action configuration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <select
                  value={form.actionType}
                  onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Trigger Config <span className="text-muted-foreground font-normal">(JSON)</span>
              </label>
              <textarea
                value={form.triggerConfig}
                onChange={(e) => setForm((f) => ({ ...f, triggerConfig: e.target.value }))}
                rows={2}
                placeholder={getTriggerConfigPlaceholder(form.triggerType)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Action Config <span className="text-muted-foreground font-normal">(JSON)</span>
              </label>
              <textarea
                value={form.actionConfig}
                onChange={(e) => setForm((f) => ({ ...f, actionConfig: e.target.value }))}
                rows={2}
                placeholder={getActionConfigPlaceholder(form.actionType)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateWorkflow.isPending || !form.name}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {updateWorkflow.isPending ? 'Saving...' : 'Save'}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ------------------------------------------------------------------
// Main WorkflowsTab component
// ------------------------------------------------------------------

export function WorkflowsTab() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const app = appSlug ?? '';
  const { data: workflows, isLoading } = useWorkflows(slug, app);
  const createWorkflow = useCreateWorkflow();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<WorkflowFormState>(EMPTY_FORM);

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      let parsedTriggerConfig: Record<string, unknown>;
      let parsedActionConfig: Record<string, unknown>;
      try {
        parsedTriggerConfig = JSON.parse(form.triggerConfig) as Record<string, unknown>;
        parsedActionConfig = JSON.parse(form.actionConfig) as Record<string, unknown>;
      } catch {
        return;
      }
      createWorkflow.mutate(
        {
          workspaceSlug: slug,
          appSlug: app,
          name: form.name,
          description: form.description || undefined,
          triggerType: form.triggerType,
          triggerConfig: parsedTriggerConfig,
          actionType: form.actionType,
          actionConfig: parsedActionConfig,
        },
        {
          onSuccess: () => {
            setShowCreate(false);
            setForm(EMPTY_FORM);
          },
        },
      );
    },
    [slug, app, form, createWorkflow],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Workflows</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Workflow
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-muted/50 border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold mb-3">Create Workflow</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Notify on budget change"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Trigger</label>
                <select
                  value={form.triggerType}
                  onChange={(e) => setForm((f) => ({ ...f, triggerType: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {TRIGGER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Action</label>
                <select
                  value={form.actionType}
                  onChange={(e) => setForm((f) => ({ ...f, actionType: e.target.value }))}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Trigger Config <span className="text-muted-foreground font-normal">(JSON)</span>
                </label>
                <textarea
                  value={form.triggerConfig}
                  onChange={(e) => setForm((f) => ({ ...f, triggerConfig: e.target.value }))}
                  rows={2}
                  placeholder={getTriggerConfigPlaceholder(form.triggerType)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Action Config <span className="text-muted-foreground font-normal">(JSON)</span>
                </label>
                <textarea
                  value={form.actionConfig}
                  onChange={(e) => setForm((f) => ({ ...f, actionConfig: e.target.value }))}
                  rows={2}
                  placeholder={getActionConfigPlaceholder(form.actionType)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createWorkflow.isPending || !form.name}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {createWorkflow.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setForm(EMPTY_FORM);
                }}
                className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workflow list */}
      {workflows?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <WorkflowIcon className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No workflows yet</p>
          <p className="text-xs mt-1">
            Create automated workflows triggered by data changes, schedules, or manually.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {workflows?.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              workspaceSlug={slug}
              appSlug={app}
            />
          ))}
        </div>
      )}
    </div>
  );
}
