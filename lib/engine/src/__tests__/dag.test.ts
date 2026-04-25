import { describe, it, expect } from 'vitest';
import { DAGManager, CyclicDependencyError } from '../dag/index.js';

describe('DAGManager', () => {
  it('adds nodes and tracks dependencies', () => {
    const dag = new DAGManager();
    dag.addNode('GrossProfit', 'Revenue - COGS', ['Revenue', 'COGS']);
    expect(dag.getDependencies('GrossProfit')).toEqual(['Revenue', 'COGS']);
    expect(dag.getDependents('Revenue')).toEqual(['GrossProfit']);
    expect(dag.getDependents('COGS')).toEqual(['GrossProfit']);
  });

  it('returns topological recalculation order', () => {
    const dag = new DAGManager();
    dag.addNode('Revenue', '', []);
    dag.addNode('COGS', '', []);
    dag.addNode('GrossProfit', 'Revenue - COGS', ['Revenue', 'COGS']);
    dag.addNode('GrossMargin', 'GrossProfit / Revenue', ['GrossProfit', 'Revenue']);

    dag.markDirty('Revenue');
    const order = dag.getRecalculationOrder();

    const gpIdx = order.indexOf('GrossProfit');
    const gmIdx = order.indexOf('GrossMargin');
    expect(gpIdx).toBeLessThan(gmIdx);
  });

  it('marks dependents as dirty', () => {
    const dag = new DAGManager();
    dag.addNode('A', '', []);
    dag.addNode('B', 'A + 1', ['A']);
    dag.addNode('C', 'B * 2', ['B']);
    dag.addNode('D', 'C + A', ['C', 'A']);

    const dirty = dag.markDirty('A');
    expect(dirty).toContain('A');
    expect(dirty).toContain('B');
    expect(dirty).toContain('C');
    expect(dirty).toContain('D');
  });

  it('detects cyclic dependencies', () => {
    const dag = new DAGManager();
    dag.addNode('A', 'B + 1', ['B']);
    dag.addNode('B', 'C + 1', ['C']);
    dag.addNode('C', 'A + 1', ['A']);

    dag.markDirty('A');
    expect(() => dag.getRecalculationOrder()).toThrow(CyclicDependencyError);
  });

  it('removes nodes cleanly', () => {
    const dag = new DAGManager();
    dag.addNode('A', '', []);
    dag.addNode('B', 'A + 1', ['A']);
    dag.removeNode('B');
    expect(dag.getDependents('A')).toEqual([]);
    expect(dag.size).toBe(1);
  });

  it('updates dependencies when formula changes', () => {
    const dag = new DAGManager();
    dag.addNode('A', '', []);
    dag.addNode('B', '', []);
    dag.addNode('C', 'A + 1', ['A']);

    expect(dag.getDependencies('C')).toEqual(['A']);

    dag.addNode('C', 'B * 2', ['B']);
    expect(dag.getDependencies('C')).toEqual(['B']);
    expect(dag.getDependents('A')).toEqual([]);
    expect(dag.getDependents('B')).toEqual(['C']);
  });

  it('handles complex DAG with diamond dependencies', () => {
    const dag = new DAGManager();
    dag.addNode('Revenue', '', []);
    dag.addNode('COGS', '', []);
    dag.addNode('OpEx', '', []);
    dag.addNode('GrossProfit', 'Revenue - COGS', ['Revenue', 'COGS']);
    dag.addNode('EBITDA', 'GrossProfit - OpEx', ['GrossProfit', 'OpEx']);
    dag.addNode('GrossMargin', 'GrossProfit / Revenue', ['GrossProfit', 'Revenue']);
    dag.addNode('EBITDAMargin', 'EBITDA / Revenue', ['EBITDA', 'Revenue']);

    dag.markDirty('Revenue');
    const order = dag.getRecalculationOrder();

    expect(order.indexOf('GrossProfit')).toBeLessThan(order.indexOf('EBITDA'));
    expect(order.indexOf('GrossProfit')).toBeLessThan(order.indexOf('GrossMargin'));
    expect(order.indexOf('EBITDA')).toBeLessThan(order.indexOf('EBITDAMargin'));
  });
});
