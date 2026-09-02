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
  maxProseLength?: number; // default: 1000
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
  if (!str) return 0;
  return Math.ceil(str.length / 3.8);
}

export function applyTokenDiet(data: any, options: TokenDietOptions = {}): TokenDietResult {
  const enabled = options.enabled !== false;
  const maxTokens = options.maxTokens || 2500;
  const convertToMarkdown = options.convertToMarkdownTable !== false;
  const maxProseLength = options.maxProseLength || 1000;

  let rawJson = '';
  try {
    rawJson = data !== undefined ? JSON.stringify(data, null, 2) || '' : '{}';
  } catch {
    rawJson = String(data);
  }
  const rawEstimatedTokens = estimateTokenCount(rawJson);

  if (!enabled || data === undefined) {
    return {
      text: rawJson || '{}',
      structured: data ?? {},
      rawEstimatedTokens,
      dietEstimatedTokens: rawEstimatedTokens,
      savingsPercentage: 0,
      isTruncated: false,
    };
  }

  // 1. Apply field mask if specified
  let processed = options.fieldMasks ? applyFieldMask(data, options.fieldMasks) : data;

  // 2. Prune nulls and boilerplate noise
  processed = pruneNullsAndNoise(processed, maxProseLength);

  // If pruning reduced the entire payload to undefined, handle safely (Finding 16)
  if (processed === undefined) {
    return {
      text: '{}',
      structured: {},
      rawEstimatedTokens,
      dietEstimatedTokens: estimateTokenCount('{}'),
      savingsPercentage: rawEstimatedTokens > 0 ? 99 : 0,
      isTruncated: false,
    };
  }

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

  // 4. Strictly enforce token ceiling (Finding 18)
  const maxChars = Math.floor(maxTokens * 3.8);
  if (textOutput.length > maxChars) {
    isTruncated = true;
    const suffix = `\n\n... [Response capped at ~${maxTokens} tokens. Use pagination or filters to view more.]`;
    const sliceLen = Math.max(0, maxChars - suffix.length);
    textOutput = textOutput.slice(0, sliceLen) + suffix;
  }

  const dietTokens = estimateTokenCount(textOutput);
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
