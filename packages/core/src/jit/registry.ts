import { NormalizedOperation } from '../parser/types.js';
import { BM25ToolIndex } from './indexer.js';

export interface ToolRegistryOptions {
  forceJIT?: boolean;
  maxMountedTools?: number; // LRU capacity (default: 10)
  hotToolKeywords?: string[];
}

export class ToolRegistry {
  private allOperations: Map<string, NormalizedOperation> = new Map();
  private activeOperations: Map<string, NormalizedOperation> = new Map();
  private mountedOrder: string[] = [];
  private index: BM25ToolIndex;
  private isJITMode: boolean = false;
  private maxMountedTools: number;
  private hotToolKeywords: string[] = [];
  private onToolsChangedCallback?: () => void;

  constructor(operations: NormalizedOperation[], options?: ToolRegistryOptions | boolean) {
    for (const op of operations) {
      this.allOperations.set(op.id, op);
    }

    this.index = new BM25ToolIndex(operations);

    const forceJIT = typeof options === 'boolean' ? options : options?.forceJIT;
    this.maxMountedTools = (typeof options === 'object' && options.maxMountedTools) ? options.maxMountedTools : 10;
    if (typeof options === 'object' && Array.isArray(options.hotToolKeywords)) {
      this.hotToolKeywords = options.hotToolKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
    }

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
    } else {
      // Hybrid JIT: Pre-mount top root collection read operations ("Hot Tools") on startup
      const hotTools = this.identifyHotTools(operations);
      for (const op of hotTools) {
        if (this.activeOperations.size >= this.maxMountedTools) break;
        this.activeOperations.set(op.id, op);
        this.mountedOrder.push(op.id);
      }
    }
  }

  private identifyHotTools(operations: NormalizedOperation[]): NormalizedOperation[] {
    // 1. Derive domain keywords dynamically from OpenAPI specification tags
    const tagFrequencies = new Map<string, number>();
    for (const op of operations) {
      if (Array.isArray(op.tags)) {
        for (const rawTag of op.tags) {
          const t = rawTag.trim().toLowerCase();
          if (t && !['default', 'api', 'v1', 'v2', 'v3', 'maintenance', 'health', 'ping'].includes(t)) {
            tagFrequencies.set(t, (tagFrequencies.get(t) || 0) + 1);
          }
        }
      }
    }

    let maxTagFreq = 1;
    for (const freq of tagFrequencies.values()) {
      if (freq > maxTagFreq) maxTagFreq = freq;
    }

    const derivedTagKeywords = new Map<string, number>();
    for (const [tag, freq] of tagFrequencies.entries()) {
      derivedTagKeywords.set(tag, freq);
      const parts = tag.split(/[-_\s]+/).filter((p) => p.length > 2);
      for (const p of parts) {
        if (!derivedTagKeywords.has(p)) {
          derivedTagKeywords.set(p, freq);
        }
      }
    }

    // 2. Candidate filtering
    const candidates = operations.filter((op) => {
      if (op.method !== 'get') return false;
      if (op.riskTier === 'CRITICAL') return false;
      // Exclude paths with path parameters like /projects/{id}
      if (op.path.includes('{')) return false;

      // Explicit vendor extension override: if marked x-hot-tool: true or x-mcp-hot: true, include even if segments > 2
      const isExplicitHot =
        op.extensions?.['x-hot-tool'] === true ||
        op.extensions?.['x-mcp-hot'] === true ||
        op.extensions?.['x-postmcp-hot'] === true;

      if (!isExplicitHot) {
        const segments = op.path.split('/').filter(Boolean);
        if (segments.length > 2) return false;
      }
      return true;
    });

    const defaultFallbackKeywords = [
      'project', 'repo', 'issue', 'charge', 'user', 'me', 'account', 'org', 'team'
    ];

    // 3. Multi-tier scoring
    const scored = candidates.map((op) => {
      let priority = 0;
      const lower = (op.id + ' ' + op.path + ' ' + op.summary).toLowerCase();
      const opTagsLower = (op.tags || []).map((t) => t.toLowerCase());

      // Tier 1: Explicit Vendor Extensions
      const isExplicitHot =
        op.extensions?.['x-hot-tool'] === true ||
        op.extensions?.['x-mcp-hot'] === true ||
        op.extensions?.['x-postmcp-hot'] === true ||
        op.extensions?.['x-priority'] === 'high' ||
        op.extensions?.['x-priority'] === 'critical';

      const isExplicitCold =
        op.extensions?.['x-hot-tool'] === false ||
        op.extensions?.['x-mcp-hot'] === false ||
        op.extensions?.['x-priority'] === 'low';

      if (isExplicitHot) priority += 50;
      if (isExplicitCold) priority -= 100;

      // Tier 2: Configured Hot-Tool Keywords
      if (this.hotToolKeywords.length > 0) {
        for (const kw of this.hotToolKeywords) {
          if (lower.includes(kw) || opTagsLower.some((t) => t.includes(kw))) {
            priority += 30;
            break;
          }
        }
      }

      // Tier 3: Dynamic Spec-Derived Tag Keywords (weighted by relative frequency)
      if (derivedTagKeywords.size > 0) {
        let bestTagScore = 0;
        for (const [tagKw, freq] of derivedTagKeywords.entries()) {
          if (opTagsLower.includes(tagKw) || lower.includes(tagKw)) {
            const weight = Math.round(20 * (freq / maxTagFreq));
            if (weight > bestTagScore) {
              bestTagScore = weight;
            }
          }
        }
        priority += bestTagScore;
      }

      // Tier 4: Structural & Semantic Heuristics
      if (lower.includes('list') || lower.includes('get') || lower.includes('all')) {
        priority += 10;
      }
      if (op.path.split('/').filter(Boolean).length === 1) {
        priority += 15;
      }

      // Tier 5: Fallback CRUD Keywords
      for (const kw of defaultFallbackKeywords) {
        if (lower.includes(kw) || opTagsLower.some((t) => t.includes(kw))) {
          priority += 15;
          break;
        }
      }

      // Deprioritize non-domain diagnostic/healthcheck endpoints from turn-1 hot tools
      if (
        lower.includes('health') ||
        lower.includes('ping') ||
        lower.includes('heartbeat') ||
        opTagsLower.includes('maintenance') ||
        opTagsLower.includes('health')
      ) {
        priority -= 15;
      }

      return { op, priority };
    });

    scored.sort((a, b) => b.priority - a.priority);
    const limit = Math.min(6, this.maxMountedTools);
    return scored
      .filter((s) => s.priority > 0)
      .slice(0, limit)
      .map((s) => s.op);
  }

  public getIsJIT(): boolean {
    return this.isJITMode;
  }

  public getAllOperations(): NormalizedOperation[] {
    return Array.from(this.allOperations.values());
  }

  public getActiveOperations(): NormalizedOperation[] {
    return this.mountedOrder.map((id) => this.activeOperations.get(id)!).filter(Boolean);
  }

  private promoteTool(id: string): void {
    const idx = this.mountedOrder.indexOf(id);
    if (idx !== -1) {
      this.mountedOrder.splice(idx, 1);
      this.mountedOrder.push(id);
    }
    const op = this.activeOperations.get(id);
    if (op) {
      this.activeOperations.delete(id);
      this.activeOperations.set(id, op);
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
