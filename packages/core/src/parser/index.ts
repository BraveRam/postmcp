import YAML from 'yaml';
import axios from 'axios';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { dereferenceSpec } from './dereference.js';
import { normalizeSpec } from './normalizer.js';
import { NormalizedSpec, ParseOpenApiOptions } from './types.js';
import { readCachedSpec, writeCachedSpec } from './cache.js';

export * from './types.js';
export * from './cache.js';
export { dereferenceSpec } from './dereference.js';
export { normalizeSpec } from './normalizer.js';

export async function parseOpenAPI(
  input: string | object,
  basePathOrOptions?: string | ParseOpenApiOptions,
  options?: ParseOpenApiOptions
): Promise<NormalizedSpec> {
  const actualBasePath = typeof basePathOrOptions === 'string' ? basePathOrOptions : undefined;
  const actualOptions: ParseOpenApiOptions =
    typeof basePathOrOptions === 'object' && basePathOrOptions !== null
      ? basePathOrOptions
      : options || {};

  let rawDoc: unknown;
  let detectedBasePath = actualBasePath;

  if (typeof input === 'object' && input !== null) {
    rawDoc = input;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const isCacheDisabled =
        actualOptions.noCache === true ||
        process.env.POSTMCP_NO_CACHE === '1' ||
        process.env.POSTMCP_NO_CACHE === 'true';

      const isRefreshRequested =
        actualOptions.refresh === true ||
        process.env.POSTMCP_REFRESH_CACHE === '1' ||
        process.env.POSTMCP_REFRESH_CACHE === 'true';

      // 1. Check local disk cache first if caching is enabled and refresh not requested
      if (!isCacheDisabled && !isRefreshRequested) {
        const cached = await readCachedSpec(trimmed, actualOptions.cacheDir);
        if (cached && cached.content) {
          try {
            rawDoc = JSON.parse(cached.content);
          } catch {
            rawDoc = YAML.parse(cached.content);
          }
        }
      }

      // 2. If not found in cache or refresh requested, fetch from remote URL
      if (!rawDoc) {
        try {
          const response = await axios.get(trimmed, {
            headers: {
              'Accept': 'application/json, application/yaml, text/yaml, */*',
              'User-Agent': 'PostMCP/0.1.37 (https://github.com/BraveRam/postmcp)',
            },
            responseType: 'text',
          });

          const rawText = String(response.data);
          try {
            rawDoc = JSON.parse(rawText);
          } catch {
            rawDoc = YAML.parse(rawText);
          }

          // Cache on successful fetch if caching enabled
          if (!isCacheDisabled) {
            const etag = typeof response.headers?.etag === 'string' ? response.headers.etag : undefined;
            await writeCachedSpec(trimmed, rawText, actualOptions.cacheDir, etag).catch(() => {
              // Cache write error is non-fatal
            });
          }
        } catch (fetchErr: unknown) {
          // 3. Graceful offline fallback: if network fails, check if an older cached version exists
          if (!isCacheDisabled) {
            const fallback = await readCachedSpec(trimmed, actualOptions.cacheDir);
            if (fallback && fallback.content) {
              const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
              console.warn(
                `Warning: Failed to fetch remote spec from ${trimmed} (${errMsg}). Using locally cached version.`
              );
              try {
                rawDoc = JSON.parse(fallback.content);
              } catch {
                rawDoc = YAML.parse(fallback.content);
              }
            }
          }

          if (!rawDoc) {
            throw fetchErr;
          }
        }
      }
    } else if (
      trimmed.startsWith('{') ||
      trimmed.startsWith('[') ||
      trimmed.includes('openapi:') ||
      trimmed.includes('swagger:')
    ) {
      try {
        rawDoc = JSON.parse(trimmed);
      } catch {
        rawDoc = YAML.parse(trimmed);
      }
    } else {
      // Local file path resolution with workspace fallback
      const candidates = [
        actualBasePath ? path.resolve(actualBasePath, trimmed) : null,
        path.resolve(/*turbopackIgnore: true*/ process.cwd(), trimmed),
        process.env.POSTMCP_WORKSPACE ? path.resolve(process.env.POSTMCP_WORKSPACE, trimmed) : null,
        path.resolve(trimmed),
      ].filter(Boolean) as string[];

      let foundPath: string | null = null;
      for (const cand of candidates) {
        try {
          await fs.access(cand);
          foundPath = cand;
          break;
        } catch {
          // Continue search
        }
      }

      if (!foundPath) {
        throw new Error(`OpenAPI specification file not found: '${trimmed}'`);
      }

      detectedBasePath = path.dirname(foundPath);
      const content = await fs.readFile(/*turbopackIgnore: true*/ foundPath, 'utf-8');
      try {
        rawDoc = JSON.parse(content);
      } catch {
        rawDoc = YAML.parse(content);
      }
    }
  } else {
    throw new Error('Invalid OpenAPI spec input. Must be a string (URL, file path, JSON/YAML) or an object.');
  }

  // If the document is already a NormalizedSpec, return directly
  if (
    rawDoc &&
    typeof rawDoc === 'object' &&
    'operations' in rawDoc &&
    Array.isArray((rawDoc as Record<string, unknown>).operations) &&
    !('paths' in rawDoc)
  ) {
    return rawDoc as NormalizedSpec;
  }

  const dereferenced = await dereferenceSpec(rawDoc, detectedBasePath);
  return normalizeSpec(dereferenced as Record<string, unknown>);
}
