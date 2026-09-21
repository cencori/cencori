interface BuildOgImageUrlOptions {
    title: string;
    subtitle?: string;
    type?: string;
    author?: string;
    date?: string;
    align?: "left" | "center";
    logo?: boolean;
}

export function buildOgImageUrl({
    title,
    subtitle,
    type,
    author,
    date,
    align,
    logo,
}: BuildOgImageUrlOptions): string {
    const params = new URLSearchParams({ title });

    if (subtitle) params.set("subtitle", subtitle);
    if (type) params.set("type", type);
    if (author) params.set("author", author);
    if (date) params.set("date", date);
    if (align) params.set("align", align);
    if (logo === false) params.set("logo", "0");

    return `/og?${params.toString()}`;
}
