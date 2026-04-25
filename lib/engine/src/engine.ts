import { Lexer } from './lexer/index.js';
import { Parser, type ASTNode } from './parser/index.js';
import { Evaluator, type EvaluationContext, type FormulaValue } from './evaluator/index.js';
import { DAGManager } from './dag/index.js';

export interface CellCoordinate {
  [dimensionId: string]: string;
}

export interface BlockDefinition {
  id: string;
  name: string;
  formula: string;
  dependencies: string[];
}

export interface CellValue {
  blockId: string;
  coordinates: CellCoordinate;
  value: FormulaValue;
}

export class FormulaEngine {
  private dag = new DAGManager();
  private parsedFormulas = new Map<string, ASTNode>();
  private cellValues = new Map<string, FormulaValue>();

  addBlock(block: BlockDefinition): void {
    const ast = this.parseFormula(block.formula);
    this.parsedFormulas.set(block.id, ast);
    this.dag.addNode(block.id, block.formula, block.dependencies);
  }

  removeBlock(id: string): void {
    this.dag.removeNode(id);
    this.parsedFormulas.delete(id);
  }

  setCellValue(key: string, value: FormulaValue): void {
    this.cellValues.set(key, value);
    this.dag.markDirty(key);
  }

  getCellValue(key: string): FormulaValue {
    return this.cellValues.get(key) ?? null;
  }

  recalculate(changedBlockIds?: string[]): Map<string, FormulaValue> {
    const dirty = changedBlockIds
      ? new Set(changedBlockIds.flatMap(id => [...this.dag.markDirty(id)]))
      : undefined;

    const order = this.dag.getRecalculationOrder(dirty);
    const results = new Map<string, FormulaValue>();

    for (const blockId of order) {
      const ast = this.parsedFormulas.get(blockId);
      if (!ast) continue;

      const context: EvaluationContext = {
        resolveIdentifier: (name: string) => {
          return this.cellValues.get(name) ?? this.dag.getNode(name)?.lastValue as FormulaValue ?? null;
        },
      };

      const evaluator = new Evaluator(context);
      const result = evaluator.evaluate(ast);
      this.dag.setNodeValue(blockId, result);
      this.cellValues.set(blockId, result);
      results.set(blockId, result);
    }

    return results;
  }

  parseFormula(formula: string): ASTNode {
    if (!formula || formula.trim() === '') {
      return { type: 'NumberLiteral', value: 0 };
    }
    const lexer = new Lexer(formula);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
  }

  validateFormula(formula: string): { valid: boolean; error?: string; ast?: ASTNode } {
    try {
      const ast = this.parseFormula(formula);
      return { valid: true, ast };
    } catch (err) {
      return { valid: false, error: (err as Error).message };
    }
  }

  extractDependencies(formula: string): string[] {
    try {
      const ast = this.parseFormula(formula);
      const deps = new Set<string>();
      this.walkAST(ast, deps);
      return [...deps];
    } catch {
      return [];
    }
  }

  private walkAST(node: ASTNode, deps: Set<string>): void {
    switch (node.type) {
      case 'Identifier':
        deps.add(node.name);
        break;
      case 'UnaryExpression':
        this.walkAST(node.operand, deps);
        break;
      case 'BinaryExpression':
        this.walkAST(node.left, deps);
        this.walkAST(node.right, deps);
        break;
      case 'FunctionCall':
        for (const arg of node.args) this.walkAST(arg, deps);
        break;
      case 'ModifierExpression':
        this.walkAST(node.base, deps);
        break;
      case 'ConditionalExpression':
        this.walkAST(node.condition, deps);
        this.walkAST(node.consequent, deps);
        this.walkAST(node.alternate, deps);
        break;
    }
  }

  getDag(): DAGManager {
    return this.dag;
  }
}
