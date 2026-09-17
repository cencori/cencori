"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown01Icon, Settings05Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOG_CATEGORY_ORDER,
  formatBlogCategory,
  type BlogCardPost,
} from "./blog-client";
import { FilterDropdown } from "@/components/stories/FilterDropdown";
import { BlogGrid } from "./BlogGrid";
import { BlogListView } from "./BlogListView";

type Sort = "newest" | "oldest";
type View = "grid" | "list";

const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest",
  oldest: "Oldest",
};

const PAGE_SIZE = 9;

function sortPosts(posts: BlogCardPost[], sort: Sort | null): BlogCardPost[] {
  const list = [...posts];
  if (sort === "oldest") {
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }
  list.sort((a, b) => b.date.localeCompare(a.date));
  return list;
}

function toggleOption(selected: string[], option: string): string[] {
  return selected.includes(option)
    ? selected.filter((item) => item !== option)
    : [...selected, option];
}

export interface BlogFiltersProps {
  posts: BlogCardPost[];
  /** Pre-selected tab. Defaults to All. */
  initialCategory?: string | null;
  /** Heading when no tab is selected. Defaults to "Newsroom". */
  titleFallback?: string;
  /** Tabs to list. Defaults to the full canonical order. */
  visibleCategories?: string[];
}

export function BlogFilters({
  posts,
  initialCategory = null,
  titleFallback = "Newsroom",
  visibleCategories = BLOG_CATEGORY_ORDER,
}: BlogFiltersProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(
    initialCategory,
  );
  const [tags, setTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort | null>(null);
  const [view, setView] = useState<View>("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const tagOptions = useMemo(
    () => [...new Set(posts.flatMap((p) => p.tags ?? []))].sort(),
    [posts],
  );
  const categoryOptions = visibleCategories;

  const filtered = useMemo(() => {
    const list = posts.filter(
      (post) =>
        (activeCategory === null ||
          formatBlogCategory(post.category) === activeCategory) &&
        (tags.length === 0 ||
          (post.tags ?? []).some((tag) => tags.includes(tag))),
    );
    return sortPosts(list, sort);
  }, [posts, activeCategory, tags, sort]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, tags, sort]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const hasActiveFilters = activeCategory !== null || tags.length > 0;

  const reset = () => {
    setActiveCategory(null);
    setTags([]);
  };

  const title = activeCategory ?? titleFallback;

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>

      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex flex-1 items-center gap-6 overflow-x-auto border-b border-border/40 no-scrollbar pb-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] md:border-b-0 md:pb-0">
          <button
            className={cn(
              "shrink-0 text-[15px] transition-colors",
              activeCategory === null
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setActiveCategory(null)}
            type="button"
          >
            All
          </button>
          {categoryOptions.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                className={cn(
                  "shrink-0 text-[15px] transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={category}
                onClick={() => setActiveCategory(isActive ? null : category)}
                type="button"
              >
                {category}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-5">
          <div className="flex items-center gap-5">
          <FilterDropdown
            groups={[{ heading: "Tags", options: tagOptions }]}
            icon={
              <HugeiconsIcon icon={Settings05Icon} size={16} strokeWidth={1.8} />
            }
            label="Filter"
            onClear={() => setTags([])}
            onToggle={(option) =>
              setTags((current) => toggleOption(current, option))
            }
            selected={tags}
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

          <div className="flex items-center gap-3">
            <button
              aria-label="Grid view"
              className={cn(
                "transition-colors",
                view === "grid"
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-foreground",
              )}
              onClick={() => setView("grid")}
              type="button"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              aria-label="List view"
              className={cn(
                "transition-colors",
                view === "list"
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-foreground",
              )}
              onClick={() => setView("list")}
              type="button"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      <div>
        {posts.length === 0 ? (
          <BlogGrid posts={[]} />
        ) : filtered.length === 0 ? (
          <div className="mx-auto max-w-xl py-16 text-center">
            <p className="text-lg font-semibold">No articles match.</p>
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
          <>
            {view === "grid" ? (
              <BlogGrid posts={visible} />
            ) : (
              <BlogListView posts={visible} />
            )}
            {hasMore ? (
              <div className="mt-12 flex justify-center">
                <button
                  className="inline-flex min-h-11 items-center rounded-full bg-foreground px-5 text-sm text-background transition-opacity hover:opacity-90"
                  onClick={() =>
                    setVisibleCount((count) => count + PAGE_SIZE)
                  }
                  type="button"
                >
                  Show more
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
