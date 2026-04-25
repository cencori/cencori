import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, productName } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Connect to Google Sheets via Webhook (Zapier/Make/n8n)
    const webhookUrl = process.env.WAITLIST_WEBHOOK_URL;

    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          productName,
          timestamp: new Date().toISOString(),
          source: "Cencori Website",
        }),
      });

      if (!response.ok) {
        console.error("Webhook failed:", await response.text());
        // We still return 200 to the client so they see a success message,
        // but we log the error internally. Or we can return 500.
        // For waitlists, it's safer to return 500 if we actually failed to save it.
        return NextResponse.json({ error: "Failed to save to waitlist" }, { status: 500 });
      }
    } else {
      // If no webhook is configured, just log it for testing purposes
      console.log(`[Waitlist Debug] Email: ${email}, Product: ${productName}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
