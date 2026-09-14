import { NextResponse } from 'next/server';

export function cronDisabled(): NextResponse | null {
    if (process.env.ENABLE_VERCEL_CRON === 'true') return null;
    return NextResponse.json({ error: 'Cron disabled' }, { status: 404 });
}
