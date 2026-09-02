import { NextResponse } from 'next/server';
import { parseOpenAPI } from '@postmcp/core';
import { getPreset } from '@postmcp/presets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { spec, presetId, url } = body;

    let targetSpec: any = null;

    if (presetId) {
      const preset = getPreset(presetId);
      if (!preset) {
        return NextResponse.json({ error: `Preset '${presetId}' not found.` }, { status: 404 });
      }
      targetSpec = preset.bundledSpec || preset.specUrl;
      if (!targetSpec) {
        return NextResponse.json({ error: `Preset '${presetId}' has no specification.` }, { status: 404 });
      }
    } else if (url) {
      targetSpec = url;
    } else if (spec) {
      targetSpec = typeof spec === 'string' ? spec : spec;
    } else {
      return NextResponse.json({ error: 'No spec, presetId, or url provided.' }, { status: 400 });
    }

    const parsed = await parseOpenAPI(targetSpec);

    // If preset provided, attach its declared macros & field masks (Finding 6)
    if (presetId) {
      const preset = getPreset(presetId);
      if (preset?.macros && preset.macros.length > 0) {
        parsed.macros = [...(parsed.macros || []), ...preset.macros];
      }
      if (preset?.fieldMasks && preset.fieldMasks.length > 0) {
        const fieldMasksMap: Record<string, string[]> = {};
        for (const fm of preset.fieldMasks) {
          fieldMasksMap[fm.path] = fm.fields;
        }
        parsed.tokenDiet = {
          enabled: true,
          fieldMasks: fieldMasksMap,
          ...(parsed.tokenDiet || {}),
        };
      }
    }

    return NextResponse.json({
      success: true,
      spec: parsed,
      operationsCount: parsed.operations.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to parse OpenAPI specification.',
      },
      { status: 422 }
    );
  }
}
