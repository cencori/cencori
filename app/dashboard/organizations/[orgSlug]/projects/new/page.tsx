/* eslint-disable react/no-unescaped-entities */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react"; // Import useEffect and useState
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateSlug } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useBreadcrumbs } from "@/lib/contexts/BreadcrumbContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

const formSchema = z.object({
  name: z.string().min(2, { message: "Project name must be at least 2 characters." }),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]), // Make it non-optional here, with default in `useForm`
  github_repo_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewProjectPage({ params }: { params: { orgSlug: string } }) {
  const { orgSlug } = params;
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orgLoading, setOrgLoading] = useState(true); // New loading state for organization
  const [orgError, setOrgError] = useState<string | null>(null); // New error state for organization
  const [organization, setOrganization] = useState<OrganizationData | null>(null); // New state for organization

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );

  const { setBreadcrumbs } = useBreadcrumbs();

  // Fetch organization details in useEffect
  useEffect(() => {
    const fetchOrg = async () => {
      setOrgLoading(true);
      setOrgError(null);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data: orgData, error: fetchError } = await supabase
          .from("organizations")
          .select("id, name, slug")
          .eq("slug", orgSlug)
          .eq("owner_id", user.id)
          .single();

        if (fetchError || !orgData) {
          console.error("Error fetching organization:", fetchError?.message);
          setOrgError("Organization not found or you don't have permission.");
          return;
        }
        setOrganization(orgData);

        setBreadcrumbs([
          { label: "Organizations", href: "/dashboard/organizations" },
          { label: orgData.name, href: `/dashboard/organizations/${orgSlug}/projects` },
          { label: "Projects", href: `/dashboard/organizations/${orgSlug}/projects` },
          { label: "New" },
        ]);

      } catch (err: unknown) { // Change any to unknown
        console.error("Unexpected error fetching organization:", (err as Error).message);
        setOrgError("An unexpected error occurred while loading organization details.");
      } finally {
        setOrgLoading(false);
      }
    };

    fetchOrg();
  }, [orgSlug, setBreadcrumbs, router, supabase]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      visibility: "private", // Explicitly set default here
      github_repo_url: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in to create a project.");
      setLoading(false);
      return;
    }

    if (!organization) {
      toast.error("Organization data is not loaded yet. Please try again.");
      setLoading(false);
      return;
    }

    let newSlug = generateSlug();
    let slugExists = true;

    // Ensure project slug is unique within this organization
    for (let i = 0; i < 5; i++) { // Max 5 retries
      const { data, error } = await supabase
        .from("projects")
        .select("slug")
        .eq("organization_id", organization.id)
        .eq("slug", newSlug)
        .single();

      if (!data) {
        slugExists = false;
        break;
      }
      newSlug = generateSlug();
    }

    if (slugExists) {
      toast.error("Could not generate a unique project slug. Please try again.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("projects").insert({
      name: values.name,
      slug: newSlug,
      description: values.description,
      organization_id: organization.id,
      visibility: values.visibility, // Insert new field
      github_repo_url: values.github_repo_url || null, // Insert new field, handle empty string
    });

    if (error) {
      console.error("Error creating project:", error.message);
      toast.error("Failed to create project. " + error.message);
    } else {
      toast.success("Project created successfully!");
      router.push(`/dashboard/organizations/${orgSlug}/projects/${newSlug}`);
    }
    setLoading(false);
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xl">Loading organization details...</p>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xl text-red-500">{orgError}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center pt-10">
      <Card className="w-[550px]">
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          <CardDescription>Create a new project for {organization?.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="A brief description of my project"
                {...form.register("description")}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="visibility">Visibility</Label>
              <Select onValueChange={(value) => form.setValue("visibility", value as "private" | "public")} defaultValue="private">
                <SelectTrigger id="visibility" className="w-full">
                  <SelectValue placeholder="Select a visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="github_repo_url">GitHub Repository URL (Optional)</Label>
              <Input
                id="github_repo_url"
                placeholder="https://github.com/your-repo"
                {...form.register("github_repo_url")}
              />
              {form.formState.errors.github_repo_url && (
                <p className="text-red-500 text-sm">{form.formState.errors.github_repo_url.message}</p>
              )}
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Project"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href={`/dashboard/organizations/${orgSlug}/projects`}>Cancel</Link>
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Projects are contained within organizations.
        </CardFooter>
      </Card>
    </div>
  );
}
