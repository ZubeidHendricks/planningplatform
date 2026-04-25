const CURRENCY_SYMBOL = 'R';

export function formatNumber(value: number, decimals = 0): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(1) + 'B';
  }
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 10_000) {
    return (value / 1_000).toFixed(1) + 'K';
  }
  return value.toLocaleString('en-ZA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(value: number, decimals = 0): string {
  return CURRENCY_SYMBOL + formatNumber(value, decimals);
}

export function formatPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals) + '%';
}

export function formatValue(
  value: number | string,
  format: 'number' | 'currency' | 'percent' = 'number',
): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return formatCurrency(value);
    case 'percent':
      return formatPercent(value);
    default:
      return formatNumber(value);
  }
}

export function calculateTrend(
  current: number,
  previous: number,
): { direction: 'up' | 'down' | 'flat'; percent: number } {
  if (previous === 0) return { direction: current > 0 ? 'up' : 'flat', percent: 0 };
  const change = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(change) < 0.1) return { direction: 'flat', percent: 0 };
  return {
    direction: change > 0 ? 'up' : 'down',
    percent: Math.abs(change),
  };
}
