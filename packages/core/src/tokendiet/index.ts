import { pruneNullsAndNoise } from './prune.js';
import { arrayToMarkdownTable, isHomogeneousObjectArray } from './table.js';
import { applyFieldMask } from './mask.js';

export * from './prune.js';
export * from './table.js';
export * from './mask.js';

export interface TokenDietOptions {
  enabled?: boolean;
  fieldMasks?: string[];
  maxTokens?: number; // default: 2500
  convertToMarkdownTable?: boolean; // default: true
}

export interface TokenDietResult {
  text: string;
  structured: any;
  rawEstimatedTokens: number;
  dietEstimatedTokens: number;
  savingsPercentage: number;
  isTruncated: boolean;
}

export function estimateTokenCount(str: string): number {
  return Math.ceil(str.length / 3.8);
}

export function applyTokenDiet(data: any, options: TokenDietOptions = {}): TokenDietResult {
  const enabled = options.enabled !== false;
  const maxTokens = options.maxTokens || 2500;
  const convertToMarkdown = options.convertToMarkdownTable !== false;

  const rawJson = JSON.stringify(data, null, 2) || '';
  const rawEstimatedTokens = estimateTokenCount(rawJson);

  if (!enabled || !data) {
    return {
      text: rawJson,
      structured: data,
      rawEstimatedTokens,
      dietEstimatedTokens: rawEstimatedTokens,
      savingsPercentage: 0,
      isTruncated: false,
    };
  }

  // 1. Apply field mask if specified
  let processed = options.fieldMasks ? applyFieldMask(data, options.fieldMasks) : data;

  // 2. Prune nulls and boilerplate noise
  processed = pruneNullsAndNoise(processed);

  // 3. Format into text output
  let textOutput = '';
  let isTruncated = false;

  if (Array.isArray(processed) && convertToMarkdown && isHomogeneousObjectArray(processed)) {
    textOutput = arrayToMarkdownTable(processed);
  } else if (
    processed &&
    typeof processed === 'object' &&
    Array.isArray(processed.data) &&
    convertToMarkdown &&
    isHomogeneousObjectArray(processed.data)
  ) {
    // Common REST pattern: { data: [...], total: 100 }
    const { data: list, ...rest } = processed;
    const header = Object.keys(rest).length > 0 ? `**Metadata:** ${JSON.stringify(rest)}\n\n` : '';
    textOutput = header + arrayToMarkdownTable(list);
  } else {
    textOutput = typeof processed === 'string' ? processed : JSON.stringify(processed, null, 2);
  }

  // 4. Check token ceiling & truncate if needed
  let dietTokens = estimateTokenCount(textOutput);
  if (dietTokens > maxTokens) {
    isTruncated = true;
    const maxChars = Math.floor(maxTokens * 3.8);
    textOutput =
      textOutput.slice(0, maxChars) +
      `\n\n... [Response capped at ~${maxTokens} tokens. Use specific filters or pagination to view additional records.]`;
    dietTokens = maxTokens;
  }

  const savingsPercentage =
    rawEstimatedTokens > 0
      ? Math.max(0, Math.round(((rawEstimatedTokens - dietTokens) / rawEstimatedTokens) * 100))
      : 0;

  return {
    text: textOutput,
    structured: processed,
    rawEstimatedTokens,
    dietEstimatedTokens: dietTokens,
    savingsPercentage,
    isTruncated,
  };
}
