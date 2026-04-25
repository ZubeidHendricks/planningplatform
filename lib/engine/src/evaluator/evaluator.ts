import type { ASTNode } from '../parser/ast.js';
import { BUILTIN_FUNCTIONS, EvaluationError, type FormulaValue } from './functions.js';

export interface EvaluationContext {
  resolveIdentifier: (name: string) => FormulaValue;
  resolveModifier?: (base: FormulaValue, modifierType: string, modifierArgs: string[]) => FormulaValue;
}

export class Evaluator {
  constructor(private context: EvaluationContext) {}

  evaluate(node: ASTNode): FormulaValue {
    switch (node.type) {
      case 'NumberLiteral':
        return node.value;

      case 'StringLiteral':
        return node.value;

      case 'BooleanLiteral':
        return node.value;

      case 'Identifier':
        return this.context.resolveIdentifier(node.name);

      case 'UnaryExpression':
        return this.evaluateUnary(node);

      case 'BinaryExpression':
        return this.evaluateBinary(node);

      case 'FunctionCall':
        return this.evaluateFunction(node);

      case 'ModifierExpression':
        return this.evaluateModifier(node);

      case 'ConditionalExpression': {
        const condition = this.evaluate(node.condition);
        return this.isTruthy(condition)
          ? this.evaluate(node.consequent)
          : this.evaluate(node.alternate);
      }
    }
  }

  private evaluateUnary(node: ASTNode & { type: 'UnaryExpression' }): FormulaValue {
    const val = this.evaluate(node.operand);
    switch (node.operator) {
      case '-':
        return -(this.toNumber(val));
      case '+':
        return this.toNumber(val);
      case 'NOT':
        return !this.isTruthy(val);
    }
  }

  private evaluateBinary(node: ASTNode & { type: 'BinaryExpression' }): FormulaValue {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (node.operator) {
      case '+': return this.toNumber(left) + this.toNumber(right);
      case '-': return this.toNumber(left) - this.toNumber(right);
      case '*': return this.toNumber(left) * this.toNumber(right);
      case '/': {
        const divisor = this.toNumber(right);
        if (divisor === 0) throw new EvaluationError('Division by zero');
        return this.toNumber(left) / divisor;
      }
      case '%': {
        const mod = this.toNumber(right);
        if (mod === 0) throw new EvaluationError('Modulo by zero');
        return this.toNumber(left) % mod;
      }
      case '^': return Math.pow(this.toNumber(left), this.toNumber(right));
      case '&': return String(left ?? '') + String(right ?? '');
      case '=': case '==': return left === right;
      case '!=': case '<>': return left !== right;
      case '<': return this.toNumber(left) < this.toNumber(right);
      case '<=': return this.toNumber(left) <= this.toNumber(right);
      case '>': return this.toNumber(left) > this.toNumber(right);
      case '>=': return this.toNumber(left) >= this.toNumber(right);
      case 'AND': return this.isTruthy(left) && this.isTruthy(right);
      case 'OR': return this.isTruthy(left) || this.isTruthy(right);
      default:
        throw new EvaluationError(`Unknown operator: ${node.operator}`);
    }
  }

  private evaluateFunction(node: ASTNode & { type: 'FunctionCall' }): FormulaValue {
    const fn = BUILTIN_FUNCTIONS[node.name];
    if (!fn) {
      throw new EvaluationError(`Unknown function: ${node.name}`);
    }
    const args = node.args.map(a => this.evaluate(a));
    return fn(args);
  }

  private evaluateModifier(node: ASTNode & { type: 'ModifierExpression' }): FormulaValue {
    const base = this.evaluate(node.base);
    if (this.context.resolveModifier) {
      return this.context.resolveModifier(base, node.modifierType, node.modifierArgs);
    }
    return base;
  }

  private toNumber(val: FormulaValue): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'string') {
      const n = parseFloat(val);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  private isTruthy(val: FormulaValue): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') return val.length > 0;
    return true;
  }
}
