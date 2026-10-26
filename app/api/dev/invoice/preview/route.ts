/**
 * GET /api/dev/invoice/preview: live preview of the invoice PDF.
 *
 * Polls the PDF's fingerprint once a second and reloads the frame when a
 * saved change to lib/billing/invoice-pdf.ts alters it. The PDF is shown
 * from a blob URL because the site sends X-Frame-Options: DENY, which stops
 * the route itself from loading in a frame. Only served by `next dev`.
 */

export const dynamic = 'force-dynamic';

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice preview</title>
<style>html,body{margin:0;height:100%;background:#525659}iframe{border:0;width:100%;height:100%}</style>
</head><body>
<iframe id="pdf" title="Invoice preview"></iframe>
<script>
  const frame = document.getElementById('pdf');
  let current = '';
  async function check() {
    try {
      const res = await fetch('/api/dev/invoice?format=hash', { cache: 'no-store' });
      const hash = await res.text();
      if (res.ok && hash !== current) {
        const pdf = await fetch('/api/dev/invoice?v=' + hash, { cache: 'no-store' });
        if (pdf.ok) {
          current = hash;
          const previous = frame.src;
          frame.src = URL.createObjectURL(await pdf.blob()) + '#view=FitH&toolbar=0';
          if (previous.startsWith('blob:')) URL.revokeObjectURL(previous.split('#')[0]);
        }
      }
    } catch {}
    setTimeout(check, 1000);
  }
  check();
</script>
</body></html>`;

export async function GET() {
    if (process.env.NODE_ENV !== 'development') {
        return new Response('Not found', { status: 404 });
    }
    return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
