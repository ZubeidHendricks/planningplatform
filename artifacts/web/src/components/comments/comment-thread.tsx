import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Reply, Check, Trash2, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  type Comment,
} from '@/lib/hooks/use-comments';
import { useAuthStore } from '@/stores/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentThreadProps {
  workspaceSlug: string;
  appSlug: string;
  targetType: 'block' | 'board' | 'cell';
  targetId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Single Comment
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  onReply: (commentId: string) => void;
  onResolve: (commentId: string, isResolved: number) => void;
  onDelete: (commentId: string) => void;
  currentUserId: string;
}

function CommentItem({
  comment,
  isReply = false,
  onReply,
  onResolve,
  onDelete,
  currentUserId,
}: CommentItemProps) {
  return (
    <div
      className={cn(
        'group flex gap-3 py-3',
        isReply && 'ml-10 border-l-2 border-border pl-4',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
          'bg-primary/10 text-primary',
        )}
      >
        {getInitials(comment.author.firstName, comment.author.lastName)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {comment.author.firstName} {comment.author.lastName}
          </span>
          <span className="text-xs text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </span>
          {comment.isResolved === 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Check className="h-3 w-3" />
              Resolved
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap break-words">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="mt-1.5 flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
          {!isReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
          )}
          {!isReply && (
            <button
              type="button"
              onClick={() =>
                onResolve(comment.id, comment.isResolved === 1 ? 0 : 1)
              }
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3 w-3" />
              {comment.isResolved === 1 ? 'Unresolve' : 'Resolve'}
            </button>
          )}
          {comment.userId === currentUserId && (
            <button
              type="button"
              onClick={() => onDelete(comment.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment Form
// ---------------------------------------------------------------------------

interface CommentFormProps {
  onSubmit: (body: string) => void;
  isPending: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

function CommentForm({
  onSubmit,
  isPending,
  placeholder = 'Write a comment...',
  autoFocus = false,
  onCancel,
}: CommentFormProps) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setBody('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        className={cn(
          'w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          'disabled:opacity-50',
        )}
        disabled={isPending}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Ctrl+Enter to submit
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!body.trim() || isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <Send className="h-3 w-3" />
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CommentThread({
  workspaceSlug,
  appSlug,
  targetType,
  targetId,
}: CommentThreadProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const userId = useAuthStore((s) => s.user?.id) ?? '';

  const { data: allComments = [], isLoading } = useComments(
    workspaceSlug,
    appSlug,
    targetType,
    targetId,
  );
  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  // Organize into root comments and replies
  const { rootComments, repliesByParent } = useMemo(() => {
    const roots: Comment[] = [];
    const replies: Record<string, Comment[]> = {};

    for (const comment of allComments) {
      if (!comment.parentCommentId) {
        roots.push(comment);
      } else {
        const parentId = comment.parentCommentId;
        if (!replies[parentId]) {
          replies[parentId] = [];
        }
        replies[parentId].push(comment);
      }
    }

    return { rootComments: roots, repliesByParent: replies };
  }, [allComments]);

  const handleCreate = (body: string, parentCommentId?: string) => {
    createComment.mutate({
      workspaceSlug,
      appSlug,
      targetType,
      targetId,
      parentCommentId,
      body,
    });
    setReplyingTo(null);
  };

  const handleResolve = (commentId: string, isResolved: number) => {
    updateComment.mutate({
      workspaceSlug,
      appSlug,
      commentId,
      isResolved,
    });
  };

  const handleDelete = (commentId: string) => {
    deleteComment.mutate({
      workspaceSlug,
      appSlug,
      commentId,
      targetType,
      targetId,
    });
  };

  return (
    <div className="border-t border-border bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
      >
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span>Comments</span>
        {allComments.length > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">
            {allComments.length}
          </span>
        )}
        <div className="flex-1" />
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && allComments.length === 0 && (
            <div className="py-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                No comments yet. Start a conversation.
              </p>
            </div>
          )}

          {/* Comment list */}
          {!isLoading && rootComments.length > 0 && (
            <div className="divide-y divide-border">
              {rootComments.map((comment) => (
                <div key={comment.id}>
                  <CommentItem
                    comment={comment}
                    onReply={setReplyingTo}
                    onResolve={handleResolve}
                    onDelete={handleDelete}
                    currentUserId={userId}
                  />

                  {/* Replies */}
                  {repliesByParent[comment.id]?.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      isReply
                      onReply={setReplyingTo}
                      onResolve={handleResolve}
                      onDelete={handleDelete}
                      currentUserId={userId}
                    />
                  ))}

                  {/* Reply form */}
                  {replyingTo === comment.id && (
                    <div className="ml-10 border-l-2 border-border pl-4 pb-2">
                      <CommentForm
                        onSubmit={(body) => handleCreate(body, comment.id)}
                        isPending={createComment.isPending}
                        placeholder="Write a reply..."
                        autoFocus
                        onCancel={() => setReplyingTo(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New comment form */}
          <div className="mt-4">
            <CommentForm
              onSubmit={(body) => handleCreate(body)}
              isPending={createComment.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
}
