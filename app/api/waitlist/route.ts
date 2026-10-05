import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email,
      productName,
      // Tensor conversational waitlist (all optional except email for backwards compat)
      name,
      workEmail,
      company,
      role,
      building,
      planInterested,
      timeline,
      currentTools,
      priorities,
      budget,
      heardAbout,
      anythingElse,
      source,
    } = body;

    const resolvedEmail: string = workEmail || email;

    if (!resolvedEmail || !EMAIL_RE.test(String(resolvedEmail))) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const payload = {
      email: resolvedEmail,
      productName: productName || "tensor",
      timestamp: new Date().toISOString(),
      source: source || "Cencori Website",
      // Full Tensor agent fields — webhook consumers (Sheets/Zapier) get everything.
      name: name || undefined,
      workEmail: workEmail || resolvedEmail,
      company: company || undefined,
      role: role || undefined,
      building: building || undefined,
      planInterested: planInterested || undefined,
      timeline: timeline || undefined,
      currentTools: Array.isArray(currentTools) ? currentTools : currentTools || undefined,
      priorities: Array.isArray(priorities) ? priorities : priorities || undefined,
      budget: budget || undefined,
      heardAbout: heardAbout || undefined,
      anythingElse: anythingElse || undefined,
    };

    // Connect to Google Sheets via Webhook (Zapier/Make/n8n)
    const webhookUrl = process.env.WAITLIST_WEBHOOK_URL;

    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
      console.log(`[Waitlist Debug] ${JSON.stringify(payload)}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
