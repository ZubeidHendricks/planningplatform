// Pure TypeScript statistical forecasting — no external ML libraries.

export interface ForecastInput {
  values: number[];
  periods: number;
  method?: 'linear' | 'moving_average' | 'exponential_smoothing';
}

export interface ForecastResult {
  method: string;
  forecasted: number[];
  confidence: { lower: number; upper: number }[];
  accuracy: {
    mae: number;
    mape: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonality: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function variance(arr: number[], avg?: number): number {
  if (arr.length < 2) return 0;
  const m = avg ?? mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) ** 2;
  return s / (arr.length - 1); // sample variance
}

function stddev(arr: number[], avg?: number): number {
  return Math.sqrt(variance(arr, avg));
}

function sanitize(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v));
}

// ---------------------------------------------------------------------------
// Linear Regression: y = mx + b via ordinary least squares
// ---------------------------------------------------------------------------

function linearRegression(values: number[]): { m: number; b: number; se: number } {
  const n = values.length;
  if (n === 0) return { m: 0, b: 0, se: 0 };
  if (n === 1) return { m: 0, b: values[0]!, se: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;

  // Standard error of estimate
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const predicted = m * i + b;
    sse += (values[i]! - predicted) ** 2;
  }
  const se = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;

  return { m, b, se };
}

function forecastLinear(values: number[], periods: number): ForecastResult {
  const data = sanitize(values);
  if (data.length === 0) {
    return emptyResult('linear', periods);
  }

  const { m, b, se } = linearRegression(data);
  const n = data.length;

  const forecasted: number[] = [];
  const confidence: { lower: number; upper: number }[] = [];
  const xMean = (n - 1) / 2;
  let sumXDevSq = 0;
  for (let i = 0; i < n; i++) sumXDevSq += (i - xMean) ** 2;

  // 95% confidence — use t ~ 1.96 for large samples
  const t = 1.96;

  for (let p = 0; p < periods; p++) {
    const x = n + p;
    const yHat = m * x + b;
    forecasted.push(yHat);

    // Prediction interval: se * sqrt(1 + 1/n + (x - xMean)^2 / sum(xi-xMean)^2)
    const factor = sumXDevSq > 0
      ? Math.sqrt(1 + 1 / n + (x - xMean) ** 2 / sumXDevSq)
      : 1;
    const margin = t * se * factor;
    confidence.push({ lower: yHat - margin, upper: yHat + margin });
  }

  const accuracy = crossValidateMethod(data, 'linear');

  return {
    method: 'linear',
    forecasted,
    confidence,
    accuracy,
    trend: calculateTrend(data),
    seasonality: detectSeasonality(data),
  };
}

// ---------------------------------------------------------------------------
// Moving Average
// ---------------------------------------------------------------------------

function detectBestWindow(values: number[]): number {
  if (values.length < 6) return 3;

  // Try windows 2..floor(n/2), pick the one that minimises one-step-ahead MAE
  let bestWindow = 3;
  let bestMAE = Infinity;
  const maxWindow = Math.min(Math.floor(values.length / 2), 12);

  for (let w = 2; w <= maxWindow; w++) {
    let totalError = 0;
    let count = 0;
    for (let i = w; i < values.length; i++) {
      let s = 0;
      for (let j = i - w; j < i; j++) s += values[j]!;
      const predicted = s / w;
      totalError += Math.abs(values[i]! - predicted);
      count++;
    }
    const mae = count > 0 ? totalError / count : Infinity;
    if (mae < bestMAE) {
      bestMAE = mae;
      bestWindow = w;
    }
  }
  return bestWindow;
}

function forecastMovingAverage(values: number[], periods: number): ForecastResult {
  const data = sanitize(values);
  if (data.length === 0) {
    return emptyResult('moving_average', periods);
  }
  if (data.length === 1) {
    return {
      method: 'moving_average',
      forecasted: Array(periods).fill(data[0]) as number[],
      confidence: Array(periods).fill({ lower: data[0], upper: data[0] }) as { lower: number; upper: number }[],
      accuracy: { mae: 0, mape: 0 },
      trend: 'stable',
      seasonality: false,
    };
  }

  const window = detectBestWindow(data);
  const tail = data.slice(-window);
  const avg = mean(tail);

  // Historical one-step-ahead errors for variance estimation
  const errors: number[] = [];
  for (let i = window; i < data.length; i++) {
    let s = 0;
    for (let j = i - window; j < i; j++) s += data[j]!;
    errors.push(data[i]! - s / window);
  }
  const errorStd = stddev(errors);
  const t = 1.96;

  const forecasted: number[] = [];
  const confidence: { lower: number; upper: number }[] = [];

  for (let p = 0; p < periods; p++) {
    // Moving average forecast stays flat; uncertainty grows with sqrt(horizon)
    forecasted.push(avg);
    const margin = t * errorStd * Math.sqrt(1 + p / window);
    confidence.push({ lower: avg - margin, upper: avg + margin });
  }

  const accuracy = crossValidateMethod(data, 'moving_average');

  return {
    method: 'moving_average',
    forecasted,
    confidence,
    accuracy,
    trend: calculateTrend(data),
    seasonality: detectSeasonality(data),
  };
}

