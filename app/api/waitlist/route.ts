import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).slice(0, 20);
  if (typeof value === "string" && value.trim() !== "") return [value];
  return [];
}

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

    const normalizedEmail = String(resolvedEmail).trim().toLowerCase();
    const tools = asStringArray(currentTools);
    const prios = asStringArray(priorities);

    // Primary record: Supabase is the source of truth. One row per email —
    // resubmits refresh the answers in place instead of duplicating.
    try {
      const admin = createAdminClient();
      const { error: dbError } = await admin.from("tensor_waitlist").upsert(
        {
          email: normalizedEmail,
          name: name || null,
          work_email: workEmail || normalizedEmail,
          company: company || null,
          role: role || null,
          building: building || null,
          plan_interested: planInterested || null,
          timeline: timeline || null,
          current_tools: tools,
          priorities: prios,
          budget: budget || null,
          heard_about: heardAbout || null,
          anything_else: anythingElse || null,
          product_name: productName || "tensor",
          source: source || "Cencori Website",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
      if (dbError) throw dbError;
    } catch (dbError) {
      console.error("Waitlist DB save failed:", dbError);
      return NextResponse.json({ error: "Failed to save to waitlist" }, { status: 500 });
    }

    // Best-effort forward to Google Sheets via Webhook (Zapier/Make/n8n).
    // A webhook failure must never fail the signup anymore — Supabase
    // already has it. Log and move on.
    const webhookUrl = process.env.WAITLIST_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            productName: productName || "tensor",
            timestamp: new Date().toISOString(),
            source: source || "Cencori Website",
            name: name || undefined,
            workEmail: workEmail || normalizedEmail,
            company: company || undefined,
            role: role || undefined,
            building: building || undefined,
            planInterested: planInterested || undefined,
            timeline: timeline || undefined,
            currentTools: tools.length > 0 ? tools : undefined,
            priorities: prios.length > 0 ? prios : undefined,
            budget: budget || undefined,
            heardAbout: heardAbout || undefined,
            anythingElse: anythingElse || undefined,
          }),
        });
        if (!response.ok) {
          console.error("Waitlist webhook forward failed:", await response.text());
        }
      } catch (webhookError) {
        console.error("Waitlist webhook forward failed:", webhookError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
