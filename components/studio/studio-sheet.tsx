"use client";

import { Drawer } from "vaul";
import { AltArrowLeftIcon } from "@solar-icons/react/linear/alt-arrow-left";

/**
 * Studio's sheets on desktop (lg and up) are pages, not sheets: added to a
 * sheet's Drawer.Content, this fills the column beside the sidebar (or the
 * window, where there's no sidebar) with the content centred at the page
 * width, square and still. Phones keep the bottom sheet.
 */
export const SHEET_AS_PAGE =
    "lg:top-0 lg:bottom-0 lg:right-0 lg:mx-0 lg:h-auto lg:max-h-none lg:max-w-none lg:rounded-none lg:border-0 lg:px-[max(2.5rem,calc((100%-48rem)/2))] lg:pt-8 lg:!animate-none";

/** The dimmed backdrop behind a sheet; a page has none. */
export const SHEET_OVERLAY_PHONE_ONLY = "lg:hidden";

/** Desktop only: Back, at the top of a sheet shown as a page. */
export function SheetPageBack() {
    return (
        <Drawer.Close asChild>
            <button type="button" className="mb-2 hidden w-fit items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex">
                <AltArrowLeftIcon size={16} />
                Back
            </button>
        </Drawer.Close>
    );
}
