import { NextResponse } from 'next/server';
import { getStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

// Uptime-monitor probe for the AI Gateway (status.cencori.com). Answers 503
// only when the gateway is down — storage unreachable or more than two provider
// circuits open. Degraded still answers 200: a single tripped circuit is
// covered by failover and must not show as a public outage.
export async function GET() {
  try {
    const { services } = await getStatus();
    const gateway = services.find((service) => service.id === 'ai-gateway');
    const status = gateway?.status ?? 'down';

    return NextResponse.json(
      { status },
      { status: status === 'down' ? 503 : 200, headers: HEADERS },
    );
  } catch (error) {
    console.error('[API] Error checking AI Gateway status:', error);
    return NextResponse.json({ status: 'unknown' }, { status: 503, headers: HEADERS });
  }
}
