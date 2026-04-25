import { describe, it, expect } from 'vitest';
import { Lexer } from '../lexer/index.js';
import { Parser } from '../parser/index.js';
import type { ASTNode } from '../parser/ast.js';

function parse(input: string): ASTNode {
  const tokens = new Lexer(input).tokenize();
  return new Parser(tokens).parse();
}

describe('Parser', () => {
  it('parses number literals', () => {
    const ast = parse('42');
    expect(ast).toEqual({ type: 'NumberLiteral', value: 42 });
  });

  it('parses string literals', () => {
    const ast = parse('"hello"');
    expect(ast).toEqual({ type: 'StringLiteral', value: 'hello' });
  });

  it('parses boolean literals', () => {
    expect(parse('TRUE')).toEqual({ type: 'BooleanLiteral', value: true });
    expect(parse('FALSE')).toEqual({ type: 'BooleanLiteral', value: false });
  });

  it('parses arithmetic with precedence', () => {
    const ast = parse('1 + 2 * 3');
    expect(ast.type).toBe('BinaryExpression');
    const bin = ast as any;
    expect(bin.operator).toBe('+');
    expect(bin.left).toEqual({ type: 'NumberLiteral', value: 1 });
    expect(bin.right.operator).toBe('*');
  });

  it('parses parenthesized expressions', () => {
    const ast = parse('(1 + 2) * 3');
    const bin = ast as any;
    expect(bin.operator).toBe('*');
    expect(bin.left.operator).toBe('+');
  });

  it('parses unary minus', () => {
    const ast = parse('-42');
    expect(ast.type).toBe('UnaryExpression');
    const un = ast as any;
    expect(un.operator).toBe('-');
    expect(un.operand).toEqual({ type: 'NumberLiteral', value: 42 });
  });

  it('parses function calls', () => {
    const ast = parse('SUM(1, 2, 3)');
    expect(ast.type).toBe('FunctionCall');
    const fn = ast as any;
    expect(fn.name).toBe('SUM');
    expect(fn.args.length).toBe(3);
  });

  it('parses nested function calls', () => {
    const ast = parse('ROUND(SUM(a, b), 2)');
    expect(ast.type).toBe('FunctionCall');
    const fn = ast as any;
    expect(fn.name).toBe('ROUND');
    expect(fn.args[0].type).toBe('FunctionCall');
    expect(fn.args[0].name).toBe('SUM');
  });

  it('parses IF expressions', () => {
    const ast = parse('IF(x > 0, x, -x)');
    expect(ast.type).toBe('ConditionalExpression');
    const cond = ast as any;
    expect(cond.condition.type).toBe('BinaryExpression');
    expect(cond.condition.operator).toBe('>');
  });

  it('parses comparison operators', () => {
    const ast = parse('a >= b');
    const bin = ast as any;
    expect(bin.type).toBe('BinaryExpression');
    expect(bin.operator).toBe('>=');
  });

  it('parses logical operators', () => {
    const ast = parse('a AND b OR c');
    const bin = ast as any;
    expect(bin.type).toBe('BinaryExpression');
    expect(bin.operator).toBe('OR');
    expect(bin.left.operator).toBe('AND');
  });

  it('parses modifiers', () => {
    const ast = parse('Revenue [BY SUM: Region]');
    expect(ast.type).toBe('ModifierExpression');
    const mod = ast as any;
    expect(mod.modifierType).toBe('BY SUM');
    expect(mod.modifierArgs).toEqual(['Region']);
    expect(mod.base.type).toBe('Identifier');
  });

  it('parses chained modifiers', () => {
    const ast = parse('Revenue [FILTER: Country] [BY SUM: Quarter]');
    expect(ast.type).toBe('ModifierExpression');
    const outer = ast as any;
    expect(outer.modifierType).toBe('BY SUM');
    expect(outer.base.type).toBe('ModifierExpression');
    expect(outer.base.modifierType).toBe('FILTER');
  });

  it('parses string concatenation', () => {
    const ast = parse('"Hello" & " " & "World"');
    expect(ast.type).toBe('BinaryExpression');
    const bin = ast as any;
    expect(bin.operator).toBe('&');
  });

  it('throws on unexpected tokens', () => {
    expect(() => parse('1 + + +')).toThrow();
  });

  it('parses complex financial formula', () => {
    const ast = parse('IF(Revenue > 0, Revenue - COGS, 0) / Revenue * 100');
    expect(ast.type).toBe('BinaryExpression');
  });
});
