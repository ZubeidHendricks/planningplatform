import { useState } from 'react';
import { useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useDimensions, useCreateDimension, useDimensionMembers, useCreateDimensionMember } from '@/lib/hooks/use-dimensions';
import { Plus, Trash2, ChevronRight, ChevronDown, Layers } from 'lucide-react';

export function DimensionsTab() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: dimensions, isLoading } = useDimensions(slug, appSlug ?? '');
  const createDimension = useCreateDimension();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [dimSlug, setDimSlug] = useState('');
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createDimension.mutateAsync({ workspaceSlug: slug, appSlug: appSlug ?? '', name, slug: dimSlug });
    setShowCreate(false);
    setName('');
    setDimSlug('');
  };

  const autoSlug = (val: string) => {
    setName(val);
    setDimSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Dimensions</h2>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
          <Plus className="h-3.5 w-3.5" /> Add Dimension
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-muted/50 border border-border rounded-lg p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input value={name} onChange={(e) => autoSlug(e.target.value)} placeholder="Time Period" className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input value={dimSlug} onChange={(e) => setDimSlug(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required pattern="^[a-z0-9-]+$" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createDimension.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {dimensions?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No dimensions yet. Add dimensions to structure your data.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dimensions?.map((dim) => (
            <DimensionItem
              key={dim.id}
              dimension={dim}
              isExpanded={expandedDim === dim.id}
              onToggle={() => setExpandedDim(expandedDim === dim.id ? null : dim.id)}
              workspaceSlug={slug}
              appSlug={appSlug ?? ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DimensionItem({
  dimension,
  isExpanded,
  onToggle,
  workspaceSlug,
  appSlug,
}: {
  dimension: { id: string; name: string; slug: string; description?: string | null };
  isExpanded: boolean;
  onToggle: () => void;
  workspaceSlug: string;
  appSlug: string;
}) {
  const { data: members } = useDimensionMembers(workspaceSlug, appSlug, isExpanded ? dimension.id : '');
  const createMember = useCreateDimensionMember();
  const [newMemberName, setNewMemberName] = useState('');

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    await createMember.mutateAsync({ workspaceSlug, appSlug, dimensionId: dimension.id, name: newMemberName });
    setNewMemberName('');
  };

  return (
    <div className="border border-border rounded-lg">
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left">
        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <div>
          <p className="font-medium text-sm">{dimension.name}</p>
          <p className="text-xs text-muted-foreground">{dimension.slug}</p>
        </div>
        {Array.isArray(members) && <span className="ml-auto text-xs text-muted-foreground">{members.length} members</span>}
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 py-3">
          {(Array.isArray(members) ? members : []).map((member) => (
            <div key={member.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              <span>{member.name}</span>
              {member.code && <span className="text-xs text-muted-foreground">({member.code})</span>}
            </div>
          ))}

          <form onSubmit={handleAddMember} className="mt-3 flex gap-2">
            <input
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="Add member..."
              className="flex-1 px-2.5 py-1.5 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button type="submit" disabled={createMember.isPending} className="px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50">Add</button>
          </form>
        </div>
      )}
    </div>
  );
}
