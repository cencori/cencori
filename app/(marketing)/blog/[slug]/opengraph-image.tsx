import { ImageResponse } from "next/og";
import { getAllPosts } from "@/lib/blog";

export const runtime = "edge";

export const alt = "Cencori Blog";
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

// SVG of the Cencori logo (inline)
const logoSvg = `<svg width="21924" height="21924" viewBox="0 0 21924 21924" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_190_39)"><circle cx="7744" r="7744" fill="white"/><circle cy="14180" r="7744" fill="white"/><circle cx="21924" cy="7744" r="7744" fill="white"/><circle cx="14180" cy="21924" r="7744" fill="white"/></g><defs><clipPath id="clip0_190_39"><rect width="21924" height="21924" rx="594" fill="white"/></clipPath></defs></svg>`;
const logoBase64 = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;

export default async function Image({ params }: { params: { slug: string } }) {
    const { slug } = await params;
    const posts = getAllPosts();
    const post = posts.find((p) => p.slug === slug);
    const title = post ? post.title : "Cencori Blog";

    // Fallback to simpler path resolution for font in nested routes
    // Ideally we'd use a shared utility or asset export but copying logic is safer for edge bundling
    // We are 2 levels deep: app/(marketing)/blog/[slug] -> need to go up to app/Geist-Black.ttf
    // Relative path: ../../../Geist-Black.ttf (from (marketing)/blog/[slug])
    // But import.meta.url resolution is tricky. Let's try to reference the one we copied to app/

    const fontData = await fetch(
        new URL("../../../Geist-Black.ttf", import.meta.url)
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
                            marginTop: "auto",
                            marginBottom: "0",
                            fontFamily: '"Geist", sans-serif',
                        }}
                    >
                        {title}
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
