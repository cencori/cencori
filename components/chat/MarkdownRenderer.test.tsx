import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("MarkdownRenderer", () => {
    it("uses the surrounding theme for regular prose and list text", () => {
        const html = renderToStaticMarkup(
            <MarkdownRenderer content={"Hello there.\n\n- First item\n- Second item"} />,
        );

        expect(html).toContain("color:var(--foreground)");
        expect(html).toContain("--tw-prose-body:var(--foreground)");
        expect(html).toContain("--tw-prose-bullets:var(--muted-foreground)");
        expect(html).toContain("Hello there.");
        expect(html).toContain("First item");
    });
});
