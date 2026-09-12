import * as fs from 'node:fs';
import * as path from 'node:path';
import axios from 'axios';
import YAML from 'yaml';

/**
 * Safe RFC 6901 JSON Schema / OpenAPI $ref dereferencer with circular reference protection,
 * memoized reference caching, bounded expansion depth, remote HTTP $ref fetching, and relative file resolution.
 */

function decodeJsonPointerPart(part: string): string {
  // RFC 6901: ~1 decodes to /, ~0 decodes to ~
  let decoded = part;
  try {
    decoded = decodeURIComponent(part);
  } catch {
    // Fallback if malformed percent-encoding
  }
  return decoded.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function resolvePointer(root: unknown, pointer: string): unknown {
  if (pointer === '#' || pointer === '' || !pointer) {
    return root;
  }

  if (!pointer.startsWith('#/')) {
    return null;
  }

  const parts = pointer.slice(2).split('/').map(decodeJsonPointerPart);
  let current: unknown = root;

  for (const part of parts) {
    if (current === null || typeof current !== 'object') {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export async function dereferenceSpec(rawDoc: unknown, basePath?: string): Promise<unknown> {
  if (!rawDoc || typeof rawDoc !== 'object') return rawDoc;

  const docCache = new Map<string, { doc: unknown; base: string }>();
  const resolvedCache = new Map<string, unknown>();
  const activeStack = new Set<string>();

  async function loadDoc(uriOrPath: string, currentBase?: string): Promise<{ doc: unknown; base: string }> {
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
        headers: {
          'Accept': 'application/json, application/yaml, text/yaml, */*',
          'User-Agent': 'PostMCP/0.1.26 (https://github.com/BraveRam/postmcp)',
        },
        responseType: 'text',
      });

      let parsed: unknown;
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

    const resolvedPath = currentBase ? path.resolve(currentBase, uriOrPath) : path.resolve(uriOrPath);
    if (docCache.has(resolvedPath)) {
      return docCache.get(resolvedPath)!;
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`External $ref file not found: ${uriOrPath} (resolved: ${resolvedPath})`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');
    let parsed: unknown;
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

  async function walk(
    node: unknown,
    currentDocRoot: unknown,
    currentBase?: string,
    depth: number = 0
  ): Promise<unknown> {
    if (node === null || typeof node !== 'object') {
      return node;
    }

    if (depth > 30) {
      return { type: 'object', additionalProperties: true };
    }

    if (Array.isArray(node)) {
      return Promise.all(node.map((item) => walk(item, currentDocRoot, currentBase, depth + 1)));
    }

    const nodeRecord = node as Record<string, unknown>;

    // Handle $ref
    if (typeof nodeRecord.$ref === 'string') {
      const ref = nodeRecord.$ref;
      const scopedRefKey = `${currentBase || 'root'}::${ref}`;

      // Circular reference protection: Break cycle if currently in call stack
      if (activeStack.has(scopedRefKey)) {
        return {
          type: 'object',
          description: `Recursive self-reference to ${ref}`,
          additionalProperties: true,
        };
      }

      // Memoization: Return previously resolved schema
      if (resolvedCache.has(scopedRefKey)) {
        const cached = resolvedCache.get(scopedRefKey);
        const { $ref: _, ...rest } = nodeRecord;
        if (Object.keys(rest).length === 0) {
          return cached;
        }
        const restResolved = await walk(rest, currentDocRoot, currentBase, depth + 1);
        if (typeof cached === 'object' && cached !== null && !Array.isArray(cached)) {
          return { ...(cached as Record<string, unknown>), ...(restResolved as Record<string, unknown>) };
        }
        return cached;
      }

      let target: unknown = null;
      let targetDocRoot: unknown = currentDocRoot;
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
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Failed to dereference external $ref '${ref}': ${msg}`);
        }
      } else {
        try {
          const loaded = await loadDoc(ref, currentBase);
          target = loaded.doc;
          targetDocRoot = loaded.doc;
          targetBase = loaded.base;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(`Failed to dereference external $ref '${ref}': ${msg}`);
        }
      }

      if (target === undefined || target === null) {
        throw new Error(`Unresolvable $ref pointer: '${ref}'`);
      }

      activeStack.add(scopedRefKey);
      const resolved = await walk(target, targetDocRoot, targetBase, depth + 1);
      activeStack.delete(scopedRefKey);

      // Cache the fully resolved schema
      resolvedCache.set(scopedRefKey, resolved);

      // Merge remaining sibling properties alongside $ref
      const { $ref: _, ...rest } = nodeRecord;
      if (Object.keys(rest).length === 0) {
        return resolved;
      }
      const restResolved = await walk(rest, currentDocRoot, currentBase, depth + 1);
      if (typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved)) {
        return { ...(resolved as Record<string, unknown>), ...(restResolved as Record<string, unknown>) };
      }
      return resolved;
    }

    // Handle object properties
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(nodeRecord)) {
      result[key] = await walk(value, currentDocRoot, currentBase, depth + 1);
    }
    return result;
  }

  return walk(rawDoc, rawDoc, basePath, 0);
}
