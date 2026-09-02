import { NextResponse } from 'next/server';
import { ALL_PRESETS, getAllCategories } from '@postmcp/presets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();
  const category = searchParams.get('category');

  let presets = ALL_PRESETS;

  if (category && category !== 'all') {
    presets = presets.filter((p) => p.category === category);
  }

  if (query) {
    presets = presets.filter(
      (p) =>
        p.id.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(query)))
    );
  }

  const safePresets = presets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    authType: p.authType,
    authEnvVar: p.authEnvVar,
    defaultBaseUrl: p.defaultBaseUrl,
    tags: p.tags,
    fieldMasks: p.fieldMasks,
    macros: p.macros,
    hasBundledSpec: Boolean(p.bundledSpec),
  }));

  return NextResponse.json({
    presets: safePresets,
    categories: ['all', ...getAllCategories()],
    total: safePresets.length,
  });
}
