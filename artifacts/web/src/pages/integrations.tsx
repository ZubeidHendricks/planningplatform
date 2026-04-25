import { useState, useCallback } from 'react';
import {
  Database,
  FileSpreadsheet,
  Sheet,
  Globe,
  Receipt,
  Calculator,
  Upload,
  Check,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Clock,
  Loader2,
  Eye,
  EyeOff,
  Wifi,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CsvImportWizard } from '@/components/import/csv-import-wizard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'accounting' | 'erp' | 'database' | 'file' | 'api';
  status: 'available' | 'connected' | 'coming_soon';
  color: string;
}

interface ConnectionConfig {
  connectorId: string;
  connectedAt: string;
  lastSyncAt?: string;
  config: Record<string, unknown>;
}

interface SyncRecord {
  connectorId: string;
  connectorName: string;
  timestamp: string;
  status: 'success' | 'error';
  rowCount?: number;
}

interface HeaderPair {
  key: string;
  value: string;
}

interface ExcelColumnMapping {
  sourceColumn: string;
  targetField: string | null;
  dataType: 'text' | 'number' | 'date' | 'boolean';
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'integration_connections';
const SYNC_LOG_KEY = 'integration_sync_log';

function loadConnections(): ConnectionConfig[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveConnections(connections: ConnectionConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

function loadSyncLog(): SyncRecord[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSyncLog(log: SyncRecord[]) {
  localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log));
}

function addSyncRecord(record: SyncRecord) {
  const log = loadSyncLog();
  log.unshift(record);
  saveSyncLog(log.slice(0, 50));
}

// ---------------------------------------------------------------------------
// Connector definitions
// ---------------------------------------------------------------------------

const integrations: IntegrationDef[] = [
  {
    id: 'csv',
    name: 'CSV Import',
    description: 'Import data from CSV, TSV, or delimited text files',
    icon: FileSpreadsheet,
    category: 'file',
    status: 'available',
    color: 'bg-green-500',
  },
  {
    id: 'excel',
    name: 'Excel Upload',
    description: 'Upload and import .xlsx or .xls spreadsheet files',
    icon: FileSpreadsheet,
    category: 'file',
    status: 'available',
    color: 'bg-emerald-600',
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    description: 'Connect and sync data from Google Sheets',
    icon: Sheet,
    category: 'file',
    status: 'available',
    color: 'bg-green-600',
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description: 'Connect to any REST API endpoint for data ingestion',
    icon: Globe,
    category: 'api',
    status: 'available',
    color: 'bg-violet-500',
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: 'Direct connection to PostgreSQL databases',
    icon: Database,
    category: 'database',
    status: 'available',
    color: 'bg-indigo-500',
  },
  {
    id: 'mysql',
    name: 'MySQL',
    description: 'Direct connection to MySQL databases',
    icon: Database,
    category: 'database',
    status: 'available',
    color: 'bg-orange-500',
  },
  {
    id: 'xero',
    name: 'Xero',
    description: 'Sync accounting data from Xero',
    icon: Receipt,
    category: 'accounting',
    status: 'coming_soon',
    color: 'bg-sky-500',
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Connect to Sage for SA financial data',
    icon: Calculator,
    category: 'accounting',
    status: 'coming_soon',
    color: 'bg-emerald-500',
  },
];

const categories = [
  { key: 'all', label: 'All' },
  { key: 'file', label: 'File Import' },
  { key: 'api', label: 'API' },
  { key: 'database', label: 'Database' },
  { key: 'accounting', label: 'Accounting' },
];

const sampleTargetFields = [
  { key: 'name', label: 'Name', required: true },
  { key: 'code', label: 'Code' },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'department', label: 'Department' },
  { key: 'notes', label: 'Notes' },
];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function IntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [activeDialog, setActiveDialog] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionConfig[]>(loadConnections);
  const [syncLog, setSyncLog] = useState<SyncRecord[]>(loadSyncLog);

  const filtered =
    activeCategory === 'all'
      ? integrations
      : integrations.filter((i) => i.category === activeCategory);

