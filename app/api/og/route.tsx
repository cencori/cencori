import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

// SVG of the Cencori logo (inline to avoid fs issues in production)
const logoSvg = `<svg width="21924" height="21924" viewBox="0 0 21924 21924" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_190_39)"><circle cx="7744" r="7744" fill="white"/><circle cy="14180" r="7744" fill="white"/><circle cx="21924" cy="7744" r="7744" fill="white"/><circle cx="14180" cy="21924" r="7744" fill="white"/></g><defs><clipPath id="clip0_190_39"><rect width="21924" height="21924" rx="594" fill="white"/></clipPath></defs></svg>`;
const logoBase64 = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

export const runtime = "edge";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);

    const title = url.searchParams.get("title") || "Cencori";
    const subtitle = url.searchParams.get("subtitle") || "";

    // Load Geist Black font (bundled at app/Geist-Black.ttf)
    const fontData = await fetch(
        new URL("../../Geist-Black.ttf", import.meta.url)
    ).then((res) => res.arrayBuffer());

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    height: "100%",
                    padding: "80px",
                    background: "#000000",
                    color: "#ffffff",
                    fontFamily: '"Geist", sans-serif',
                    position: "relative",
                }}
            >
                {/* Logo Top-Left */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        position: "absolute",
                        top: "80px",
                        left: "80px",
                    }}
                >
                    <img
                        src={logoBase64}
                        alt="Cencori"
                        width={42}
                        height={42}
                    />
                </div>

                {/* Title + Subtitle Bottom-Left */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                        flex: 1,
                        paddingTop: "160px",
                    }}
                >
                    <h1
                        style={{
                            fontSize: "64px",
                            fontWeight: 900,
                            lineHeight: 1.1,
                            letterSpacing: "-0.03em",
                            color: "#ffffff",
                            margin: 0,
                            maxWidth: "1000px",
                            fontFamily: '"Geist", sans-serif',
                        }}
                    >
                        {title}
                    </h1>
                    {subtitle && (
                        <p
                            style={{
                                fontSize: "28px",
                                fontWeight: 400,
                                lineHeight: 1.4,
                                color: "rgba(255, 255, 255, 0.6)",
                                margin: 0,
                                marginTop: "16px",
                                maxWidth: "900px",
                                fontFamily: '"Geist", sans-serif',
                            }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
            fonts: [
                {
                    name: "Geist",
                    data: fontData,
                    style: "normal",
                    weight: 900,
                },
            ],
        }
    );
}
