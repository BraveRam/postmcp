import { NormalizedOperation } from '../parser/types.js';

interface IndexDoc {
  operation: NormalizedOperation;
  tokens: string[];
  docLength: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

export class BM25ToolIndex {
  private docs: IndexDoc[] = [];
  private avgDocLength: number = 0;
  private idf: Map<string, number> = new Map();
  private k1: number = 1.2;
  private b: number = 0.75;

  constructor(operations: NormalizedOperation[]) {
    this.indexOperations(operations);
  }

  private indexOperations(operations: NormalizedOperation[]): void {
    const docTermFreqs: Map<string, number>[] = [];
    let totalLength = 0;

    for (const op of operations) {
      const docText = [
        op.id,
        op.method,
        op.path,
        op.summary,
        op.description,
        ...op.tags,
        ...op.parameters.map((p) => `${p.name} ${p.description || ''}`),
      ].join(' ');

      const tokens = tokenize(docText);
      const docLength = tokens.length;
      totalLength += docLength;

      const termFreq = new Map<string, number>();
      for (const token of tokens) {
        termFreq.set(token, (termFreq.get(token) || 0) + 1);
      }
      docTermFreqs.push(termFreq);

      this.docs.push({
        operation: op,
        tokens,
        docLength,
      });
    }

    const nDocs = this.docs.length;
    this.avgDocLength = nDocs > 0 ? totalLength / nDocs : 1;

    // Calculate IDF for all unique terms
    const termDocCounts = new Map<string, number>();
    for (const tf of docTermFreqs) {
      for (const term of tf.keys()) {
        termDocCounts.set(term, (termDocCounts.get(term) || 0) + 1);
      }
    }

    for (const [term, count] of termDocCounts.entries()) {
      // Standard BM25 IDF formula
      const idfValue = Math.log((nDocs - count + 0.5) / (count + 0.5) + 1);
      this.idf.set(term, Math.max(0.1, idfValue));
    }
  }

  public search(query: string, tag?: string, limit: number = 5): NormalizedOperation[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return this.docs.slice(0, limit).map((d) => d.operation);
    }

    const scores: Array<{ operation: NormalizedOperation; score: number }> = [];

    for (const doc of this.docs) {
      if (tag && !doc.operation.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        continue;
      }

      let score = 0;
      const termFreqs = new Map<string, number>();
      for (const token of doc.tokens) {
        termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
      }

      for (const qToken of queryTokens) {
        const idf = this.idf.get(qToken) || 0.1;
        let tf = termFreqs.get(qToken) || 0;

        // Stem prefix match (e.g. invoice matches invoices, refund matches refunds)
        if (tf === 0 && qToken.length >= 4) {
          for (const dToken of doc.tokens) {
            if (
              dToken.length >= 4 &&
              (dToken.startsWith(qToken) || qToken.startsWith(dToken))
            ) {
              tf += 0.8;
              break;
            }
          }
        }

        // Exact match boost for operationId and method/path
        let boost = 1.0;
        if (doc.operation.id.toLowerCase().includes(qToken)) boost += 1.5;
        if (doc.operation.path.toLowerCase().includes(qToken)) boost += 1.2;
        if (doc.operation.summary.toLowerCase().includes(qToken)) boost += 1.3;

        if (tf > 0) {
          const numerator = tf * (this.k1 + 1) * boost;
          const denominator = tf + this.k1 * (1 - this.b + this.b * (doc.docLength / this.avgDocLength));
          score += idf * (numerator / (denominator || 1));
        }
      }

      if (score > 0) {
        scores.push({ operation: doc.operation, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, limit).map((s) => s.operation);
  }
}
