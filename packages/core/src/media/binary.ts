import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export async function saveBinaryArtifact(buffer: Buffer, filenamePrefix: string = 'file', extension: string = 'bin'): Promise<string> {
  const artifactDir = path.join(os.homedir(), '.postmcp', 'artifacts');
  await fs.mkdir(artifactDir, { recursive: true });

  const filename = `${filenamePrefix}_${Date.now()}.${extension}`;
  const filePath = path.join(artifactDir, filename);

  await fs.writeFile(filePath, buffer);
  return filePath;
}
