import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

const logoPath = join(process.cwd(), "public", "logo white.svg");
const logoData = readFileSync(logoPath);
const logoBase64 = `data:image/svg+xml;base64,${logoData.toString("base64")}`;

const BACKGROUND = "#0d0d0d";
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1aa";
const PRIMARY = "#ffffff";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);

    const title = url.searchParams.get("title") || "Cencori";
    const subtitle = url.searchParams.get("subtitle") || "";
    const type = url.searchParams.get("type") || "page";
    const author = url.searchParams.get("author") || "";
    const date = url.searchParams.get("date") || "";

    const typeLabels: Record<string, string> = {
        blog: "Blog",
        changelog: "Changelog",
        docs: "Documentation",
        page: "",
    };

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
                    fontFamily: "system-ui, -apple-system, sans-serif",
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

                {/* Title Bottom-Left */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        flex: 1,
                        paddingTop: "160px", // Push content down
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
                            // Ensure strict bottom alignment if flex doesn't behave perfectly in OG engine
                            marginTop: "auto",
                        }}
                    >
                        {title}
                    </h1>
                </div>
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
