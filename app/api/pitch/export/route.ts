import { NextRequest, NextResponse } from "next/server";

// Export API for pitch deck
// Supports PDF, PPTX, and DOCX formats
// Note: Full implementation requires additional packages:
// - pptxgenjs for PPTX
// - docx for DOCX  
// - puppeteer or @react-pdf/renderer for PDF

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") as "pdf" | "pptx" | "docx" | null;

    if (!format || !["pdf", "pptx", "docx"].includes(format)) {
        return NextResponse.json(
            { error: "Invalid format. Use pdf, pptx, or docx." },
            { status: 400 }
        );
    }

    try {
        // For now, return a placeholder response
        // Full implementation would generate actual files

        const slideContent = {
            title: "Cencori Pitch Deck",
            slides: [
                { title: "Title", subtitle: "The Infrastructure for AI Production" },
                { title: "Problem", points: ["Provider lock-in", "Security gaps", "Cost surprises", "Compliance burden"] },
                { title: "Solution", points: ["One SDK", "Built-in security", "Complete observability", "Provider failover"] },
                { title: "Product", features: ["Dashboard", "SDKs", "Security", "Analytics"] },
                { title: "Market", tam: "$150B", sam: "$42B", som: "$2B" },
                { title: "How It Works", steps: ["Integrate", "Configure", "Deploy"] },
                { title: "Business Model", tiers: ["Free", "Pro", "Enterprise"] },
                { title: "Traction", metrics: { developers: "2,500+", requests: "12M+", mrr: "$15K" } },
                { title: "Team", founder: "Bola Abanjo" },
                { title: "Ask", amount: "$1.5M Pre-Seed" },
            ],
        };

        // Generate based on format
        if (format === "pdf") {
            // For MVP: Return HTML that can be printed to PDF
            const html = generatePitchHTML(slideContent);
            return new NextResponse(html, {
                headers: {
                    "Content-Type": "text/html",
                    "Content-Disposition": 'attachment; filename="cencori-pitch-deck.html"',
                },
            });
        }

        if (format === "pptx") {
            // Placeholder - would use pptxgenjs
            return NextResponse.json(
                {
                    message: "PPTX export coming soon. For now, please use the PDF export or view the deck at pitch.cencori.com",
                    deck_url: "https://pitch.cencori.com"
                },
                { status: 200 }
            );
        }

        if (format === "docx") {
            // Placeholder - would use docx package
            return NextResponse.json(
                {
                    message: "DOCX export coming soon. For now, please use the PDF export or view the deck at pitch.cencori.com",
                    deck_url: "https://pitch.cencori.com"
                },
                { status: 200 }
            );
        }

        return NextResponse.json({ error: "Unknown error" }, { status: 500 });
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json(
            { error: "Failed to generate export" },
            { status: 500 }
        );
    }
}

interface SlideContent {
    title: string;
    slides: Array<{
        title: string;
        subtitle?: string;
        points?: string[];
        features?: string[];
        tam?: string;
        sam?: string;
        som?: string;
        steps?: string[];
        tiers?: string[];
        metrics?: { developers: string; requests: string; mrr: string };
        founder?: string;
        amount?: string;
    }>;
}

function generatePitchHTML(content: SlideContent): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title}</title>
  <style>
    @page { size: landscape; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; }
    .slide { width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem; page-break-after: always; }
    .slide:last-child { page-break-after: auto; }
    h1 { font-size: 3rem; font-weight: 700; margin-bottom: 1rem; }
    h2 { font-size: 2rem; font-weight: 600; margin-bottom: 1.5rem; }
    .subtitle { color: #888; font-size: 1.5rem; }
    .emerald { color: #10b981; }
    ul { list-style: none; font-size: 1.25rem; }
    li { margin: 0.5rem 0; padding-left: 1.5rem; position: relative; }
    li::before { content: '→'; position: absolute; left: 0; color: #10b981; }
    .logo { font-size: 4rem; font-weight: 700; background: linear-gradient(to right, #10b981, #059669); -webkit-background-clip: text; background-clip: text; color: transparent; }
  </style>
</head>
<body>
  ${content.slides.map((slide, i) => `
  <div class="slide">
    ${i === 0 ? `
      <div class="logo">Cencori</div>
      <h1>The Infrastructure <span class="emerald">for</span> AI Production</h1>
      <p class="subtitle">Ship AI with built-in security, observability, and scale.</p>
    ` : `
      <h2>${slide.title}</h2>
      ${slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : ''}
      ${slide.points ? `<ul>${slide.points.map(p => `<li>${p}</li>`).join('')}</ul>` : ''}
      ${slide.amount ? `<p class="emerald" style="font-size: 3rem; font-weight: 700;">${slide.amount}</p>` : ''}
    `}
  </div>
  `).join('')}
</body>
</html>
`;
}
