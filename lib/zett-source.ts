import { loader } from "fumadocs-core/source";
import { zett } from "@/.source/server";

// Fumadocs content source for the Zett docs route. The generated `.source`
// `zett` collection is produced by the fumadocs-mdx plugin (createMDX in
// next.config) from content/zett — kept separate from the main `docs`
// collection in lib/source.ts so Zett can carry its own design.
export const zettSource = loader({
  baseUrl: "/zett/docs",
  source: zett.toFumadocsSource(),
});
