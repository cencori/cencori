import { ImageResponse } from "next/og";

export const runtime = "edge";

// Link preview for status.cencori.com. The brand OG (/brand/og) inverted:
// black background, white "Status.". Lives under /og, not /status, because
// /status/* redirects to the status subdomain.
export async function GET() {
    const fontData = await fetch(
        new URL("../../Inter-Black.ttf", import.meta.url)
    ).then((res) => res.arrayBuffer());

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    background: "#000000",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        right: "80px",
                        bottom: "56px",
                        display: "flex",
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "120px",
                        fontWeight: 900,
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                        color: "#ffffff",
                        margin: 0,
                    }}
                >
                    Status
                    {/* Same green as the status page's operational badge. */}
                    <span style={{ color: "#34d399" }}>.</span>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts: [
                {
                    name: "Inter",
                    data: fontData,
                    style: "normal",
                    weight: 900,
                },
            ],
        }
    );
}
