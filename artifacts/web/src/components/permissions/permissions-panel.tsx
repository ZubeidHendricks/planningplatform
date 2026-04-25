import { useState, useCallback } from 'react';
import {
  useAppPermissions,
  useGrantPermission,
  useUpdatePermission,
  useRevokePermission,
  type AppPermission,
} from '@/lib/hooks/use-enterprise';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------
// Role configuration
// ------------------------------------------------------------------

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  editor: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300',
};

// ------------------------------------------------------------------
// Permission row
// ------------------------------------------------------------------

function PermissionRow({
  permission,
  workspaceSlug,
  appSlug,
}: {
  permission: AppPermission;
  workspaceSlug: string;
  appSlug: string;
}) {
  const updatePermission = useUpdatePermission();
  const revokePermission = useRevokePermission();
  const isOwner = permission.role === 'owner';

  const handleRoleChange = useCallback(
    (newRole: string) => {
      updatePermission.mutate({
        workspaceSlug,
        appSlug,
        permissionId: permission.id,
        role: newRole,
      });
    },
    [workspaceSlug, appSlug, permission.id, updatePermission],
  );

  const handleRevoke = useCallback(() => {
    revokePermission.mutate({
      workspaceSlug,
      appSlug,
      permissionId: permission.id,
    });
  }, [workspaceSlug, appSlug, permission.id, revokePermission]);

  return (
    <div className="flex items-center justify-between px-4 py-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {(permission.userEmail ?? permission.userId).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {permission.userEmail ?? permission.userId}
          </p>
          <p className="text-xs text-muted-foreground">
            Added {new Date(permission.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isOwner ? (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium',
              ROLE_COLORS.owner,
            )}
          >
            Owner
          </span>
        ) : (
          <select
            value={permission.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            disabled={updatePermission.isPending}
            className="px-2 py-1 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            aria-label={`Role for ${permission.userEmail ?? permission.userId}`}
          >
            {ROLES.filter((r) => r.value !== 'owner').map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        )}
        {!isOwner && (
          <button
            onClick={handleRevoke}
            disabled={revokePermission.isPending}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
            title="Remove access"
            aria-label={`Remove ${permission.userEmail ?? permission.userId}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main panel
// ------------------------------------------------------------------

interface PermissionsPanelProps {
  workspaceSlug: string;
  appSlug: string;
}

export function PermissionsPanel({ workspaceSlug, appSlug }: PermissionsPanelProps) {
  const { data: permissions, isLoading } = useAppPermissions(workspaceSlug, appSlug);
  const grantPermission = useGrantPermission();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('editor');

  const handleGrant = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!userId.trim()) return;
      grantPermission.mutate(
        {
          workspaceSlug,
          appSlug,
          userId: userId.trim(),
          role,
        },
        {
          onSuccess: () => {
            setUserId('');
            setRole('editor');
          },
        },
      );
    },
    [workspaceSlug, appSlug, userId, role, grantPermission],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">App Permissions</h3>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Workspace owners and admins always have full access. Manage additional per-app permissions below.
      </p>

      {/* User list */}
      {permissions && permissions.length > 0 ? (
        <div className="border border-border rounded-lg divide-y divide-border mb-4">
          {permissions.map((perm) => (
            <PermissionRow
              key={perm.id}
              permission={perm}
              workspaceSlug={workspaceSlug}
              appSlug={appSlug}
            />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-border rounded-lg py-8 text-center text-muted-foreground mb-4">
          <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No app-level permissions configured</p>
          <p className="text-xs mt-1">
            Workspace members use their workspace role by default.
          </p>
        </div>
      )}

      {/* Add user form */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <form onSubmit={handleGrant} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1">User Email or ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={grantPermission.isPending || !userId.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {grantPermission.isPending ? 'Granting...' : 'Grant'}
          </button>
        </form>
      </div>
    </div>
  );
}
