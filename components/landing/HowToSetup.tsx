"use client";

import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CodeBlock as HighlightedCodeBlock } from "@/components/ai-elements/code-block";
import { type BundledLanguage } from "shiki";
import { Reveal } from "@/components/landing/Reveal";

type CodeTabKey = "python" | "node" | "curl" | "go" | "csharp" | "php" | "ruby" | "java";

const steps = [
    {
        number: "01",
        title: "Install the SDK",
        description: "Add Cencori to your project with npm or yarn.",
        code: "npm install cencori",
    },
    {
        number: "02",
        title: "Get your API key",
        description: "Create a free account and grab your API key from the dashboard.",
        code: null,
    },
    {
        number: "03",
        title: "Start building",
        description: "Use any AI provider with security and observability built-in.",
        code: null,
    },
];

const setupCodeTabs: Array<{ key: CodeTabKey; label: string; language: BundledLanguage; code: string }> = [
    {
        key: "python",
        label: "Python",
        language: "python",
        code: `# pip install cencori
from cencori import Cencori

client = Cencori(api_key="csk_live_...")
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello from Python!"}]
)

print(response.choices[0].message.content)`,
    },
    {
        key: "node",
        label: "Node.js",
        language: "typescript",
        code: `// npm install cencori
import { Cencori } from "cencori";

const client = new Cencori({ apiKey: "csk_live_..." });

const response = await client.ai.chat({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello from Node.js!" }],
});

console.log(response.content);`,
    },
    {
        key: "curl",
        label: "cURL",
        language: "bash",
        code: `curl https://cencori.com/v1/chat/completions \\
  -H "Authorization: Bearer csk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Hello from cURL!" }
    ]
  }'`,
    },
    {
        key: "go",
        label: "Go",
        language: "go",
        code: `// go get github.com/cencori/cencori-go
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/cencori/cencori-go"
    "github.com/cencori/cencori-go/option"
)

func main() {
    client := cencori.NewClient(
        option.WithAPIKey(os.Getenv("CENCORI_API_KEY")),
    )

    resp, err := client.Chat.Completions.New(context.TODO(), cencori.ChatCompletionNewParams{
        Model: cencori.F(cencori.ChatModelGPT4o),
        Messages: cencori.F([]cencori.ChatCompletionMessageParam{
            cencori.UserMessage("Hello from Go!"),
        }),
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(resp.Choices[0].Message.Content)
}`,
    },
    {
        key: "csharp",
        label: "C#",
        language: "csharp",
        code: `// dotnet add package OpenAI
using Azure;
using Azure.AI.OpenAI;

var client = new OpenAIClient(
    new Uri("https://cencori.com/v1"),
    new AzureKeyCredential("csk_live_...")
);

var request = new ChatCompletionsOptions()
{
    DeploymentName = "gpt-4o",
    Messages =
    {
        new ChatRequestUserMessage("Hello from C#!"),
    }
};

var response = await client.GetChatCompletionsAsync(request);
Console.WriteLine(response.Value.Choices[0].Message.Content);`,
    },
    {
        key: "php",
        label: "PHP",
        language: "php",
        code: `<?php
use OpenAI;

$client = OpenAI::factory()
    ->withBaseUri('https://cencori.com/v1')
    ->withApiKey('csk_live_...')
    ->make();

$result = $client->chat()->create([
    'model' => 'gpt-4o',
    'messages' => [
        ['role' => 'user', 'content' => 'Hello from PHP!'],
    ],
]);

echo $result->choices[0]->message->content;`,
    },
    {
        key: "ruby",
        label: "Ruby",
        language: "ruby",
        code: `# gem install ruby-openai
require "openai"

client = OpenAI::Client.new(
  access_token: "csk_live_...",
  uri_base: "https://cencori.com/v1"
)

response = client.chat(
  parameters: {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello from Ruby!" }]
  }
)

puts response.dig("choices", 0, "message", "content")`,
    },
    {
        key: "java",
        label: "Java",
        language: "java",
        code: `// implementation("com.theokanning.openai-gpt3-java:service:latest")
OpenAiService service = new OpenAiService(
    "csk_live_...",
    Duration.ofSeconds(30),
    "https://cencori.com/v1/"
);

ChatCompletionRequest request = ChatCompletionRequest.builder()
    .model("gpt-4o")
    .messages(List.of(new ChatMessage("user", "Hello from Java!")))
    .build();

service.createChatCompletion(request)
    .getChoices()
    .forEach(System.out::println);`,
    },
];

