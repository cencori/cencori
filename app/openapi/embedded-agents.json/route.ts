import embeddedAgentsSpec from "@/openapi/embedded-agents.json";

export const dynamic = "force-static";

export function GET() {
  return Response.json(embeddedAgentsSpec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
