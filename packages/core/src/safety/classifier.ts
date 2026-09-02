import { NormalizedOperation, RiskTier } from '../parser/types.js';

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

export function getToolAnnotations(op: NormalizedOperation): ToolAnnotations {
  if (op.riskTier === 'READ_ONLY') {
    return {
      readOnlyHint: true,
      idempotentHint: true,
      destructiveHint: false,
    };
  }

  if (op.riskTier === 'CRITICAL') {
    return {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: op.method === 'delete',
    };
  }

  // MUTATION
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: op.method === 'put',
  };
}
