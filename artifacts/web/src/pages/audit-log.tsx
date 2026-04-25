import { useState, useCallback } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import {
  useAuditLogs,
  type AuditLogParams,
  type AuditLog,
} from '@/lib/hooks/use-enterprise';
import {
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'export', label: 'Export' },
  { value: 'import', label: 'Import' },
  { value: 'invite', label: 'Invite' },
  { value: 'permission_grant', label: 'Permission Grant' },
  { value: 'permission_revoke', label: 'Permission Revoke' },
];

const RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'application', label: 'Application' },
  { value: 'block', label: 'Block' },
  { value: 'dimension', label: 'Dimension' },
  { value: 'board', label: 'Board' },
  { value: 'version', label: 'Version' },
  { value: 'scenario', label: 'Scenario' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'environment', label: 'Environment' },
  { value: 'member', label: 'Member' },
  { value: 'workspace', label: 'Workspace' },
];

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  update: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  delete: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  login: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  export: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  import: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300',
  invite: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  permission_grant: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  permission_revoke: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const PAGE_SIZE = 25;

// ------------------------------------------------------------------
// Expandable row component
// ------------------------------------------------------------------

function AuditLogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const actionColor = ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground';

  return (
    <>
      <tr
        className="group cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        role="row"
        aria-expanded={expanded}
      >
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="font-medium">{log.userEmail}</span>
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize',
              actionColor,
            )}
          >
            {log.action.replace(/_/g, ' ')}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
          {log.resourceType}
        </td>
        <td className="px-4 py-3 text-sm">
          {log.resourceName ?? log.resourceId ?? '-'}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </td>
      </tr>
      {expanded && log.details && (
        <tr>
          <td colSpan={6} className="px-4 py-3 bg-muted/30 border-t border-border">
            <div className="text-xs">
              <p className="font-medium text-muted-foreground mb-1">Details</p>
              <pre className="bg-background border border-border rounded-md p-3 overflow-x-auto text-xs text-foreground">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ------------------------------------------------------------------
// Main audit log page
// ------------------------------------------------------------------

export function AuditLogPage() {
  const { workspaceSlug: paramSlug } = useParams();
  const slug = paramSlug ?? useAuthStore.getState().workspaceSlug ?? '';

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const params: AuditLogParams = {
    page,
    limit: PAGE_SIZE,
    ...(actionFilter && { action: actionFilter }),
    ...(resourceTypeFilter && { resourceType: resourceTypeFilter }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(emailSearch && { userEmail: emailSearch }),
  };

  const { data, isLoading } = useAuditLogs(slug, params);
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleReset = useCallback(() => {
    setActionFilter('');
    setResourceTypeFilter('');
    setStartDate('');
    setEndDate('');
    setEmailSearch('');
    setPage(1);
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        </div>
        <p className="text-muted-foreground mt-1">
          Track all actions performed across your workspace
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-4">
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <Filter className="h-4 w-4" />
          Filters
          {showFilters ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {showFilters && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Action filter */}
              <div>
                <label className="block text-xs font-medium mb-1">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Filter by action"
                >
                  {ACTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resource type filter */}
              <div>
                <label className="block text-xs font-medium mb-1">Resource Type</label>
                <select
                  value={resourceTypeFilter}
                  onChange={(e) => {
                    setResourceTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Filter by resource type"
                >
                  {RESOURCE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="block text-xs font-medium mb-1">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Start date"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="block text-xs font-medium mb-1">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="End date"
                />
              </div>

              {/* User email search */}
              <div>
                <label className="block text-xs font-medium mb-1">User Email</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={emailSearch}
                    onChange={(e) => {
                      setEmailSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by email..."
                    className="w-full pl-8 pr-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-label="Search by user email"
                  />
                </div>
              </div>
            </div>

            {(actionFilter || resourceTypeFilter || startDate || endDate || emailSearch) && (
              <div className="flex justify-end">
                <button
                  onClick={handleReset}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">No audit log entries found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Actions performed in your workspace will appear here
          </p>
        </div>
      ) : (
        <>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" role="table" aria-label="Audit log entries">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Resource Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Resource
                    </th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <AuditLogRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}
              {' - '}
              {Math.min(page * PAGE_SIZE, total)} of {total} entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-border rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
