import { Preset, PresetCategory } from './types.js';
import { DEVELOPER_TOOLS_PRESETS } from './catalog/developer-tools.js';
import { CLOUD_DATABASES_PRESETS } from './catalog/cloud-databases.js';
import { PAYMENTS_COMMERCE_PRESETS } from './catalog/payments-commerce.js';
import { COMMUNICATION_AI_PRESETS } from './catalog/communication-ai.js';
import { PRODUCTIVITY_SUPPORT_PRESETS } from './catalog/productivity-support.js';
import { MEDIA_SOCIAL_PRESETS } from './catalog/media-social.js';

export * from './types.js';
export { DEVELOPER_TOOLS_PRESETS } from './catalog/developer-tools.js';
export { CLOUD_DATABASES_PRESETS } from './catalog/cloud-databases.js';
export { PAYMENTS_COMMERCE_PRESETS } from './catalog/payments-commerce.js';
export { COMMUNICATION_AI_PRESETS } from './catalog/communication-ai.js';
export { PRODUCTIVITY_SUPPORT_PRESETS } from './catalog/productivity-support.js';
export { MEDIA_SOCIAL_PRESETS } from './catalog/media-social.js';

export const ALL_PRESETS: Preset[] = [
  ...DEVELOPER_TOOLS_PRESETS,
  ...CLOUD_DATABASES_PRESETS,
  ...PAYMENTS_COMMERCE_PRESETS,
  ...COMMUNICATION_AI_PRESETS,
  ...PRODUCTIVITY_SUPPORT_PRESETS,
  ...MEDIA_SOCIAL_PRESETS,
];

export const PRESETS_BY_ID: Record<string, Preset> = ALL_PRESETS.reduce((acc, preset) => {
  acc[preset.id] = preset;
  return acc;
}, {} as Record<string, Preset>);

export function getAllPresets(): Preset[] {
  return ALL_PRESETS;
}

export function getPreset(id: string): Preset | undefined {
  const cleanId = id.replace(/^@/, '').toLowerCase().trim();
  return PRESETS_BY_ID[cleanId];
}

export function getPresetsByCategory(category: PresetCategory): Preset[] {
  return ALL_PRESETS.filter((p) => p.category === category);
}

export function searchPresets(query: string): Preset[] {
  const q = query.toLowerCase().trim();
  if (!q) return ALL_PRESETS;

  return ALL_PRESETS.filter((p) => {
    return (
      p.id.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });
}

export function getAllCategories(): PresetCategory[] {
  return [
    'Developer Tools',
    'Database & Cloud',
    'Payments & Commerce',
    'Communication & AI',
    'Productivity & Support',
    'Social & Media',
    'Demo & Testing',
  ];
}
