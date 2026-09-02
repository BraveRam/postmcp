import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import axios from 'axios';
import { ALL_PRESETS, PRESETS_BY_ID, getPreset, Preset } from '@postmcp/presets';

export { ALL_PRESETS, PRESETS_BY_ID, getPreset, Preset };
export const BUNDLED_PRESETS = PRESETS_BY_ID;

export function getPresetCacheDir(): string {
  try {
    const dir = path.join(os.homedir(), '.postmcp', 'presets');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'postmcp-presets');
    if (!fs.existsSync(fallbackDir)) {
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
      } catch {
        // Ignore fallback dir creation errors
      }
    }
    return fallbackDir;
  }
}

export async function resolvePresetSpec(presetIdOrAlias: string): Promise<string | object> {
  const cleanId = presetIdOrAlias.replace(/^@/, '').toLowerCase().trim();
  const preset = getPreset(cleanId);

  if (!preset) {
    throw new Error(`Unknown preset '@${cleanId}'. Run 'postmcp presets list' to see all available presets.`);
  }

  // Check local cache first
  const cacheDir = getPresetCacheDir();
  const cacheFile = path.join(cacheDir, `${cleanId}.json`);
  if (fs.existsSync(cacheFile)) {
    return cacheFile;
  }

  // If remote spec URL exists, try to fetch and cache it
  if (preset.specUrl) {
    try {
      const res = await axios.get(preset.specUrl, { timeout: 8000, responseType: 'text' });
      try {
        fs.writeFileSync(cacheFile, res.data, 'utf-8');
        return cacheFile;
      } catch {
        return res.data;
      }
    } catch {
      // Remote fetch failed, fall through to bundledSpec
    }
  }

  // If bundledSpec exists, write to cache and return
  if (preset.bundledSpec) {
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(preset.bundledSpec, null, 2), 'utf-8');
      return cacheFile;
    } catch {
      return preset.bundledSpec;
    }
  }

  if (preset.specUrl) {
    return preset.specUrl;
  }

  throw new Error(`Preset '@${cleanId}' has no specification available.`);
}

export async function syncAllPresets(): Promise<string[]> {
  const synced: string[] = [];
  const cacheDir = getPresetCacheDir();

  for (const preset of ALL_PRESETS) {
    const filePath = path.join(cacheDir, `${preset.id}.json`);
    let wrote = false;

    if (preset.specUrl) {
      try {
        const res = await axios.get(preset.specUrl, { timeout: 8000, responseType: 'text' });
        fs.writeFileSync(filePath, res.data, 'utf-8');
        wrote = true;
      } catch {
        // Fallback to bundled spec
      }
    }

    if (!wrote && preset.bundledSpec) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(preset.bundledSpec, null, 2), 'utf-8');
        wrote = true;
      } catch {
        // Ignore filesystem write error
      }
    }

    if (wrote) {
      synced.push(preset.id);
    }
  }

  return synced;
}
