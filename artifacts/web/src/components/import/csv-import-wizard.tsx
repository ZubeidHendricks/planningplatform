import { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColumnMapping {
  csvColumn: string;
  targetField: string | null;
  dataType: 'text' | 'number' | 'date' | 'boolean';
}

interface CsvImportWizardProps {
  targetFields: Array<{ key: string; label: string; required?: boolean }>;
  onImport: (data: Record<string, unknown>[], mappings: ColumnMapping[]) => void;
  onCancel: () => void;
}

type Step = 'upload' | 'mapping' | 'review';

function parseCSV(text: string, delimiter: string): string[][] {
  const lines = text.split('\n').filter((l) => l.trim());
  return lines.map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function detectDelimiter(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  if (tabs > commas && tabs > semicolons) return '\t';
  if (semicolons > commas) return ';';
  return ',';
}

export function CsvImportWizard({ targetFields, onImport, onCancel }: CsvImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [rawText, setRawText] = useState('');
  const [delimiter, setDelimiter] = useState(',');
  const [hasHeader, setHasHeader] = useState(true);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }, []);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const detectedDelimiter = detectDelimiter(text);
      setDelimiter(detectedDelimiter);
      setRawText(text);
      processText(text, detectedDelimiter, true);
    };
    reader.readAsText(file);
  }

  function processText(text: string, delim: string, header: boolean) {
    const parsed = parseCSV(text, delim);
    if (parsed.length === 0) return;
    if (header) {
      setHeaders(parsed[0] ?? []);
      setRows(parsed.slice(1));
      setMappings((parsed[0] ?? []).map((col) => ({
        csvColumn: col,
        targetField: autoMatch(col),
        dataType: 'text' as const,
      })));
    } else {
      const cols = (parsed[0] ?? []).map((_, i) => `Column ${i + 1}`);
      setHeaders(cols);
      setRows(parsed);
      setMappings(cols.map((col) => ({
        csvColumn: col,
        targetField: null,
        dataType: 'text' as const,
      })));
    }
  }

  function autoMatch(csvCol: string): string | null {
    const normalized = csvCol.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const field of targetFields) {
      const fieldNorm = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalized === fieldNorm || normalized.includes(fieldNorm) || fieldNorm.includes(normalized)) {
        return field.key;
      }
    }
    return null;
  }

  function updateMapping(index: number, field: string | null) {
    setMappings((prev) => prev.map((m, i) => i === index ? { ...m, targetField: field } : m));
  }

  function updateDataType(index: number, dataType: ColumnMapping['dataType']) {
    setMappings((prev) => prev.map((m, i) => i === index ? { ...m, dataType } : m));
  }

  function validate(): boolean {
    const errs: string[] = [];
    const required = targetFields.filter((f) => f.required);
    for (const req of required) {
      if (!mappings.some((m) => m.targetField === req.key)) {
        errs.push(`Required field "${req.label}" is not mapped`);
      }
    }
    setErrors(errs);
    return errs.length === 0;
  }

  function handleImport() {
    if (!validate()) return;
    const data: Record<string, unknown>[] = rows.map((row) => {
      const obj: Record<string, unknown> = {};
      mappings.forEach((m, i) => {
        if (m.targetField && row[i] !== undefined) {
          let val: unknown = row[i];
          if (m.dataType === 'number') val = Number(row[i]) || 0;
          if (m.dataType === 'boolean') val = ['true', '1', 'yes'].includes((row[i] ?? '').toLowerCase());
          obj[m.targetField] = val;
        }
      });
      return obj;
    });
    onImport(data, mappings);
  }

  const steps: { key: Step; label: string; num: number }[] = [
    { key: 'upload', label: 'Upload File', num: 1 },
    { key: 'mapping', label: 'Map Columns', num: 2 },
    { key: 'review', label: 'Review & Import', num: 3 },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg max-w-3xl w-full">
      {/* Step indicator */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <div className={cn(
              'flex items-center gap-2 text-sm',
              i <= currentStepIndex ? 'text-primary font-medium' : 'text-muted-foreground',
            )}>
              <span className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold',
                i < currentStepIndex ? 'bg-primary text-primary-foreground' : i === currentStepIndex ? 'bg-primary/10 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground',
              )}>
                {i < currentStepIndex ? <Check className="h-3 w-3" /> : s.num}
              </span>
              {s.label}
            </div>
          </div>
        ))}
        <button onClick={onCancel} className="ml-auto p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step content */}
      <div className="p-6">
        {step === 'upload' && (
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Drop your CSV file here</p>
              <p className="text-xs text-muted-foreground mb-4">or click to browse</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium cursor-pointer hover:bg-primary/90">
                <FileSpreadsheet className="h-4 w-4" />
                Choose File
                <input type="file" accept=".csv,.tsv,.txt" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>

            {rawText && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Delimiter</label>
                    <select
                      value={delimiter}
                      onChange={(e) => { setDelimiter(e.target.value); processText(rawText, e.target.value, hasHeader); }}
                      className="px-2 py-1.5 border border-input rounded-md text-sm bg-background"
                    >
                      <option value=",">Comma (,)</option>
                      <option value="	">Tab</option>
                      <option value=";">Semicolon (;)</option>
                      <option value="|">Pipe (|)</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hasHeader}
                      onChange={(e) => { setHasHeader(e.target.checked); processText(rawText, delimiter, e.target.checked); }}
                      className="rounded border-input"
                    />
                    First row is header
                  </label>
                </div>
                <div className="text-xs text-muted-foreground">
                  {headers.length} columns, {rows.length} data rows detected
                </div>
                <div className="max-h-32 overflow-auto border border-border rounded-md">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted">
                        {headers.map((h, i) => (
                          <th key={i} className="px-2 py-1 text-left font-medium border-r border-border last:border-r-0">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 3).map((row, ri) => (
                        <tr key={ri} className="border-t border-border">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 border-r border-border last:border-r-0 truncate max-w-[120px]">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Map CSV columns to target fields.</p>
            <div className="space-y-2">
              {mappings.map((m, i) => (
                <div key={i} className="flex items-center gap-3 p-2 border border-border rounded-md">
                  <span className="text-sm font-medium w-36 truncate">{m.csvColumn}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <select
                    value={m.targetField ?? ''}
                    onChange={(e) => updateMapping(i, e.target.value || null)}
                    className="flex-1 px-2 py-1.5 border border-input rounded-md text-sm bg-background"
                  >
                    <option value="">-- Skip --</option>
                    {targetFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label} {f.required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                  <select
                    value={m.dataType}
                    onChange={(e) => updateDataType(i, e.target.value as ColumnMapping['dataType'])}
                    className="w-24 px-2 py-1.5 border border-input rounded-md text-sm bg-background"
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="boolean">Boolean</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            {errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {err}
                  </div>
                ))}
              </div>
            )}

            <div className="text-sm">
              <p className="font-medium mb-2">Import Summary</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <span>Total rows:</span>
                <span className="text-foreground font-medium">{rows.length}</span>
                <span>Mapped columns:</span>
                <span className="text-foreground font-medium">{mappings.filter((m) => m.targetField).length} / {mappings.length}</span>
                <span>Skipped columns:</span>
                <span className="text-foreground font-medium">{mappings.filter((m) => !m.targetField).length}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Column Mappings</p>
              <div className="space-y-1">
                {mappings.filter((m) => m.targetField).map((m, i) => {
                  const field = targetFields.find((f) => f.key === m.targetField);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-32 truncate">{m.csvColumn}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{field?.label ?? m.targetField}</span>
                      <span className="text-muted-foreground">({m.dataType})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="max-h-40 overflow-auto border border-border rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted sticky top-0">
                    {mappings.filter((m) => m.targetField).map((m, i) => (
                      <th key={i} className="px-2 py-1 text-left font-medium border-r border-border last:border-r-0">
                        {targetFields.find((f) => f.key === m.targetField)?.label ?? m.targetField}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-t border-border">
                      {mappings.map((m, ci) => {
                        if (!m.targetField) return null;
                        return (
                          <td key={ci} className="px-2 py-1 border-r border-border last:border-r-0 truncate max-w-[120px]">
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
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
        <button
          onClick={() => {
            if (step === 'mapping') setStep('upload');
            if (step === 'review') setStep('mapping');
          }}
          disabled={step === 'upload'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        {step !== 'review' ? (
          <button
            onClick={() => {
              if (step === 'upload' && rawText) setStep('mapping');
              if (step === 'mapping') { if (validate()) setStep('review'); }
            }}
            disabled={step === 'upload' && !rawText}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-40"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            <Check className="h-3.5 w-3.5" /> Import {rows.length} rows
          </button>
        )}
      </div>
    </div>
  );
}
