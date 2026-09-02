import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export function getExtensionFromContentType(contentType?: string): string {
  if (!contentType) return 'bin';
  if (contentType.includes('application/pdf')) return 'pdf';
  if (contentType.includes('application/zip')) return 'zip';
  if (contentType.includes('application/json')) return 'json';
  if (contentType.includes('text/csv')) return 'csv';
  if (contentType.includes('text/plain')) return 'txt';
  if (contentType.includes('image/png')) return 'png';
  if (contentType.includes('image/jpeg')) return 'jpg';
  if (contentType.includes('image/webp')) return 'webp';
  return 'bin';
}

export async function saveBinaryArtifact(
  buffer: Buffer,
  filenamePrefix: string = 'file',
  contentType?: string
): Promise<string> {
  const extension = getExtensionFromContentType(contentType);
  const artifactDir = path.join(os.homedir(), '.postmcp', 'artifacts');
  await fs.mkdir(artifactDir, { recursive: true });

  const filename = `${filenamePrefix}_${Date.now()}.${extension}`;
  const filePath = path.join(artifactDir, filename);

  await fs.writeFile(filePath, buffer);
  return filePath;
}
