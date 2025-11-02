/* eslint-disable react/no-unescaped-entities */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, { message: "Project name must be at least 2 characters." }),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof formSchema>;

interface ProjectData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: 'private' | 'public';
  status: 'active' | 'inactive';
}

export default function EditProjectPage({
  params,
}: {
  params: { orgSlug: string; projectSlug: string };
}) {
  const { orgSlug, projectSlug } = params;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          toast.error("You must be logged in to view projects.");
          router.push("/login");
          return;
        }

        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("id")
          .eq("slug", orgSlug)
          .eq("owner_id", user.id) // Ensure owner has access
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          setError("Organization not found or you don't have permission.");
          setLoading(false);
          return;
        }

        const { data: projectData, error: fetchError } = await supabase
          .from("projects")
          .select("id, name, slug, description, visibility, status")
          .eq("organization_id", orgData.id)
          .eq("slug", projectSlug)
          .single();

        if (fetchError || !projectData) {
          console.error("Error fetching project:", fetchError?.message);
          setError("Project not found or you don't have permission.");
          setLoading(false);
          return;
        }

        setProject(projectData);
        form.reset({ // Pre-fill the form
          name: projectData.name,
          description: projectData.description || "",
          visibility: projectData.visibility,
          status: projectData.status,
        });
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [orgSlug, projectSlug, router, form, supabase]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in to update a project.");
      setSubmitting(false);
      return;
    }

    if (!project) {
      toast.error("Project data not loaded.");
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.from("projects").update({
      name: values.name,
      description: values.description,
      visibility: values.visibility,
      status: values.status,
    }).eq("id", project.id);

    if (updateError) {
      console.error("Error updating project:", updateError.message);
      toast.error("Failed to update project: " + updateError.message);
    } else {
      toast.success("Project updated successfully!");
      router.push(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}`);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xl">Loading project...</p>
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

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xl text-red-500">Project data not available.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
      <Card className="w-[550px]">
        <CardHeader>
          <CardTitle>Edit Project: {project.name}</CardTitle>
          <CardDescription>Update the details for this project.</CardDescription>
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
              <Select onValueChange={(value) => form.setValue("visibility", value as FormValues["visibility"]) } defaultValue={form.getValues("visibility")}>
                <SelectTrigger id="visibility">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.visibility && (
                <p className="text-red-500 text-sm">{form.formState.errors.visibility.message}</p>
              )}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value) => form.setValue("status", value as FormValues["status"]) } defaultValue={form.getValues("status")}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.status && (
                <p className="text-red-500 text-sm">{form.formState.errors.status.message}</p>
              )}
            </div>
            <div className="flex justify-between items-center mt-4">
            <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Updating..." : "Update Project"}
            </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          Project details are essential for team collaboration.
        </CardFooter>
      </Card>
    </div>
  );
}
