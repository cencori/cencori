"use client";

import { createBrowserClient } from "@supabase/ssr"; // Import browser client
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { redirect, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlusIcon } from "@/components/ui/plus";
import { BoxesIcon } from "@/components/ui/boxes";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan_id: string;
  organization_plans: { name: string }[]; // Corrected to array type
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
          .select("id, name, slug, description, plan_id, organization_plans(name)");

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center space-x-4 pb-12">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-6 mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
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
      <div className="text-center p-10 ">
        <p className="text-sm mb-4 mt-32">You don&apos;t have any organizations yet.</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center space-x-4 pb-6 sm:pb-12">
        <h1 className="text-base sm:text-lg font-bold">Your Organizations</h1>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-xs pl-8"
          />
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/organizations/new">
            <PlusIcon size={16} className="mr-2" />
            New Organization
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrganizations.map((org) => (
          <Card
            key={org.id}
            className="cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50 group"
            onClick={() => router.push(`/dashboard/organizations/${org.slug}/projects`)}
          >
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors shrink-0">
                  <BoxesIcon size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg mb-1">{org.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {org.organization_plans[0]?.name?.charAt(0).toUpperCase() + org.organization_plans[0]?.name?.slice(1) || "Free"} Plan
                    <span className="mx-1.5">•</span>
                    Projects
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
