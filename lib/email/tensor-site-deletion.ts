import { launchTemplate } from "@/lib/email-templates";
import { escapeHtml } from "@/lib/email/sendbyte";

/**
 * The warning sent a week before a paused Tensor app is deleted. Laid out as Cencori's welcome
 * email is (launchTemplate), without its banner: a greeting, a few short paragraphs, one button.
 */
export function tensorSiteDeletionEmail(input: {
  firstName: string | null;
  /** The app's address, e.g. shop.cencori.app. */
  address: string;
  /** When it will be deleted, as a date a person reads ("22 November 2026"). */
  when: string;
  preferencesUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string } {
  const address = escapeHtml(input.address);
  const when = escapeHtml(input.when);
  return {
    subject: `${input.address} will be deleted on ${input.when}`,
    html: launchTemplate({
      preheader: `Choose a plan that includes it by ${when} to keep it and its data.`,
      greeting: `Hi ${escapeHtml(input.firstName || "there")},`,
      paragraphs: [
        `Your Tensor app <strong style="color:#111;">${address}</strong> has been paused since your plan stopped including it.`,
        `On <strong style="color:#111;">${when}</strong> it will be deleted, along with all of its data. This cannot be undone.`,
        "To keep it, choose a plan that includes it. It will be back online within a day, or straight away when you open the project in Tensor.",
      ],
      linksHeader: "Before then, you can:",
      links: [
        { label: "See what each plan includes", url: "https://tensorade.app/pricing#publishing" },
        { label: "Open your projects in Tensor", url: "https://tensorade.app/projects" },
      ],
      ctaText: "Keep my app",
      ctaUrl: "https://tensorade.app/billing",
      signOff: "Build different.",
      preferencesUrl: input.preferencesUrl,
      unsubscribeUrl: input.unsubscribeUrl,
      footerContext: "You received this because you published an app with Tensor.",
    }),
  };
}
