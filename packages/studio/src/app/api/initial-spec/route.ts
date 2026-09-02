import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const initialSpec =
    process.env.STUDIO_INITIAL_SPEC ||
    process.env.NEXT_PUBLIC_INITIAL_SPEC ||
    null;

  return NextResponse.json({ initialSpec });
}
