import { describe, it, expect } from 'vitest';
import { Lexer, TokenType } from '../lexer/index.js';

describe('Lexer', () => {
  it('tokenizes numbers', () => {
    const tokens = new Lexer('42 3.14').tokenize();
    expect(tokens[0]!.type).toBe(TokenType.Number);
    expect(tokens[0]!.value).toBe('42');
    expect(tokens[1]!.type).toBe(TokenType.Number);
    expect(tokens[1]!.value).toBe('3.14');
  });

  it('tokenizes strings', () => {
    const tokens = new Lexer('"hello world"').tokenize();
    expect(tokens[0]!.type).toBe(TokenType.String);
    expect(tokens[0]!.value).toBe('hello world');
  });

  it('tokenizes booleans', () => {
    const tokens = new Lexer('TRUE FALSE').tokenize();
    expect(tokens[0]!.type).toBe(TokenType.Boolean);
    expect(tokens[0]!.value).toBe('TRUE');
    expect(tokens[1]!.type).toBe(TokenType.Boolean);
    expect(tokens[1]!.value).toBe('FALSE');
  });

  it('tokenizes identifiers', () => {
    const tokens = new Lexer('Revenue cost_of_goods').tokenize();
    expect(tokens[0]!.type).toBe(TokenType.Identifier);
    expect(tokens[0]!.value).toBe('Revenue');
    expect(tokens[1]!.type).toBe(TokenType.Identifier);
    expect(tokens[1]!.value).toBe('cost_of_goods');
  });

  it('tokenizes operators', () => {
    const tokens = new Lexer('+ - * / = != < <= > >=').tokenize();
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.Plus, TokenType.Minus, TokenType.Star, TokenType.Slash,
      TokenType.Equals, TokenType.NotEquals, TokenType.LessThan, TokenType.LessThanOrEqual,
      TokenType.GreaterThan, TokenType.GreaterThanOrEqual, TokenType.EOF,
    ]);
  });

  it('tokenizes function calls', () => {
    const tokens = new Lexer('SUM(a, b, 10)').tokenize();
    expect(tokens[0]!.type).toBe(TokenType.Identifier);
    expect(tokens[0]!.value).toBe('SUM');
    expect(tokens[1]!.type).toBe(TokenType.LeftParen);
    expect(tokens[2]!.type).toBe(TokenType.Identifier);
    expect(tokens[3]!.type).toBe(TokenType.Comma);
  });

  it('tokenizes modifiers', () => {
    const tokens = new Lexer('Revenue [BY SUM: Region]').tokenize();
    expect(tokens[0]!.type).toBe(TokenType.Identifier);
    expect(tokens[0]!.value).toBe('Revenue');
    expect(tokens[1]!.type).toBe(TokenType.Modifier);
    expect(tokens[1]!.value).toBe('BY SUM: Region');
  });

  it('tokenizes complex formula', () => {
    const tokens = new Lexer('IF(Revenue > 1000, Revenue * 0.1, 0)').tokenize();
    expect(tokens[0]!.value).toBe('IF');
    expect(tokens[1]!.type).toBe(TokenType.LeftParen);
    expect(tokens.filter(t => t.type !== TokenType.EOF).length).toBe(12);
  });

  it('handles nested modifiers', () => {
    const tokens = new Lexer('Revenue [FILTER: Country = "ZA"] [BY SUM: Quarter]').tokenize();
    expect(tokens.filter(t => t.type === TokenType.Modifier).length).toBe(2);
  });

  it('throws on unterminated string', () => {
    expect(() => new Lexer('"unterminated').tokenize()).toThrow('Unterminated string');
  });

  it('throws on unterminated modifier', () => {
    expect(() => new Lexer('Revenue [BY SUM:').tokenize()).toThrow('Unterminated modifier');
  });
});
