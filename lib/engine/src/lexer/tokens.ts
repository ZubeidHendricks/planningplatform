export enum TokenType {
  // Literals
  Number = 'Number',
  String = 'String',
  Boolean = 'Boolean',
  Identifier = 'Identifier',

  // Operators
  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Percent = 'Percent',
  Caret = 'Caret',
  Ampersand = 'Ampersand',

  // Comparison
  Equals = 'Equals',
  NotEquals = 'NotEquals',
  LessThan = 'LessThan',
  LessThanOrEqual = 'LessThanOrEqual',
  GreaterThan = 'GreaterThan',
  GreaterThanOrEqual = 'GreaterThanOrEqual',

  // Delimiters
  LeftParen = 'LeftParen',
  RightParen = 'RightParen',
  LeftBracket = 'LeftBracket',
  RightBracket = 'RightBracket',
  Comma = 'Comma',
  Colon = 'Colon',
  Dot = 'Dot',

  // Modifiers (Pigment-style)
  Modifier = 'Modifier',

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

export const KEYWORDS = new Set([
  'TRUE', 'FALSE',
  'IF', 'THEN', 'ELSE',
  'AND', 'OR', 'NOT',
]);

export const MODIFIER_KEYWORDS = new Set([
  'BY', 'FILTER', 'TIME', 'ADD', 'REMOVE', 'SHIFT',
  'SUM', 'AVG', 'MIN', 'MAX', 'COUNT',
  'CONSTANT', 'PROPERTY',
]);
