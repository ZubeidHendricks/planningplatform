import { Token, TokenType } from '../lexer/index.js';
import type { ASTNode } from './ast.js';

export class ParserError extends Error {
  constructor(
    message: string,
    public token: Token,
  ) {
    super(`Parse error at ${token.line}:${token.column}: ${message}`);
    this.name = 'ParserError';
  }
}

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.current().type !== TokenType.EOF) {
      throw new ParserError(`Unexpected token '${this.current().value}'`, this.current());
    }
    return node;
  }

  private parseExpression(): ASTNode {
    return this.parseOr();
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.matchIdentifier('OR')) {
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinaryExpression', operator: 'OR', left, right };
    }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseComparison();
    while (this.matchIdentifier('AND')) {
      this.advance();
      const right = this.parseComparison();
      left = { type: 'BinaryExpression', operator: 'AND', left, right };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseConcat();
    const comparisonTypes = [
      TokenType.Equals,
      TokenType.NotEquals,
      TokenType.LessThan,
      TokenType.LessThanOrEqual,
      TokenType.GreaterThan,
      TokenType.GreaterThanOrEqual,
    ];

    while (comparisonTypes.includes(this.current().type)) {
      const op = this.current().value;
      this.advance();
      const right = this.parseConcat();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseConcat(): ASTNode {
    let left = this.parseAddSub();
    while (this.current().type === TokenType.Ampersand) {
      this.advance();
      const right = this.parseAddSub();
      left = { type: 'BinaryExpression', operator: '&', left, right };
    }
    return left;
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (
      this.current().type === TokenType.Plus ||
      this.current().type === TokenType.Minus
    ) {
      const op = this.current().value;
      this.advance();
      const right = this.parseMulDiv();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parsePower();
    while (
      this.current().type === TokenType.Star ||
      this.current().type === TokenType.Slash ||
      this.current().type === TokenType.Percent
    ) {
      const op = this.current().value;
      this.advance();
      const right = this.parsePower();
      left = { type: 'BinaryExpression', operator: op, left, right };
    }
    return left;
  }

  private parsePower(): ASTNode {
    let left = this.parseUnary();
    while (this.current().type === TokenType.Caret) {
      this.advance();
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator: '^', left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.current().type === TokenType.Minus) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: '-', operand };
    }
    if (this.current().type === TokenType.Plus) {
      this.advance();
      return this.parseUnary();
    }
    if (this.matchIdentifier('NOT')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryExpression', operator: 'NOT', operand };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();

    while (this.current().type === TokenType.Modifier) {
      const modToken = this.current();
      this.advance();
      const parts = modToken.value.split(/\s*:\s*/);
      const modifierType = parts[0]!.trim();
      const modifierArgs = parts.slice(1).map(a => a.trim()).filter(Boolean);
      node = {
        type: 'ModifierExpression',
        base: node,
        modifierType,
        modifierArgs,
      };
    }

    return node;
  }

  private parsePrimary(): ASTNode {
    const token = this.current();

    switch (token.type) {
      case TokenType.Number:
        this.advance();
        return { type: 'NumberLiteral', value: parseFloat(token.value) };

      case TokenType.String:
        this.advance();
        return { type: 'StringLiteral', value: token.value };

      case TokenType.Boolean:
        this.advance();
        return { type: 'BooleanLiteral', value: token.value === 'TRUE' };

      case TokenType.Identifier: {
        let name = token.value;
        this.advance();

        // IF expression
        if (name.toUpperCase() === 'IF') {
          return this.parseIfExpression();
        }

        // Function call
        if (this.current().type === TokenType.LeftParen) {
          return this.parseFunctionCall(name);
        }

        // Greedily merge consecutive identifiers into one multi-word name
        // (e.g., "Gross Profit" = Identifier("Gross") + Identifier("Profit"))
        // but stop before keywords like AND, OR, NOT, IF
        const STOP_WORDS = new Set(['AND', 'OR', 'NOT', 'IF', 'TRUE', 'FALSE']);
        while (
          this.current().type === TokenType.Identifier &&
          !STOP_WORDS.has(this.current().value.toUpperCase()) &&
          this.current().type !== TokenType.LeftParen
        ) {
          name += ' ' + this.current().value;
          this.advance();
        }

        return { type: 'Identifier', name };
      }

      case TokenType.LeftParen: {
        this.advance();
        const expr = this.parseExpression();
        this.expect(TokenType.RightParen, "Expected ')'");
        return expr;
      }

      default:
        throw new ParserError(`Unexpected token '${token.value}'`, token);
    }
  }

  private parseIfExpression(): ASTNode {
    this.expect(TokenType.LeftParen, "Expected '(' after IF");
    const condition = this.parseExpression();
    this.expect(TokenType.Comma, "Expected ',' after IF condition");
    const consequent = this.parseExpression();
    this.expect(TokenType.Comma, "Expected ',' after IF consequent");
    const alternate = this.parseExpression();
    this.expect(TokenType.RightParen, "Expected ')' after IF expression");
    return { type: 'ConditionalExpression', condition, consequent, alternate };
  }

  private parseFunctionCall(name: string): ASTNode {
    this.advance(); // skip (
    const args: ASTNode[] = [];

    if (this.current().type !== TokenType.RightParen) {
      args.push(this.parseExpression());
      while (this.current().type === TokenType.Comma) {
        this.advance();
        args.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RightParen, "Expected ')' after function arguments");
    return { type: 'FunctionCall', name: name.toUpperCase(), args };
  }

  private current(): Token {
    return this.tokens[this.pos] ?? {
      type: TokenType.EOF,
      value: '',
      position: -1,
      line: -1,
      column: -1,
    };
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private expect(type: TokenType, message: string): Token {
    const token = this.current();
    if (token.type !== type) {
      throw new ParserError(`${message}, got '${token.value}'`, token);
    }
    this.advance();
    return token;
  }

  private matchIdentifier(name: string): boolean {
    return (
      this.current().type === TokenType.Identifier &&
      this.current().value.toUpperCase() === name
    );
  }
}
