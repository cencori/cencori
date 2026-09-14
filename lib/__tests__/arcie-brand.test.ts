import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { arcieBrand } from "@/lib/arcie-brand";
import { navigationMenus } from "@/components/nav/nav-data";

const read = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Arcie public positioning", () => {
  it("keeps the agreed definition consistent across canonical and public docs", () => {
    expect(arcieBrand.definition).toBe(
      "Arcie—Cencori’s model-agnostic agent infrastructure",
    );
    for (const file of [
      "content/arcie/index.mdx",
      "content/arcie/managed-api.mdx",
      "docs/company/ARCIE_POSITIONING.md",
      "docs/company/CENCORI_COMPANY_BIBLE.md",
      "docs/company/VOLUME_5_GTM.md",
      "docs/company/VOLUME_7_AGENT_KNOWLEDGE_BASE.md",
    ]) {
      expect(read(file), file).toContain(arcieBrand.definition);
    }
  });

  it("distinguishes the available framework from the managed API direction", () => {
    expect(arcieBrand.framework.status).toBe("Available");
    expect(arcieBrand.managedApi.status).toBe("In development");
    expect(read("content/arcie/managed-api.mdx")).toContain(
      "not a\nproduction API contract",
    );
  });

  it("exposes the managed API direction through both navigation and docs", () => {
    const products = navigationMenus.find((menu) => menu.id === "products");
    const hrefs = (products?.groups ?? []).flatMap((group) =>
      (group.items ?? []).flatMap((item) => [
        item.href,
        item.link?.href,
        ...((item as { preview?: { href?: string }[] }).preview ?? []).map(
          (entry) => entry.href,
        ),
      ]),
    );
    expect(hrefs).toContain("/arcie");
    const meta = JSON.parse(read("content/arcie/meta.json"));
    expect(meta.pages).toContain("managed-api");
  });

  it("does not retain the retired product name or broken rename artifacts in public docs", () => {
    for (const file of readdirSync(path.join(process.cwd(), "content/arcie"))) {
      if (!file.endsWith(".mdx")) continue;
      expect(read(`content/arcie/${file}`), file).not.toMatch(
        /\bZett\b|basarcie|timarcie/,
      );
    }
  });
});
