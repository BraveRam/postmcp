import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export interface SpecCacheMetadata {
  url: string;
  cachedAt: string;
  etag?: string;
  sizeBytes: number;
}

export interface CachedSpecResult {
  content: string;
  metadata?: SpecCacheMetadata;
  filePath: string;
}

export function getDefaultSpecCacheDir(): string {
  if (process.env.POSTMCP_CACHE_DIR) {
    return path.resolve(process.env.POSTMCP_CACHE_DIR);
  }
  return path.join(os.homedir(), '.postmcp', 'cache', 'specs');
}

export function getSpecCachePaths(url: string, customCacheDir?: string): {
  cacheDir: string;
  specPath: string;
  metaPath: string;
} {
  const cacheDir = customCacheDir ? path.resolve(customCacheDir) : getDefaultSpecCacheDir();
  const trimmed = url.trim();
  const hash = crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 16);
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  const slug = withoutProtocol.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 48) || 'spec';

  return {
    cacheDir,
    specPath: path.join(cacheDir, `${slug}_${hash}.spec`),
    metaPath: path.join(cacheDir, `${slug}_${hash}.meta.json`),
  };
}

export async function readCachedSpec(
  url: string,
  customCacheDir?: string
): Promise<CachedSpecResult | null> {
  const { specPath, metaPath } = getSpecCachePaths(url, customCacheDir);

  try {
    const content = await fs.readFile(specPath, 'utf-8');
    let metadata: SpecCacheMetadata | undefined;

    try {
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      metadata = JSON.parse(metaContent) as SpecCacheMetadata;
    } catch {
      // Metadata read error is non-fatal
    }

    return {
      content,
      metadata,
      filePath: specPath,
    };
  } catch {
    return null;
  }
}

export async function writeCachedSpec(
  url: string,
  content: string,
  customCacheDir?: string,
  etag?: string
): Promise<void> {
  const { cacheDir, specPath, metaPath } = getSpecCachePaths(url, customCacheDir);

  await fs.mkdir(cacheDir, { recursive: true });

  const metadata: SpecCacheMetadata = {
    url: url.trim(),
    cachedAt: new Date().toISOString(),
    etag,
    sizeBytes: Buffer.byteLength(content, 'utf-8'),
  };

  await fs.writeFile(specPath, content, 'utf-8');
  await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

export async function clearSpecCache(
  url?: string,
  customCacheDir?: string
): Promise<void> {
  if (url) {
    const { specPath, metaPath } = getSpecCachePaths(url, customCacheDir);
    try {
      await fs.unlink(specPath);
    } catch {
      // Ignore if missing
    }
    try {
      await fs.unlink(metaPath);
    } catch {
      // Ignore if missing
    }
    return;
  }

  const cacheDir = customCacheDir ? path.resolve(customCacheDir) : getDefaultSpecCacheDir();
  try {
    const files = await fs.readdir(cacheDir);
    for (const f of files) {
      await fs.unlink(path.join(cacheDir, f)).catch(() => {});
    }
  } catch {
    // Directory might not exist yet
  }
}
