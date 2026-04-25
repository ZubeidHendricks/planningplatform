import { useState } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useVersions, useCreateVersion, useUpdateVersion, useDeleteVersion, useCloneVersion } from '@/lib/hooks/use-versions';
import { Plus, Trash2, Lock, Unlock, GitBranch, Copy } from 'lucide-react';

const typeColors: Record<string, string> = {
  budget: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  forecast: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  actuals: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export function VersionsTab() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: versions, isLoading } = useVersions(slug, appSlug ?? '');
  const createVersion = useCreateVersion();
  const updateVersion = useUpdateVersion();
  const deleteVersion = useDeleteVersion();
  const cloneVersion = useCloneVersion();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [versionType, setVersionType] = useState<string>('budget');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createVersion.mutateAsync({
      workspaceSlug: slug,
      appSlug: appSlug ?? '',
      name,
      versionType: versionType as 'budget' | 'forecast' | 'actuals',
    });
    setShowCreate(false);
    setName('');
  };

  const toggleLock = (versionId: string, currentLock: number) => {
    updateVersion.mutate({
      workspaceSlug: slug,
      appSlug: appSlug ?? '',
      versionId,
      isLocked: currentLock ? 0 : 1,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Versions & Scenarios</h2>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
          <Plus className="h-3.5 w-3.5" /> New Version
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-muted/50 border border-border rounded-lg p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="FY2026 Budget" className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={versionType} onChange={(e) => setVersionType(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="budget">Budget</option>
                  <option value="forecast">Forecast</option>
                  <option value="actuals">Actuals</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createVersion.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {versions?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No versions yet. Create budget, forecast, or actuals versions.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {versions?.map((version) => (
            <div key={version.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors group">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{version.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[version.versionType] ?? 'bg-muted text-muted-foreground'}`}>
                      {version.versionType}
                    </span>
                    {version.isLocked ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Created {new Date(version.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => cloneVersion.mutate({ workspaceSlug: slug, appSlug: appSlug ?? '', versionId: version.id })}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  title="Clone version"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => toggleLock(version.id, version.isLocked)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                  title={version.isLocked ? 'Unlock' : 'Lock'}
                >
                  {version.isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </button>
                {!version.isLocked && (
                  <button
                    onClick={() => deleteVersion.mutate({ workspaceSlug: slug, appSlug: appSlug ?? '', versionId: version.id })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
