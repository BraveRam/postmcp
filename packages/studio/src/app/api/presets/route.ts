import { NextResponse } from 'next/server';
import { ALL_PRESETS, getAllCategories } from '@postmcp/presets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase().trim();
  // Reconstruct category in case unencoded '&' was split by URL parser
  // (e.g. ?category=Payments & Commerce => category="Payments ", " Commerce"="")
  let rawCategory = searchParams.get('category') || '';
  if (rawCategory && rawCategory.toLowerCase() !== 'all') {
    const isDirectMatch = ALL_PRESETS.some(
      (p) => p.category.toLowerCase() === rawCategory.toLowerCase().trim()
    );
    if (!isDirectMatch) {
      for (const key of searchParams.keys()) {
        if (key !== 'category' && key !== 'q') {
          const combined = `${rawCategory}&${key}`.trim();
          if (ALL_PRESETS.some((p) => p.category.toLowerCase() === combined.toLowerCase())) {
            rawCategory = combined;
            break;
          }
        }
      }
    }
  }

  const category = rawCategory.trim();
  let presets = ALL_PRESETS;

  if (category && category.toLowerCase() !== 'all') {
    const catLower = category.toLowerCase();
    presets = presets.filter((p) => p.category.toLowerCase() === catLower);
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
