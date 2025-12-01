import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function CostOptimizationPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Cost Optimization
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Practical strategies to reduce your AI costs while maintaining quality and performance.
                </p>
            </div>

            {/* Understanding AI Costs */}
            <div className="space-y-4">
                <h2 id="understanding-costs" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Understanding AI Costs
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    AI providers charge based on tokens (words/characters). Costs vary dramatically by:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc"><strong>Model size:</strong> GPT-4o costs ~10x more than GPT-3.5 Turbo</li>
                    <li className="list-disc"><strong>Input vs Output:</strong> Output tokens often cost 2-3x more</li>
                    <li className="list-disc"><strong>Context window:</strong> Longer conversations accumulate costs</li>
                </ul>
            </div>

            {/* Strategy 1: Choose the Right Model */}
            <div className="space-y-4">
                <h2 id="choose-model" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Strategy 1: Choose the Right Model
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Not every task needs GPT-4o. Match the model to the complexity:
                </p>

                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Task Type</th>
                                <th className="text-left p-3 font-semibold">Recommended Model</th>
                                <th className="text-left p-3 font-semibold">Cost/1M tokens</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">Simple classification, tagging</td>
                                <td className="p-3">GPT-3.5 Turbo / Gemini 2.0 Flash</td>
                                <td className="p-3">$0.50 - $1.50</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Summarization, extraction</td>
                                <td className="p-3">Claude 3 Haiku / Gemini 2.5 Flash</td>
                                <td className="p-3">$1.00 - $5.00</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Complex reasoning, analysis</td>
                                <td className="p-3">GPT-4o / Claude 3 Sonnet</td>
                                <td className="p-3">$5.00 - $15.00</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Critical decisions, legal work</td>
                                <td className="p-3">GPT-4 Turbo / Claude 3 Opus</td>
                                <td className="p-3">$15.00 - $30.00</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-4">
                    <h3 className="text-base font-semibold mb-2">Implementation Example:</h3>
                    <CodeBlock
                        filename="model-routing.ts"
                        language="typescript"
                        code={`// Route based on task complexity
function selectModel(taskType: string) {
  switch (taskType) {
    case 'sentiment':
      return 'gpt-3.5-turbo'; // Cheap and fast
    case 'summary':
      return 'gemini-2.5-flash'; // Balanced
    case 'creative':
      return 'claude-3-sonnet'; // High quality
    default:
      return 'gpt-4o'; // General purpose
  }
}

const response = await cencori.ai.chat({
  model: selectModel(taskType),
  messages: [{ role: 'user', content: prompt }],
});`}
                    />
                </div>
            </div>

            {/* Strategy 2: Minimize Token Usage */}
            <div className="space-y-4">
                <h2 id="minimize-tokens" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Strategy 2: Minimize Token Usage
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">1. Keep Prompts Concise</h3>
                        <p className="text-sm text-muted-foreground mb-3">
                            Remove unnecessary words and examples:
                        </p>
                        <CodeBlock
                            filename="prompt-optimization.ts"
                            language="typescript"
                            code={`// ❌ BAD: Verbose (120 tokens)
const badPrompt = \`
You are a helpful assistant. I would like you to please analyze 
the following customer feedback and tell me if it's positive, 
negative, or neutral. Here is the feedback: "\${feedback}". 
Please provide your analysis.
\`;

// ✅ GOOD: Concise (15 tokens)
const goodPrompt = \`Classify sentiment (positive/negative/neutral): "\${feedback}"\`;`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">2. Limit max_tokens</h3>
                        <CodeBlock
                            filename="limit-tokens.ts"
                            language="typescript"
                            code={`// Prevent excessive output
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Summarize this article' }],
  max_tokens: 150, // Cap at 150 tokens
});`}
                        />
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">3. Truncate Long Inputs</h3>
                        <CodeBlock
                            filename="truncate-input.ts"
                            language="typescript"
                            code={`// Truncate long documents before sending
function truncateText(text: string, maxTokens: number = 2000) {
  // Rough estimation: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  return text.length > maxChars 
    ? text.substring(0, maxChars) + '...'
    : text;
}

const content = truncateText(longDocument);`}
                        />
                    </div>
                </div>
            </div>

            {/* Strategy 3: Implement Caching */}
            <div className="space-y-4">
                <h2 id="caching" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Strategy 3: Cache Repeated Queries
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If users ask the same questions frequently, cache the responses:
                </p>

                <CodeBlock
                    filename="simple-cache.ts"
                    language="typescript"
                    code={`const cache = new Map<string, string>();

async function getCachedResponse(prompt: string) {
  // Check cache first
  if (cache.has(prompt)) {
    console.log('Cache hit! No API call needed');
    return cache.get(prompt);
  }

  // Make API call
  const response = await cencori.ai.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  });

  // Store in cache
  cache.set(prompt, response.content);
  return response.content;
}

// Usage
const answer = await getCachedResponse('What is Cencori?');`}
                />
            </div>

            {/* Strategy 4: Batch Processing */}
            <div className="space-y-4">
                <h2 id="batching" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Strategy 4: Batch Multiple Tasks
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Process multiple items in a single request:
                </p>

                <CodeBlock
                    filename="batching.ts"
                    language="typescript"
                    code={`// ❌ BAD: 100 API calls for 100 items
for (const item of items) {
  await cencori.ai.chat({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: \`Classify: \${item}\` }],
  });
}

// ✅ GOOD: 1 API call for 100 items
const batch = items.map(item => \`- \${item}\`).join('\\n');
const response = await cencori.ai.chat({
  model: 'gpt-3.5-turbo',
  messages: [{
    role: 'user',
    content: \`Classify each item (format: item: classification):\\n\${batch}\`
  }],
});`}
                />
            </div>

            {/* Strategy 5: Use Smaller Context Windows */}
            <div className="space-y-4">
                <h2 id="context-window" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Strategy 5: Manage Conversation History
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    For chatbots, limit conversation history to recent messages:
                </p>

                <CodeBlock
                    filename="context-management.ts"
                    language="typescript"
                    code={`// Keep only last 5 messages
const MAX_HISTORY = 5;

function getRecentMessages(allMessages: Message[]) {
  return allMessages.slice(-MAX_HISTORY);
}

const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: getRecentMessages(conversationHistory),
});`}
                />
            </div>

            {/* Strategy 6: Monitor and Alert */}
            <div className="space-y-4">
                <h2 id="monitoring" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Strategy 6: Monitor Costs in Real-Time
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori tracks costs automatically. Use the dashboard to:
                </p>
                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">View daily cost trends</li>
                    <li className="list-disc">Compare costs by model</li>
                    <li className="list-disc">Identify expensive queries</li>
                    <li className="list-disc">Set up low balance alerts</li>
                </ul>

                <p className="text-sm text-muted-foreground mt-4">
                    Check costs programmatically:
                </p>

                <CodeBlock
                    filename="check-costs.ts"
                    language="typescript"
                    code={`// Every response includes cost
const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(\`Cost: $\${response.cost_usd}\`);
console.log(\`Tokens: \${response.usage.total_tokens}\`);

// Set a budget threshold
const MAX_COST_PER_REQUEST = 0.10; // $0.10
if (response.cost_usd > MAX_COST_PER_REQUEST) {
  console.warn('High cost request detected!');
}`}
                />
            </div>

            {/* Cost Comparison */}
            <div className="space-y-4">
                <h2 id="comparison" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Real-World Cost Examples
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Scenario</th>
                                <th className="text-left p-3 font-semibold">Without Optimization</th>
                                <th className="text-left p-3 font-semibold">With Optimization</th>
                                <th className="text-left p-3 font-semibold">Savings</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3">1000 sentiment analyses/day</td>
                                <td className="p-3">GPT-4o: $50/day</td>
                                <td className="p-3">GPT-3.5: $5/day</td>
                                <td className="p-3">90% ($1,350/mo)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Customer support chatbot</td>
                                <td className="p-3">Full history: $200/day</td>
                                <td className="p-3">5 msg history: $50/day</td>
                                <td className="p-3">75% ($4,500/mo)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3">Document summarization</td>
                                <td className="p-3">Full docs: $100/day</td>
                                <td className="p-3">Truncated: $30/day</td>
                                <td className="p-3">70% ($2,100/mo)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Wins */}
            <div className="space-y-4">
                <h2 id="quick-wins" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Quick Wins Checklist
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">✅ Use GPT-3.5 Turbo or Gemini 2.5 Flash for simple tasks</li>
                    <li className="list-disc">✅ Set <code className="text-xs bg-muted px-1.5 py-0.5 rounded">max_tokens</code> limits</li>
                    <li className="list-disc">✅ Cache frequently asked questions</li>
                    <li className="list-disc">✅ Batch process when possible</li>
                    <li className="list-disc">✅ Truncate long inputs</li>
                    <li className="list-disc">✅ Use streaming for better UX without extra cost</li>
                    <li className="list-disc">✅ Monitor costs daily in Cencori dashboard</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/guides/migrate-anthropic">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Migrate from Anthropic</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/security/pii-detection">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">PII Detection</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
