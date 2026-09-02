export interface TokenDietOptions {
  enabled?: boolean;
  fieldMasks?: string[];
  pathFieldMasks?: Record<string, string[]>;
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
