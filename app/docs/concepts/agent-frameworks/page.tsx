import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Agent Frameworks | Cencori Docs",
    description: "Use Cencori with CrewAI, AutoGen, LangChain, and any OpenAI-compatible agent framework.",
};

export default function AgentFrameworksPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Agent Frameworks
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Cencori works with any AI agent framework out of the box. Just point your base URL to us and get full observability, failover, and security—automatically.
                </p>
            </div>

            {/* Why Cencori for Agents */}
            <div className="space-y-4">
                <h2 id="why-cencori" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Why Use Cencori for Agents
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    AI agents make many LLM calls autonomously. Without proper infrastructure, you lose visibility into what they&apos;re doing, can&apos;t control costs, and risk outages when providers fail.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori solves this by sitting between your agent and the LLM:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc"><strong>Full observability:</strong> See every request, token count, and cost</li>
                    <li className="list-disc"><strong>Automatic failover:</strong> If OpenAI is down, route to Anthropic</li>
                    <li className="list-disc"><strong>Rate limiting:</strong> Prevent runaway agents from burning your budget</li>
                    <li className="list-disc"><strong>Security scanning:</strong> Block prompt injection and unsafe outputs</li>
                    <li className="list-disc"><strong>Multi-provider:</strong> Use any model from any provider</li>
                </ul>
            </div>

            {/* How It Works */}
            <div className="space-y-4">
                <h2 id="how-it-works" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    How It Works
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Cencori exposes an OpenAI-compatible API. Agent frameworks like CrewAI, AutoGen, and LangChain already speak this protocol—they just need a different <code className="text-xs bg-muted px-1.5 py-0.5 rounded">base_url</code>.
                </p>

                <div className="mt-4 p-4 bg-muted/20 border border-border/40 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                        <strong>The Pattern:</strong> Set <code className="text-xs bg-muted px-1.5 py-0.5 rounded">base_url</code> to <code className="text-xs bg-muted px-1.5 py-0.5 rounded">https://api.cencori.com/v1</code> and use your Cencori API key. That&apos;s it.
                    </p>
                </div>
            </div>

            {/* Supported Frameworks */}
            <div className="space-y-4">
                <h2 id="supported-frameworks" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Supported Frameworks
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Framework</th>
                                <th className="text-left p-3 font-semibold">Language</th>
                                <th className="text-left p-3 font-semibold">Config Method</th>
                                <th className="text-left p-3 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-medium">CrewAI</td>
                                <td className="p-3">Python</td>
                                <td className="p-3"><code className="text-xs bg-muted px-1 rounded">OPENAI_API_BASE</code> env var</td>
                                <td className="p-3">Works</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">AutoGen</td>
                                <td className="p-3">Python</td>
                                <td className="p-3"><code className="text-xs bg-muted px-1 rounded">base_url</code> in config</td>
                                <td className="p-3">Works</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">LangChain</td>
                                <td className="p-3">Python/JS</td>
                                <td className="p-3"><code className="text-xs bg-muted px-1 rounded">openai_api_base</code></td>
                                <td className="p-3">Works</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">OmniCoreAgent</td>
                                <td className="p-3">Python</td>
                                <td className="p-3"><code className="text-xs bg-muted px-1 rounded">base_url</code> in model_config</td>
                                <td className="p-3">Works</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-medium">OpenAI SDK</td>
                                <td className="p-3">Any</td>
                                <td className="p-3"><code className="text-xs bg-muted px-1 rounded">base_url</code> parameter</td>
                                <td className="p-3">Works</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CrewAI Integration */}
            <div className="space-y-4">
                <h2 id="crewai" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    CrewAI
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    CrewAI is a popular framework for building multi-agent systems. Configure it to use Cencori by setting environment variables:
                </p>

                <CodeBlock
                    filename=".env"
                    language="bash"
                    code={`# Point CrewAI to Cencori
OPENAI_API_KEY=your_cencori_api_key
OPENAI_API_BASE=https://api.cencori.com/v1

# Or for specific models
OPENAI_MODEL_NAME=gpt-4o`}
                />

                <CodeBlock
                    filename="crew.py"
                    language="python"
                    code={`from crewai import Agent, Task, Crew

# CrewAI will automatically use Cencori via the env vars
researcher = Agent(
    role='Research Analyst',
    goal='Find insights about market trends',
    verbose=True
)

task = Task(
    description='Analyze Q4 2025 AI infrastructure trends',
    agent=researcher
)

crew = Crew(agents=[researcher], tasks=[task])
result = crew.kickoff()

# All LLM calls are logged in your Cencori dashboard!`}
                />
            </div>

            {/* AutoGen Integration */}
            <div className="space-y-4">
                <h2 id="autogen" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    AutoGen
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Microsoft&apos;s AutoGen framework supports custom endpoints through the config:
                </p>

                <CodeBlock
                    filename="autogen_config.py"
                    language="python"
                    code={`from autogen import AssistantAgent, UserProxyAgent

config_list = [{
    "model": "gpt-4o",
    "api_key": "your_cencori_api_key",
    "base_url": "https://api.cencori.com/v1"
}]

assistant = AssistantAgent(
    name="assistant",
    llm_config={"config_list": config_list}
)

user_proxy = UserProxyAgent(
    name="user_proxy",
    human_input_mode="NEVER"
)

user_proxy.initiate_chat(
    assistant,
    message="Write a Python function to calculate fibonacci"
)

# Every agent interaction is tracked in Cencori`}
                />
            </div>

            {/* LangChain Integration */}
            <div className="space-y-4">
                <h2 id="langchain" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    LangChain
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    LangChain supports custom base URLs in the ChatOpenAI class:
                </p>

                <CodeBlock
                    filename="langchain_agent.py"
                    language="python"
                    code={`from langchain_openai import ChatOpenAI
from langchain.agents import create_react_agent, AgentExecutor
from langchain import hub

# Point LangChain to Cencori
llm = ChatOpenAI(
    model="gpt-4o",
    api_key="your_cencori_api_key",
    base_url="https://api.cencori.com/v1"
)

# Create your agent as usual
prompt = hub.pull("hwchase17/react")
agent = create_react_agent(llm, tools=[], prompt=prompt)
executor = AgentExecutor(agent=agent, tools=[], verbose=True)

result = executor.invoke({"input": "What is the capital of France?"})

# Full observability through Cencori dashboard`}
                />

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    For JavaScript/TypeScript:
                </p>

                <CodeBlock
                    filename="langchain_agent.ts"
                    language="typescript"
                    code={`import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  openAIApiKey: "your_cencori_api_key",
  configuration: {
    baseURL: "https://api.cencori.com/v1"
  }
});

const response = await llm.invoke("Hello, how are you?");`}
                />
            </div>

            {/* OpenAI SDK Direct */}
            <div className="space-y-4">
                <h2 id="openai-sdk" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    OpenAI SDK (Direct)
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Any code using the OpenAI SDK can be pointed to Cencori:
                </p>

                <CodeBlock
                    filename="openai_direct.py"
                    language="python"
                    code={`from openai import OpenAI

# Just change the base_url - that's it!
client = OpenAI(
    api_key="your_cencori_api_key",
    base_url="https://api.cencori.com/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)`}
                />
            </div>

            {/* What You Get */}
            <div className="space-y-4">
                <h2 id="benefits" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What You Get
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Once your agent is routing through Cencori, you automatically get:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-4 border border-border/40 rounded-lg">
                        <h3 className="text-sm font-semibold mb-2">Full Observability</h3>
                        <p className="text-xs text-muted-foreground">
                            Every LLM call logged with tokens, cost, latency, and full request/response.
                        </p>
                    </div>
                    <div className="p-4 border border-border/40 rounded-lg">
                        <h3 className="text-sm font-semibold mb-2">Cost Tracking</h3>
                        <p className="text-xs text-muted-foreground">
                            Real-time spend tracking per agent, per task, per user.
                        </p>
                    </div>
                    <div className="p-4 border border-border/40 rounded-lg">
                        <h3 className="text-sm font-semibold mb-2">Automatic Failover</h3>
                        <p className="text-xs text-muted-foreground">
                            If OpenAI is down, automatically route to Anthropic or Gemini.
                        </p>
                    </div>
                    <div className="p-4 border border-border/40 rounded-lg">
                        <h3 className="text-sm font-semibold mb-2">Security Scanning</h3>
                        <p className="text-xs text-muted-foreground">
                            Block prompt injection, PII leakage, and unsafe outputs.
                        </p>
                    </div>
                </div>
            </div>

            {/* Troubleshooting */}
            <div className="space-y-4">
                <h2 id="troubleshooting" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Troubleshooting
                </h2>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">401 Unauthorized</h3>
                        <p className="text-sm text-muted-foreground">
                            Make sure you&apos;re using your Cencori API key, not your OpenAI key. Get your key from the{" "}
                            <Link href="/dashboard" className="text-primary hover:underline">dashboard</Link>.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">Model Not Found</h3>
                        <p className="text-sm text-muted-foreground">
                            Ensure you have the provider key configured in your{" "}
                            <Link href="/docs/concepts/multi-provider" className="text-primary hover:underline">project settings</Link>.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-base font-semibold">Streaming Issues</h3>
                        <p className="text-sm text-muted-foreground">
                            Cencori fully supports streaming. Make sure your framework is configured to use <code className="text-xs bg-muted px-1.5 py-0.5 rounded">stream=True</code>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-4">
                <h2 id="next-steps" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Next Steps
                </h2>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">
                        <Link href="/docs/concepts/security" className="text-primary hover:underline">
                            Configure security policies for agents
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/concepts/rate-limiting" className="text-primary hover:underline">
                            Set up rate limits to prevent runaway costs
                        </Link>
                    </li>
                    <li className="list-disc">
                        <Link href="/docs/concepts/failover" className="text-primary hover:underline">
                            Configure automatic failover
                        </Link>
                    </li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/security">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Security</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/concepts/failover">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Failover</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
