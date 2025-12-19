/* eslint-disable react/no-unescaped-entities */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateSlug } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

const formSchema = z.object({
  name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
  type: z.enum(["personal", "agency", "startup", "company"]),
  plan: z.enum(["free", "pro", "team", "enterprise"]),
});

type FormValues = z.infer<typeof formSchema>;

// Helper to get monthly request limit based on tier
function getRequestLimit(tier: string): number {
  switch (tier) {
    case 'free': return 1000;
    case 'pro': return 50000;
    case 'team': return 250000;
    case 'enterprise': return 999999999;
    default: return 1000;
  }
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "personal",
      plan: "free",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("You must be logged in to create an organization.");
      setLoading(false);
      return;
    }

    let newSlug = generateSlug();
    let slugExists = true;

    for (let i = 0; i < 5; i++) {
      const { data } = await supabase
        .from("organizations")
        .select("slug")
        .eq("slug", newSlug)
        .single();

      if (!data) {
        slugExists = false;
        break;
      }
      newSlug = generateSlug();
    }

    if (slugExists) {
      toast.error("Could not generate a unique slug. Please try again.");
      setLoading(false);
      return;
    }

    const requestLimit = getRequestLimit(values.plan);

    const { data: orgData, error } = await supabase.from("organizations").insert({
      name: values.name,
      slug: newSlug,
      subscription_tier: values.plan,
      subscription_status: values.plan === 'free' ? 'active' : 'incomplete',
      monthly_request_limit: requestLimit,
      monthly_requests_used: 0,
      owner_id: user.id,
    }).select('id, slug').single();

    if (error) {
      console.error("Error creating organization:", error.message);
      toast.error("Failed to create organization. " + error.message);
      setLoading(false);
      return;
    }

    if (!orgData) {
      toast.error("Failed to create organization. Please try again.");
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: orgData.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      console.error("Error adding organization owner:", memberError.message);
      toast.error("Organization created but failed to add owner. Please contact support.");
      setLoading(false);
      return;
    }

    toast.success("Organization created successfully!");

    if (values.plan === 'pro' || values.plan === 'team') {
      router.push(`/dashboard/organizations/${orgData.slug}/billing?upgrade=true`);
    } else if (values.plan === 'enterprise') {
      router.push(`/contact?plan=enterprise&org=${orgData.slug}`);
    } else {
      router.push(`/dashboard/organizations/${orgData.slug}/projects`);
    }

    setLoading(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-base font-medium mb-1">Create a new organization</h1>
        <p className="text-xs text-muted-foreground">
          Organizations are a way to group your projects. Each organization can be configured with different team members and billing settings.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-card border border-border/40 rounded-md">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Name Field */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4 border-b border-border/40">
            <label htmlFor="name" className="text-xs font-medium pt-2">
              Name
            </label>
            <div className="space-y-1.5">
              <Input
                id="name"
                placeholder="Organization name"
                className="h-8 text-xs bg-secondary/50 border-border/50"
                {...form.register("name")}
              />
              <p className="text-[11px] text-muted-foreground">
                What's the name of your company or team? You can change this later.
              </p>
              {form.formState.errors.name && (
                <p className="text-[11px] text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
          </div>

          {/* Type Field */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4 border-b border-border/40">
            <label htmlFor="type" className="text-xs font-medium pt-2">
              Type
            </label>
            <div className="space-y-1.5">
              <Select
                onValueChange={(value: string) => form.setValue("type", value as FormValues["type"])}
                defaultValue={form.getValues("type")}
              >
                <SelectTrigger id="type" className="h-8 text-xs bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                  <SelectItem value="agency" className="text-xs">Agency</SelectItem>
                  <SelectItem value="startup" className="text-xs">Startup</SelectItem>
                  <SelectItem value="company" className="text-xs">Company</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                What best describes your organization?
              </p>
            </div>
          </div>

          {/* Plan Field */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4">
            <label htmlFor="plan" className="text-xs font-medium pt-2">
              Plan
            </label>
            <div className="space-y-1.5">
              <Select
                onValueChange={(value: string) => form.setValue("plan", value as FormValues["plan"])}
                defaultValue={form.getValues("plan")}
              >
                <SelectTrigger id="plan" className="h-8 text-xs bg-secondary/50 border-border/50">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free" className="text-xs">Free - $0/month</SelectItem>
                  <SelectItem value="pro" className="text-xs">Pro - $49/month</SelectItem>
                  <SelectItem value="team" className="text-xs">Team - $149/month</SelectItem>
                  <SelectItem value="enterprise" className="text-xs">Enterprise - Custom</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Which plan fits your organization's needs best?{" "}
                <Link href="/pricing" className="text-primary hover:underline">
                  Learn more
                </Link>
              </p>
              {(form.watch("plan") === "pro" || form.watch("plan") === "team") && (
                <p className="text-[11px] text-muted-foreground">
                  You'll be redirected to checkout after creating.
                </p>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-3"
          onClick={() => router.push("/dashboard/organizations")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-7 text-xs px-4"
          disabled={loading}
          onClick={form.handleSubmit(onSubmit)}
        >
          {loading ? "Creating..." : "Create organization"}
        </Button>
      </div>
    </div>
  );
}
