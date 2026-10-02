import BrandPageContent from "@/components/brand/BrandPageContent";

export const metadata = {
    title: { absolute: "Brand" },
    description: "Download official Cencori logos and brand assets.",
    openGraph: {
        images: ["/brand/og"],
    },
    twitter: {
        card: "summary_large_image",
        images: ["/brand/og"],
    },
};

export default function BrandPage() {
    return <BrandPageContent />;
}
