import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import axios from 'axios';
import { ALL_PRESETS, PRESETS_BY_ID, getPreset, Preset } from '@postmcp/presets';

export { ALL_PRESETS, PRESETS_BY_ID, getPreset, Preset };
export const BUNDLED_PRESETS = PRESETS_BY_ID;

export function getPresetCacheDir(): string {
  const dir = path.join(os.homedir(), '.postmcp', 'presets');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function resolvePresetSpec(presetIdOrAlias: string): Promise<string> {
  const cleanId = presetIdOrAlias.replace(/^@/, '').toLowerCase().trim();
  const preset = getPreset(cleanId);

  if (!preset) {
    throw new Error(`Unknown preset '@${cleanId}'. Run 'postmcp presets list' to see all available presets.`);
  }

  // Check local cache first
  const cacheFile = path.join(getPresetCacheDir(), `${cleanId}.json`);
  if (fs.existsSync(cacheFile)) {
    return cacheFile;
  }

  // If remote spec URL exists, fetch and cache it
  if (preset.specUrl) {
    try {
      const res = await axios.get(preset.specUrl, { responseType: 'text' });
      fs.writeFileSync(cacheFile, res.data, 'utf-8');
      return cacheFile;
    } catch {
      // Return remote URL directly as fallback for parser
      return preset.specUrl;
    }
  }

  throw new Error(`Preset '@${cleanId}' does not declare a public specUrl. Please provide the specification path directly.`);
}

export async function syncAllPresets(): Promise<string[]> {
  const synced: string[] = [];
  const cacheDir = getPresetCacheDir();

  for (const preset of ALL_PRESETS) {
    if (preset.specUrl) {
      try {
        const res = await axios.get(preset.specUrl, { timeout: 10000, responseType: 'text' });
        const filePath = path.join(cacheDir, `${preset.id}.json`);
        fs.writeFileSync(filePath, res.data, 'utf-8');
        synced.push(preset.id);
      } catch {
        // Skip offline / unreachable preset during batch sync
      }
    }
  }

  return synced;
}
