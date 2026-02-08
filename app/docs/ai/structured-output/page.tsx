"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function StructuredOutputDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Structured Output
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Get JSON responses that match your schema. Type-safe, validated output from AI models.
                </p>
            </div>

            {/* JSON Schema */}
            <div className="space-y-4">
                <h2 id="json-schema" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    JSON Schema
                </h2>

                <CodeBlock code={`const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Extract user info from: John Doe, 30 years old' }],
  response_format: {
    type: 'json_schema',
    json_schema: {
      name: 'user_info',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name', 'age']
      }
    }
  }
});

const user = JSON.parse(response.content);
// { name: 'John Doe', age: 30 }`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Zod + Vercel AI SDK */}
            <div className="space-y-4">
                <h2 id="zod" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Zod Schema (Vercel AI SDK)
                </h2>

                <CodeBlock code={`import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: cencori('gpt-4o'),
  schema: z.object({
    recipe: z.object({
      name: z.string(),
      ingredients: z.array(z.string()),
      steps: z.array(z.string()),
      prepTime: z.number().describe('Prep time in minutes')
    })
  }),
  prompt: 'Generate a simple pasta recipe'
});

console.log(object.recipe.name);
console.log(object.recipe.ingredients);`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Streaming Objects */}
            <div className="space-y-4">
                <h2 id="streaming" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Streaming Objects
                </h2>

                <CodeBlock code={`import { streamObject } from 'ai';
import { z } from 'zod';

const { partialObjectStream } = await streamObject({
  model: cencori('gpt-4o'),
  schema: z.object({
    characters: z.array(z.object({
      name: z.string(),
      class: z.string(),
      description: z.string()
    }))
  }),
  prompt: 'Generate 3 RPG characters'
});

for await (const partialObject of partialObjectStream) {
  console.log(partialObject);
  // Partial object updates as they stream in
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Supported Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>
                <p className="text-sm text-muted-foreground">
                    Models with structured output support:
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground ml-6">
                    <li className="list-disc">OpenAI: gpt-5, gpt-4o, gpt-4o-mini (native JSON mode)</li>
                    <li className="list-disc">Anthropic: claude-opus-4, claude-sonnet-4</li>
                    <li className="list-disc">Google: gemini-3-pro, gemini-2.5-flash</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/tool-calling">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Tool Calling</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/endpoints/chat">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Chat Endpoint</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