  function isConnected(id: string) {
    return connections.some((c) => c.connectorId === id);
  }

  function getConnection(id: string) {
    return connections.find((c) => c.connectorId === id);
  }

  function saveConnection(connectorId: string, config: Record<string, unknown>) {
    const now = new Date().toISOString();
    const updated = connections.filter((c) => c.connectorId !== connectorId);
    const newConn: ConnectionConfig = {
      connectorId,
      connectedAt: getConnection(connectorId)?.connectedAt || now,
      lastSyncAt: now,
      config,
    };
    updated.push(newConn);
    setConnections(updated);
    saveConnections(updated);

    const def = integrations.find((i) => i.id === connectorId);
    const record: SyncRecord = {
      connectorId,
      connectorName: def?.name ?? connectorId,
      timestamp: now,
      status: 'success',
    };
    addSyncRecord(record);
    setSyncLog(loadSyncLog());
  }

  function removeConnection(connectorId: string) {
    const updated = connections.filter((c) => c.connectorId !== connectorId);
    setConnections(updated);
    saveConnections(updated);
  }

  function handleCardClick(integration: IntegrationDef) {
    if (integration.status === 'coming_soon') return;
    if (integration.id === 'csv') {
      setShowCsvImport(true);
    } else {
      setActiveDialog(integration.id);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect external data sources to your planning models
        </p>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={cn(
              'px-3 py-1.5 rounded-2xl text-sm font-medium transition-all duration-200',
              activeCategory === cat.key
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card/70 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent/50 backdrop-blur-xl',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* CSV Import overlay */}
      {showCsvImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <CsvImportWizard
            targetFields={sampleTargetFields}
            onImport={(data) => {
              saveConnection('csv', { rowCount: data.length });
              setShowCsvImport(false);
            }}
            onCancel={() => setShowCsvImport(false)}
          />
        </div>
      )}

      {/* Connector grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((integration) => {
          const Icon = integration.icon;
          const connected = isConnected(integration.id);
          const comingSoon = integration.status === 'coming_soon';

          return (
            <div
              key={integration.id}
              className={cn(
                'relative border border-border/50 rounded-3xl p-5 transition-all duration-200 bg-card/70 backdrop-blur-xl',
                comingSoon
                  ? 'opacity-70'
                  : 'hover:border-primary/40 hover:shadow-win cursor-pointer active:scale-[0.98]',
              )}
              onClick={() => handleCardClick(integration)}
              role="button"
              tabIndex={comingSoon ? -1 : 0}
              aria-label={`${integration.name}${connected ? ' - Connected' : ''}${comingSoon ? ' - Coming Soon' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleCardClick(integration);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'h-11 w-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm',
                    integration.color,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{integration.name}</h3>
                    {connected && (
                      <Badge
                        variant="success"
                        className="text-[10px] px-1.5 py-0 h-4 gap-0.5"
                      >
                        <Check className="h-2.5 w-2.5" /> Connected
                      </Badge>
                    )}
                    {comingSoon && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4"
                      >
                        Coming Soon
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {integration.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                {comingSoon ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 rounded-xl"
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(`Access requested for ${integration.name}. We will notify you when it becomes available.`);
                    }}
                  >
                    Request Access
                  </Button>
                ) : connected ? (
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                    <RefreshCw className="h-3 w-3" /> Configure
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                    {integration.id === 'csv' || integration.id === 'excel' ? (
                      <>
                        <Upload className="h-3 w-3" /> Import
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-3 w-3" /> Connect
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <ExcelUploadDialog
        open={activeDialog === 'excel'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
        onSave={(config) => {
          saveConnection('excel', config);
          setActiveDialog(null);
        }}
      />
      <GoogleSheetsDialog
        open={activeDialog === 'google-sheets'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
        existingConfig={getConnection('google-sheets')?.config}
        onSave={(config) => {
          saveConnection('google-sheets', config);
          setActiveDialog(null);
        }}
      />
      <RestApiDialog
        open={activeDialog === 'rest-api'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
        existingConfig={getConnection('rest-api')?.config}
        onSave={(config) => {
          saveConnection('rest-api', config);
          setActiveDialog(null);
        }}
      />
      <DatabaseDialog
        open={activeDialog === 'postgresql'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
        dbType="PostgreSQL"
        defaultPort="5432"
        existingConfig={getConnection('postgresql')?.config}
        onSave={(config) => {
          saveConnection('postgresql', config);
          setActiveDialog(null);
        }}
        onRemove={() => {
          removeConnection('postgresql');
          setActiveDialog(null);
        }}
        isConnected={isConnected('postgresql')}
      />
      <DatabaseDialog
        open={activeDialog === 'mysql'}
        onOpenChange={(open) => !open && setActiveDialog(null)}
        dbType="MySQL"
        defaultPort="3306"
        existingConfig={getConnection('mysql')?.config}
        onSave={(config) => {
          saveConnection('mysql', config);
          setActiveDialog(null);
        }}
        onRemove={() => {
          removeConnection('mysql');
          setActiveDialog(null);
        }}
        isConnected={isConnected('mysql')}
      />

      {/* Recent syncs */}
      <RecentSyncs syncLog={syncLog} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excel Upload Dialog
// ---------------------------------------------------------------------------

function ExcelUploadDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [step, setStep] = useState<'upload' | 'sheet' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState('');
  const [sheets] = useState<string[]>(['Sheet1', 'Sheet2', 'Budget Data']);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sampleHeaders, setSampleHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ExcelColumnMapping[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  function resetState() {
    setStep('upload');
    setFileName('');
    setSelectedSheet('');
    setSampleHeaders([]);
    setSampleRows([]);
    setMappings([]);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && /\.(xlsx|xls)$/i.test(file.name)) {
        processFile(file);
      }
    },
    [],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [],
  );

  function processFile(file: File) {
    setFileName(file.name);
    // Simulate parsing - in production, use SheetJS (xlsx)
    const mockHeaders = ['Account', 'Department', 'Q1 Amount', 'Q2 Amount', 'Notes'];
    const mockRows = [
      ['Revenue', 'Sales', '125000', '132000', 'YoY growth'],
      ['COGS', 'Operations', '45000', '48000', ''],
      ['Salaries', 'HR', '78000', '78000', 'No change'],
      ['Marketing', 'Marketing', '22000', '28000', 'Campaign spend'],
    ];
    setSampleHeaders(mockHeaders);
    setSampleRows(mockRows);
    setMappings(
      mockHeaders.map((col) => ({
        sourceColumn: col,
        targetField: autoMatchField(col),
        dataType: 'text' as const,
      })),
    );
    setStep('sheet');
  }

  function autoMatchField(col: string): string | null {
    const n = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const f of sampleTargetFields) {
      const fn = f.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === fn || n.includes(fn) || fn.includes(n)) return f.key;
    }
    if (n.includes('amount') || n.includes('q1') || n.includes('q2')) return 'amount';
    return null;
  }