// ---------------------------------------------------------------------------
// Exponential Smoothing — Holt's double exponential (level + trend)
// ---------------------------------------------------------------------------

function holtSmoothing(
  values: number[],
  alpha: number,
  beta: number,
): { level: number; trend: number; fitted: number[] } {
  const n = values.length;
  if (n === 0) return { level: 0, trend: 0, fitted: [] };
  if (n === 1) return { level: values[0]!, trend: 0, fitted: [values[0]!] };

  // Initialise: level = first value, trend = second - first
  let level = values[0]!;
  let trend = values[1]! - values[0]!;
  const fitted: number[] = [level];

  for (let i = 1; i < n; i++) {
    const y = values[i]!;
    const prevLevel = level;
    level = alpha * y + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    fitted.push(level + trend);
  }

  return { level, trend, fitted };
}

function holtMSE(values: number[], alpha: number, beta: number): number {
  const { fitted } = holtSmoothing(values, alpha, beta);
  let sse = 0;
  for (let i = 0; i < values.length; i++) {
    sse += (values[i]! - fitted[i]!) ** 2;
  }
  return sse / values.length;
}

function optimizeHoltParams(values: number[]): { alpha: number; beta: number } {
  // Grid search over alpha and beta in [0.05, 0.95] with step 0.05
  let bestAlpha = 0.3;
  let bestBeta = 0.1;
  let bestMSE = Infinity;

  for (let a = 5; a <= 95; a += 5) {
    for (let b = 5; b <= 95; b += 5) {
      const alpha = a / 100;
      const beta = b / 100;
      const mse = holtMSE(values, alpha, beta);
      if (mse < bestMSE) {
        bestMSE = mse;
        bestAlpha = alpha;
        bestBeta = beta;
      }
    }
  }
  return { alpha: bestAlpha, beta: bestBeta };
}

function forecastExponentialSmoothing(values: number[], periods: number): ForecastResult {
  const data = sanitize(values);
  if (data.length === 0) {
    return emptyResult('exponential_smoothing', periods);
  }
  if (data.length === 1) {
    return {
      method: 'exponential_smoothing',
      forecasted: Array(periods).fill(data[0]) as number[],
      confidence: Array(periods).fill({ lower: data[0], upper: data[0] }) as { lower: number; upper: number }[],
      accuracy: { mae: 0, mape: 0 },
      trend: 'stable',
      seasonality: false,
    };
  }

  // If enough data, auto-optimise; otherwise use defaults
  const { alpha, beta } = data.length > 10
    ? optimizeHoltParams(data)
    : { alpha: 0.3, beta: 0.1 };

  const { level, trend, fitted } = holtSmoothing(data, alpha, beta);

  // Residuals for confidence interval estimation
  const residuals: number[] = [];
  for (let i = 0; i < data.length; i++) {
    residuals.push(data[i]! - fitted[i]!);
  }
  const resStd = stddev(residuals);
  const t = 1.96;

  const forecasted: number[] = [];
  const confidence: { lower: number; upper: number }[] = [];

  for (let p = 1; p <= periods; p++) {
    const yHat = level + trend * p;
    forecasted.push(yHat);
    // Uncertainty grows with horizon
    const margin = t * resStd * Math.sqrt(p);
    confidence.push({ lower: yHat - margin, upper: yHat + margin });
  }

  const accuracy = crossValidateMethod(data, 'exponential_smoothing');

  return {
    method: 'exponential_smoothing',
    forecasted,
    confidence,
    accuracy,
    trend: calculateTrend(data),
    seasonality: detectSeasonality(data),
  };
}

// ---------------------------------------------------------------------------
// Cross-validation helper: 80/20 split
// ---------------------------------------------------------------------------

