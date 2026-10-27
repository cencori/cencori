"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import QRCode from "qrcode";
import { Download, Share2, X } from "lucide-react";

/**
 * The customer link as a QR code, for a table card, a shop window or a flyer:
 * shown big enough to scan off the phone, shared as a link, or saved as a
 * ready-to-print card (business name, the code, "Scan to chat with us").
 */
export function StudioLinkQr({ url, name, open, onOpenChange }: { url: string; name: string; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [svg, setSvg] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        void QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }).then(setSvg);
    }, [open, url]);

    const share = async () => {
        try {
            if (navigator.share) await navigator.share({ title: name, url });
            else await navigator.clipboard.writeText(url);
        } catch {
            // Dismissed the share sheet.
        }
    };

    const saveCard = async () => {
        setSaving(true);
        try {
            const card = await printableCard(url, name);
            const link = document.createElement("a");
            link.href = card;
            link.download = `${name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "chat"}-qr.png`;
            link.click();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 z-50 bg-black/30" />
                <Drawer.Content className="dashboard-theme fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl border-t border-border/60 bg-background px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 font-sans text-foreground outline-none">
                    <div className="flex h-10 items-center justify-between">
                        <Drawer.Title className="text-[17px] font-semibold">Your QR code</Drawer.Title>
                        <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full"><X className="h-5 w-5" /></button>
                    </div>
                    <Drawer.Description className="text-[13px] leading-5 text-muted-foreground">Customers scan it to chat with your assistant. Put it on tables, your counter, flyers or packaging.</Drawer.Description>
                    <div className="mx-auto mt-5 w-full max-w-[280px] rounded-3xl bg-white p-4">
                        {svg ? <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="aspect-square w-full" />}
                    </div>
                    <p className="mt-3 truncate text-center text-[13px] text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => void share()} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border/60 text-[15px] font-medium"><Share2 className="h-4 w-4" />Share link</button>
                        <button type="button" onClick={() => void saveCard()} disabled={saving} className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-60"><Download className="h-4 w-4" />Save card</button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}

/** A 1080×1350 PNG to print: the business name, the code, and what to do with it. */
async function printableCard(url: string, name: string): Promise<string> {
    const code = new Image();
    code.src = await QRCode.toDataURL(url, { width: 760, margin: 1, errorCorrectionLevel: "M" });
    await code.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111111";
    context.textAlign = "center";
    context.font = "600 64px system-ui, -apple-system, sans-serif";
    context.fillText(fit(context, name, 920), 540, 170);
    context.drawImage(code, 160, 250, 760, 760);
    context.font = "600 52px system-ui, -apple-system, sans-serif";
    context.fillText("Scan to chat with us", 540, 1110);
    context.fillStyle = "#6b6b6b";
    context.font = "36px system-ui, -apple-system, sans-serif";
    context.fillText("Ask, order or book, any time", 540, 1175);
    return canvas.toDataURL("image/png");
}

function fit(context: CanvasRenderingContext2D, text: string, width: number): string {
    if (context.measureText(text).width <= width) return text;
    let cut = text;
    while (cut.length > 1 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
}
