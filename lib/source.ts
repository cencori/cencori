import { loader } from "fumadocs-core/source";
import { docs } from "@/.source/server";

// Fumadocs content source for the docs route. Generated `.source` is produced by
// the fumadocs-mdx plugin (createMDX in next.config) from content/docs.
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
