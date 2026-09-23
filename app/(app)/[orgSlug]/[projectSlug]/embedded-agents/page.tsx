import { permanentRedirect } from "next/navigation";

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default async function LegacyEmbeddedAgentsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = await params;
    permanentRedirect(`/${orgSlug}/${projectSlug}/agents`);
}
