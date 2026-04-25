import { useState, useRef, useEffect, useCallback } from 'react';
import {
  useEnvironments,
  useCreateEnvironment,
  usePromoteEnvironment,
  useDeleteEnvironment,
  type Environment,
} from '@/lib/hooks/use-enterprise';
import {
  ChevronDown,
  Plus,
  ArrowUpRight,
  Trash2,
  Check,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------
// Environment Switcher
// ------------------------------------------------------------------

interface EnvironmentSwitcherProps {
  workspaceSlug: string;
  appSlug: string;
  activeEnvironmentId?: string | null;
  onSwitch?: (env: Environment) => void;
}

export function EnvironmentSwitcher({
  workspaceSlug,
  appSlug,
  activeEnvironmentId,
  onSwitch,
}: EnvironmentSwitcherProps) {
  const { data: environments, isLoading } = useEnvironments(workspaceSlug, appSlug);
  const createEnvironment = useCreateEnvironment();
  const promoteEnvironment = usePromoteEnvironment();
  const deleteEnvironment = useDeleteEnvironment();

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [promoteMenuId, setPromoteMenuId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine active environment
  const activeEnv = environments?.find((e) => e.id === activeEnvironmentId)
    ?? environments?.find((e) => !!e.isDefault)
    ?? environments?.[0];

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
        setPromoteMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!newEnvName.trim()) return;
      createEnvironment.mutate(
        { workspaceSlug, appSlug, name: newEnvName.trim() },
        {
          onSuccess: () => {
            setNewEnvName('');
            setShowCreate(false);
          },
        },
      );
    },
    [workspaceSlug, appSlug, newEnvName, createEnvironment],
  );

  const handlePromote = useCallback(
    (envId: string) => {
      promoteEnvironment.mutate({ workspaceSlug, appSlug, environmentId: envId });
      setPromoteMenuId(null);
    },
    [workspaceSlug, appSlug, promoteEnvironment],
  );

  const handleDelete = useCallback(
    (envId: string) => {
      deleteEnvironment.mutate({ workspaceSlug, appSlug, environmentId: envId });
    },
    [workspaceSlug, appSlug, deleteEnvironment],
  );

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs">
        <Layers className="h-3 w-3 animate-pulse" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!environments || environments.length === 0) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Layers className="h-3 w-3" />
          <span>No Environment</span>
          <ChevronDown className="h-3 w-3" />
        </button>

        {open && (
          <div className="absolute top-full right-0 mt-1 z-50 min-w-[220px] rounded-md border border-border bg-popover shadow-md p-2">
            <form onSubmit={handleCreate} className="space-y-2">
              <input
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                placeholder="Environment name"
                className="w-full px-2.5 py-1.5 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                required
              />
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  disabled={createEnvironment.isPending}
                  className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-2 py-1 border border-border rounded-md text-xs hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current environment chip */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
          activeEnv?.isDefault
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Layers className="h-3 w-3" />
        <span>{activeEnv?.name ?? 'Environment'}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full right-0 mt-1 z-50 min-w-[240px] rounded-md border border-border bg-popover shadow-md"
          role="listbox"
          aria-label="Select environment"
        >
          <div className="p-1">
            {environments.map((env) => {
              const isActive = env.id === activeEnv?.id;
              return (
                <div key={env.id} className="relative group">
                  <button
                    onClick={() => {
                      onSwitch?.(env);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={isActive}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors text-left',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
                    {!isActive && <div className="w-3.5" />}
                    <span className="flex-1 truncate">{env.name}</span>
                    {!!env.isDefault && (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1 rounded">
                        default
                      </span>
                    )}
                  </button>

                  {/* Actions on hover */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!env.isDefault && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPromoteMenuId(promoteMenuId === env.id ? null : env.id);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Promote"
                          aria-label={`Promote ${env.name}`}
                        >
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(env.id);
                          }}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                          aria-label={`Delete ${env.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Promote confirmation */}
                  {promoteMenuId === env.id && (
                    <div className="ml-6 px-2 pb-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePromote(env.id);
                        }}
                        disabled={promoteEnvironment.isPending}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        {promoteEnvironment.isPending ? 'Promoting...' : 'Confirm promote to production'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-border p-1">
            {showCreate ? (
              <form onSubmit={handleCreate} className="p-1 space-y-2">
                <input
                  value={newEnvName}
                  onChange={(e) => setNewEnvName(e.target.value)}
                  placeholder="Environment name"
                  className="w-full px-2.5 py-1.5 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                  required
                />
                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    disabled={createEnvironment.isPending || !newEnvName.trim()}
                    className="flex-1 px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50"
                  >
                    {createEnvironment.isPending ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setNewEnvName('');
                    }}
                    className="px-2 py-1 border border-border rounded-md text-xs hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Environment</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
