import YAML from 'yaml';
import axios from 'axios';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { dereferenceSpec } from './dereference.js';
import { normalizeSpec } from './normalizer.js';
import { NormalizedSpec } from './types.js';

export * from './types.js';
export { dereferenceSpec } from './dereference.js';
export { normalizeSpec } from './normalizer.js';

export async function parseOpenAPI(input: string | object, basePath?: string): Promise<NormalizedSpec> {
  let rawDoc: any;
  let detectedBasePath = basePath;

  if (typeof input === 'object' && input !== null) {
    rawDoc = input;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const response = await axios.get(trimmed, {
        headers: {
          'Accept': 'application/json, application/yaml, text/yaml, */*',
          'User-Agent': 'PostMCP/0.1.0 (https://github.com/BraveRam/postmcp)',
        },
        responseType: 'text',
      });
      try {
        rawDoc = JSON.parse(response.data);
      } catch {
        rawDoc = YAML.parse(response.data);
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
        basePath ? path.resolve(basePath, trimmed) : null,
        path.resolve(process.cwd(), trimmed),
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
      const content = await fs.readFile(foundPath, 'utf-8');
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
  if (rawDoc && typeof rawDoc === 'object' && Array.isArray(rawDoc.operations) && !rawDoc.paths) {
    return rawDoc as NormalizedSpec;
  }

  const dereferenced = await dereferenceSpec(rawDoc, detectedBasePath);
  return normalizeSpec(dereferenced);
}
