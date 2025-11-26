import { CodeBlock } from "@/components/docs/CodeBlock";

export default function VibeCodersPage() {
    return (
        <div className="space-y-10">
            <div>
                <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
                    For Vibe Coders
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                    You're building fast with tools like Cursor, v0, and Lovable. Cencori ensures your speed doesn't compromise security.
                </p>
            </div>

            <div className="space-y-6">
                <h2 id="the-problem" className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
                    The "Vibe Coding" Security Gap
                </h2>
                <p className="leading-7 [&:not(:first-child)]:mt-6">
                    AI coding assistants are incredible at generating functional code, but they often miss security best practices. They might:
                </p>
                <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
                    <li>Hardcode sensitive API keys or credentials.</li>
                    <li>Forget input validation, leading to SQL injection or XSS.</li>
                    <li>Fail to implement rate limiting on expensive API routes.</li>
                    <li>Hallucinate insecure dependencies.</li>
                </ul>
                <p className="leading-7">
                    When you're "vibe coding" — iterating rapidly and letting the AI handle the implementation — you need a safety net that catches these issues automatically.
                </p>
            </div>

            <div className="space-y-6">
                <h2 id="how-cencori-helps" className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
                    How Cencori Helps
                </h2>
                <p className="leading-7">
                    Cencori acts as a wrapper around your AI-generated endpoints. It doesn't get in your way; it just observes and protects.
                </p>

                <h3 id="example-nextjs" className="text-xl font-semibold mt-8 mb-4">Example: Securing a Next.js Route</h3>
                <p className="leading-7 mb-4">
                    Let's say Cursor generated this API route for you:
                </p>
                <CodeBlock
                    filename="app/api/generate/route.ts (Before)"
                    code={`import { openai } from "@/lib/openai";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  // ⚠️ No rate limiting
  // ⚠️ No input validation
  // ⚠️ No logging
  
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  return Response.json(response);
}`}
                />

                <p className="leading-7 mb-4">
                    With Cencori, you just wrap it. You can even ask Cursor to "wrap this with Cencori":
                </p>
                <CodeBlock
                    filename="app/api/generate/route.ts (After)"
                    code={`import { cencori } from "@/lib/cencori"; // Your Cencori instance

export async function POST(req: Request) {
  // Cencori middleware handles logging, rate limiting, and threat detection automatically.
  return cencori.guard(async () => {
    const { prompt } = await req.json();
    
    const response = await cencori.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    return Response.json(response);
  }, req);
}`}
                />
            </div>

            <div className="space-y-6">
                <h2 id="getting-started" className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">
                    Start Vibe Coding Safely
                </h2>
                <p className="leading-7">
                    1. <strong>Install the SDK:</strong> <code>npm install @cencori/sdk</code>
                    <br />
                    2. <strong>Initialize:</strong> Set up your Cencori client.
                    <br />
                    3. <strong>Guard:</strong> Wrap your critical AI routes.
                </p>
                <p className="leading-7 mt-4">
                    Now you can let the AI write the code, knowing Cencori has your back on security.
                </p>
            </div>
        </div>
    );
}
