import { describe, it, expect } from 'vitest';
import { Lexer } from '../lexer/index.js';
import { Parser } from '../parser/index.js';
import { Evaluator, type EvaluationContext, type FormulaValue } from '../evaluator/index.js';

function evaluate(input: string, vars: Record<string, FormulaValue> = {}): FormulaValue {
  const tokens = new Lexer(input).tokenize();
  const ast = new Parser(tokens).parse();
  const context: EvaluationContext = {
    resolveIdentifier: (name) => vars[name] ?? null,
  };
  return new Evaluator(context).evaluate(ast);
}

describe('Evaluator', () => {
  it('evaluates number literals', () => {
    expect(evaluate('42')).toBe(42);
    expect(evaluate('3.14')).toBe(3.14);
  });

  it('evaluates arithmetic', () => {
    expect(evaluate('2 + 3')).toBe(5);
    expect(evaluate('10 - 4')).toBe(6);
    expect(evaluate('3 * 7')).toBe(21);
    expect(evaluate('15 / 3')).toBe(5);
    expect(evaluate('2 ^ 10')).toBe(1024);
    expect(evaluate('10 % 3')).toBe(1);
  });

  it('respects operator precedence', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
  });

  it('evaluates unary minus', () => {
    expect(evaluate('-5')).toBe(-5);
    expect(evaluate('-(3 + 4)')).toBe(-7);
  });

  it('evaluates comparisons', () => {
    expect(evaluate('5 > 3')).toBe(true);
    expect(evaluate('3 > 5')).toBe(false);
    expect(evaluate('5 >= 5')).toBe(true);
    expect(evaluate('5 = 5')).toBe(true);
    expect(evaluate('5 != 3')).toBe(true);
  });

  it('evaluates logical operators', () => {
    expect(evaluate('TRUE AND TRUE')).toBe(true);
    expect(evaluate('TRUE AND FALSE')).toBe(false);
    expect(evaluate('FALSE OR TRUE')).toBe(true);
    expect(evaluate('NOT TRUE')).toBe(false);
  });

  it('evaluates IF expressions', () => {
    expect(evaluate('IF(TRUE, 1, 2)')).toBe(1);
    expect(evaluate('IF(FALSE, 1, 2)')).toBe(2);
    expect(evaluate('IF(10 > 5, "yes", "no")')).toBe('yes');
  });

  it('evaluates string concatenation', () => {
    expect(evaluate('"Hello" & " " & "World"')).toBe('Hello World');
  });

  it('evaluates built-in functions', () => {
    expect(evaluate('SUM(1, 2, 3, 4)')).toBe(10);
    expect(evaluate('AVG(2, 4, 6)')).toBe(4);
    expect(evaluate('MIN(5, 3, 8)')).toBe(3);
    expect(evaluate('MAX(5, 3, 8)')).toBe(8);
    expect(evaluate('COUNT(1, 2, 3)')).toBe(3);
    expect(evaluate('ABS(-42)')).toBe(42);
    expect(evaluate('ROUND(3.14159, 2)')).toBe(3.14);
    expect(evaluate('SQRT(16)')).toBe(4);
    expect(evaluate('POWER(2, 8)')).toBe(256);
  });

  it('evaluates string functions', () => {
    expect(evaluate('UPPER("hello")')).toBe('HELLO');
    expect(evaluate('LOWER("HELLO")')).toBe('hello');
    expect(evaluate('LEN("hello")')).toBe(5);
    expect(evaluate('LEFT("hello", 3)')).toBe('hel');
    expect(evaluate('RIGHT("hello", 3)')).toBe('llo');
    expect(evaluate('CONCATENATE("a", "b", "c")')).toBe('abc');
  });

  it('evaluates with variables', () => {
    expect(evaluate('Revenue - COGS', { Revenue: 1000, COGS: 600 })).toBe(400);
    expect(evaluate('Revenue * TaxRate', { Revenue: 1000, TaxRate: 0.15 })).toBe(150);
  });

  it('evaluates nested functions', () => {
    expect(evaluate('ROUND(AVG(10, 20, 33), 1)')).toBe(21);
  });

  it('evaluates complex financial formulas', () => {
    const vars = { Revenue: 1000000, COGS: 400000, OpEx: 300000 };
    expect(evaluate('Revenue - COGS - OpEx', vars)).toBe(300000);
    expect(evaluate('(Revenue - COGS) / Revenue * 100', vars)).toBe(60);
    expect(evaluate('IF(Revenue > 0, (Revenue - COGS) / Revenue * 100, 0)', vars)).toBe(60);
  });

  it('handles null/missing variables gracefully', () => {
    expect(evaluate('missing_var')).toBe(null);
    expect(evaluate('COALESCE(missing_var, 42)')).toBe(42);
  });

  it('throws on division by zero', () => {
    expect(() => evaluate('10 / 0')).toThrow('Division by zero');
  });
});
