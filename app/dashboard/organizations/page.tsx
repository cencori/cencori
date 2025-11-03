"use client";

import { createBrowserClient } from "@supabase/ssr"; // Import browser client
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/config/site";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlusIcon } from "@/components/ui/plus";
import { BoxesIcon } from "@/components/ui/boxes"; // Import BoxesIcon
import { Input } from "@/components/ui/input";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: string;
  current_plan: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<OrganizationData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );

  useEffect(() => {
    const fetchOrganizations = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          // If no user, redirect to login
          router.push(siteConfig.links.signInUrl);
          return;
        }

        const { data: orgsData, error: fetchError } = await supabase
          .from("organizations")
          .select("id, name, slug, description, type, current_plan")
          .eq("owner_id", user.id);

        if (fetchError) {
          console.error("Error fetching organizations:", fetchError.message);
          setError("Error loading organizations.");
        } else {
          setOrganizations(orgsData);
          if (orgsData && orgsData.length === 0) {
            // If no organizations, redirect to new organization page
            router.push("/dashboard/organizations/new");
          }
        }
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [router]); // Depend on router to ensure it's ready

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm">Loading organizations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xl text-red-500">{error}</p>
      </div>
    );
  }

  // This block should ideally not be reached if organizations.length is 0 due to redirect in useEffect
  if (!organizations || organizations.length === 0) {
    return (
      <div className="text-center p-10 border rounded-lg">
        <p className="text-sm mb-4">You don&apos;t have any organizations yet.</p>
        <Button asChild>
          <Link href="/dashboard/organizations/new">Create Your First Organization</Link>
        </Button>
      </div>
    );
  }

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center space-x-4 pb-4">
        <h1 className="text-lg font-bold">Your Organizations</h1>
      </div>
      <div className="flex justify-between items-center mb-6">
        <Input
          type="text"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-xs mr-6"
        />
        <Button asChild>
          <Link href="/dashboard/organizations/new">
            <PlusIcon size={16} className="mr-2" />
            New Organization
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrganizations.map((org) => (
          <Card key={org.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/organizations/${org.slug}/projects`)}>
            <CardHeader>
              <div>
              <BoxesIcon size={24} className="text-muted-foreground pb-4" />
              </div>
              <div className="flex-col">
                <CardTitle className="font-bold">{org.name}</CardTitle>
                  <p className="text-muted-foreground">{org.current_plan.charAt(0).toUpperCase() + org.current_plan.slice(1) + " Plan"}</p>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
