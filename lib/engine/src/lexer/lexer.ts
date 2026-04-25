import { Token, TokenType, KEYWORDS } from './tokens.js';

export class LexerError extends Error {
  constructor(
    message: string,
    public position: number,
    public line: number,
    public column: number,
  ) {
    super(`Lexer error at ${line}:${column}: ${message}`);
    this.name = 'LexerError';
  }
}

export class Lexer {
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  constructor(private source: string) {}

  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    while (this.pos < this.source.length) {
      this.skipWhitespace();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos]!;

      if (ch === '[') {
        this.readModifier();
      } else if (this.isDigit(ch) || (ch === '.' && this.peek(1) !== undefined && this.isDigit(this.peek(1)!))) {
        this.readNumber();
      } else if (ch === '"' || ch === "'") {
        this.readString(ch);
      } else if (this.isAlpha(ch) || ch === '_') {
        this.readIdentifier();
      } else {
        this.readOperator();
      }
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      position: this.pos,
      line: this.line,
      column: this.column,
    });

    return this.tokens;
  }

  private readModifier(): void {
    const start = this.pos;
    const startCol = this.column;
    this.advance(); // skip [

    let depth = 1;
    let value = '';

    while (this.pos < this.source.length && depth > 0) {
      const ch = this.source[this.pos]!;
      if (ch === '[') depth++;
      if (ch === ']') depth--;
      if (depth > 0) value += ch;
      this.advance();
    }

    if (depth !== 0) {
      throw new LexerError('Unterminated modifier bracket', start, this.line, startCol);
    }

    this.tokens.push({
      type: TokenType.Modifier,
      value: value.trim(),
      position: start,
      line: this.line,
      column: startCol,
    });
  }

  private readNumber(): void {
    const start = this.pos;
    const startCol = this.column;
    let value = '';
    let hasDot = false;

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]!;
      if (ch === '.' && !hasDot) {
        hasDot = true;
        value += ch;
        this.advance();
      } else if (this.isDigit(ch)) {
        value += ch;
        this.advance();
      } else if (ch === '_') {
        this.advance(); // numeric separator, skip
      } else {
        break;
      }
    }

    this.tokens.push({
      type: TokenType.Number,
      value,
      position: start,
      line: this.line,
      column: startCol,
    });
  }

  private readString(quote: string): void {
    const start = this.pos;
    const startCol = this.column;
    this.advance(); // skip opening quote
    let value = '';

    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        this.advance();
        const escaped = this.source[this.pos];
        if (escaped === 'n') value += '\n';
        else if (escaped === 't') value += '\t';
        else if (escaped === '\\') value += '\\';
        else if (escaped === quote) value += quote;
        else value += escaped;
      } else {
        value += this.source[this.pos];
      }
      this.advance();
    }

    if (this.pos >= this.source.length) {
      throw new LexerError('Unterminated string', start, this.line, startCol);
    }

    this.advance(); // skip closing quote

    this.tokens.push({
      type: TokenType.String,
      value,
      position: start,
      line: this.line,
      column: startCol,
    });
  }

  private readIdentifier(): void {
    const start = this.pos;
    const startCol = this.column;
    let value = '';

    while (this.pos < this.source.length && (this.isAlphaNumeric(this.source[this.pos]!) || this.source[this.pos] === '_')) {
      value += this.source[this.pos];
      this.advance();
    }

    const upper = value.toUpperCase();
    if (upper === 'TRUE' || upper === 'FALSE') {
      this.tokens.push({
        type: TokenType.Boolean,
        value: upper,
        position: start,
        line: this.line,
        column: startCol,
      });
    } else {
      this.tokens.push({
        type: KEYWORDS.has(upper) ? TokenType.Identifier : TokenType.Identifier,
        value,
        position: start,
        line: this.line,
        column: startCol,
      });
    }
  }

  private readOperator(): void {
    const start = this.pos;
    const startCol = this.column;
    const ch = this.source[this.pos]!;
    const next = this.peek(1);

    let type: TokenType;
    let value: string;

    switch (ch) {
      case '+': type = TokenType.Plus; value = '+'; this.advance(); break;
      case '-': type = TokenType.Minus; value = '-'; this.advance(); break;
      case '*': type = TokenType.Star; value = '*'; this.advance(); break;
      case '/': type = TokenType.Slash; value = '/'; this.advance(); break;
      case '%': type = TokenType.Percent; value = '%'; this.advance(); break;
      case '^': type = TokenType.Caret; value = '^'; this.advance(); break;
      case '&': type = TokenType.Ampersand; value = '&'; this.advance(); break;
      case '(': type = TokenType.LeftParen; value = '('; this.advance(); break;
      case ')': type = TokenType.RightParen; value = ')'; this.advance(); break;
      case ',': type = TokenType.Comma; value = ','; this.advance(); break;
      case ':': type = TokenType.Colon; value = ':'; this.advance(); break;
      case '.': type = TokenType.Dot; value = '.'; this.advance(); break;
      case '=':
        if (next === '=') {
          type = TokenType.Equals; value = '=='; this.advance(); this.advance();
        } else {
          type = TokenType.Equals; value = '='; this.advance();
        }
        break;
      case '!':
        if (next === '=') {
          type = TokenType.NotEquals; value = '!='; this.advance(); this.advance();
        } else {
          throw new LexerError(`Unexpected character '!'`, start, this.line, startCol);
        }
        break;
      case '<':
        if (next === '=') {
          type = TokenType.LessThanOrEqual; value = '<='; this.advance(); this.advance();
        } else if (next === '>') {
          type = TokenType.NotEquals; value = '<>'; this.advance(); this.advance();
        } else {
          type = TokenType.LessThan; value = '<'; this.advance();
        }
        break;
      case '>':
        if (next === '=') {
          type = TokenType.GreaterThanOrEqual; value = '>='; this.advance(); this.advance();
        } else {
          type = TokenType.GreaterThan; value = '>'; this.advance();
        }
        break;
      default:
        throw new LexerError(`Unexpected character '${ch}'`, start, this.line, startCol);
    }

    this.tokens.push({ type, value, position: start, line: this.line, column: startCol });
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]!;
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private peek(offset: number): string | undefined {
    return this.source[this.pos + offset];
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }
}
