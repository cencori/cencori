import { launchTemplate } from "@/lib/email-templates";
import { escapeHtml } from "@/lib/email/sendbyte";
import { generateUserUnsubscribeToken } from "@/lib/user-unsubscribe";

export const TENSOR_LAUNCH_SUBJECT = "Tensor is live";

/** What a waitlist entry's unsubscribe link is signed over, kept apart from the tokens of accounts. */
const signed = (waitlistId: string) => `tensor-waitlist:${waitlistId}`;

export function tensorWaitlistUnsubscribeToken(waitlistId: string): string {
  return generateUserUnsubscribeToken(signed(waitlistId));
}

export function tensorWaitlistUnsubscribeUrl(baseUrl: string, waitlistId: string): string {
  return `${baseUrl}/api/tensor/waitlist/unsubscribe?id=${encodeURIComponent(waitlistId)}&token=${tensorWaitlistUnsubscribeToken(waitlistId)}`;
}

/** The first word of the name someone gave the waitlist, or null when they gave none. */
export function waitlistFirstName(name: string | null | undefined): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.length > 0 && first.length <= 40 ? first : null;
}

/**
 * The email that tells the waitlist Tensor is open. Laid out as Cencori's other launch emails are
 * (launchTemplate). An entry without a name is greeted without one.
 */
export function tensorLaunchEmail(input: {
  firstName: string | null;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  return {
    subject: TENSOR_LAUNCH_SUBJECT,
    html: launchTemplate({
      bannerUrl: "https://www.tensorade.app/static/og-image.png",
      bannerAlt: "Tensor",
      preheader: "You joined the waitlist. Tensor is open today, on Mac, Windows and the web.",
      greeting: input.firstName ? `Hi ${escapeHtml(input.firstName)},` : "Hi there,",
      paragraphs: [
        "You joined the Tensor waitlist. Tensor is open today.",
        "Tensor is an agentic development environment. You describe what you want built, and AI agents plan, write, run and ship the code with you. It runs on Mac, Windows and the web.",
        "You can start on the free trial. Plans start at $2 (₦2,000) a month.",
      ],
      linksHeader: "To get started:",
      links: [
        { label: "Download Tensor for Mac or Windows", url: "https://www.tensorade.app/download" },
        { label: "Build on the web", url: "https://www.tensorade.app/chat" },
        { label: "See the plans", url: "https://www.tensorade.app/pricing" },
      ],
      ctaText: "Get Tensor",
      ctaUrl: "https://www.tensorade.app/download",
      signOff: "Build different.",
      // Most of the waitlist has no account to manage preferences on, so both links unsubscribe.
      preferencesUrl: input.unsubscribeUrl,
      unsubscribeUrl: input.unsubscribeUrl,
      footerContext: "You received this because you joined the Tensor waitlist.",
    }),
  };
}
