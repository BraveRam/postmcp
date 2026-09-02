import { NormalizedOperation, RiskTier, MacroDefinition } from '../parser/types.js';

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

export function getMacroAnnotations(macro: MacroDefinition): ToolAnnotations {
  const destructiveRegex = /(delete|drop|purge|cancel|terminate|refund|transfer|destroy|wipe|revoke|admin|billing|auth)/i;
  let hasDestructive = destructiveRegex.test(macro.name) || destructiveRegex.test(macro.description);
  let hasMutation = false;
  let allIdempotent = true;

  for (const step of macro.steps) {
    const action = step.action.trim();
    const method = action.split(/\s+/)[0]?.toLowerCase() || 'get';

    if (method === 'delete' || destructiveRegex.test(action)) {
      hasDestructive = true;
    }

    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      hasMutation = true;
    }

    if (method === 'post' || method === 'patch') {
      allIdempotent = false;
    }
  }

  if (hasDestructive) {
    return {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    };
  }

  if (hasMutation) {
    return {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: allIdempotent,
    };
  }

  // READ_ONLY macro
  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  };
}
