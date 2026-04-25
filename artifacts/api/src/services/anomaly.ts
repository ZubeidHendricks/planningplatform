// Pure TypeScript anomaly detection — no external ML/stats libraries.

export interface AnomalyEntry {
  index: number;
  value: number;
  expectedRange: { lower: number; upper: number };
  severity: 'low' | 'medium' | 'high';
  zscore: number;
  explanation: string;
}

export interface AnomalyStats {
  mean: number;
  stddev: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
}

export interface AnomalyResult {
  anomalies: AnomalyEntry[];
  stats: AnomalyStats;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitize(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v));
}

function computeMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function computeStddev(arr: number[], avg: number): number {
  if (arr.length < 2) return 0;
  let s = 0;
  for (const v of arr) s += (v - avg) ** 2;
  return Math.sqrt(s / (arr.length - 1)); // sample std dev
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo]!;
  const frac = pos - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

function computeMedian(sorted: number[]): number {
  return quantile(sorted, 0.5);
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Stats computation
// ---------------------------------------------------------------------------

function computeStats(values: number[]): AnomalyStats {
  if (values.length === 0) {
    return { mean: 0, stddev: 0, median: 0, q1: 0, q3: 0, iqr: 0 };
  }

  const avg = computeMean(values);
  const sd = computeStddev(values, avg);
  const sorted = [...values].sort((a, b) => a - b);
  const med = computeMedian(sorted);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;

  return { mean: avg, stddev: sd, median: med, q1, q3, iqr };
}

// ---------------------------------------------------------------------------
// Z-Score detection
// ---------------------------------------------------------------------------

interface RawAnomaly {
  index: number;
  value: number;
  zscore: number;
  zSeverity: 'medium' | 'high' | null;
  iqrSeverity: 'medium' | 'high' | null;
}

function detectZScore(
  values: number[],
  stats: AnomalyStats,
): Map<number, RawAnomaly> {
  const results = new Map<number, RawAnomaly>();
  if (stats.stddev === 0) return results;

  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    const z = (v - stats.mean) / stats.stddev;
    const absZ = Math.abs(z);

    if (absZ > 2) {
      results.set(i, {
        index: i,
        value: v,
        zscore: z,
        zSeverity: absZ > 3 ? 'high' : 'medium',
        iqrSeverity: null,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// IQR detection
// ---------------------------------------------------------------------------

function detectIQR(
  values: number[],
  stats: AnomalyStats,
): Map<number, { severity: 'medium' | 'high' }> {
  const results = new Map<number, { severity: 'medium' | 'high' }>();
  if (stats.iqr === 0) return results;

  const lowerFence = stats.q1 - 1.5 * stats.iqr;
  const upperFence = stats.q3 + 1.5 * stats.iqr;
  const lowerExtreme = stats.q1 - 3 * stats.iqr;
  const upperExtreme = stats.q3 + 3 * stats.iqr;

  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v < lowerExtreme || v > upperExtreme) {
      results.set(i, { severity: 'high' });
    } else if (v < lowerFence || v > upperFence) {
      results.set(i, { severity: 'medium' });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Combined detection: union of both methods, severity by consensus
// ---------------------------------------------------------------------------

function generateExplanation(
  value: number,
  stats: AnomalyStats,
  zscore: number,
  severity: 'low' | 'medium' | 'high',
): string {
  const direction = zscore > 0 ? 'above' : 'below';
  const absZ = Math.abs(zscore).toFixed(1);
  const parts: string[] = [];

  parts.push(
    `Value ${formatNumber(value)} is ${absZ} standard deviations ${direction} the mean of ${formatNumber(stats.mean)}`,
  );

  if (severity === 'high') {
    parts.push('This is a significant outlier detected by both z-score and IQR methods');
  } else if (severity === 'medium') {
    parts.push('This value falls outside expected bounds');
  } else {
    parts.push('This is a mild deviation from the expected range');
  }

  return parts.join('. ') + '.';
}

export function detectAnomalies(values: number[]): AnomalyResult {
  const data = sanitize(values);
  const stats = computeStats(data);

  if (data.length < 2) {
    return { anomalies: [], stats };
  }

  // Run both detectors
  const zResults = detectZScore(data, stats);
  const iqrResults = detectIQR(data, stats);

  // Union of indices flagged by either method
  const flaggedIndices = new Set<number>([...zResults.keys(), ...iqrResults.keys()]);

  // Expected range from IQR fences
  const lowerFence = stats.q1 - 1.5 * stats.iqr;
  const upperFence = stats.q3 + 1.5 * stats.iqr;

  // If IQR is 0 (all same values), fall back to z-score bounds
  const expectedLower = stats.iqr > 0 ? lowerFence : stats.mean - 2 * stats.stddev;
  const expectedUpper = stats.iqr > 0 ? upperFence : stats.mean + 2 * stats.stddev;

  const anomalies: AnomalyEntry[] = [];

  for (const idx of flaggedIndices) {
    const v = data[idx]!;
    const zEntry = zResults.get(idx);
    const iqrEntry = iqrResults.get(idx);

    // Compute z-score even if only IQR flagged it
    const zscore = stats.stddev > 0 ? (v - stats.mean) / stats.stddev : 0;

    // Severity consensus: if both flag high -> high; if both flag -> medium at least;
    // if only one flags -> use that method's severity but cap at medium unless high
    let severity: 'low' | 'medium' | 'high';

    if (zEntry?.zSeverity === 'high' && iqrEntry?.severity === 'high') {
      severity = 'high';
    } else if (zEntry?.zSeverity === 'high' || iqrEntry?.severity === 'high') {
      // One says high, the other either says medium or didn't flag: call it high if both flagged, medium otherwise
      severity = (zEntry && iqrEntry) ? 'high' : 'medium';
    } else if (zEntry && iqrEntry) {
      // Both flagged as medium
      severity = 'medium';
    } else {
      // Only one method flagged
      severity = 'low';
    }

    anomalies.push({
      index: idx,
      value: v,
      expectedRange: { lower: expectedLower, upper: expectedUpper },
      severity,
      zscore,
      explanation: generateExplanation(v, stats, zscore, severity),
    });
  }

  // Sort by severity (high first) then by absolute z-score descending
  const severityOrder = { high: 0, medium: 1, low: 2 };
  anomalies.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return Math.abs(b.zscore) - Math.abs(a.zscore);
  });

  return { anomalies, stats };
}
