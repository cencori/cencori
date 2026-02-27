interface BuildOgImageUrlOptions {
    title: string;
    subtitle?: string;
    type?: string;
    author?: string;
    date?: string;
}

export function buildOgImageUrl({
    title,
    subtitle,
    type,
    author,
    date,
}: BuildOgImageUrlOptions): string {
    const params = new URLSearchParams({ title });

    if (subtitle) params.set("subtitle", subtitle);
    if (type) params.set("type", type);
    if (author) params.set("author", author);
    if (date) params.set("date", date);

    return `/og?${params.toString()}`;
}
