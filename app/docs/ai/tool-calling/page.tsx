"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock, CodeBlockCopyButton } from "@/components/ai-elements/code-block";

export default function ToolCallingDocs() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Tool Calling
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Let AI models call functions in your code. Define tools, and the model decides when to use them.
                </p>
            </div>

            {/* Basic Example */}
            <div className="space-y-4">
                <h2 id="basic" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Basic Example
                </h2>

                <CodeBlock code={`import { Cencori } from 'cencori';

const cencori = new Cencori({ apiKey: 'csk_...' });

const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is the weather in Tokyo?' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' }
        },
        required: ['location']
      }
    }
  }]
});

if (response.toolCalls) {
  console.log(response.toolCalls);
  // [{ function: { name: 'get_weather', arguments: '{"location":"Tokyo"}' } }]
}`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Handling Tool Calls */}
            <div className="space-y-4">
                <h2 id="handling" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Handling Tool Calls
                </h2>

                <CodeBlock code={`// After receiving a tool call, execute it and send result back
const toolCall = response.toolCalls[0];
const args = JSON.parse(toolCall.function.arguments);

// Execute your function
const weatherData = await getWeather(args.location);

// Send result back to model
const finalResponse = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [
    { role: 'user', content: 'What is the weather in Tokyo?' },
    { role: 'assistant', tool_calls: response.toolCalls },
    {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(weatherData)
    }
  ]
});

console.log(finalResponse.content);
// "The weather in Tokyo is 72°F and sunny."`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Vercel AI SDK */}
            <div className="space-y-4">
                <h2 id="vercel" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Vercel AI SDK
                </h2>

                <CodeBlock code={`import { generateText, tool } from 'ai';
import { z } from 'zod';

const result = await generateText({
  model: cencori('gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather for a city',
      parameters: z.object({
        city: z.string().describe('The city name')
      }),
      execute: async ({ city }) => {
        // Your implementation
        return { temp: 72, conditions: 'sunny' };
      }
    })
  },
  prompt: 'What is the weather in Tokyo?'
});`} language="typescript">
                    <CodeBlockCopyButton />
                </CodeBlock>
            </div>

            {/* Supported Models */}
            <div className="space-y-4">
                <h2 id="models" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Models
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-2 font-semibold">Provider</th>
                                <th className="text-left py-2 font-semibold">Models</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="py-2">OpenAI</td>
                                <td className="py-2">gpt-5, gpt-4o, gpt-4o-mini, o3</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Anthropic</td>
                                <td className="py-2">claude-opus-4, claude-sonnet-4</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Google</td>
                                <td className="py-2">gemini-3-pro, gemini-2.5-flash</td>
                            </tr>
                            <tr className="border-b">
                                <td className="py-2">Mistral</td>
                                <td className="py-2">mistral-large-3</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/ai/streaming">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Streaming</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/ai/structured-output">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Structured Output</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