export const HowToSetup = () => {
    const [activeCodeTab, setActiveCodeTab] = useState<CodeTabKey>("python");
    const [copiedTab, setCopiedTab] = useState<CodeTabKey | null>(null);

    const handleTabChange = (value: string) => {
        const matchedTab = setupCodeTabs.find((tab) => tab.key === value);
        if (matchedTab) {
            setActiveCodeTab(matchedTab.key);
            setCopiedTab(null);
        }
    };

    const handleCopy = async (code: string, tabKey: CodeTabKey) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedTab(tabKey);
            window.setTimeout(() => setCopiedTab(null), 1200);
        } catch {
            setCopiedTab(null);
        }
    };

    return (
        <section className="py-24 sm:py-32 bg-background">
            <div className="mx-auto max-w-6xl px-4 md:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,24rem)_1fr] gap-16 lg:gap-24 items-start">
                    <div>
                        <Reveal>
                            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.25em] text-muted-foreground/60">
                                Setup
                            </p>
                        </Reveal>
                        <Reveal delay={0.05}>
                            <h2 className="max-w-md text-3xl sm:text-[2.75rem] font-semibold tracking-[-0.03em] leading-[1.1] mb-6">
                                Infrastructure in 
                                <br />
                                <span className="text-muted-foreground">minutes.</span>
                            </h2>
                        </Reveal>
                        <Reveal delay={0.1}>
                            <p className="max-w-sm text-muted-foreground leading-[1.7]">
                                Three simple steps to go from account setup to a production-ready AI integration, with the same gateway across every provider.
                            </p>
                        </Reveal>
                    </div>

                    <div className="space-y-0">
                        {steps.map((step, index) => (
                            <Reveal key={step.number} delay={index * 0.08}>
                                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-5 sm:gap-8">
                                    <div className="flex flex-col items-center">
                                        <div className="flex size-8 items-center justify-center rounded-full border border-border/50 bg-card text-[10px] font-medium tracking-[0.12em] text-muted-foreground">
                                            {step.number}
                                        </div>
                                        {index < steps.length - 1 && (
                                            <div className="mt-3 w-px flex-1 min-h-20 bg-border/50" />
                                        )}
                                    </div>

                                    <div className="pb-10 sm:pb-12">
                                        <h3 className="mb-2 text-lg font-medium text-foreground">
                                            {step.title}
                                        </h3>
                                        <p className="mb-4 text-sm text-muted-foreground leading-[1.7]">
                                            {step.description}
                                        </p>

                                        {step.code && (
                                            <div className="overflow-x-auto rounded-lg border border-border/40 bg-foreground/[0.02] px-4 py-4">
                                                <pre className="text-xs md:text-sm font-mono text-foreground/80 whitespace-pre-wrap break-all md:whitespace-pre md:break-normal">
                                                    <code>{step.code}</code>
                                                </pre>
                                            </div>
                                        )}

                                        {step.number === "03" && (
                                            <div className="space-y-3">
                                                <Tabs value={activeCodeTab} onValueChange={handleTabChange} className="w-full">
                                                    <TabsList className="w-full justify-start overflow-x-auto">
                                                        {setupCodeTabs.map((tab) => (
                                                            <TabsTrigger key={tab.key} value={tab.key}>
                                                                {tab.label}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>

                                                    {setupCodeTabs.map((tab) => (
                                                        <TabsContent
                                                            key={tab.key}
                                                            value={tab.key}
                                                            forceMount
                                                            hidden={activeCodeTab !== tab.key ? true : undefined}
                                                            className="mt-3"
                                                        >
                                                            <figure className="relative overflow-hidden rounded-xl border border-border/40 text-foreground">
                                                                <figcaption className="flex items-center justify-between border-b border-border/40 bg-foreground/[0.02] px-4 py-2 text-xs text-muted-foreground">
                                                                    <span className="font-medium">{tab.label}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCopy(tab.code, tab.key)}
                                                                        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                                                        aria-label="Copy code snippet"
                                                                    >
                                                                        {copiedTab === tab.key ? "Copied" : "Copy"}
                                                                    </button>
                                                                </figcaption>
                                                                <HighlightedCodeBlock
                                                                    code={tab.code}
                                                                    language={tab.language}
                                                                    className="rounded-none border-0"
                                                                />
                                                            </figure>
                                                        </TabsContent>
                                                    ))}
                                                </Tabs>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
