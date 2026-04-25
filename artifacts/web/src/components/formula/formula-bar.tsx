import { useRef, useCallback, useEffect, useState } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { Play, Sparkles, Check, X, Loader2 } from 'lucide-react';
import { useSuggestFormula, type FormulaResult } from '@/lib/hooks/use-ai';
import { cn } from '@/lib/utils';

const formulaFunctions = [
  'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'ROUND', 'SQRT', 'POWER', 'ABS',
  'CEILING', 'FLOOR', 'MOD', 'LOG', 'LN', 'EXP',
  'LEFT', 'RIGHT', 'MID', 'LEN', 'UPPER', 'LOWER', 'TRIM', 'CONCAT',
  'COALESCE', 'IF',
];

function formulaCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[A-Za-z_]\w*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: formulaFunctions.map((fn) => ({
      label: fn,
      type: 'function',
      apply: `${fn}(`,
    })),
  };
}

const formulaHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#7c3aed' },
  { tag: tags.number, color: '#059669' },
  { tag: tags.string, color: '#d97706' },
  { tag: tags.operator, color: '#dc2626' },
  { tag: tags.function(tags.variableName), color: '#2563eb' },
]);

interface FormulaBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPending?: boolean;
  /** Workspace slug for AI formula suggestions */
  workspaceSlug?: string;
  /** App slug for AI formula suggestions */
  appSlug?: string;
  /** Block name for AI formula context */
  blockName?: string;
}

export function FormulaBar({
  value,
  onChange,
  onSubmit,
  isPending,
  workspaceSlug,
  appSlug,
  blockName,
}: FormulaBarProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  // -- AI suggestion state --
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestion, setSuggestion] = useState<FormulaResult | null>(null);
  const suggestFormula = useSuggestFormula();
  const popoverRef = useRef<HTMLDivElement>(null);

  const aiEnabled = Boolean(workspaceSlug && appSlug && blockName);

  // Close the suggestion popover when clicking outside
  useEffect(() => {
    if (!showSuggestion) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSuggestion(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSuggestion]);

  const handleAiSuggest = useCallback(() => {
    if (!workspaceSlug || !appSlug || !blockName) return;

    // Build a description from the current formula context
    const description = value.trim()
      ? `Improve or fix this formula: ${value}`
      : `Suggest a formula for the block "${blockName}"`;

    suggestFormula.mutate(
      {
        workspaceSlug,
        appSlug,
        blockName,
        description,
      },
      {
        onSuccess: (response) => {
          if (response.data) {
            setSuggestion(response.data);
            setShowSuggestion(true);
          }
        },
      },
    );
  }, [workspaceSlug, appSlug, blockName, value, suggestFormula]);

  const handleApplySuggestion = useCallback(() => {
    if (!suggestion) return;
    onChange(suggestion.formula);
    // Also update the CodeMirror editor view directly
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: suggestion.formula },
      });
    }
    setShowSuggestion(false);
    setSuggestion(null);
  }, [suggestion, onChange]);

  const handleDismissSuggestion = useCallback(() => {
    setShowSuggestion(false);
    setSuggestion(null);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        keymap.of([
          ...defaultKeymap,
          {
            key: 'Enter',
            run: () => {
              onSubmit();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
          if (update.focusChanged) {
            setIsFocused(update.view.hasFocus);
          }
        }),
        cmPlaceholder('Enter formula... e.g. SUM(Revenue) * 1.1'),
        autocompletion({ override: [formulaCompletions] }),
        syntaxHighlighting(formulaHighlight),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            fontFamily: 'JetBrains Mono, SF Mono, Consolas, monospace',
          },
          '.cm-content': {
            padding: '6px 0',
          },
          '.cm-focused': {
            outline: 'none',
          },
          '.cm-line': {
            padding: '0 8px',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 border rounded-md transition-colors ${
        isFocused ? 'border-primary ring-1 ring-ring' : 'border-input'
      } bg-background`}>
        <span className="pl-3 text-xs font-semibold text-muted-foreground select-none">fx</span>
        <div ref={editorRef} className="flex-1 min-h-[32px]" />

        {/* AI Suggest button */}
        {aiEnabled && (
          <button
            onClick={handleAiSuggest}
            disabled={suggestFormula.isPending}
            className={cn(
              'p-1.5 rounded transition-colors',
              'text-violet-500 hover:bg-violet-50 hover:text-violet-600',
              'dark:hover:bg-violet-500/10',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            title="AI formula suggestion"
            aria-label="Get AI formula suggestion"
          >
            {suggestFormula.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
          </button>
        )}

        <button
          onClick={onSubmit}
          disabled={isPending}
          className="mr-1 p-1.5 rounded hover:bg-muted transition-colors text-primary disabled:opacity-50"
          title="Run formula (Enter)"
        >
          <Play className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* AI Suggestion popover */}
      {showSuggestion && suggestion && (
        <div
          ref={popoverRef}
          className={cn(
            'absolute left-0 right-0 top-full mt-1.5 z-50',
            'rounded-2xl border border-border/50 bg-card/70 backdrop-blur-xl shadow-win',
            'p-3',
          )}
          role="dialog"
          aria-label="AI formula suggestion"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
                AI Suggestion
              </span>
            </div>
            <button
              onClick={handleDismissSuggestion}
              className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Dismiss suggestion"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Suggested formula */}
          <div className="rounded-lg bg-muted/50 border border-border/30 px-3 py-2 mb-2">
            <code className="text-xs font-mono text-foreground break-all">
              {suggestion.formula}
            </code>
          </div>

          {/* Explanation */}
          {suggestion.explanation && (
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {suggestion.explanation}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApplySuggestion}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                'rounded-lg bg-violet-600 text-white hover:bg-violet-700',
                'transition-colors',
              )}
            >
              <Check className="h-3 w-3" />
              Apply
            </button>
            <button
              onClick={handleDismissSuggestion}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                'rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted',
                'transition-colors',
              )}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
