import { useState } from 'react';
import { useCreateView } from '@/lib/hooks/use-views';
import { Eye, Plus, Check } from 'lucide-react';

interface View {
  id: string;
  name: string;
  isDefault: number;
  pivotConfig: {
    rows: string[];
    columns: string[];
    pages: string[];
    filters: Record<string, string[]>;
  };
}

interface ViewSelectorProps {
  views: View[];
  activeViewId: string | null;
  onSelectView: (id: string | null) => void;
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
}

export function ViewSelector({ views, activeViewId, onSelectView, workspaceSlug, appSlug, blockId }: ViewSelectorProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const createView = useCreateView();

  const handleCreate = async () => {
    if (!newViewName.trim()) return;
    const result = await createView.mutateAsync({
      workspaceSlug,
      appSlug,
      blockId,
      name: newViewName,
      pivotConfig: { rows: [], columns: [], pages: [], filters: {} },
    });
    setShowCreate(false);
    setNewViewName('');
    if (result?.data?.id) onSelectView(result.data.id);
  };

  return (
    <div className="relative flex items-center gap-1">
      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
        <button
          onClick={() => onSelectView(null)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            activeViewId === null ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Default
        </button>
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => onSelectView(view.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              activeViewId === view.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {view.name}
          </button>
        ))}
      </div>

      {showCreate ? (
        <div className="flex items-center gap-1">
          <input
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="View name"
            className="px-2 py-1 border border-input rounded text-xs bg-background w-28 focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button onClick={handleCreate} className="p-1 rounded hover:bg-muted text-primary"><Check className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)} className="p-1 rounded hover:bg-muted text-muted-foreground"><Plus className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}
