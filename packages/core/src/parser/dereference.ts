import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';

/**
 * Safe RFC 6901 JSON Schema / OpenAPI $ref dereferencer with circular reference protection.
 */

function decodeJsonPointerPart(part: string): string {
  // RFC 6901: ~1 decodes to /, ~0 decodes to ~
  return decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~');
}

function resolvePointer(root: any, pointer: string): any {
  if (pointer === '#' || pointer === '') {
    return root;
  }

  if (!pointer.startsWith('#/')) {
    return null;
  }

  const parts = pointer.slice(2).split('/').map(decodeJsonPointerPart);
  let current = root;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return null;
    }
    current = current[part];
  }

  return current;
}

export function dereferenceSpec(rawDoc: any, basePath?: string): any {
  const root = JSON.parse(JSON.stringify(rawDoc)); // Clone
  const visitedPaths = new Map<string, number>();
  const externalDocCache = new Map<string, any>();

  function loadExternalFile(filePath: string): any {
    if (externalDocCache.has(filePath)) {
      return externalDocCache.get(filePath);
    }
    const resolvedPath = basePath ? path.resolve(basePath, filePath) : path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`External $ref file not found: ${filePath} (resolved: ${resolvedPath})`);
    }
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = YAML.parse(content);
    }
    externalDocCache.set(filePath, parsed);
    return parsed;
  }

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

      let target: any = null;

      if (ref.startsWith('#/')) {
        target = resolvePointer(root, ref);
      } else if (ref.includes('#/')) {
        // File reference with pointer: e.g. "./schemas.yaml#/User"
        const [filePart, pointerPart] = ref.split('#');
        try {
          const extDoc = loadExternalFile(filePart);
          target = resolvePointer(extDoc, `#${pointerPart}`);
        } catch (err: any) {
          throw new Error(`Failed to dereference external $ref '${ref}': ${err.message}`);
        }
      } else if (!ref.startsWith('http://') && !ref.startsWith('https://')) {
        // Entire file reference: e.g. "./models.json"
        try {
          target = loadExternalFile(ref);
        } catch (err: any) {
          throw new Error(`Failed to dereference external $ref '${ref}': ${err.message}`);
        }
      }

      if (!target) {
        throw new Error(`Unresolvable $ref pointer: '${ref}'`);
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
