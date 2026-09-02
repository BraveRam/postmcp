import { NextResponse } from 'next/server';
import { applyTokenDiet } from '@postmcp/core';

export async function POST(request: Request) {
  try {
    const { data, options } = await request.json();

    if (data === undefined) {
      return NextResponse.json({ error: 'Payload data is required.' }, { status: 400 });
    }

    const result = applyTokenDiet(data, {
      enabled: options?.enabled ?? true,
      fieldMasks: options?.fieldMasks,
      maxTokens: options?.maxTokens ?? 2500,
      convertToMarkdownTable: options?.convertToMarkdownTable ?? true,
      maxProseLength: options?.maxProseLength ?? 1000,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Token Diet computation failed.',
      },
      { status: 500 }
    );
  }
}
