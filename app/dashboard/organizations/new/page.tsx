/* eslint-disable react/no-unescaped-entities */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  description: z.string().optional(),
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
    case 'enterprise': return 999999999; // Unlimited
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
      description: "",
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

    // Ensure slug is unique (simple retry logic)
    for (let i = 0; i < 5; i++) { // Max 5 retries
      const { data, error } = await supabase
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

    // Create organization with subscription tier
    const { data: orgData, error } = await supabase.from("organizations").insert({
      name: values.name,
      slug: newSlug,
      description: values.description,
      organization_type: values.type,
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

    // Add the creating user as an owner in the organization_members table
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

    // If user selected a paid plan, redirect to billing for Polar checkout
    if (values.plan === 'pro' || values.plan === 'team') {
      router.push(`/dashboard/organizations/${orgData.slug}/billing?upgrade=true`);
    } else if (values.plan === 'enterprise') {
      // Redirect to contact page for enterprise
      router.push(`/contact?plan=enterprise&org=${orgData.slug}`);
    } else {
      // Free tier - go to projects
      router.push(`/dashboard/organizations/${orgData.slug}/projects`);
    }

    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
      <Card className="w-[550px]">
        <CardHeader>
          <CardTitle>Create New Organization</CardTitle>
          <CardDescription>Start managing your projects by creating an organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Org"
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
                placeholder="A brief description of my organization"
                {...form.register("description")}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="type">Organization Type</Label>
              <Select onValueChange={(value: string) => form.setValue("type", value as FormValues["type"])} defaultValue={form.getValues("type")}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="agency">Agency</SelectItem>
                  <SelectItem value="startup">Startup</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.type && (
                <p className="text-red-500 text-sm">{form.formState.errors.type.message}</p>
              )}
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="plan">Select Plan</Label>
              <Select onValueChange={(value: string) => form.setValue("plan", value as FormValues["plan"])} defaultValue={form.getValues("plan")}>
                <SelectTrigger id="plan" className="w-full">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    <div className="flex flex-col">
                      <span className="font-medium">Free</span>
                      <span className="text-xs text-muted-foreground">1,000 requests/month • $0</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pro">
                    <div className="flex flex-col">
                      <span className="font-medium">Pro</span>
                      <span className="text-xs text-muted-foreground">50,000 requests/month • $49/mo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="team">
                    <div className="flex flex-col">
                      <span className="font-medium">Team</span>
                      <span className="text-xs text-muted-foreground">250,000 requests/month • $149/mo</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="enterprise">
                    <div className="flex-col">
                      <span className="font-medium">Enterprise</span>
                      <span className="text-xs text-muted-foreground">Unlimited requests • Custom pricing</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.plan && (
                <p className="text-red-500 text-sm">{form.formState.errors.plan.message}</p>
              )}
              {(form.watch("plan") === "pro" || form.watch("plan") === "team") && (
                <p className="text-xs text-muted-foreground mt-1">
                  You'll be redirected to checkout after creating the organization.
                </p>
              )}
              {form.watch("plan") === "enterprise" && (
                <p className="text-xs text-muted-foreground mt-1">
                  You'll be redirected to contact sales for custom pricing.
                </p>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 mt-4">
              <Button type="button" variant="outline" onClick={() => router.push("/dashboard/organizations")} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </form >
        </CardContent >
        <CardFooter className="text-sm text-muted-foreground">
          By creating an organization, you agree to our <a href="/terms-of-service" className="underline hover:text-primary" target="_blank" rel="noopener noreferrer"> Terms of Service</a>.
        </CardFooter>
      </Card >
    </div >
  );
}
