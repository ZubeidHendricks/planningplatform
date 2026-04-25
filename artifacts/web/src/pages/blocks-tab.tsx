import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useBlocks, useCreateBlock, useDeleteBlock } from '@/lib/hooks/use-blocks';
import { useAuthStore } from '@/stores/auth';
import {
  getBlockType,
  BLOCK_TYPES,
  BLOCK_TYPE_KEYS,
  supportsFormula,
  type BlockType,
} from '@/lib/block-types';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Calculator, Check } from 'lucide-react';

export function BlocksTab() {
  const { workspaceSlug, appSlug } = useParams();
  const slug = workspaceSlug ?? useAuthStore.getState().workspaceSlug ?? '';
  const { data: blocks, isLoading } = useBlocks(slug, appSlug ?? '');
  const createBlock = useCreateBlock();
  const deleteBlock = useDeleteBlock();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [blockSlug, setBlockSlug] = useState('');
  const [blockType, setBlockType] = useState<BlockType>('metric');
  const [formula, setFormula] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBlock.mutateAsync({
      workspaceSlug: slug,
      appSlug: appSlug ?? '',
      name,
      slug: blockSlug,
      blockType,
      formula: formula || undefined,
      description: description || undefined,
    });
    setShowCreate(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setBlockSlug('');
    setBlockType('metric');
    setFormula('');
    setDescription('');
  };

  const autoSlug = (val: string) => {
    setName(val);
    setBlockSlug(
      val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const selectedTypeConfig = BLOCK_TYPES[blockType];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Blocks</h2>
          <p className="text-sm text-muted-foreground">
            Metrics, dimensions, transactions, and tables
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
        >
          <Plus className="h-3.5 w-3.5" /> Add Block
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 bg-muted/30 border border-border rounded-lg p-5">
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Block Type Selector - visual cards */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Block Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {BLOCK_TYPE_KEYS.map((typeKey) => {
                  const config = BLOCK_TYPES[typeKey];
                  const Icon = config.icon;
                  const isSelected = blockType === typeKey;
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => setBlockType(typeKey)}
                      className={cn(
                        'relative flex flex-col items-start gap-2 p-3 rounded-lg border-2 text-left transition-all',
                        isSelected
                          ? cn(config.borderColor, config.bgLight)
                          : 'border-border hover:border-muted-foreground/30 bg-background',
                      )}
                    >
                      {isSelected && (
                        <div
                          className={cn(
                            'absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center',
                            config.bgColor,
                          )}
                        >
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      <Icon className={cn('h-5 w-5', config.color)} />
                      <div>
                        <p
                          className={cn(
                            'text-sm font-semibold',
                            isSelected ? config.color : 'text-foreground',
                          )}
                        >
                          {config.label}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                          {config.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => autoSlug(e.target.value)}
                  placeholder="Revenue"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug</label>
                <input
                  value={blockSlug}
                  onChange={(e) => setBlockSlug(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                  pattern="^[a-z0-9-]+$"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description{' '}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Describe this ${selectedTypeConfig.label.toLowerCase()}...`}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Formula - only for metric and table */}
            {supportsFormula(blockType) && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Formula{' '}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="e.g. Price * Quantity"
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={createBlock.isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50',
                  selectedTypeConfig.bgColor,
                  'hover:opacity-90',
                )}
              >
                {createBlock.isPending ? (
                  'Creating...'
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    Create {selectedTypeConfig.label}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="px-3 py-2 border border-border rounded-md text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Block List */}
      {blocks?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calculator className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No blocks yet</p>
          <p className="text-sm mt-1">
            Add your first block to start building.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {blocks?.map((block) => {
            const config = getBlockType(block.blockType);
            const Icon = config.icon;
            return (
              <div
                key={block.id}
                className={cn(
                  'flex items-center justify-between pl-0 pr-4 py-0 hover:bg-muted/50 transition-colors group',
                  'border-l-2',
                  config.borderColor,
                )}
              >
                <Link
                  to={`/${slug}/apps/${appSlug}/blocks/${block.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0 py-3 pl-4"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-md shrink-0',
                      config.bgLight,
                    )}
                  >
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">
                      {block.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                          config.bgLight,
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                      {block.formula && (
                        <span className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                          {block.formula}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() =>
                    deleteBlock.mutate({
                      workspaceSlug: slug,
                      appSlug: appSlug ?? '',
                      blockId: block.id,
                    })
                  }
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
