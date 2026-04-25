export interface DependencyNode {
  id: string;
  formula: string;
  dependsOn: Set<string>;
  dependedBy: Set<string>;
  isDirty: boolean;
  lastValue: unknown;
}

export class CyclicDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`Cyclic dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CyclicDependencyError';
  }
}

export class DAGManager {
  private nodes = new Map<string, DependencyNode>();

  addNode(id: string, formula: string, dependencies: string[]): void {
    const existing = this.nodes.get(id);

    if (existing) {
      for (const dep of existing.dependsOn) {
        this.nodes.get(dep)?.dependedBy.delete(id);
      }
    }

    const node: DependencyNode = {
      id,
      formula,
      dependsOn: new Set(dependencies),
      dependedBy: existing?.dependedBy ?? new Set(),
      isDirty: true,
      lastValue: existing?.lastValue ?? null,
    };

    this.nodes.set(id, node);

    for (const dep of dependencies) {
      let depNode = this.nodes.get(dep);
      if (!depNode) {
        depNode = {
          id: dep,
          formula: '',
          dependsOn: new Set(),
          dependedBy: new Set(),
          isDirty: false,
          lastValue: null,
        };
        this.nodes.set(dep, depNode);
      }
      depNode.dependedBy.add(id);
    }
  }

  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    for (const dep of node.dependsOn) {
      this.nodes.get(dep)?.dependedBy.delete(id);
    }

    for (const dependent of node.dependedBy) {
      this.nodes.get(dependent)?.dependsOn.delete(id);
    }

    this.nodes.delete(id);
  }

  markDirty(id: string): Set<string> {
    const dirty = new Set<string>();
    const queue = [id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (dirty.has(current)) continue;

      const node = this.nodes.get(current);
      if (!node) continue;

      node.isDirty = true;
      dirty.add(current);

      for (const dependent of node.dependedBy) {
        if (!dirty.has(dependent)) {
          queue.push(dependent);
        }
      }
    }

    return dirty;
  }

  getRecalculationOrder(dirtyIds?: Set<string>): string[] {
    const targets = dirtyIds ?? new Set(
      [...this.nodes.values()].filter(n => n.isDirty).map(n => n.id)
    );

    if (targets.size === 0) return [];

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const order: string[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (inStack.has(id)) {
        const cycle = [...inStack, id];
        const start = cycle.indexOf(id);
        throw new CyclicDependencyError(cycle.slice(start));
      }

      inStack.add(id);
      const node = this.nodes.get(id);
      if (node) {
        for (const dep of node.dependsOn) {
          visit(dep);
        }
      }
      inStack.delete(id);
      visited.add(id);

      if (targets.has(id)) {
        order.push(id);
      }
    };

    for (const id of targets) {
      visit(id);
    }

    return order;
  }

  getDependencies(id: string): string[] {
    return [...(this.nodes.get(id)?.dependsOn ?? [])];
  }

  getDependents(id: string): string[] {
    return [...(this.nodes.get(id)?.dependedBy ?? [])];
  }

  getNode(id: string): DependencyNode | undefined {
    return this.nodes.get(id);
  }

  setNodeValue(id: string, value: unknown): void {
    const node = this.nodes.get(id);
    if (node) {
      node.lastValue = value;
      node.isDirty = false;
    }
  }

  getAllNodes(): Map<string, DependencyNode> {
    return new Map(this.nodes);
  }

  clear(): void {
    this.nodes.clear();
  }

  get size(): number {
    return this.nodes.size;
  }
}
