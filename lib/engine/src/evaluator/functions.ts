export type FormulaValue = number | string | boolean | null;

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvaluationError';
  }
}

function assertNumber(val: FormulaValue, context: string): number {
  if (typeof val !== 'number' || isNaN(val)) {
    throw new EvaluationError(`${context}: expected number, got ${typeof val}`);
  }
  return val;
}

function toNumber(val: FormulaValue): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export type BuiltinFunction = (args: FormulaValue[]) => FormulaValue;

export const BUILTIN_FUNCTIONS: Record<string, BuiltinFunction> = {
  SUM: (args) => {
    let total = 0;
    for (const arg of args) {
      total += toNumber(arg);
    }
    return total;
  },

  AVG: (args) => {
    if (args.length === 0) return 0;
    let total = 0;
    for (const arg of args) {
      total += toNumber(arg);
    }
    return total / args.length;
  },

  MIN: (args) => {
    if (args.length === 0) return 0;
    let min = toNumber(args[0]!);
    for (let i = 1; i < args.length; i++) {
      const v = toNumber(args[i]!);
      if (v < min) min = v;
    }
    return min;
  },

  MAX: (args) => {
    if (args.length === 0) return 0;
    let max = toNumber(args[0]!);
    for (let i = 1; i < args.length; i++) {
      const v = toNumber(args[i]!);
      if (v > max) max = v;
    }
    return max;
  },

  COUNT: (args) => args.filter(a => a !== null).length,

  ABS: (args) => {
    const val = assertNumber(args[0] ?? null, 'ABS');
    return Math.abs(val);
  },

  ROUND: (args) => {
    const val = assertNumber(args[0] ?? null, 'ROUND');
    const decimals = args[1] !== undefined ? assertNumber(args[1], 'ROUND decimals') : 0;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
  },

  FLOOR: (args) => {
    const val = assertNumber(args[0] ?? null, 'FLOOR');
    return Math.floor(val);
  },

  CEIL: (args) => {
    const val = assertNumber(args[0] ?? null, 'CEIL');
    return Math.ceil(val);
  },

  POWER: (args) => {
    const base = assertNumber(args[0] ?? null, 'POWER base');
    const exp = assertNumber(args[1] ?? null, 'POWER exponent');
    return Math.pow(base, exp);
  },

  SQRT: (args) => {
    const val = assertNumber(args[0] ?? null, 'SQRT');
    if (val < 0) throw new EvaluationError('SQRT: cannot take square root of negative number');
    return Math.sqrt(val);
  },

  LOG: (args) => {
    const val = assertNumber(args[0] ?? null, 'LOG');
    if (val <= 0) throw new EvaluationError('LOG: argument must be positive');
    return Math.log(val);
  },

  CONCATENATE: (args) => {
    return args.map(a => (a === null ? '' : String(a))).join('');
  },

  LEFT: (args) => {
    const str = String(args[0] ?? '');
    const count = args[1] !== undefined ? assertNumber(args[1], 'LEFT count') : 1;
    return str.substring(0, count);
  },

  RIGHT: (args) => {
    const str = String(args[0] ?? '');
    const count = args[1] !== undefined ? assertNumber(args[1], 'RIGHT count') : 1;
    return str.substring(str.length - count);
  },

  LEN: (args) => {
    return String(args[0] ?? '').length;
  },

  UPPER: (args) => String(args[0] ?? '').toUpperCase(),
  LOWER: (args) => String(args[0] ?? '').toLowerCase(),

  ISNULL: (args) => args[0] === null || args[0] === undefined,

  COALESCE: (args) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined) return arg;
    }
    return null;
  },

  PREVIOUS: (_args) => {
    // Placeholder — actual implementation requires cell context from the DAG
    return 0;
  },

  PREVIOUSBASE: (_args) => {
    // Placeholder — for circular reference convergence
    return 0;
  },
};
