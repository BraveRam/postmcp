/**
 * Safe JSON Schema / OpenAPI $ref dereferencer with circular reference protection.
 */

function resolvePointer(root: any, pointer: string): any {
  if (!pointer.startsWith('#/')) {
    return null; // Remote URLs resolved at pre-fetch phase
  }

  const parts = pointer.slice(2).split('/').map(decodeURIComponent);
  let current = root;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return null;
    }
    current = current[part];
  }

  return current;
}

export function dereferenceSpec(rawDoc: any): any {
  const root = JSON.parse(JSON.stringify(rawDoc)); // Clone to avoid mutation
  const visitedPaths = new Map<string, number>();

  function walk(node: any, currentPath: string = '#'): any {
    if (node === null || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item, index) => walk(item, `${currentPath}/${index}`));
    }

    // Handle $ref
    if (typeof node.$ref === 'string') {
      const ref = node.$ref;
      const visits = visitedPaths.get(ref) || 0;

      // Circular reference protection: terminate at depth 2
      if (visits >= 2) {
        return {
          type: 'object',
          description: `Recursive self-reference to ${ref}`,
          additionalProperties: true,
        };
      }

      const target = resolvePointer(root, ref);
      if (!target) {
        return {
          type: 'object',
          description: `Unresolved reference to ${ref}`,
          additionalProperties: true,
        };
      }

      visitedPaths.set(ref, visits + 1);
      const resolved = walk(target, ref);
      visitedPaths.set(ref, visits); // backtrack

      // Merge remaining properties alongside $ref
      const { $ref: _, ...rest } = node;
      return { ...resolved, ...walk(rest, currentPath) };
    }

    // Handle object properties
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = walk(value, `${currentPath}/${key}`);
    }
    return result;
  }

  return walk(root);
}
