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
    <div class="footer" style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid #dadce0;">
      ${extra ? `<p class="muted" style="color:#5f6368;font-size:13px;margin:0 0 12px;line-height:1.5;">${extra}</p>` : ''}
      <p class="muted" style="color:#5f6368;font-size:11px;margin:0;letter-spacing:0.3px;text-transform:uppercase;">
        © ${CURRENT_YEAR} Cencori · <a href="https://cencori.com" class="muted" style="color:#5f6368;text-decoration:underline;">cencori.com</a>
      </p>
      <div style="margin-top:12px;">
        <a href="https://cencori.com/dashboard" class="muted" style="color:#5f6368;font-size:11px;text-decoration:underline;margin:0 8px;">Dashboard</a>
        <a href="https://cencori.com/docs" class="muted" style="color:#5f6368;font-size:11px;text-decoration:underline;margin:0 8px;">Documentation</a>
        <a href="https://cencori.com/blog" class="muted" style="color:#5f6368;font-size:11px;text-decoration:underline;margin:0 8px;">Security Research</a>
      </div>
    </div>`;
}

function wrapInContainer(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
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
    body, .body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ffffff !important;
      color: #202124 !important;
    }
    table, td { color: #202124; }
    a { color: #1a73e8; text-decoration: underline; }
    img { border: 0; display: block; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    p { margin: 0 0 16px; }
    h1, h2, h3, h4, h5, h6 { margin: 0; padding: 0; }

    /* Gmail-like (Google Material) light tokens */
    .bg { background-color: #ffffff !important; }
    .frame { background-color: #ffffff !important; border: 0 !important; border-radius: 0 !important; }
    .frame-pad { padding: 24px 18px !important; }
    .text { color: #202124 !important; }
    .muted { color: #5f6368 !important; }
    .accent { color: #1a73e8 !important; }
    .divider { border-top: 1px solid #dadce0 !important; }
    .callout { background-color: #f1f3f4 !important; border: 1px solid #dadce0 !important; border-radius: 12px !important; }
    .btn { background: #1a73e8 !important; color: #ffffff !important; text-decoration: none !important; border-radius: 999px !important; display: inline-block !important; font-weight: 700 !important; }
    .btn-outline { background: transparent !important; border: 1px solid #1a73e8 !important; color: #1a73e8 !important; text-decoration: none !important; border-radius: 999px !important; display: inline-block !important; font-weight: 600 !important; }
    .check { color: #188038 !important; font-weight: bold !important; }

    .logo-dark { display: none !important; }
    .logo-light { display: block !important; }

    @media (max-width: 600px) {
      .frame-pad { padding: 18px 14px !important; }
    }

    @media (prefers-color-scheme: dark) {
      /* Gmail-like (Google Material) dark tokens */
      body, .body { background-color: #202124 !important; color: #e8eaed !important; }
      table, td { color: #e8eaed !important; }
      .bg { background-color: #202124 !important; }
      .frame { background-color: #202124 !important; border: 0 !important; border-radius: 0 !important; }
      .text { color: #e8eaed !important; }
      .muted { color: #9aa0a6 !important; }
      .accent { color: #8ab4f8 !important; }
      .divider { border-top-color: #3c4043 !important; }
      .callout { background-color: #2b2c2f !important; border-color: #3c4043 !important; }
      a { color: #8ab4f8 !important; }
      .btn { background: #8ab4f8 !important; color: #202124 !important; }
      .btn-outline { border-color: #8ab4f8 !important; color: #8ab4f8 !important; }
      .check { color: #81c995 !important; }

      .logo-dark { display: block !important; }
      .logo-light { display: none !important; }
      .footer { border-top-color: #3c4043 !important; }
    }

    /* Outlook.com / Office 365 dark mode hooks */
    [data-ogsc] body, [data-ogsc] .body, [data-ogsc] .bg { background-color: #202124 !important; }
    [data-ogsc] .frame { background-color: #202124 !important; border: 0 !important; border-radius: 0 !important; }
    [data-ogsc] .text { color: #e8eaed !important; }
    [data-ogsc] .muted { color: #9aa0a6 !important; }
    [data-ogsc] .accent, [data-ogsc] a { color: #8ab4f8 !important; }
    [data-ogsc] .divider { border-top-color: #3c4043 !important; }
    [data-ogsc] .callout { background-color: #2b2c2f !important; border-color: #3c4043 !important; }
    [data-ogsc] .btn { background: #8ab4f8 !important; color: #202124 !important; }
    [data-ogsc] .btn-outline { border-color: #8ab4f8 !important; color: #8ab4f8 !important; }
    [data-ogsc] .check { color: #81c995 !important; }
    [data-ogsc] .logo-dark { display: block !important; }
    [data-ogsc] .logo-light { display: none !important; }
    [data-ogsc] .footer { border-top-color: #3c4043 !important; }
  </style>
</head>
<body class="body" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji','Segoe UI Symbol';line-height:1.6;color:#202124;background-color:#ffffff;margin:0;padding:0;width:100% !important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="bg" style="background-color:#ffffff;background:#ffffff;" bgcolor="#ffffff">
    <tr>
      <td align="center" class="bg" style="background-color:#ffffff;background:#ffffff;padding:0;" bgcolor="#ffffff">
        ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>` : ''}
        <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" class="frame" style="max-width:600px;width:100%;background-color:#ffffff;border:0;border-radius:0;overflow:hidden;" bgcolor="#ffffff">
          <tr>
            <td class="frame-pad" style="padding:24px 18px;text-align:left;">
              ${content}
            </td>
          </tr>
        </table>
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
    ? `<div style="text-align:center;margin:24px 0 0;">
        <a href="${ctaUrl}" class="btn" style="padding:12px 28px;font-size:14px;letter-spacing:0.2px;">${ctaText}</a>
      </div>`
    : '';

  return wrapInContainer(`
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://cencori.com" class="logo-light"><img src="${LOGO_LIGHT_THEME}" alt="Cencori" style="height:28px;margin:0 auto;" /></a>
      <div class="logo-dark" style="display:none;"><a href="https://cencori.com"><img src="${LOGO_DARK_THEME}" alt="Cencori" style="height:28px;margin:0 auto;" /></a></div>
    </div>
    <div class="text" style="font-size:15px;color:#202124;line-height:1.7;">
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
    ? `<div style="text-align:center;margin:28px 0 0;">
        <a href="${ctaUrl}" class="btn" style="padding:14px 36px;font-size:15px;letter-spacing:0.2px;">${ctaText}</a>
      </div>`
    : '';

  return wrapInContainer(`
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://cencori.com" class="logo-light"><img src="${LOGO_LIGHT_THEME}" alt="Cencori" style="height:32px;margin:0 auto 18px;" /></a>
      <div class="logo-dark" style="display:none;"><a href="https://cencori.com"><img src="${LOGO_DARK_THEME}" alt="Cencori" style="height:32px;margin:0 auto 18px;" /></a></div>
      <h1 class="text" style="color:#202124;font-size:30px;font-weight:800;margin:0 0 10px;letter-spacing:-0.6px;line-height:1.15;">${subject}</h1>
    </div>
    <div class="text" style="font-size:16px;color:#202124;line-height:1.8;">
      ${body}
    </div>
    <div class="callout" style="margin-top:22px;padding:18px 18px 6px;border-radius:12px;border:1px solid #dadce0;background:#f1f3f4;">
      <p class="text" style="color:#202124;font-size:13px;font-weight:800;margin:0 0 12px;letter-spacing:0.2px;">Core Platform Capabilities</p>
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td style="padding-bottom:12px;">
            <span class="check" style="color:#188038;font-weight:bold;margin-right:8px;">✓</span>
            <span class="text" style="color:#202124;font-size:13px;"><strong class="text" style="color:#202124;">Advanced SAST:</strong> Real-time detection of 1,000+ secret types and vulns.</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;">
            <span class="check" style="color:#188038;font-weight:bold;margin-right:8px;">✓</span>
            <span class="text" style="color:#202124;font-size:13px;"><strong class="text" style="color:#202124;">Deep SCA:</strong> Semantic dependency audits via OSV.dev integration.</span>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:0;">
            <span class="check" style="color:#188038;font-weight:bold;margin-right:8px;">✓</span>
            <span class="text" style="color:#202124;font-size:13px;"><strong class="text" style="color:#202124;">AI Memory Layer:</strong> Context-aware security that learns from your code.</span>
          </td>
        </tr>
      </table>
    </div>
    ${ctaBlock}
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
    ? `<div style="text-align:center;margin:22px 0 0;">
        <a href="${ctaUrl}" class="btn-outline" style="padding:10px 22px;font-size:13px;letter-spacing:0.2px;">${ctaText}</a>
      </div>`
    : '';

  return wrapInContainer(`
    <div style="text-align:center;margin-bottom:16px;">
      <a href="https://cencori.com" class="logo-light"><img src="${LOGO_LIGHT_THEME}" alt="Cencori" style="height:24px;margin:0 auto;" /></a>
      <div class="logo-dark" style="display:none;"><a href="https://cencori.com"><img src="${LOGO_DARK_THEME}" alt="Cencori" style="height:24px;margin:0 auto;" /></a></div>
    </div>
    <div style="text-align:center;margin-bottom:26px;">
      <p class="accent" style="color:#1a73e8;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:800;margin:0 0 8px;">Weekly Intelligence</p>
      <h1 class="text" style="color:#202124;font-size:26px;font-weight:900;margin:0;letter-spacing:-0.4px;line-height:1.15;">${subject}</h1>
    </div>
    <div class="divider" style="border-top:1px solid #dadce0;padding-top:22px;">
      <div class="text" style="font-size:15px;color:#202124;line-height:1.75;">
        ${body}
      </div>
      ${ctaBlock}
    </div>
    <div class="callout" style="margin-top:28px;background:#f1f3f4;padding:18px;border-radius:12px;border:1px solid #dadce0;text-align:center;">
       <p class="text" style="color:#202124;font-size:14px;font-weight:800;margin:0 0 8px;">Securing your infrastructure?</p>
       <p class="muted" style="color:#5f6368;font-size:13px;margin:0 0 14px;">Deploy Cencori scans to detect vulnerabilities before they hit production.</p>
       <a href="https://cencori.com/scan/import" class="accent" style="color:#1a73e8;font-size:13px;font-weight:800;text-decoration:underline;">Import Repository →</a>
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
