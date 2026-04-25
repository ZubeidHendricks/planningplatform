import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApps, useCreateApp, useDeleteApp } from '@/lib/hooks/use-apps';
import { useAuthStore } from '@/stores/auth';
import { Plus, Boxes, Trash2, ArrowRight } from 'lucide-react';
import { getAppIcon } from '@/lib/icon-map';

export function ApplicationsPage() {
  const { workspaceSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: apps, isLoading } = useApps(slug);
  const createApp = useCreateApp();
  const deleteApp = useDeleteApp();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [appSlug, setAppSlug] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createApp.mutateAsync({ workspaceSlug: slug, name, slug: appSlug, description: description || undefined });
    setShowCreate(false);
    setName('');
    setAppSlug('');
    setDescription('');
  };

  const autoSlug = (val: string) => {
    setName(val);
    setAppSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="px-3 py-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage your planning models and applications</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all duration-300 font-medium shadow-win hover:shadow-win-lg self-start sm:self-auto min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> New Application
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 sm:mb-8 bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-win p-4 sm:p-8">
          <h2 className="text-lg font-semibold mb-4">Create Application</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => autoSlug(e.target.value)}
                  placeholder="Revenue Planning"
                  className="w-full px-3 py-2 border border-input rounded-2xl bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  value={appSlug}
                  onChange={(e) => setAppSlug(e.target.value)}
                  placeholder="revenue-planning"
                  className="w-full px-3 py-2 border border-input rounded-2xl bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  pattern="^[a-z0-9-]+$"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createApp.isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 font-medium disabled:opacity-50 transition-all duration-300">
                {createApp.isPending ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-border/50 rounded-2xl hover:bg-muted transition-all duration-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {apps?.length === 0 ? (
        <div className="text-center py-16 bg-card/70 backdrop-blur-xl border border-border/50 rounded-3xl shadow-win">
          <Boxes className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No applications yet</h3>
          <p className="text-muted-foreground mt-1">Create your first planning application to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps?.map((app) => (
            <div key={app.id} className="bg-card/70 backdrop-blur-xl border border-border/50 rounded-3xl shadow-win p-5 hover:border-primary/50 hover:shadow-win-lg hover:scale-[1.01] transition-all duration-300 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                    {(() => { const Icon = getAppIcon(app.icon); return Icon ? <Icon className="h-5 w-5" /> : app.name.charAt(0).toUpperCase(); })()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{app.name}</h3>
                    <p className="text-sm text-muted-foreground">{app.slug}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteApp.mutate({ workspaceSlug: slug, appSlug: app.slug })}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all rounded"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {app.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{app.description}</p>
              )}
              <Link
                to={`/${slug}/apps/${app.slug}`}
                className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium"
              >
                Open <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
