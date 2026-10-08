import { NextResponse } from "next/server";

/**
 * Stable download links for Tensor: /tensor/download/apple-silicon and /tensor/download/intel.
 *
 * They point at the newest release in the public tensor-releases repository, whose installers keep
 * the same file names from release to release. So these links never change, and where the files
 * live can change behind them without any link that has been shared going stale.
 */
const RELEASES = "https://github.com/cencori/tensor-releases/releases/latest/download";

const INSTALLERS: Record<string, string> = {
  "apple-silicon": "Tensor-arm64.dmg",
  intel: "Tensor-x64.dmg",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const installer = INSTALLERS[platform];
  if (!installer) {
    return NextResponse.redirect(new URL("/tensor/download", _request.url), 302);
  }
  // Not cached: the newest release is whatever GitHub says it is at the moment of the click.
  return NextResponse.redirect(`${RELEASES}/${installer}`, {
    headers: { "Cache-Control": "no-store" },
    status: 302,
  });
}
