import type { Metadata } from "next";
import { getStories } from "@/lib/stories";
import { StoriesFilters } from "@/components/stories/StoriesFilters";

export const metadata: Metadata = {
  title: "Customers | Cencori",
  description: "Teams building and running AI on Cencori — customer stories from production.",
};

export default function CustomersPage() {
  const stories = getStories("customer");

  return (
    <main className="flex-1 pt-20 md:pt-28">
      <div className="container mx-auto max-w-5xl space-y-8 px-4 pb-8 pt-4 md:py-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Customers</h1>
        <StoriesFilters stories={stories} />
      </div>
    </main>
  );
}
