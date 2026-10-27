/**
 * The invoice PDF.
 *
 * Coordinates are in the design's pixels (a 1440px-wide page) and scaled to
 * A4 points, so positions can be read straight off the mockup. Preview
 * changes live at /dev/invoice while `next dev` is running.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import type { BachsInvoiceDocument, InvoiceOrg } from './bachs-invoices';

const ASSETS = path.join(process.cwd(), 'lib/billing/invoice-assets');

const PAGE_PX = 1440;
const A4_WIDTH_PT = 595.28;
const K = A4_WIDTH_PT / PAGE_PX;
const px = (n: number) => n * K;

type RGB = [number, number, number];
const INK: RGB = [17, 17, 17];
const GREEN: RGB = [72, 187, 120];
const GREEN_DARK: RGB = [30, 130, 70];
const RULE: RGB = [200, 200, 200];
const BAND: RGB = [200, 200, 198];
const MUTED: RGB = [90, 90, 90];

const LEFT = 52;
const RIGHT = 1378;
const TABLE_LEFT = 56;
const TABLE_RIGHT = 1382;
const AMOUNT_X = 1340;
const TOTAL_LABEL_X = 1010;

const FONTS = { regular: 'Geist-Regular', medium: 'Geist-Medium', semibold: 'Geist-SemiBold', bold: 'Geist-Bold' } as const;
type Weight = keyof typeof FONTS;

let assets: { fonts: Record<Weight, string>; logo: Uint8Array } | null = null;

function loadAssets() {
    if (!assets) {
        const font = (file: string) => readFileSync(path.join(ASSETS, `${file}.ttf`)).toString('base64');
        assets = {
            fonts: {
                regular: font(FONTS.regular),
                medium: font(FONTS.medium),
                semibold: font(FONTS.semibold),
                bold: font(FONTS.bold),
            },
            logo: new Uint8Array(readFileSync(path.join(ASSETS, 'logo.png'))),
        };
    }
    return assets;
}

export function renderBachsInvoicePdf(invoice: BachsInvoiceDocument): ArrayBuffer {
    const { fonts, logo } = loadAssets();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    for (const weight of Object.keys(FONTS) as Weight[]) {
        doc.addFileToVFS(`${FONTS[weight]}.ttf`, fonts[weight]);
        doc.addFont(`${FONTS[weight]}.ttf`, FONTS[weight], 'normal');
    }
    doc.setProperties({ title: `Invoice ${invoice.number}`, author: 'Cencori Inc.' });

    const text = (
        value: string | string[],
        x: number,
        y: number,
        opts: { size: number; weight?: Weight; color?: RGB; align?: 'left' | 'right'; spacing?: number; maxWidth?: number; lineHeight?: number },
    ) => {
        doc.setFont(FONTS[opts.weight ?? 'regular'], 'normal');
        doc.setFontSize(px(opts.size));
        doc.setTextColor(...(opts.color ?? INK));
        doc.text(value, px(x), px(y), {
            align: opts.align ?? 'left',
            charSpace: opts.spacing ? px(opts.spacing) : 0,
            maxWidth: opts.maxWidth ? px(opts.maxWidth) : undefined,
            lineHeightFactor: opts.lineHeight ?? 1.15,
        });
    };
    const rule = (y: number, x1 = LEFT, x2 = RIGHT, color = RULE, width = 1.5) => {
        doc.setDrawColor(...color).setLineWidth(px(width));
        doc.line(px(x1), px(y), px(x2), px(y));
    };
    const label = (value: string, x: number, y: number, color = GREEN) =>
        text(value, x, y, { size: 20, weight: 'bold', color });

    // ── Header ──
    doc.addImage(logo, 'PNG', px(LEFT), px(34), px(235), px(235 * 246 / 2048));
    text('INVOICE', LEFT, 178, { size: 52, weight: 'bold' });

    const meta: [string, string][] = [
        ['INVOICE NO.', invoice.number],
        ['ISSUE DATE', ordinalDate(invoice.paidAt)],
        ['PAYMENT DATE', ordinalDate(invoice.paidAt)],
    ];
    meta.forEach(([name, value], i) => {
        const y = 177 + i * 58;
        label(name, 728, y);
        text(value, 943, y, { size: 22, spacing: 1.2 });
    });

    // ── Billed to ──
    label('BILLED TO', LEFT, 250, GREEN_DARK);
    text(invoice.org.name, LEFT, 290, { size: 27, weight: 'semibold' });
    const contact = billedToLines(invoice.org);
    text(contact, LEFT, 328, { size: 22, lineHeight: 1.45 });
    const billedEnd = 328 + (contact.length - 1) * 22 * 1.45;

    // Everything below moves down when the address runs long.
    const dy = Math.max(0, billedEnd + 120 - 477);
    let y = 477 + dy;

    text(['Prepaid API credits for the Cencori platform, paid by card.'], LEFT, y, { size: 19, weight: 'semibold', maxWidth: 620, lineHeight: 1.5 });
    y += 78;
    rule(y);
    y += 52;
    label('SUMMARY', LEFT, y);

    // ── Summary table ──
    const tableTop = y + 19;
    y = tableTop;
    const rowRule = (at: number) => rule(at, TABLE_LEFT, TABLE_RIGHT, RULE, 1.5);
    text('DESCRIPTION', 91, y + 41, { size: 19, weight: 'bold' });
    text('TOTAL (USD)', 1337, y + 41, { size: 19, weight: 'bold', align: 'right', spacing: 1.2 });
    y += 75;
    rowRule(y);

    for (const line of invoice.lines) {
        text(line.title, 91, y + 45, { size: 21, weight: 'semibold' });
        text(line.detail, 91, y + 70, { size: 19 });
        text(usd(line.amountUsd), AMOUNT_X, y + 45, { size: 21, align: 'right', spacing: 1 });
        y += 92;
        rowRule(y);
    }

    const totalRow = (name: string, value: string, height = 92) => {
        text(name, TOTAL_LABEL_X, y + 56, { size: 17, weight: 'bold', align: 'right', spacing: 2 });
        text(value, AMOUNT_X, y + 56, { size: 22, align: 'right', spacing: 1 });
        y += height;
    };
    totalRow('SUBTOTAL', usd(invoice.totalUsd));
    rowRule(y);
    totalRow('TAX', usd(0));

    // Grey band with the paid total.
    const bandHeight = 100;
    doc.setFillColor(...BAND);
    doc.rect(px(TABLE_LEFT), px(y), px(TABLE_RIGHT - TABLE_LEFT), px(bandHeight), 'F');
    text('TOTAL PAID (USD)', 1015, y + 62, { size: 25, weight: 'bold', align: 'right', spacing: 2.5 });
    text(usd(invoice.totalUsd), AMOUNT_X, y + 62, { size: 26, weight: 'bold', align: 'right', spacing: 1.5 });
    y += bandHeight;

    // Table frame, drawn last so it sits on top of the band.
    doc.setDrawColor(...RULE).setLineWidth(px(1.5));
    doc.rect(px(TABLE_LEFT), px(tableTop), px(TABLE_RIGHT - TABLE_LEFT), px(y - tableTop));

    // ── Amount in words ──
    y += 77;
    label('AMOUNT IN WORDS', LEFT, y);
    text(`${amountInWords(invoice.totalUsd)} Only.`, LEFT, y + 37, { size: 19, weight: 'semibold' });
    y += 78;
    rule(y);

    // ── Payment information and notes ──
    y += 54;
    label('PAYMENT INFORMATION', LEFT, y);
    label('NOTES', 759, y);

    const payment: [string, string][] = [
        ['Payment Method:', 'Card'],
        ['Currency:', 'USD'],
        ['Status:', 'Paid in full'],
        ['Payment Reference:', invoice.chargeId],
    ];
    payment.forEach(([name, value], i) => {
        const rowY = y + 50 + i * 34;
        text(name, LEFT, rowY, { size: 19, weight: 'semibold' });
        text(value, 303, rowY, { size: value === invoice.chargeId ? 15 : 20 });
    });

    const notes = [
        'This invoice is for a payment already received. No balance is due.',
        `${usd(invoice.netCreditsUsd)} in API credits was added to ${invoice.org.name} after the card top-up fee.`,
    ];
    let noteY = y + 57;
    for (const note of notes) {
        doc.setFillColor(...INK);
        doc.circle(px(782), px(noteY - 7), px(3.2), 'F');
        const wrapped = wrap(doc, note, 21, 560);
        text(wrapped, 798, noteY, { size: 21, lineHeight: 1.45 });
        noteY += wrapped.length * 21 * 1.45 + 4;
    }
    doc.circle(px(782), px(noteY - 7), px(3.2), 'F');
    text('For any questions, please contact', 798, noteY, { size: 21 });
    doc.setFont(FONTS.regular, 'normal').setFontSize(px(21));
    const leadWidth = doc.getTextWidth('For any questions, please contact ') / K;
    text('billing@cencori.com', 798 + leadWidth, noteY, { size: 21, weight: 'semibold' });

    // ── Footer ──
    y = Math.max(y + 50 + payment.length * 34, noteY + 20) + 20;
    rule(y, 48, 1374);
    text('Thank you for your trust and partnership.', LEFT, y + 44, { size: 20, weight: 'semibold' });
    text('Cencori Inc.', LEFT, y + 85, { size: 20, weight: 'semibold', color: GREEN });
    text(['Powering critical systems across AI,', 'enterprises, and modern computing.'], LEFT, y + 119, { size: 20, lineHeight: 1.45, color: MUTED });
    ['billing@cencori.com', 'cencori.com', 'Lagos, Nigeria'].forEach((line, i) => {
        text(line, 1155, y + 48 + i * 46, { size: 20, spacing: 1 });
    });

    return doc.output('arraybuffer');
}

function wrap(doc: jsPDF, value: string, size: number, maxWidth: number): string[] {
    doc.setFont(FONTS.regular, 'normal').setFontSize(px(size));
    return doc.splitTextToSize(value, px(maxWidth)) as string[];
}

function billedToLines(org: InvoiceOrg): string[] {
    const cityLine = [org.billing_city, [org.billing_state, org.billing_zip].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
    return [
        org.billing_email,
        org.billing_address_line1,
        org.billing_address_line2,
        cityLine,
        countryName(org.billing_country),
        org.billing_tax_id ? `Tax ID: ${org.billing_tax_id}` : null,
    ].filter((line): line is string => Boolean(line));
}

function countryName(code: string | null): string | null {
    if (!code) return null;
    try {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
    } catch {
        return code;
    }
}

/** "6th October 2026" */
function ordinalDate(iso: string): string {
    const date = new Date(iso);
    const day = date.getUTCDate();
    const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] ?? 'th';
    const rest = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `${day}${suffix} ${rest}`;
}

function usd(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underThousand(n: number): string {
    const hundreds = Math.floor(n / 100);
    const rest = n % 100;
    const parts: string[] = [];
    if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
    if (rest >= 20) parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ''));
    else if (rest || !hundreds) parts.push(ONES[rest]);
    return parts.join(' ');
}

function integerInWords(n: number): string {
    if (n === 0) return 'Zero';
    const scales = ['', ' Thousand', ' Million', ' Billion'];
    const parts: string[] = [];
    for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
        const chunk = n % 1000;
        if (chunk) parts.unshift(underThousand(chunk) + scales[i]);
    }
    return parts.join(' ');
}

/** "Fifty-Two Dollars and Ninety Cents" */
export function amountInWords(amount: number): string {
    const cents = Math.round(amount * 100);
    const dollars = Math.floor(cents / 100);
    const rest = cents % 100;
    const dollarWords = `${integerInWords(dollars)} Dollar${dollars === 1 ? '' : 's'}`;
    return rest ? `${dollarWords} and ${integerInWords(rest)} Cent${rest === 1 ? '' : 's'}` : dollarWords;
}
