import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

// Load logo as base64
const logoPath = join(process.cwd(), "public", "cdark.png");
const logoData = readFileSync(logoPath);
const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

// Cenpact colors
const BACKGROUND = "#0d0d0d";
const FOREGROUND = "#fafafa";
const MUTED = "#a1a1aa";
const PRIMARY = "#ffffff";

export async function GET(request: NextRequest) {
    const url = new URL(request.url);

    // Get query params
    const title = url.searchParams.get("title") || "Cencori";
    const subtitle = url.searchParams.get("subtitle") || "";
    const type = url.searchParams.get("type") || "page"; // blog, changelog, docs, page
    const author = url.searchParams.get("author") || "";
    const date = url.searchParams.get("date") || "";

    // Type badge text
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
                    padding: "60px",
                    background: BACKGROUND,
                    color: FOREGROUND,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}
            >
                {/* Top row: Type badge + Logo */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "auto",
                    }}
                >
                    {/* Type badge */}
                    {typeLabels[type] && (
                        <div
                            style={{
                                display: "flex",
                                fontSize: "18px",
                                fontWeight: 500,
                                color: MUTED,
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                            }}
                        >
                            {typeLabels[type]}
                        </div>
                    )}

                    {/* Logo */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={logoBase64}
                            alt="Cencori"
                            width={24}
                            height={24}
                        />
                        <span
                            style={{
                                fontSize: "24px",
                                fontWeight: 600,
                                color: PRIMARY,
                            }}
                        >
                            Cencori
                        </span>
                    </div>
                </div>

                {/* Main content */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        flex: 1,
                    }}
                >
                    {/* Title */}
                    <div
                        style={{
                            display: "flex",
                            fontSize: title.length > 50 ? "48px" : "56px",
                            fontWeight: 700,
                            lineHeight: 1.2,
                            letterSpacing: "-0.02em",
                            color: PRIMARY,
                            maxWidth: "900px",
                        }}
                    >
                        {title}
                    </div>

                    {/* Subtitle */}
                    {subtitle && (
                        <div
                            style={{
                                display: "flex",
                                fontSize: "24px",
                                fontWeight: 400,
                                color: MUTED,
                                marginTop: "24px",
                                maxWidth: "800px",
                            }}
                        >
                            {subtitle}
                        </div>
                    )}
                </div>

                {/* Footer: Author + Date */}
                {(author || date) && (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                            marginTop: "auto",
                        }}
                    >
                        {author && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                {/* Author avatar placeholder */}
                                <div
                                    style={{
                                        display: "flex",
                                        width: "48px",
                                        height: "48px",
                                        background: "#27272a",
                                        borderRadius: "50%",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "20px",
                                        fontWeight: 600,
                                        color: MUTED,
                                    }}
                                >
                                    {author.charAt(0).toUpperCase()}
                                </div>
                                <span
                                    style={{
                                        fontSize: "20px",
                                        fontWeight: 500,
                                        color: FOREGROUND,
                                    }}
                                >
                                    {author}
                                </span>
                            </div>
                        )}

                        {author && date && (
                            <span
                                style={{
                                    fontSize: "20px",
                                    color: MUTED,
                                }}
                            >
                                ·
                            </span>
                        )}

                        {date && (
                            <span
                                style={{
                                    fontSize: "20px",
                                    color: MUTED,
                                }}
                            >
                                {date}
                            </span>
                        )}
                    </div>
                )}
            </div>
        ),
        {
            width: 1200,
            height: 630,
        }
    );
}
