import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") as "pdf" | "pptx" | "docx" | null;

    if (!format || format !== "pdf") {
        return NextResponse.json(
            { error: "Currently only 'pdf' format is supported via this instant export." },
            { status: 400 }
        );
    }

    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        
        const page = await browser.newPage();
        
        // Use localhost for local dev, or the origin from the request
        const origin = request.nextUrl.origin;
        const printUrl = `${origin}/pitch?print=true`;

        // Set viewport to 1080p landscape
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
        
        // Emulate print media
        await page.emulateMediaType("print");
        
        // Navigate and wait for initial network idle
        await page.goto(printUrl, { waitUntil: "networkidle0" });
        
        // Wait for the client-side hydration to signal it's ready
        await page.waitForSelector("body[data-ready='true']", { timeout: 10000 });
        
        // Wait an extra bit for images/charts
        await new Promise(r => setTimeout(r, 2000));

        const pdfBuffer = await page.pdf({
            printBackground: true,
            width: "1920px",
            height: "1080px",
            landscape: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            displayHeaderFooter: false,
        });

        await browser.close();

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": 'attachment; filename="cencori-pitch-deck.pdf"',
                "Cache-Control": "no-cache"
            },
        });
    } catch (error) {
        console.error("Export error:", error);
        return NextResponse.json(
            { error: "Failed to generate PDF instantly. Please try again." },
            { status: 500 }
        );
    }
}
