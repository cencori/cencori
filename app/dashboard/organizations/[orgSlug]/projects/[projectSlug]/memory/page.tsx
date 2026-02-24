import { redirect } from "next/navigation";
import { authenticate } from '../authenticate';

const ADMIN_ROUTES = ['/dashboard/organizations/', '/dashboard/organizations'];

export default async function MemoryPage({ params }: { params: Promise<{ orgSlug: string; projectSlug: string }> }) {
    const { orgSlug, projectSlug } = await params;
    if (!await authenticate()) {
        throw new Error('Unauthorized');
    }
    const route = `/dashboard/organizations/${orgSlug}/projects/${projectSlug}`;
    if (ADMIN_ROUTES.some(adminRoute => route.startsWith(adminRoute))) {
        // Ensure proper authentication for admin routes
        if (!(await authenticate('admin'))) {
            throw new Error('Unauthorized for admin route');
        }
    }
    redirect(route);
}