import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Cencori";
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

// SVG of the Cencori logo (inline to avoid fs issues)
const logoSvg = `<svg width="21924" height="21924" viewBox="0 0 21924 21924" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_190_39)"><circle cx="7744" r="7744" fill="white"/><circle cy="14180" r="7744" fill="white"/><circle cx="21924" cy="7744" r="7744" fill="white"/><circle cx="14180" cy="21924" r="7744" fill="white"/></g><defs><clipPath id="clip0_190_39"><rect width="21924" height="21924" rx="594" fill="white"/></clipPath></defs></svg>`;
const logoBase64 = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

export default async function Image() {
    // Load Geist Black font from the API route directory (temporarily until moved)
    // Or better, I should duplicate/move it. For now, let's assume I'll copy it here or reference it.
    // Actually, I'll update the plan to move the font to `assets/fonts` or `public/fonts` but for now,
    // let's fetch it from the same relative location if possible, or just duplicate the file execution step.
    // I will try to fetch relative to THIS file. I'll need to move the font file to `app/Geist-Black.ttf` or similar.
    // FOR NOW, I will use the one in `app/api/og` if I can reach it, but `import.meta.url` is relative to this file.
    // I will COPY the font to `app/` in a subsequent step.

    // Changing strategy: I will put the font in `assets/fonts/Geist-Black.ttf` and use `fetch` with `import.meta.url` 
    // referencing a strictly co-located file. 

    const fontData = await fetch(
        new URL("./Geist-Black.ttf", import.meta.url)
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

                {/* Title Bottom-Left */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
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
                            marginBottom: "0",
                            marginTop: "auto",
                            fontFamily: '"Geist", sans-serif',
                        }}
                    >
                        Cencori
                    </h1>
                </div>
            </div>
        ),
        {
            ...size,
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