function crossValidateMethod(
  values: number[],
  method: 'linear' | 'moving_average' | 'exponential_smoothing',
): { mae: number; mape: number } {
  if (values.length < 3) return { mae: 0, mape: 0 };

  const splitIdx = Math.max(2, Math.floor(values.length * 0.8));
  const train = values.slice(0, splitIdx);
  const test = values.slice(splitIdx);

  if (test.length === 0) return { mae: 0, mape: 0 };

  let predicted: number[];
  switch (method) {
    case 'linear': {
      const { m, b } = linearRegression(train);
      predicted = test.map((_, i) => m * (splitIdx + i) + b);
      break;
    }
    case 'moving_average': {
      const window = detectBestWindow(train);
      const tail = train.slice(-window);
      const avg = mean(tail);
      predicted = test.map(() => avg);
      break;
    }
    case 'exponential_smoothing': {
      const { alpha, beta } = train.length > 10
        ? optimizeHoltParams(train)
        : { alpha: 0.3, beta: 0.1 };
      const { level, trend } = holtSmoothing(train, alpha, beta);
      predicted = test.map((_, i) => level + trend * (i + 1));
      break;
    }
  }

  let totalAbsError = 0;
  let totalPctError = 0;
  let pctCount = 0;

  for (let i = 0; i < test.length; i++) {
    const actual = test[i]!;
    const pred = predicted[i]!;
    totalAbsError += Math.abs(actual - pred);
    if (actual !== 0) {
      totalPctError += Math.abs((actual - pred) / actual);
      pctCount++;
    }
  }

  return {
    mae: totalAbsError / test.length,
    mape: pctCount > 0 ? (totalPctError / pctCount) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Seasonality detection via autocorrelation
// ---------------------------------------------------------------------------

export function detectSeasonality(values: number[]): boolean {
  const data = sanitize(values);
  if (data.length < 6) return false;

  const n = data.length;
  const avg = mean(data);

  // Compute autocorrelation for lags 2..n/2
  // If any lag has r > 0.5, we consider it seasonal
  let denom = 0;
  for (let i = 0; i < n; i++) denom += (data[i]! - avg) ** 2;
  if (denom === 0) return false;

  const maxLag = Math.floor(n / 2);
  for (let lag = 2; lag <= maxLag; lag++) {
    let num = 0;
    for (let i = 0; i < n - lag; i++) {
      num += (data[i]! - avg) * (data[i + lag]! - avg);
    }
    const r = num / denom;
    if (r > 0.5) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Trend detection
// ---------------------------------------------------------------------------

export function calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
  const data = sanitize(values);
  if (data.length < 2) return 'stable';

  const { m } = linearRegression(data);

  // Compare slope magnitude against mean to determine significance
  const avg = mean(data);
  const absAvg = Math.abs(avg);
  const threshold = absAvg > 0 ? Math.abs(m) / absAvg : Math.abs(m);

  // If the per-period change is less than 1% of the mean, call it stable
  if (threshold < 0.01) return 'stable';
  return m > 0 ? 'increasing' : 'decreasing';
}

// ---------------------------------------------------------------------------
// Auto-forecast: pick best method via cross-validation
// ---------------------------------------------------------------------------

export function autoForecast(values: number[], periods: number): ForecastResult {
  const data = sanitize(values);
  if (data.length === 0) return emptyResult('linear', periods);

  const methods: Array<'linear' | 'moving_average' | 'exponential_smoothing'> = [
    'linear',
    'moving_average',
    'exponential_smoothing',
  ];

  let bestResult: ForecastResult | null = null;
  let bestMAE = Infinity;

  for (const method of methods) {
    const result = forecast({ values: data, periods, method });
    if (result.accuracy.mae < bestMAE) {
      bestMAE = result.accuracy.mae;
      bestResult = result;
    }
  }

  return bestResult!;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function emptyResult(method: string, periods: number): ForecastResult {
  return {
    method,
    forecasted: Array(periods).fill(0) as number[],
    confidence: Array(periods).fill({ lower: 0, upper: 0 }) as { lower: number; upper: number }[],
    accuracy: { mae: 0, mape: 0 },
    trend: 'stable',
    seasonality: false,
  };
}

export function forecast(input: ForecastInput): ForecastResult {
  const { values, periods, method = 'linear' } = input;

  if (periods <= 0) return emptyResult(method, 0);

  switch (method) {
    case 'linear':
      return forecastLinear(values, periods);
    case 'moving_average':
      return forecastMovingAverage(values, periods);
    case 'exponential_smoothing':
      return forecastExponentialSmoothing(values, periods);
    default:
      return forecastLinear(values, periods);
  }
}
