import { getAllPosts, getAllTags } from "@/lib/blog";
import { BlogList } from "@/components/blog/BlogList";
import { AuthNavbar } from "@/components/landing/AuthNavbar";
import { Footer } from "@/components/landing/Footer";

export default function BlogPage() {
  const allPosts = getAllPosts();
  const allTags = getAllTags();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuthNavbar />

      <main className="flex-1 pt-20">
        {/* Header */}
        <div className="border-b border-border/40">
          <div className="container mx-auto py-8 px-4 max-w-5xl">
            <h1 className="text-lg font-semibold">Blog</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Updates, announcements, and engineering insights
            </p>
          </div>
        </div>

        <BlogList posts={allPosts} tags={allTags} />
      </main>

      <Footer />
    </div>
  );
}

