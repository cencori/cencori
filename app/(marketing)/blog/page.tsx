import { getAllPosts, getAllTags } from "@/lib/blog";
import { BlogList } from "@/components/blog/BlogList";
import Navbar from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export default function BlogPage() {
  const allPosts = getAllPosts();
  const allTags = getAllTags();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <Navbar />

      <main className="flex-1 pt-20">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

        {/* Header */}
        <div className="relative border-b border-border/40 bg-background/50 backdrop-blur-sm">
          <div className="container mx-auto py-12 px-4 max-w-7xl text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
              <span>News</span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <BlogList posts={allPosts} tags={allTags} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
