import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { useUpdateBranding } from '@/lib/hooks/use-enterprise';
import {
  useSubscriptions,
  useBillingHistory,
  usePaymentMethod,
  useUsageSummary,
  useCancelSubscription,
  type Subscription,
  type Invoice,
  type InvoiceStatus,
} from '@/lib/hooks/use-billing';
import {
  Users,
  Shield,
  Palette,
  Bell,
  Key,
  Building2,
  Trash2,
  Save,
  UserPlus,
  CreditCard,
  Receipt,
  Download,
  Calendar,
  Package,
  BarChart3,
  HardDrive,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type SettingsSection = 'general' | 'members' | 'permissions' | 'branding' | 'notifications' | 'api' | 'billing';

interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface WorkspaceSettings {
  workspace: { id: string; name: string; slug: string; logoUrl: string | null };
  members: WorkspaceMember[];
}

const sections: Array<{ key: SettingsSection; label: string; icon: React.ElementType; description: string }> = [
  { key: 'general', label: 'General', icon: Building2, description: 'Workspace name, slug, and basic settings' },
  { key: 'billing', label: 'Billing', icon: CreditCard, description: 'Subscriptions, invoices, and payment methods' },
  { key: 'members', label: 'Members', icon: Users, description: 'Manage workspace members and invitations' },
  { key: 'permissions', label: 'Permissions', icon: Shield, description: 'Roles, access control, and security' },
  { key: 'branding', label: 'Branding', icon: Palette, description: 'Logo, colors, and visual identity' },
  { key: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and in-app notification preferences' },
  { key: 'api', label: 'API Keys', icon: Key, description: 'Manage API keys for integrations' },
];

export function SettingsPage() {
  const { workspaceSlug: paramSlug } = useParams();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const slug = paramSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<WorkspaceSettings>({
    queryKey: ['workspace-settings', slug],
    queryFn: async () => {
      const res = await api.get<WorkspaceSettings>(`/${slug}/settings`);
      return res.data!;
    },
    enabled: !!slug,
  });

  const [wsName, setWsName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [saveMsg, setSaveMsg] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => {
    if (settings?.workspace.name) setWsName(settings.workspace.name);
  }, [settings?.workspace.name]);

  const updateWorkspace = useMutation({
    mutationFn: (name: string) => api.patch(`/${slug}/settings`, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspace-settings', slug] });
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(''), 2000);
    },
  });

  const inviteMember = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      api.post(`/${slug}/settings/invite`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspace-settings', slug] });
      setInviteEmail('');
      setInviteMsg('Invited!');
      setTimeout(() => setInviteMsg(''), 2000);
    },
    onError: (err) => {
      setInviteMsg(err.message || 'Failed');
      setTimeout(() => setInviteMsg(''), 3000);
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/${slug}/settings/members/${memberId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspace-settings', slug] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your workspace configuration</p>
      </div>

      <div className="flex gap-6">
        <nav className="w-48 shrink-0 space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                  activeSection === section.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {activeSection === 'general' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">General Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Workspace Name</label>
                    <input
                      value={wsName}
                      onChange={(e) => setWsName(e.target.value)}
                      className="w-full max-w-md px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Workspace Slug</label>
                    <input
                      value={settings?.workspace.slug ?? ''}
                      className="w-full max-w-md px-3 py-2 border border-input rounded-md bg-background text-sm text-muted-foreground"
                      disabled
                    />
                    <p className="text-xs text-muted-foreground mt-1">Used in URLs. Cannot be changed.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateWorkspace.mutate(wsName)}
                      disabled={updateWorkspace.isPending || wsName === settings?.workspace.name}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {updateWorkspace.isPending ? 'Saving...' : 'Save'}
                    </button>
                    {saveMsg && <span className="text-xs text-emerald-600 font-medium">{saveMsg}</span>}
                  </div>
                </div>
              </div>
              <div className="border-t border-border pt-6">
                <h3 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h3>
                <button className="px-3 py-1.5 border border-destructive text-destructive rounded-md text-sm hover:bg-destructive/10 transition-colors">
                  Delete Workspace
                </button>
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <BillingSection workspaceSlug={slug} />
          )}

          {activeSection === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Members</h2>
              </div>

              <div className="mb-4 bg-muted/50 border border-border rounded-lg p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    inviteMember.mutate({ email: inviteEmail, role: inviteRole });
                  }}
                  className="flex items-end gap-3"
                >
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviteMember.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {inviteMember.isPending ? 'Inviting...' : 'Invite'}
                  </button>
                  {inviteMsg && <span className="text-xs font-medium text-emerald-600">{inviteMsg}</span>}
                </form>
              </div>

              <div className="border border-border rounded-lg divide-y divide-border">
                {(settings?.members ?? []).map((member) => (
                  <div key={member.id} className="flex items-center justify-between px-4 py-3 group">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium capitalize">
                        {member.role}
                      </span>
                      {member.role !== 'owner' && (
                        <button
                          onClick={() => removeMember.mutate(member.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all"
                          title="Remove member"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'permissions' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Roles & Permissions</h2>
              <div className="space-y-3">
                {[
                  { role: 'Owner', desc: 'Full access to all workspace settings and data' },
                  { role: 'Admin', desc: 'Manage members, applications, and settings' },
                  { role: 'Editor', desc: 'Create and edit applications, blocks, and boards' },
                  { role: 'Viewer', desc: 'Read-only access to boards and reports' },
                ].map(({ role, desc }) => (
                  <div key={role} className="border border-border rounded-lg p-4">
                    <h3 className="font-medium text-sm">{role}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'branding' && (
            <BrandingSection workspaceSlug={slug} />
          )}

          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground mb-4">Notification system coming in Phase 2</p>
              <div className="space-y-3">
                {[
                  { label: 'Comments & Mentions', description: 'When someone mentions you or replies to your comment' },
                  { label: 'Task Assignments', description: 'When a task is assigned to you' },
                  { label: 'Version Changes', description: 'When a version is locked or data is modified' },
                  { label: 'Import Completions', description: 'When a data import finishes' },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between p-3 border border-border rounded-lg opacity-60">
                    <div>
                      <p className="text-sm font-medium">{pref.label}</p>
                      <p className="text-xs text-muted-foreground">{pref.description}</p>
                    </div>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" defaultChecked disabled className="rounded border-input" />
                        In-app
                      </label>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input type="checkbox" disabled className="rounded border-input" />
                        Email
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'api' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">API Keys</h2>
              </div>
              <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">API key management coming in Phase 4</p>
                <p className="text-xs mt-1">Generate keys to integrate with external systems</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Branding section component
// ------------------------------------------------------------------

function BrandingSection({ workspaceSlug }: { workspaceSlug: string }) {
  const updateBranding = useUpdateBranding();
  const [companyName, setCompanyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#7c3aed');
  const [secondaryColor, setSecondaryColor] = useState('#2563eb');
  const [logoUrl, setLogoUrl] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateBranding.mutate({
      workspaceSlug,
      brandCompanyName: companyName || undefined,
      brandPrimaryColor: primaryColor,
      brandSecondaryColor: secondaryColor,
      brandLogo: logoUrl || undefined,
    });
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Branding</h2>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Company name */}
        <div>
          <label className="block text-sm font-medium mb-1">Company Name</label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Your company name"
            className="w-full max-w-md px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Displayed in reports and exports.
          </p>
        </div>

        {/* Primary color */}
        <div>
          <label className="block text-sm font-medium mb-1">Primary Color</label>
          <div className="flex items-center gap-3 max-w-md">
            <div
              className="w-10 h-10 rounded-md border border-border shrink-0 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer"
                aria-label="Pick primary color"
              />
            </div>
            <input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#7c3aed"
              maxLength={7}
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Used for buttons, links, and primary UI elements.
          </p>
        </div>

        {/* Secondary color */}
        <div>
          <label className="block text-sm font-medium mb-1">Secondary Color</label>
          <div className="flex items-center gap-3 max-w-md">
            <div
              className="w-10 h-10 rounded-md border border-border shrink-0 cursor-pointer"
              style={{ backgroundColor: secondaryColor }}
            >
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer"
                aria-label="Pick secondary color"
              />
            </div>
            <input
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              placeholder="#2563eb"
              maxLength={7}
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Used for charts, accents, and secondary elements.
          </p>
        </div>

        {/* Logo URL */}
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <div className="flex items-center gap-3 max-w-md">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo preview"
                className="w-10 h-10 rounded-md border border-border object-contain bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 border-2 border-dashed border-border rounded-md flex items-center justify-center shrink-0">
                <Palette className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enter a URL to your company logo. File upload support coming soon.
          </p>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium mb-2">Preview</label>
          <div className="max-w-md border border-border rounded-lg p-4 bg-background">
            <div className="flex items-center gap-3 mb-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-8 h-8 rounded object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {companyName ? companyName.charAt(0).toUpperCase() : 'W'}
                </div>
              )}
              <span className="text-sm font-semibold">
                {companyName || 'Your Workspace'}
              </span>
            </div>
            <div className="flex gap-2">
              <div
                className="px-3 py-1.5 rounded-md text-white text-xs font-medium"
                style={{ backgroundColor: primaryColor }}
              >
                Primary Button
              </div>
              <div
                className="px-3 py-1.5 rounded-md text-white text-xs font-medium"
                style={{ backgroundColor: secondaryColor }}
              >
                Secondary
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div>
          <button
            type="submit"
            disabled={updateBranding.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {updateBranding.isPending ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------------
// Billing & Subscription section
// ------------------------------------------------------------------

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
};

function BillingSection({ workspaceSlug }: { workspaceSlug: string }) {
  const { data: subscriptions, isLoading: subsLoading } = useSubscriptions(workspaceSlug);
  const { data: invoices, isLoading: invoicesLoading } = useBillingHistory(workspaceSlug);
  const { data: paymentMethod } = usePaymentMethod(workspaceSlug);
  const { data: usage } = useUsageSummary(workspaceSlug);
  const cancelSub = useCancelSubscription();

  const activeSubscriptions = subscriptions?.filter((s) => s.status === 'active' || s.status === 'trialing') ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Billing & Subscription</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your plan, payment method, and view billing history.
        </p>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Usage Summary stat cards                                    */}
      {/* ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-sm p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Package className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active Modules</p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {usage?.activeModules ?? 0}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-sm p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Zap className="h-4.5 w-4.5 text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">API Calls This Month</p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {(usage?.apiCallsThisMonth ?? 0).toLocaleString('en-ZA')}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                / {(usage?.apiCallsLimit ?? 10_000).toLocaleString('en-ZA')}
              </span>
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-sm p-4 flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <HardDrive className="h-4.5 w-4.5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Storage Used</p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {((usage?.storageUsedMb ?? 0) / 1024).toFixed(1)} GB
              <span className="text-xs font-normal text-muted-foreground ml-1">
                / {((usage?.storageLimitMb ?? 5120) / 1024).toFixed(0)} GB
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Current Plan                                                */}
      {/* ---------------------------------------------------------- */}
      <div className="rounded-3xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Current Plan</h3>
        </div>

        {subsLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : activeSubscriptions.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No active subscriptions</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Visit the Marketplace to subscribe to module packs.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {activeSubscriptions.map((sub: Subscription) => (
              <div key={sub.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{sub.packName}</p>
                    <Badge
                      className={cn(
                        'rounded-full text-[10px]',
                        sub.status === 'active' && 'bg-emerald-100 text-emerald-700 border-emerald-200',
                        sub.status === 'trialing' && 'bg-blue-100 text-blue-700 border-blue-200',
                        sub.status === 'past_due' && 'bg-amber-100 text-amber-700 border-amber-200',
                        sub.status === 'cancelled' && 'bg-muted text-muted-foreground border-border',
                      )}
                      variant="outline"
                    >
                      {sub.status === 'active' ? 'Active' : sub.status === 'trialing' ? 'Trial' : sub.status === 'past_due' ? 'Past Due' : 'Cancelled'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3 w-3" />
                      {formatZAR(sub.priceMonthly)}/{sub.billingCycle === 'annual' ? 'yr' : 'mo'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Next billing: {formatDate(sub.currentPeriodEnd)}
                    </span>
                    <span className="capitalize">{sub.gateway}</span>
                  </div>
                  {sub.cancelAtPeriodEnd && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Cancels on {formatDate(sub.currentPeriodEnd)}
                    </p>
                  )}
                </div>
                {!sub.cancelAtPeriodEnd && (
                  <button
                    type="button"
                    onClick={() => cancelSub.mutate({ workspaceSlug, subscriptionId: sub.id })}
                    disabled={cancelSub.isPending}
                    className="shrink-0 px-3 py-1.5 rounded-2xl border border-border text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
                  >
                    {cancelSub.isPending ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Payment Method                                              */}
      {/* ---------------------------------------------------------- */}
      <div className="rounded-3xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Payment Method</h3>
        </div>

        <div className="px-5 py-4">
          {paymentMethod ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {paymentMethod.type === 'card'
                      ? `${paymentMethod.brand ?? 'Card'} ending in ${paymentMethod.last4 ?? '****'}`
                      : paymentMethod.type === 'eft'
                        ? `EFT${paymentMethod.bankName ? ` - ${paymentMethod.bankName}` : ''}`
                        : 'PayFast'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {paymentMethod.type === 'card' && paymentMethod.expiryMonth && paymentMethod.expiryYear
                      ? `Expires ${String(paymentMethod.expiryMonth).padStart(2, '0')}/${paymentMethod.expiryYear}`
                      : `Via ${paymentMethod.gateway.charAt(0).toUpperCase() + paymentMethod.gateway.slice(1)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1.5 rounded-2xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                Update
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <CreditCard className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No payment method on file</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                A payment method will be added when you subscribe to a pack.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- */}
      {/* Billing History                                             */}
      {/* ---------------------------------------------------------- */}
      <div className="rounded-3xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Billing History</h3>
        </div>

        {invoicesLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Receipt className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No invoices yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Invoices will appear here after your first payment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" aria-label="Billing history">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground">Amount</th>
                  <th className="text-center px-5 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {invoices.map((invoice: Invoice, idx: number) => (
                  <tr
                    key={invoice.id}
                    className={cn(
                      'transition-colors hover:bg-muted/20',
                      idx % 2 === 1 && 'bg-muted/10',
                    )}
                  >
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(invoice.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-xs text-foreground font-medium">
                      {invoice.description}
                    </td>
                    <td className="px-5 py-3 text-xs text-foreground font-semibold text-right whitespace-nowrap">
                      {formatZAR(invoice.amountInclVat)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize',
                          INVOICE_STATUS_STYLES[invoice.status],
                        )}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {invoice.downloadUrl && (
                        <a
                          href={invoice.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                          aria-label={`Download invoice from ${formatDate(invoice.createdAt)}`}
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
