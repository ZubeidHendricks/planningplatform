import { describe, it, expect } from 'vitest';
import { FormulaEngine } from '../engine.js';

describe('FormulaEngine', () => {
  it('validates formulas', () => {
    const engine = new FormulaEngine();
    expect(engine.validateFormula('1 + 2').valid).toBe(true);
    expect(engine.validateFormula('SUM(1, 2, 3)').valid).toBe(true);
    expect(engine.validateFormula('IF(x > 0, x, -x)').valid).toBe(true);
    expect(engine.validateFormula('1 + + +').valid).toBe(false);
    expect(engine.validateFormula('"unterminated').valid).toBe(false);
  });

  it('extracts dependencies from formulas', () => {
    const engine = new FormulaEngine();
    expect(engine.extractDependencies('Revenue - COGS')).toEqual(['Revenue', 'COGS']);
    expect(engine.extractDependencies('SUM(a, b, c)')).toEqual(['a', 'b', 'c']);
    expect(engine.extractDependencies('42')).toEqual([]);
    expect(engine.extractDependencies('IF(Revenue > 0, Revenue * TaxRate, 0)')).toEqual(['Revenue', 'TaxRate']);
  });

  it('recalculates dependent blocks', () => {
    const engine = new FormulaEngine();

    engine.setCellValue('Revenue', 1000);
    engine.setCellValue('COGS', 400);

    engine.addBlock({
      id: 'GrossProfit',
      name: 'Gross Profit',
      formula: 'Revenue - COGS',
      dependencies: ['Revenue', 'COGS'],
    });

    engine.addBlock({
      id: 'GrossMargin',
      name: 'Gross Margin %',
      formula: 'GrossProfit / Revenue * 100',
      dependencies: ['GrossProfit', 'Revenue'],
    });

    const results = engine.recalculate(['GrossProfit']);
    expect(results.get('GrossProfit')).toBe(600);
    expect(results.get('GrossMargin')).toBe(60);
  });

  it('handles formula updates and re-recalculates', () => {
    const engine = new FormulaEngine();

    engine.setCellValue('Revenue', 1000);
    engine.setCellValue('COGS', 400);
    engine.setCellValue('OpEx', 200);

    engine.addBlock({
      id: 'Profit',
      name: 'Profit',
      formula: 'Revenue - COGS',
      dependencies: ['Revenue', 'COGS'],
    });

    let results = engine.recalculate(['Profit']);
    expect(results.get('Profit')).toBe(600);

    engine.addBlock({
      id: 'Profit',
      name: 'Profit',
      formula: 'Revenue - COGS - OpEx',
      dependencies: ['Revenue', 'COGS', 'OpEx'],
    });

    results = engine.recalculate(['Profit']);
    expect(results.get('Profit')).toBe(400);
  });

  it('cascades value changes through the DAG', () => {
    const engine = new FormulaEngine();

    engine.setCellValue('Price', 100);
    engine.setCellValue('Quantity', 50);

    engine.addBlock({
      id: 'Revenue',
      name: 'Revenue',
      formula: 'Price * Quantity',
      dependencies: ['Price', 'Quantity'],
    });

    engine.addBlock({
      id: 'Tax',
      name: 'Tax',
      formula: 'Revenue * 0.15',
      dependencies: ['Revenue'],
    });

    engine.addBlock({
      id: 'NetRevenue',
      name: 'Net Revenue',
      formula: 'Revenue - Tax',
      dependencies: ['Revenue', 'Tax'],
    });

    let results = engine.recalculate(['Revenue']);
    expect(results.get('Revenue')).toBe(5000);
    expect(results.get('Tax')).toBe(750);
    expect(results.get('NetRevenue')).toBe(4250);

    engine.setCellValue('Price', 120);
    results = engine.recalculate(['Revenue']);
    expect(results.get('Revenue')).toBe(6000);
    expect(results.get('Tax')).toBe(900);
    expect(results.get('NetRevenue')).toBe(5100);
  });
});
