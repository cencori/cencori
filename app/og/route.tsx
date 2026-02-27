import type { NextRequest } from "next/server";
import { GET as handleOgRequest } from "../api/og/route";

export const runtime = "edge";

export function GET(request: NextRequest) {
    return handleOgRequest(request);
}
