import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';
import YAML from 'yaml';

/**
 * Safe RFC 6901 JSON Schema / OpenAPI $ref dereferencer with circular reference protection,
 * remote HTTP $ref fetching, and relative nested file resolution.
 */

function decodeJsonPointerPart(part: string): string {
  // RFC 6901: ~1 decodes to /, ~0 decodes to ~
  return decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~');
}

export function resolvePointer(root: any, pointer: string): any {
  if (pointer === '#' || pointer === '' || !pointer) {
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

export async function dereferenceSpec(rawDoc: any, basePath?: string): Promise<any> {
  const root = JSON.parse(JSON.stringify(rawDoc)); // Clone
  const visitedPaths = new Map<string, number>();
  const docCache = new Map<string, { doc: any; base: string }>();

  async function loadDoc(uriOrPath: string, currentBase?: string): Promise<{ doc: any; base: string }> {
    // Check if remote URL
    const isRemote =
      uriOrPath.startsWith('http://') ||
      uriOrPath.startsWith('https://') ||
      (currentBase && (currentBase.startsWith('http://') || currentBase.startsWith('https://')));

    if (isRemote) {
      let fullUrl = uriOrPath;
      if (!uriOrPath.startsWith('http://') && !uriOrPath.startsWith('https://') && currentBase) {
        fullUrl = new URL(uriOrPath, currentBase.endsWith('/') ? currentBase : `${currentBase}/`).toString();
      }

      if (docCache.has(fullUrl)) {
        return docCache.get(fullUrl)!;
      }

      const res = await axios.get(fullUrl, {
        headers: { Accept: 'application/json, application/yaml, text/yaml, */*' },
        responseType: 'text',
      });

      let parsed: any;
      try {
        parsed = JSON.parse(res.data);
      } catch {
        parsed = YAML.parse(res.data);
      }

      const newBase = new URL('.', fullUrl).toString();
      const result = { doc: parsed, base: newBase };
      docCache.set(fullUrl, result);
      return result;
    }

    // Local file path
    const resolvedPath = currentBase ? path.resolve(currentBase, uriOrPath) : path.resolve(uriOrPath);
    if (docCache.has(resolvedPath)) {
      return docCache.get(resolvedPath)!;
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`External $ref file not found: ${uriOrPath} (resolved: ${resolvedPath})`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = YAML.parse(content);
    }

    const newBase = path.dirname(resolvedPath);
    const result = { doc: parsed, base: newBase };
    docCache.set(resolvedPath, result);
    return result;
  }

  async function walk(node: any, currentDocRoot: any, currentBase?: string, currentPath: string = '#'): Promise<any> {
    if (node === null || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      return Promise.all(node.map((item, index) => walk(item, currentDocRoot, currentBase, `${currentPath}/${index}`)));
    }

    // Handle $ref
    if (typeof node.$ref === 'string') {
      const ref = node.$ref;
      const scopedRefKey = `${currentBase || 'root'}::${ref}`;
      const visits = visitedPaths.get(scopedRefKey) || 0;

      // Circular reference protection: terminate at depth 2
      if (visits >= 2) {
        return {
          type: 'object',
          description: `Recursive self-reference to ${ref}`,
          additionalProperties: true,
        };
      }

      let target: any = null;
      let targetDocRoot = currentDocRoot;
      let targetBase = currentBase;

      if (ref === '#' || ref.startsWith('#/')) {
        target = resolvePointer(currentDocRoot, ref);
      } else if (ref.includes('#')) {
        const [uriPart, pointerPart] = ref.split('#');
        try {
          const loaded = await loadDoc(uriPart, currentBase);
          const pointer = pointerPart ? (pointerPart.startsWith('/') ? `#${pointerPart}` : `#/${pointerPart}`) : '#';
          target = resolvePointer(loaded.doc, pointer);
          targetDocRoot = loaded.doc;
          targetBase = loaded.base;
        } catch (err: any) {
          throw new Error(`Failed to dereference external $ref '${ref}': ${err.message}`);
        }
      } else {
        // Entire document reference
        try {
          const loaded = await loadDoc(ref, currentBase);
          target = loaded.doc;
          targetDocRoot = loaded.doc;
          targetBase = loaded.base;
        } catch (err: any) {
          throw new Error(`Failed to dereference external $ref '${ref}': ${err.message}`);
        }
      }

      if (target === undefined || target === null) {
        throw new Error(`Unresolvable $ref pointer: '${ref}'`);
      }

      visitedPaths.set(scopedRefKey, visits + 1);
      const resolved = await walk(target, targetDocRoot, targetBase, ref);
      visitedPaths.set(scopedRefKey, visits); // backtrack

      // Merge remaining sibling properties alongside $ref if resolved is an object
      const { $ref: _, ...rest } = node;
      if (Object.keys(rest).length === 0) {
        return resolved;
      }
      const restResolved = await walk(rest, currentDocRoot, currentBase, currentPath);
      if (typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved)) {
        return { ...resolved, ...restResolved };
      }
      return resolved;
    }

    // Handle object properties
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(node)) {
      result[key] = await walk(value, currentDocRoot, currentBase, `${currentPath}/${key}`);
    }
    return result;
  }

  return walk(root, root, basePath);
}
