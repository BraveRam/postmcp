import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import mime from 'mime-types';

export function getExtensionFromContentType(contentType?: string): string {
  if (!contentType) return 'bin';
  const cleanType = contentType.split(';')[0].trim();
  const ext = mime.extension(cleanType);
  if (ext) {
    if (ext === 'jpeg') return 'jpg';
    return ext;
  }
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
