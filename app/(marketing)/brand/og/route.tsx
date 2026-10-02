import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
    const fontData = await fetch(
        new URL("../../../Inter-Black.ttf", import.meta.url)
    ).then((res) => res.arrayBuffer());

    return new ImageResponse(
        (
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    background: "#ffffff",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        right: "80px",
                        bottom: "56px",
                        fontFamily: '"Inter", sans-serif',
                        fontSize: "120px",
                        fontWeight: 900,
                        letterSpacing: "-0.03em",
                        lineHeight: 1,
                        color: "#000000",
                        margin: 0,
                    }}
                >
                    Brand.
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
