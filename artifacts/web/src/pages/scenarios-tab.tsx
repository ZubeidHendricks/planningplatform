import { useState } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useScenarios, useCreateScenario, useDeleteScenario, useUpdateScenario } from '@/lib/hooks/use-scenarios';
import { useVersions } from '@/lib/hooks/use-versions';
import { Plus, Trash2, GitCompare, Play, Pause, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScenariosTab() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: scenarios, isLoading } = useScenarios(slug, appSlug ?? '');
  const { data: versions } = useVersions(slug, appSlug ?? '');
  const createScenario = useCreateScenario();
  const updateScenario = useUpdateScenario();
  const deleteScenario = useDeleteScenario();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseVersionId, setBaseVersionId] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseVersionId) return;
    await createScenario.mutateAsync({
      workspaceSlug: slug,
      appSlug: appSlug ?? '',
      name,
      description: description || undefined,
      baseVersionId,
    });
    setShowCreate(false);
    setName('');
    setDescription('');
    setBaseVersionId('');
  };

  const toggleActive = (scenarioId: string, currentActive: number) => {
    updateScenario.mutate({
      workspaceSlug: slug,
      appSlug: appSlug ?? '',
      scenarioId,
      isActive: currentActive ? 0 : 1,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Scenarios</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Quick what-if analysis overlays</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> New Scenario
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-muted/50 border border-border rounded-lg p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Optimistic Growth"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Base Version</label>
                <select
                  value={baseVersionId}
                  onChange={(e) => setBaseVersionId(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Select a version...</option>
                  {versions?.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} ({v.versionType})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What-if: 20% higher growth rate"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createScenario.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
                {createScenario.isPending ? 'Creating...' : 'Create Scenario'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {scenarios?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GitCompare className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="mb-1">No scenarios yet</p>
          <p className="text-xs">Create scenarios to explore what-if analyses against your versions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios?.map((scenario) => {
            const baseVersion = versions?.find((v) => v.id === scenario.baseVersionId);
            return (
              <div
                key={scenario.id}
                className={cn(
                  'border rounded-lg p-4 transition-all',
                  scenario.isActive
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-border/80',
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-md flex items-center justify-center mt-0.5',
                      scenario.isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}>
                      <GitCompare className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{scenario.name}</h3>
                        {scenario.isActive ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/20 text-primary">Active</span>
                        ) : null}
                      </div>
                      {scenario.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{scenario.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Base: <span className="font-medium text-foreground">{baseVersion?.name ?? 'Unknown'}</span></span>
                        <span>Created {new Date(scenario.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(scenario.id, scenario.isActive)}
                      className={cn(
                        'p-1.5 rounded transition-colors',
                        scenario.isActive ? 'text-primary hover:text-primary/80' : 'text-muted-foreground hover:text-foreground',
                      )}
                      title={scenario.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {scenario.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteScenario.mutate({ workspaceSlug: slug, appSlug: appSlug ?? '', scenarioId: scenario.id })}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
