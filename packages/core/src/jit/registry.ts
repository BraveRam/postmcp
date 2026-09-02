import { NormalizedOperation } from '../parser/types.js';
import { BM25ToolIndex } from './indexer.js';

export class ToolRegistry {
  private allOperations: Map<string, NormalizedOperation> = new Map();
  private activeOperations: Map<string, NormalizedOperation> = new Map();
  private index: BM25ToolIndex;
  private isJITMode: boolean = false;
  private onToolsChangedCallback?: () => void;

  constructor(operations: NormalizedOperation[], forceJIT?: boolean) {
    for (const op of operations) {
      this.allOperations.set(op.id, op);
    }

    this.index = new BM25ToolIndex(operations);

    // Adaptive threshold: <= 20 static tools, > 20 JIT mode
    if (forceJIT !== undefined) {
      this.isJITMode = forceJIT;
    } else {
      this.isJITMode = operations.length > 20;
    }

    if (!this.isJITMode) {
      // Register all operations statically
      for (const op of operations) {
        this.activeOperations.set(op.id, op);
      }
    }
  }

  public getIsJIT(): boolean {
    return this.isJITMode;
  }

  public getAllOperations(): NormalizedOperation[] {
    return Array.from(this.allOperations.values());
  }

  public getActiveOperations(): NormalizedOperation[] {
    return Array.from(this.activeOperations.values());
  }

  public getOperation(id: string): NormalizedOperation | undefined {
    return this.allOperations.get(id);
  }

  public onToolsChanged(cb: () => void): void {
    this.onToolsChangedCallback = cb;
  }

  public mountToolsByQuery(query: string, tag?: string, limit: number = 5): NormalizedOperation[] {
    const matched = this.index.search(query, tag, limit);
    let changed = false;

    for (const op of matched) {
      if (!this.activeOperations.has(op.id)) {
        this.activeOperations.set(op.id, op);
        changed = true;
      }
    }

    if (changed && this.onToolsChangedCallback) {
      this.onToolsChangedCallback();
    }

    return matched;
  }
}
