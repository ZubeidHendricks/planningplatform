export type ASTNode =
  | NumberLiteral
  | StringLiteral
  | BooleanLiteral
  | Identifier
  | UnaryExpression
  | BinaryExpression
  | FunctionCall
  | ModifierExpression
  | ConditionalExpression;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface UnaryExpression {
  type: 'UnaryExpression';
  operator: '+' | '-' | 'NOT';
  operand: ASTNode;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: string;
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export interface ModifierExpression {
  type: 'ModifierExpression';
  base: ASTNode;
  modifierType: string;
  modifierArgs: string[];
}

export interface ConditionalExpression {
  type: 'ConditionalExpression';
  condition: ASTNode;
  consequent: ASTNode;
  alternate: ASTNode;
}
