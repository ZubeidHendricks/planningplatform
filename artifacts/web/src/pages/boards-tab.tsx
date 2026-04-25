import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useAuthStore } from '@/stores/auth';
import { useBoards, useCreateBoard, useDeleteBoard } from '@/lib/hooks/use-boards';
import { Plus, Trash2, LayoutDashboard, ArrowRight } from 'lucide-react';

export function BoardsTab() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: boards, isLoading } = useBoards(slug, appSlug ?? '');
  const createBoard = useCreateBoard();
  const deleteBoard = useDeleteBoard();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [boardSlug, setBoardSlug] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBoard.mutateAsync({ workspaceSlug: slug, appSlug: appSlug ?? '', name, slug: boardSlug, description: description || undefined });
    setShowCreate(false);
    setName('');
    setBoardSlug('');
    setDescription('');
  };

  const autoSlug = (val: string) => {
    setName(val);
    setBoardSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Boards</h2>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium">
          <Plus className="h-3.5 w-3.5" /> New Board
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-muted/50 border border-border rounded-lg p-5">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input value={name} onChange={(e) => autoSlug(e.target.value)} placeholder="Executive Dashboard" className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input value={boardSlug} onChange={(e) => setBoardSlug(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" required pattern="^[a-z0-9-]+$" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={createBoard.isPending} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-3 py-1.5 border border-border rounded-md text-sm hover:bg-muted">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {boards?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <LayoutDashboard className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No boards yet. Create a board to build dashboards.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {boards?.map((board) => (
            <div key={board.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors group">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{board.name}</h3>
                  {board.description && <p className="text-xs text-muted-foreground mt-1">{board.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">{Array.isArray(board.layout) ? board.layout.length : 0} widgets</p>
                </div>
                <button onClick={() => deleteBoard.mutate({ workspaceSlug: slug, appSlug: appSlug ?? '', boardSlug: board.slug })} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Link to={`/${slug}/apps/${appSlug}/boards/${board.slug}`} className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                Edit Board <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
