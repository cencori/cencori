"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";
import { CONTACT_BUDGETS, CONTACT_INDUSTRIES } from "@/lib/industries";

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    jobTitle: "",
    country: "",
    industry: "",
    budget: "",
    projectDetails: "",
  });

  const set = (field: keyof typeof form, value: string) =>
    setForm((cur) => ({ ...cur, [field]: value }));

  const showBudget = form.industry !== "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!form.industry) {
      toast.error("Please select your industry");
      return;
    }
    if (showBudget && !form.budget) {
      toast.error("Please select your budget");
      return;
    }
    if (showBudget && !form.projectDetails.trim()) {
      toast.error("Please tell us what you're building");
      return;
    }
    setIsSubmitting(true);
    try {
      const name = `${form.firstName} ${form.lastName}`.trim();
      const budget = showBudget ? form.budget : "";
      const projectDetails = showBudget ? form.projectDetails.trim() : "";
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: form.email,
          company: form.company,
          type: "general",
          subject: `${form.jobTitle} at ${form.company} (${form.country}) [${form.industry}]${budget ? ` [${budget}]` : ""}`,
          message: `Job title: ${form.jobTitle}\nCountry: ${form.country}\nIndustry: ${form.industry}\nBudget: ${budget || "Not provided"}\nCompany: ${form.company}\nName: ${name}\nEmail: ${form.email}\n\nWhat they're building:\n${projectDetails || "Not provided"}`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to send");
      toast.success("Message sent. We'll be in touch soon.");
      setForm({ firstName: "", lastName: "", company: "", email: "", jobTitle: "", country: "", industry: "", budget: "", projectDetails: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)",
          backgroundSize: "68px 68px",
        }}
      />
      <section className="relative z-10 pt-24 pb-16 sm:pt-32 sm:pb-20">
        <div className="mx-auto max-w-2xl px-4 md:px-6">
          <p className="mb-2 text-center font-inter text-[13px] text-muted-foreground">sales</p>
          <h1 className="mb-3 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Contact sales
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-muted-foreground sm:text-[15px]">
            Talk to real humans to help you identify the right usecase for your organization.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label htmlFor="firstName" className="text-xs font-medium">
                  First name<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  required
                  autoComplete="given-name"
                  className="h-10 rounded-xl border-foreground/20 text-sm"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="lastName" className="text-xs font-medium">
                  Last name<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  required
                  autoComplete="family-name"
                  className="h-10 rounded-xl border-foreground/20 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label htmlFor="company" className="text-xs font-medium">
                  Name of company<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  id="company"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  required
                  autoComplete="organization"
                  className="h-10 rounded-xl border-foreground/20 text-sm"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="email" className="text-xs font-medium">
                  Work email<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10 rounded-xl border-foreground/20 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <label htmlFor="jobTitle" className="text-xs font-medium">
                  Job title<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) => set("jobTitle", e.target.value)}
                  required
                  autoComplete="organization-title"
                  className="h-10 rounded-xl border-foreground/20 text-sm"
                />
              </div>
              <div className="flex flex-col gap-3">
                <label htmlFor="country" className="text-xs font-medium">
                  Country<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
                </label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  required
                  autoComplete="country-name"
                  className="h-10 rounded-xl border-foreground/20 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <span id="industry-label" className="text-xs font-medium">
                Select your industry<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
              </span>
              <div
                role="radiogroup"
                aria-labelledby="industry-label"
                className="py-1"
              >
                {CONTACT_INDUSTRIES.map((option) => {
                  const checked = form.industry === option;
                  return (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm hover:bg-foreground/5"
                    >
                      <input
                        type="radio"
                        name="industry"
                        value={option}
                        checked={checked}
                        onChange={() => set("industry", option)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`grid size-5 shrink-0 place-items-center rounded-[7px] ${
                          checked ? "bg-foreground" : "bg-foreground/15"
                        }`}
                      >
                        {checked ? (
                          <svg fill="none" height="12" viewBox="0 0 10 10" width="12">
                            <path
                              d="M1.5 5.2 4 7.5 8.5 2.5"
                              stroke="var(--background)"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.6"
                            />
                          </svg>
                        ) : null}
                      </span>
                      {option}
                    </label>
                  );
                })}
                {form.industry ? (
                  <button
                    type="button"
                    onClick={() => setForm((cur) => ({ ...cur, industry: "", budget: "" }))}
                    className="mt-0.5 w-full rounded-lg py-1.5 text-left text-sm text-muted-foreground hover:bg-foreground/5"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {showBudget ? (
            <div className="flex flex-col gap-3">
              <span id="budget-label" className="text-xs font-medium">
                Select your budget<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
              </span>
              <div
                role="radiogroup"
                aria-labelledby="budget-label"
                className="py-1"
              >
                {CONTACT_BUDGETS.map((option) => {
                  const checked = form.budget === option;
                  return (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1.5 text-sm hover:bg-foreground/5"
                    >
                      <input
                        type="radio"
                        name="budget"
                        value={option}
                        checked={checked}
                        onChange={() => set("budget", option)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`grid size-5 shrink-0 place-items-center rounded-[7px] ${
                          checked ? "bg-foreground" : "bg-foreground/15"
                        }`}
                      >
                        {checked ? (
                          <svg fill="none" height="12" viewBox="0 0 10 10" width="12">
                            <path
                              d="M1.5 5.2 4 7.5 8.5 2.5"
                              stroke="var(--background)"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="1.6"
                            />
                          </svg>
                        ) : null}
                      </span>
                      {option}
                    </label>
                  );
                })}
                {form.budget ? (
                  <button
                    type="button"
                    onClick={() => set("budget", "")}
                    className="mt-0.5 w-full rounded-lg py-1.5 text-left text-sm text-muted-foreground hover:bg-foreground/5"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            ) : null}
            </div>
            {showBudget ? (
            <div className="flex flex-col gap-3">
              <label htmlFor="projectDetails" className="text-xs font-medium">
                What are you building?<span aria-hidden="true" className="ml-0.5 text-red-500">*</span>
              </label>
              <Textarea
                id="projectDetails"
                value={form.projectDetails}
                onChange={(e) => set("projectDetails", e.target.value)}
                required={showBudget}
                rows={5}
                placeholder="Tell us what you're building, your usecase, what you need and what your challenges are…"
                className="min-h-32 resize-none rounded-xl border-foreground/20 text-sm"
              />
            </div>
            ) : null}

            <Button type="submit" disabled={isSubmitting} className="flex h-9 w-full max-w-28 rounded-full text-sm">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Sending...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
