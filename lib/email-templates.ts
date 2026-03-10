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

const LOGO_DARK_THEME = 'https://cencori.com/clight.png'; // White logo for dark mode
const LOGO_LIGHT_THEME = 'https://cencori.com/cdark.png'; // Dark logo for light mode
const CURRENT_YEAR = new Date().getFullYear();

function baseFooter(extra?: string): string {
  return `
    <div style="text-align:center;margin-top:48px;padding-top:32px;border-top:1px solid #222;">
      ${extra ? `<p style="color:#888;font-size:13px;margin-bottom:16px;line-height:1.5;">${extra}</p>` : ''}
      <p style="color:#555;font-size:11px;margin:0;letter-spacing:0.5px;text-transform:uppercase;">
        © ${CURRENT_YEAR} Cencori · <a href="https://cencori.com" style="color:#777;text-decoration:none;">cencori.com</a>
      </p>
      <div style="margin-top:16px;">
        <a href="https://cencori.com/dashboard" style="color:#555;font-size:11px;text-decoration:none;margin:0 8px;">Dashboard</a>
        <a href="https://cencori.com/docs" style="color:#555;font-size:11px;text-decoration:none;margin:0 8px;">Documentation</a>
        <a href="https://cencori.com/blog" style="color:#555;font-size:11px;text-decoration:none;margin:0 8px;">Security Research</a>
      </div>
    </div>`;
}

function wrapInContainer(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark only">
  <meta name="supported-color-schemes" content="dark only">
  <title>Cencori</title>
  <!--[if mso]>
  <style>
    table {border-collapse:collapse;border:0;border-spacing:0;margin:0;}
    div, td {padding:0;}
    div {margin:0 !important;}
  </style>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root {
      color-scheme: dark only;
      supported-color-schemes: dark only;
    }
    body, .body { 
      margin: 0 !important; 
      padding: 0 !important; 
      background-color: #000000 !important; 
      background: #000000 !important;
      color: #e5e5e5 !important;
    }
    table, td { color: #e5e5e5; }
    a { color: #10b981; text-decoration: none; }
    img { border: 0; display: block; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    p, h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
    @media (prefers-color-scheme: light) {
      .logo-dark { display: block !important; }
      .logo-light { display: none !important; }
    }
  </style>
</head>
<body class="body" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol';line-height:1.6;color:#e5e5e5;background-color:#000000;margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#000000;background:#000000;" bgcolor="#000000">
    <tr>
      <td align="center" style="background-color:#000000;background:#000000;" bgcolor="#000000">
        ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ''}
        <div class="container" style="max-width:600px;margin:0 auto;padding:32px 20px;text-align:left;">
          ${content}
        </div>
      </td>
    </tr>
  </table>
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
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 32px;text-decoration:none;border-radius:100px;font-weight:600;font-size:14px;letter-spacing:0.3px;">${ctaText}</a>
      </div>`
    : '';

  return wrapInContainer(`
    <div style="text-align:center;margin-bottom:32px;">
      <a href="https://cencori.com" class="logo-light"><img src="${LOGO_DARK_THEME}" alt="Cencori" style="height:28px;margin:0 auto;" /></a>
      <div class="logo-dark" style="display:none;"><a href="https://cencori.com"><img src="${LOGO_LIGHT_THEME}" alt="Cencori" style="height:28px;margin:0 auto;" /></a></div>
    </div>
    <div style="font-size:15px;color:#d4d4d4;line-height:1.7;">
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
        <a href="${ctaUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:14px 40px;text-decoration:none;border-radius:100px;font-weight:700;font-size:15px;box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);">${ctaText}</a>
      </div>`
    : '';

  return wrapInContainer(`
    <div style="text-align:center;margin-bottom:40px;">
      <a href="https://cencori.com" class="logo-light"><img src="${LOGO_DARK_THEME}" alt="Cencori" style="height:32px;margin:0 auto 24px;" /></a>
      <div class="logo-dark" style="display:none;"><a href="https://cencori.com"><img src="${LOGO_LIGHT_THEME}" alt="Cencori" style="height:32px;margin:0 auto 24px;" /></a></div>
      <h1 style="color:#fff;font-size:32px;font-weight:800;margin:0 0 12px;letter-spacing:-1px;line-height:1.2;">${subject}</h1>
      <p style="color:#10b981;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0;">Intelligence-Driven Security</p>
    </div>
    <div style="background:linear-gradient(180deg, #111 0%, #080808 100%);border-radius:16px;padding:40px;border:1px solid #222;box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
      <div style="font-size:16px;color:#d4d4d4;line-height:1.8;">
        ${body}
      </div>
      <div style="margin-top:40px;padding-top:24px;border-top:1px solid #222;">
        <p style="color:#fff;font-size:14px;font-weight:600;margin-bottom:16px;">Core Platform Capabilities:</p>
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding-bottom:12px;">
              <span style="color:#10b981;font-weight:bold;margin-right:8px;">✓</span>
              <span style="color:#eee;font-size:13px;"><strong style="color:#fff;">Advanced SAST:</strong> Real-time detection of 1,000+ secret types and vulns.</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">
              <span style="color:#10b981;font-weight:bold;margin-right:8px;">✓</span>
              <span style="color:#eee;font-size:13px;"><strong style="color:#fff;">Deep SCA:</strong> Semantic dependency audits via OSV.dev integration.</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:12px;">
              <span style="color:#10b981;font-weight:bold;margin-right:8px;">✓</span>
              <span style="color:#eee;font-size:13px;"><strong style="color:#fff;">AI Memory Layer:</strong> Context-aware security that learns from your code.</span>
            </td>
          </tr>
        </table>
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
    ? `<div style="text-align:center;margin:32px 0 0;">
        <a href="${ctaUrl}" style="display:inline-block;background:transparent;color:#10b981;padding:10px 24px;text-decoration:none;border:1px solid #10b981;border-radius:100px;font-weight:600;font-size:13px;">${ctaText}</a>
      </div>`
    : '';

  return wrapInContainer(`
    <div style="text-align:center;margin-bottom:16px;">
      <a href="https://cencori.com" class="logo-light"><img src="${LOGO_DARK_THEME}" alt="Cencori" style="height:24px;margin:0 auto;" /></a>
      <div class="logo-dark" style="display:none;"><a href="https://cencori.com"><img src="${LOGO_LIGHT_THEME}" alt="Cencori" style="height:24px;margin:0 auto;" /></a></div>
    </div>
    <div style="text-align:center;margin-bottom:40px;">
      <p style="color:#10b981;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin:0 0 8px;">Weekly Intelligence</p>
      <h1 style="color:#fff;font-size:28px;font-weight:800;margin:0;letter-spacing:-0.5px;line-height:1.1;">${subject}</h1>
    </div>
    <div style="border-top:1px solid #222;padding-top:32px;">
      <div style="font-size:15px;color:#d4d4d4;line-height:1.7;">
        ${body}
      </div>
      ${ctaBlock}
    </div>
    <div style="margin-top:40px;background:#111;padding:24px;border-radius:12px;border:1px solid #222;text-align:center;">
       <p style="color:#fff;font-size:14px;font-weight:600;margin-bottom:8px;">Securing your infrastructure?</p>
       <p style="color:#888;font-size:13px;margin-bottom:16px;">Deploy Cencori scans to detect vulnerabilities before they hit production.</p>
       <a href="https://cencori.com/scan/import" style="color:#10b981;font-size:13px;font-weight:700;text-decoration:none;">Import Repository →</a>
    </div>
    ${baseFooter(footerText || 'You received this because you are part of the Cencori developer network.')}
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
