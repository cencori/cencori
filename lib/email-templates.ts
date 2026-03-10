/**
 * Pre-built email templates for the internal email system.
 *
 * Each template provides a function that wraps user content in a
 * branded layout. All templates are responsive and dark-mode friendly.
 */

export type EmailCategory =
    | 'newsletter'
    | 'product_update'
    | 'announcement'
    | 'security_advisory'
    | 'onboarding'
    | 'transactional';

export interface EmailTemplateOptions {
    subject: string;
    body: string;
    preheader?: string;
    ctaText?: string;
    ctaUrl?: string;
    footerText?: string;
}

const LOGO_URL = 'https://cencori.com/cdark.png';
const CURRENT_YEAR = new Date().getFullYear();

function baseFooter(extra?: string): string {
    return `
    <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid #333;">
      ${extra ? `<p style="color:#999;font-size:13px;margin-bottom:12px;">${extra}</p>` : ''}
      <p style="color:#666;font-size:11px;margin:0;">
        © ${CURRENT_YEAR} Cencori · <a href="https://cencori.com" style="color:#888;text-decoration:none;">cencori.com</a>
      </p>
    </div>`;
}

function wrapInContainer(content: string, preheader?: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin:0; padding:0; background:#000; }
    a { color:#10b981; }
    img { border:0; display:block; }
  </style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#e5e5e5;background:#000;margin:0;padding:0;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    ${content}
  </div>
</body>
</html>`;
}

/**
 * Minimal template — clean, simple, direct communication.
 * Best for: transactional emails, quick announcements, security advisories.
 */
export function minimalTemplate(options: EmailTemplateOptions): string {
    const { body, preheader, ctaText, ctaUrl, footerText } = options;

    const ctaBlock = ctaText && ctaUrl
        ? `<div style="text-align:center;margin:28px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">${ctaText}</a>
      </div>`
        : '';

    return wrapInContainer(`
    <div style="text-align:center;margin-bottom:28px;">
      <img src="${LOGO_URL}" alt="Cencori" style="height:32px;margin:0 auto;" />
    </div>
    <div style="font-size:15px;color:#d4d4d4;">
      ${body}
    </div>
    ${ctaBlock}
    ${baseFooter(footerText)}
  `, preheader);
}

/**
 * Announcement template — hero-style with bold heading.
 * Best for: product launches, major updates, company news.
 */
export function announcementTemplate(options: EmailTemplateOptions): string {
    const { subject, body, preheader, ctaText, ctaUrl, footerText } = options;

    const ctaBlock = ctaText && ctaUrl
        ? `<div style="text-align:center;margin:32px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${ctaText}</a>
      </div>`
        : '';

    return wrapInContainer(`
    <div style="text-align:center;margin-bottom:32px;">
      <img src="${LOGO_URL}" alt="Cencori" style="height:32px;margin:0 auto 24px;" />
      <h1 style="color:#fff;font-size:26px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">${subject}</h1>
    </div>
    <div style="background:#111;border-radius:12px;padding:28px;border:1px solid #222;">
      <div style="font-size:15px;color:#d4d4d4;">
        ${body}
      </div>
      ${ctaBlock}
    </div>
    ${baseFooter(footerText)}
  `, preheader);
}

/**
 * Newsletter template — multi-section layout for longer content.
 * Best for: weekly roundups, product newsletters, digest emails.
 */
export function newsletterTemplate(options: EmailTemplateOptions): string {
    const { subject, body, preheader, ctaText, ctaUrl, footerText } = options;

    const ctaBlock = ctaText && ctaUrl
        ? `<div style="text-align:center;margin:24px 0 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:500;font-size:14px;">${ctaText}</a>
      </div>`
        : '';

    return wrapInContainer(`
    <div style="text-align:center;margin-bottom:8px;">
      <img src="${LOGO_URL}" alt="Cencori" style="height:28px;margin:0 auto;" />
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0;">Newsletter</p>
      <h1 style="color:#fff;font-size:22px;font-weight:600;margin:8px 0 0;letter-spacing:-0.3px;">${subject}</h1>
    </div>
    <div style="border-top:1px solid #222;padding-top:24px;">
      <div style="font-size:15px;color:#d4d4d4;">
        ${body}
      </div>
      ${ctaBlock}
    </div>
    ${baseFooter(footerText || 'You received this because you signed up for Cencori.')}
  `, preheader);
}

/** Map category to its default template function */
export const templateByCategory: Record<string, (opts: EmailTemplateOptions) => string> = {
    newsletter: newsletterTemplate,
    product_update: announcementTemplate,
    announcement: announcementTemplate,
    security_advisory: minimalTemplate,
    onboarding: minimalTemplate,
    transactional: minimalTemplate,
};

export function renderTemplate(
    category: string,
    options: EmailTemplateOptions
): string {
    const templateFn = templateByCategory[category] || minimalTemplate;
    return templateFn(options);
}
