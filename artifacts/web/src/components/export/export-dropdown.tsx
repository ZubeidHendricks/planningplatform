import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Presentation,
  FileDown,
} from 'lucide-react';

// ------------------------------------------------------------------
// Export Dropdown
// ------------------------------------------------------------------

interface ExportDropdownProps {
  workspaceSlug: string;
  appSlug: string;
  blockId: string;
  blockSlug: string;
}

type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'pptx';

const EXPORT_OPTIONS: Array<{
  format: ExportFormat;
  label: string;
  extension: string;
  icon: React.ElementType;
}> = [
  { format: 'xlsx', label: 'Excel (.xlsx)', extension: 'xlsx', icon: FileSpreadsheet },
  { format: 'pdf', label: 'PDF Report', extension: 'pdf', icon: FileText },
  { format: 'pptx', label: 'PowerPoint (.pptx)', extension: 'pptx', icon: Presentation },
  { format: 'csv', label: 'CSV', extension: 'csv', icon: FileDown },
];

export function ExportDropdown({
  workspaceSlug,
  appSlug,
  blockId,
  blockSlug,
}: ExportDropdownProps) {
  const handleExport = useCallback(
    async (format: ExportFormat, extension: string) => {
      const token = api.getToken();
      const basePath = `/api/${workspaceSlug}/apps/${appSlug}/blocks/${blockId}/export`;
      const url = format === 'csv' ? basePath : `${basePath}?format=${format}`;
      const filename = `${blockSlug}-export.${extension}`;

      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
          throw new Error(`Export failed (${res.status})`);
        }

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        useToastStore
          .getState()
          .addToast((err as Error).message ?? 'Export failed', 'error');
      }
    },
    [workspaceSlug, appSlug, blockId, blockSlug],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted transition-colors"
          aria-label="Export data"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {EXPORT_OPTIONS.map(({ format, label, extension, icon: Icon }) => (
          <DropdownMenuItem
            key={format}
            onClick={() => void handleExport(format, extension)}
            className="cursor-pointer"
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
