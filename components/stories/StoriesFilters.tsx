"use client";

import { useMemo, useState } from "react";
import { ArrowDown01Icon, Settings05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { STORY_PRODUCTS, getStoryFacets, type Story } from "@/lib/stories";
import { FilterDropdown } from "./FilterDropdown";
import { StoriesGrid } from "./StoriesGrid";

type Sort = "newest" | "oldest";

const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest",
  oldest: "Oldest",
};

function sortStories(stories: Story[], sort: Sort | null): Story[] {
  const list = [...stories];
  if (sort === "oldest") {
    list.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    return list;
  }
  list.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return list;
}

function toggleOption(selected: string[], option: string): string[] {
  return selected.includes(option)
    ? selected.filter((item) => item !== option)
    : [...selected, option];
}

export function StoriesFilters({ stories }: { stories: Story[] }) {
  const [products, setProducts] = useState<string[]>([]);
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);

  const { industries, useCases } = useMemo(
    () => getStoryFacets(stories),
    [stories],
  );

  const filtered = useMemo(() => {
    const list = stories.filter(
      (story) =>
        (products.length === 0 || products.includes(story.product)) &&
        (filters.length === 0 ||
          filters.includes(story.industry) ||
          filters.includes(story.useCase)),
    );
    return sortStories(list, sort);
  }, [stories, products, filters, sort]);

  const hasActiveFilters = products.length > 0 || filters.length > 0;

  const reset = () => {
    setProducts([]);
    setFilters([]);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-5">
        <FilterDropdown
          groups={[{ options: [...STORY_PRODUCTS] }]}
          icon={
            <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.8} />
          }
          label="Products"
          onClear={() => setProducts([])}
          onToggle={(option) =>
            setProducts((current) => toggleOption(current, option))
          }
          selected={products}
        />

        <FilterDropdown
          groups={[
            { heading: "Industry", options: industries },
            { heading: "Use case", options: useCases },
          ]}
          icon={
            <HugeiconsIcon icon={Settings05Icon} size={16} strokeWidth={1.8} />
          }
          label="Filter"
          onClear={() => setFilters([])}
          onToggle={(option) =>
            setFilters((current) => toggleOption(current, option))
          }
          selected={filters}
        />

        <FilterDropdown
          closeOnSelect
          groups={[
            { options: (Object.keys(SORT_LABELS) as Sort[]).map((value) => SORT_LABELS[value]) },
          ]}
          icon={
            <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={1.8} />
          }
          label="Sort"
          onClear={() => setSort(null)}
          onToggle={(option) => {
            const next = (Object.keys(SORT_LABELS) as Sort[]).find(
              (value) => SORT_LABELS[value] === option,
            );
            if (next) setSort(next);
          }}
          selected={sort ? [SORT_LABELS[sort]] : []}
        />
      </div>

      <div className="mt-10">
        {stories.length === 0 ? (
          <StoriesGrid stories={[]} />
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <p className="text-lg font-semibold">No stories match.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try a different combination of filters.
            </p>
            {hasActiveFilters ? (
              <button
                className="mt-6 inline-flex min-h-11 items-center rounded-full border border-border/40 px-5 text-sm"
                onClick={reset}
                type="button"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <StoriesGrid stories={filtered} />
        )}
      </div>
    </div>
  );
}