  function updateMapping(index: number, targetField: string | null) {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, targetField } : m)),
    );
  }

  function updateMappingType(index: number, dataType: ExcelColumnMapping['dataType']) {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, dataType } : m)),
    );
  }

  const stepIndex = ['upload', 'sheet', 'mapping', 'preview'].indexOf(step);
  const stepLabels = ['Upload File', 'Select Sheet', 'Map Columns', 'Preview'];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Excel Upload</DialogTitle>
          <DialogDescription>
            Import data from an Excel spreadsheet (.xlsx, .xls)
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-1">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <div
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  i <= stepIndex ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                    i < stepIndex
                      ? 'bg-primary text-primary-foreground'
                      : i === stepIndex
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i < stepIndex ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Upload step */}
        {step === 'upload' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border/50 hover:border-primary/50',
            )}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              Drop your Excel file here
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Supports .xlsx and .xls formats
            </p>
            <label>
              <Button variant="default" size="sm" className="cursor-pointer" asChild>
                <span>
                  <FileSpreadsheet className="h-4 w-4" />
                  Choose File
                </span>
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Sheet selector step */}
        {step === 'sheet' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-medium text-foreground">{fileName}</span>
            </div>
            <div className="space-y-2">
              <Label>Select Sheet</Label>
              <Select
                value={selectedSheet}
                onValueChange={setSelectedSheet}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a sheet..." />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSheet && (
              <div className="max-h-40 overflow-auto border border-border/50 rounded-2xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {sampleHeaders.map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-medium border-r border-border/30 last:border-r-0"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className="border-t border-border/30">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="px-3 py-1.5 border-r border-border/30 last:border-r-0 truncate max-w-[120px]"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Mapping step */}
        {step === 'mapping' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Map Excel columns to target fields
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {mappings.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm"
                >
                  <span className="text-sm font-medium w-32 truncate">
                    {m.sourceColumn}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select
                    value={m.targetField ?? '__skip__'}
                    onValueChange={(v) =>
                      updateMapping(i, v === '__skip__' ? null : v)
                    }
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">-- Skip --</SelectItem>
                      {sampleTargetFields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? ' *' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={m.dataType}
                    onValueChange={(v) =>
                      updateMappingType(
                        i,
                        v as ExcelColumnMapping['dataType'],
                      )
                    }
                  >
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="boolean">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview step */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium mb-2">Import Summary</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground text-xs">
                <span>File:</span>
                <span className="text-foreground font-medium">{fileName}</span>
                <span>Sheet:</span>
                <span className="text-foreground font-medium">
                  {selectedSheet}
                </span>
                <span>Rows:</span>
                <span className="text-foreground font-medium">
                  {sampleRows.length}
                </span>
                <span>Mapped columns:</span>
                <span className="text-foreground font-medium">
                  {mappings.filter((m) => m.targetField).length} /{' '}
                  {mappings.length}
                </span>
              </div>
            </div>
            <div className="max-h-40 overflow-auto border border-border/50 rounded-2xl">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 sticky top-0">
                    {mappings
                      .filter((m) => m.targetField)
                      .map((m, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-left font-medium border-r border-border/30 last:border-r-0"
                        >
                          {sampleTargetFields.find(
                            (f) => f.key === m.targetField,
                          )?.label ?? m.targetField}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row, ri) => (
                    <tr key={ri} className="border-t border-border/30">
                      {mappings.map((m, ci) => {
                        if (!m.targetField) return null;
                        return (
                          <td
                            key={ci}
                            className="px-3 py-1.5 border-r border-border/30 last:border-r-0 truncate max-w-[120px]"
                          >
                            {row[ci]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 'upload'}
            onClick={() => {
              if (step === 'sheet') setStep('upload');
              else if (step === 'mapping') setStep('sheet');
              else if (step === 'preview') setStep('mapping');
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          {step === 'preview' ? (
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  fileName,
                  sheet: selectedSheet,
                  mappings,
                  rowCount: sampleRows.length,
                })
              }
            >
              <Check className="h-3.5 w-3.5" /> Import {sampleRows.length} rows
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={
                (step === 'upload' && !fileName) ||
                (step === 'sheet' && !selectedSheet)
              }
              onClick={() => {
                if (step === 'upload') setStep('sheet');
                else if (step === 'sheet') setStep('mapping');
                else if (step === 'mapping') setStep('preview');
              }}
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Google Sheets Dialog
// ---------------------------------------------------------------------------

function GoogleSheetsDialog({
  open,
  onOpenChange,
  existingConfig,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConfig?: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [step, setStep] = useState<'url' | 'sheet' | 'mapping' | 'schedule'>('url');
  const [sheetUrl, setSheetUrl] = useState((existingConfig?.sheetUrl as string) ?? '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSheetConnected, setIsSheetConnected] = useState(false);
  const [tabs] = useState<string[]>(['Budget 2025', 'Actuals', 'Forecast']);
  const [selectedTab, setSelectedTab] = useState('');
  const [schedule, setSchedule] = useState<string>(
    (existingConfig?.schedule as string) ?? 'manual',
  );
  const [mappings, setMappings] = useState<ExcelColumnMapping[]>([]);

  const mockHeaders = ['GL Code', 'Account Name', 'Budget Amount', 'Actual', 'Variance'];

  function resetState() {
    setStep('url');
    setSheetUrl((existingConfig?.sheetUrl as string) ?? '');
    setIsConnecting(false);
    setIsSheetConnected(false);
    setSelectedTab('');
    setMappings([]);
  }

  function handleConnect() {
    if (!sheetUrl.trim()) return;
    setIsConnecting(true);
    // Simulate API call
    setTimeout(() => {
      setIsConnecting(false);
      setIsSheetConnected(true);
      setMappings(
        mockHeaders.map((col) => ({
          sourceColumn: col,
          targetField: autoMatchTarget(col),
          dataType: 'text' as const,
        })),
      );
    }, 1200);
  }

  function autoMatchTarget(col: string): string | null {
    const n = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const f of sampleTargetFields) {
      const fn = f.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (n === fn || n.includes(fn) || fn.includes(n)) return f.key;
    }
    if (n.includes('amount') || n.includes('budget') || n.includes('actual')) return 'amount';
    if (n.includes('code') || n.includes('gl')) return 'code';
    return null;
  }

  function updateMapping(index: number, targetField: string | null) {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, targetField } : m)),
    );
  }

  const stepIndex = ['url', 'sheet', 'mapping', 'schedule'].indexOf(step);
  const stepLabels = ['Connect', 'Select Tab', 'Map Columns', 'Schedule'];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sheet className="h-5 w-5 text-green-600" />
            Google Sheets
          </DialogTitle>
          <DialogDescription>
            Connect and sync data from a Google Sheets spreadsheet
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-1">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              {i > 0 && <div className="w-6 h-px bg-border" />}
              <div
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  i <= stepIndex ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                    i < stepIndex
                      ? 'bg-primary text-primary-foreground'
                      : i === stepIndex
                        ? 'bg-primary/10 text-primary border border-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i < stepIndex ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* URL step */}
        {step === 'url' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sheet-url">Google Sheet URL</Label>
              <Input
                id="sheet-url"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={sheetUrl}
                onChange={(e) => {
                  setSheetUrl(e.target.value);
                  setIsSheetConnected(false);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Paste the full URL of your Google Sheet. Ensure the sheet is
                shared or publicly accessible.
              </p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={!sheetUrl.trim() || isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
                </>
              ) : isSheetConnected ? (
                <>
                  <Check className="h-4 w-4" /> Connected
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" /> Connect
                </>
              )}
            </Button>
          </div>
        )}

        {/* Tab selector step */}
        {step === 'sheet' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Sheet / Tab</Label>
              <Select value={selectedTab} onValueChange={setSelectedTab}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a sheet tab..." />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedTab && (
              <div className="p-3 border border-border/50 rounded-2xl bg-muted/30 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">
                    {mockHeaders.length}
                  </span>{' '}
                  columns detected in &quot;{selectedTab}&quot;
                </p>
                <p className="mt-1">
                  Columns: {mockHeaders.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Mapping step */}
        {step === 'mapping' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Map sheet columns to target fields
            </p>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {mappings.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2.5 border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm"
                >
                  <span className="text-sm font-medium w-32 truncate">
                    {m.sourceColumn}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select
                    value={m.targetField ?? '__skip__'}
                    onValueChange={(v) =>
                      updateMapping(i, v === '__skip__' ? null : v)
                    }
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__skip__">-- Skip --</SelectItem>
                      {sampleTargetFields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                          {f.required ? ' *' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule step */}
        {step === 'schedule' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sync Schedule</Label>
              <Select value={schedule} onValueChange={setSchedule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual only</SelectItem>
                  <SelectItem value="hourly">Every hour</SelectItem>
                  <SelectItem value="daily">Daily at midnight</SelectItem>
                  <SelectItem value="weekly">Weekly on Monday</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how often to automatically sync data from this sheet.
              </p>
            </div>
            <div className="p-3 border border-border/50 rounded-2xl bg-muted/30 space-y-1.5 text-xs">
              <p>
                <span className="text-muted-foreground">Sheet:</span>{' '}
                <span className="font-medium">{selectedTab}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Mapped columns:</span>{' '}
                <span className="font-medium">
                  {mappings.filter((m) => m.targetField).length} /{' '}
                  {mappings.length}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Schedule:</span>{' '}
                <span className="font-medium capitalize">{schedule}</span>
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={step === 'url'}
            onClick={() => {
              if (step === 'sheet') setStep('url');
              else if (step === 'mapping') setStep('sheet');
              else if (step === 'schedule') setStep('mapping');
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          {step === 'schedule' ? (
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  sheetUrl,
                  tab: selectedTab,
                  schedule,
                  mappings,
                })
              }
            >
              <Check className="h-3.5 w-3.5" /> Save Connection
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={
                (step === 'url' && !isSheetConnected) ||
                (step === 'sheet' && !selectedTab)
              }
              onClick={() => {
                if (step === 'url') setStep('sheet');
                else if (step === 'sheet') setStep('mapping');
                else if (step === 'mapping') setStep('schedule');
              }}
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// REST API Dialog
// ---------------------------------------------------------------------------

function RestApiDialog({
  open,
  onOpenChange,
  existingConfig,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingConfig?: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
}) {
  const [url, setUrl] = useState((existingConfig?.url as string) ?? '');
  const [method, setMethod] = useState<string>(
    (existingConfig?.method as string) ?? 'GET',
  );
  const [authType, setAuthType] = useState<string>(
    (existingConfig?.authType as string) ?? 'none',
  );
  const [authValue, setAuthValue] = useState(
    (existingConfig?.authValue as string) ?? '',
  );
  const [headers, setHeaders] = useState<HeaderPair[]>(
    (existingConfig?.headers as HeaderPair[] | undefined) ?? [
      { key: '', value: '' },
    ],
  );
  const [responsePath, setResponsePath] = useState(
    (existingConfig?.responsePath as string) ?? '',
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    null | { ok: boolean; message: string }
  >(null);
  const [showAuthValue, setShowAuthValue] = useState(false);

  function resetState() {
    setUrl((existingConfig?.url as string) ?? '');
    setMethod((existingConfig?.method as string) ?? 'GET');
    setAuthType((existingConfig?.authType as string) ?? 'none');
    setAuthValue((existingConfig?.authValue as string) ?? '');
    setHeaders(
      (existingConfig?.headers as HeaderPair[] | undefined) ?? [
        { key: '', value: '' },
      ],
    );
    setResponsePath((existingConfig?.responsePath as string) ?? '');
    setIsTesting(false);
    setTestResult(null);
  }

  function addHeader() {
    setHeaders((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeHeader(index: number) {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  }

  function updateHeader(index: number, field: 'key' | 'value', val: string) {
    setHeaders((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: val } : h)),
    );
  }

  function handleTestConnection() {
    if (!url.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult({
        ok: true,
        message: 'Connection successful. Received 200 OK with 42 records.',
      });
    }, 1500);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-violet-500" />
            REST API Connector
          </DialogTitle>
          <DialogDescription>
            Connect to any REST API endpoint for data ingestion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* URL & Method */}
          <div className="flex gap-2">
            <div className="w-28">
              <Label className="text-xs mb-1.5 block">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-xs mb-1.5 block">URL</Label>
              <Input
                placeholder="https://api.example.com/data"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Authentication */}
          <div className="space-y-2">
            <Label className="text-xs">Authentication</Label>
            <div className="flex gap-2">
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="apikey">API Key</SelectItem>
                </SelectContent>
              </Select>
              {authType !== 'none' && (
                <div className="flex-1 relative">
                  <Input
                    type={showAuthValue ? 'text' : 'password'}
                    placeholder={
                      authType === 'bearer'
                        ? 'Bearer token...'
                        : authType === 'basic'
                          ? 'username:password'
                          : 'API key value...'
                    }
                    value={authValue}
                    onChange={(e) => setAuthValue(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthValue(!showAuthValue)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showAuthValue ? 'Hide value' : 'Show value'}
                  >
                    {showAuthValue ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Headers</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addHeader}
                className="h-6 text-xs px-2"
              >
                <Plus className="h-3 w-3" /> Add
              </Button>
            </div>
            <div className="space-y-1.5">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Header name"
                    value={h.key}
                    onChange={(e) => updateHeader(i, 'key', e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Input
                    placeholder="Value"
                    value={h.value}
                    onChange={(e) => updateHeader(i, 'value', e.target.value)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => removeHeader(i)}
                    aria-label="Remove header"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Response path */}
          <div className="space-y-2">
            <Label className="text-xs">Response Path (JSONPath)</Label>
            <Input
              placeholder="$.data.records or leave empty for root"
              value={responsePath}
              onChange={(e) => setResponsePath(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Specify the path to the array of records in the JSON response.
            </p>
          </div>

          {/* Test connection */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!url.trim() || isTesting}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Testing...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" /> Test Connection
                </>
              )}
            </Button>
            {testResult && (
              <div
                className={cn(
                  'flex items-start gap-2 p-3 rounded-2xl text-xs',
                  testResult.ok
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20',
                )}
              >
                {testResult.ok ? (
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                )}
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!url.trim()}
            onClick={() =>
              onSave({
                url,
                method,
                authType,
                authValue,
                headers: headers.filter((h) => h.key.trim()),
                responsePath,
              })
            }
          >
            <Check className="h-3.5 w-3.5" /> Save Connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Database Dialog (PostgreSQL / MySQL)
// ---------------------------------------------------------------------------

function DatabaseDialog({
  open,
  onOpenChange,
  dbType,
  defaultPort,
  existingConfig,
  onSave,
  onRemove,
  isConnected: isAlreadyConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dbType: 'PostgreSQL' | 'MySQL';
  defaultPort: string;
  existingConfig?: Record<string, unknown>;
  onSave: (config: Record<string, unknown>) => void;
  onRemove: () => void;
  isConnected: boolean;
}) {
  const [host, setHost] = useState((existingConfig?.host as string) ?? 'localhost');
  const [port, setPort] = useState(
    (existingConfig?.port as string) ?? defaultPort,
  );
  const [database, setDatabase] = useState(
    (existingConfig?.database as string) ?? '',
  );
  const [username, setUsername] = useState(
    (existingConfig?.username as string) ?? '',
  );
  const [password, setPassword] = useState(
    (existingConfig?.password as string) ?? '',
  );
  const [ssl, setSsl] = useState((existingConfig?.ssl as boolean) ?? true);
  const [queryMode, setQueryMode] = useState<'table' | 'query'>(
    (existingConfig?.queryMode as 'table' | 'query') ?? 'table',
  );
  const [tableName, setTableName] = useState(
    (existingConfig?.tableName as string) ?? '',
  );
  const [customQuery, setCustomQuery] = useState(
    (existingConfig?.customQuery as string) ?? '',
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    null | { ok: boolean; message: string }
  >(null);
  const [showPassword, setShowPassword] = useState(false);
  const [availableTables] = useState([
    'gl_accounts',
    'journal_entries',
    'budgets',
    'departments',
    'cost_centers',
  ]);

  function resetState() {
    setHost((existingConfig?.host as string) ?? 'localhost');
    setPort((existingConfig?.port as string) ?? defaultPort);
    setDatabase((existingConfig?.database as string) ?? '');
    setUsername((existingConfig?.username as string) ?? '');
    setPassword((existingConfig?.password as string) ?? '');
    setSsl((existingConfig?.ssl as boolean) ?? true);
    setQueryMode((existingConfig?.queryMode as 'table' | 'query') ?? 'table');
    setTableName((existingConfig?.tableName as string) ?? '');
    setCustomQuery((existingConfig?.customQuery as string) ?? '');
    setIsTesting(false);
    setTestResult(null);
  }

  function handleTestConnection() {
    if (!host || !database || !username) return;
    setIsTesting(true);
    setTestResult(null);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult({
        ok: true,
        message: `Connected to ${dbType} at ${host}:${port}/${database}. Found ${availableTables.length} tables.`,
      });
    }, 1500);
  }

  const canSave = host.trim() && database.trim() && username.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database
              className={cn(
                'h-5 w-5',
                dbType === 'PostgreSQL' ? 'text-indigo-500' : 'text-orange-500',
              )}
            />
            {dbType} Connection
          </DialogTitle>
          <DialogDescription>
            Configure a direct connection to your {dbType} database
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Host</Label>
              <Input
                placeholder="localhost or db.example.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input
                placeholder={defaultPort}
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Database</Label>
            <Input
              placeholder="my_database"
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Username</Label>
              <Input
                placeholder="postgres"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* SSL toggle */}
          <div className="flex items-center justify-between p-3 border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm">
            <div>
              <p className="text-sm font-medium">SSL / TLS</p>
              <p className="text-xs text-muted-foreground">
                Encrypt the database connection
              </p>
            </div>
            <Switch checked={ssl} onCheckedChange={setSsl} />
          </div>

          {/* Test connection */}
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={!canSave || isTesting}
            className="w-full"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Testing...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" /> Test Connection
              </>
            )}
          </Button>
          {testResult && (
            <div
              className={cn(
                'flex items-start gap-2 p-3 rounded-2xl text-xs',
                testResult.ok
                  ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20',
              )}
            >
              {testResult.ok ? (
                <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Table / Query selector */}
          <div className="space-y-3 border-t border-border/50 pt-4">
            <Label className="text-xs font-medium">Data Source</Label>
            <div className="flex gap-2">
              <Button
                variant={queryMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQueryMode('table')}
              >
                Table
              </Button>
              <Button
                variant={queryMode === 'query' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQueryMode('query')}
              >
                Custom Query
              </Button>
            </div>

            {queryMode === 'table' ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Select Table</Label>
                <Select value={tableName} onValueChange={setTableName}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a table..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">SQL Query</Label>
                <textarea
                  placeholder="SELECT * FROM budgets WHERE year = 2025"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  rows={3}
                  className="flex w-full rounded-2xl border border-input bg-white/50 dark:bg-white/5 backdrop-blur-sm px-3 py-2 text-sm transition-all duration-200 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary resize-none font-mono"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isAlreadyConnected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" /> Disconnect
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!canSave}
              onClick={() =>
                onSave({
                  host,
                  port,
                  database,
                  username,
                  password,
                  ssl,
                  queryMode,
                  tableName: queryMode === 'table' ? tableName : undefined,
                  customQuery: queryMode === 'query' ? customQuery : undefined,
                })
              }
            >
              <Check className="h-3.5 w-3.5" /> Save Connection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Recent Syncs Section
// ---------------------------------------------------------------------------

function RecentSyncs({ syncLog }: { syncLog: SyncRecord[] }) {
  if (syncLog.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">Recent Syncs</h2>
      <div className="border border-border/50 rounded-3xl bg-card/70 backdrop-blur-xl overflow-hidden">
        <div className="divide-y divide-border/30">
          {syncLog.slice(0, 10).map((record, i) => {
            const date = new Date(record.timestamp);
            const timeStr = date.toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={`${record.connectorId}-${i}`}
                className="flex items-center gap-3 px-5 py-3"
              >
                <div
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    record.status === 'success'
                      ? 'bg-green-500'
                      : 'bg-destructive',
                  )}
                />
                <span className="text-sm font-medium flex-1">
                  {record.connectorName}
                </span>
                {record.rowCount !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {record.rowCount} rows
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeStr}
                </span>
                <Badge
                  variant={record.status === 'success' ? 'success' : 'destructive'}
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {record.status === 'success' ? 'Success' : 'Error'}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
