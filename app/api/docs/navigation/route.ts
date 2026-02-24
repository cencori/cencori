import { NextResponse } from 'next/server';
import { getDocsNavigation } from '@/lib/docs';

export async function GET(request) {
  const { headers } = request;
  const authHeader = headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sections = getDocsNavigation();
  return NextResponse.json({ sections });
}