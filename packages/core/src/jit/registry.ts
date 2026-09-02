import { NormalizedOperation } from '../parser/types.js';
import { BM25ToolIndex } from './indexer.js';

export interface ToolRegistryOptions {
  forceJIT?: boolean;
  maxMountedTools?: number; // LRU capacity (default: 10)
}

export class ToolRegistry {
  private allOperations: Map<string, NormalizedOperation> = new Map();
  private activeOperations: Map<string, NormalizedOperation> = new Map();
  private mountedOrder: string[] = [];
  private index: BM25ToolIndex;
  private isJITMode: boolean = false;
  private maxMountedTools: number;
  private onToolsChangedCallback?: () => void;

  constructor(operations: NormalizedOperation[], options?: ToolRegistryOptions | boolean) {
    for (const op of operations) {
      this.allOperations.set(op.id, op);
    }

    this.index = new BM25ToolIndex(operations);

    const forceJIT = typeof options === 'boolean' ? options : options?.forceJIT;
    this.maxMountedTools = (typeof options === 'object' && options.maxMountedTools) ? options.maxMountedTools : 10;

    // Adaptive threshold: <= 20 static tools, > 20 JIT mode
    if (forceJIT !== undefined) {
      this.isJITMode = forceJIT;
    } else {
      this.isJITMode = operations.length > 20;
    }

    if (!this.isJITMode) {
      // In static mode, all operations are active
      for (const op of operations) {
        this.activeOperations.set(op.id, op);
        this.mountedOrder.push(op.id);
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

  private promoteTool(id: string): void {
    const idx = this.mountedOrder.indexOf(id);
    if (idx !== -1) {
      this.mountedOrder.splice(idx, 1);
      this.mountedOrder.push(id);
    }
  }

  /**
   * Retrieves an operation only if it is currently accessible.
   * In JIT mode, unmounted operations are strictly inaccessible.
   * Promotes the accessed tool to the MRU position (true LRU).
   */
  public getOperation(id: string): NormalizedOperation | undefined {
    if (!this.isJITMode) {
      return this.allOperations.get(id);
    }
    const op = this.activeOperations.get(id);
    if (op) {
      this.promoteTool(id);
    }
    return op;
  }

  public isOperationMounted(id: string): boolean {
    return this.activeOperations.has(id);
  }

  public onToolsChanged(cb: () => void): void {
    this.onToolsChangedCallback = cb;
  }

  public mountToolsByQuery(query: string, tag?: string, limit: number = 5): NormalizedOperation[] {
    const matched = this.index.search(query, tag, limit);
    // Only mount up to maxMountedTools best matches so lower ranked results don't evict higher ranked results
    const toolsToMount = matched.slice(0, this.maxMountedTools);
    let changed = false;

    for (const op of toolsToMount) {
      if (this.activeOperations.has(op.id)) {
        // Promote already mounted tool in LRU order
        this.promoteTool(op.id);
      } else {
        // Enforce LRU capacity limit
        while (this.mountedOrder.length >= this.maxMountedTools) {
          const evictedId = this.mountedOrder.shift();
          if (evictedId) {
            this.activeOperations.delete(evictedId);
          }
        }

        this.activeOperations.set(op.id, op);
        this.mountedOrder.push(op.id);
        changed = true;
      }
    }

    if (changed && this.onToolsChangedCallback) {
      this.onToolsChangedCallback();
    }

    return toolsToMount.filter((op) => this.activeOperations.has(op.id));
  }

  public unmountTool(id: string): boolean {
    if (this.activeOperations.delete(id)) {
      this.mountedOrder = this.mountedOrder.filter((item) => item !== id);
      if (this.onToolsChangedCallback) {
        this.onToolsChangedCallback();
      }
      return true;
    }
    return false;
  }

  public resetActiveTools(): void {
    if (this.isJITMode) {
      this.activeOperations.clear();
      this.mountedOrder = [];
      if (this.onToolsChangedCallback) {
        this.onToolsChangedCallback();
      }
    }
  }
}
