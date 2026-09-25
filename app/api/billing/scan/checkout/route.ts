import { NextResponse } from 'next/server';

// Scan standalone subscriptions are deprecated and removed from the product
// offering. This route is kept to return an explicit 410 (Gone) instead of a
// confusing 404 for old clients, bookmarks, and the retired paywall dialog.
export async function POST() {
  return NextResponse.json(
    {
      error: 'Scan standalone subscriptions are no longer offered',
      code: 'SCAN_DEPRECATED',
      upgradeUrl: '/pricing',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Scan standalone subscriptions are no longer offered',
      code: 'SCAN_DEPRECATED',
      upgradeUrl: '/pricing',
    },
    { status: 410 }
  );
}
