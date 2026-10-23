import { NextResponse, type NextRequest } from "next/server";
import { resolvePublicOrigin } from "@/lib/public-origin";

/**
 * Stable download links for Tensor: /tensor/download/apple-silicon, /tensor/download/intel, and
 * /tensor/download/windows.
 *
 * They point at the newest release in the public tensor-releases repository, whose installers keep
 * the same file names from release to release. So these links never change, and where the files
 * live can change behind them without any link that has been shared going stale.
 */
const RELEASES = "https://github.com/cencori/tensor-releases/releases/latest/download";

const INSTALLERS: Record<string, string> = {
  "apple-silicon": "Tensor-arm64.dmg",
  intel: "Tensor-x64.dmg",
  windows: "Tensor-x64-setup.exe",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const installer = INSTALLERS[platform];
  if (!installer) {
    return NextResponse.redirect(new URL("/tensor/download", resolvePublicOrigin(_request)), 302);
  }
  // Not cached: the newest release is whatever GitHub says it is at the moment of the click.
  return NextResponse.redirect(`${RELEASES}/${installer}`, {
    headers: { "Cache-Control": "no-store" },
    status: 302,
  });
}
