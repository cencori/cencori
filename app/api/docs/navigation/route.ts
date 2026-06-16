import { NextResponse } from 'next/server';
import { getDocsNavigation } from '@/lib/docs';

export const dynamic = 'force-dynamic';

export async function GET() {
    const sections = getDocsNavigation();
    return NextResponse.json({ sections });
}
