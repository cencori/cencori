import {
    ArrowsRightLeftIcon,
    BoltIcon,
    CircleStackIcon,
    CodeBracketSquareIcon,
    CommandLineIcon,
    DocumentMagnifyingGlassIcon,
    EyeIcon,
    MagnifyingGlassIcon,
    QueueListIcon,
    ServerStackIcon,
    SignalIcon,
    WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/landing/Reveal";

const capabilities = [
    {
        title: "Responses API",
        description: "Run stateful agent workflows through one OpenAI-compatible endpoint.",
        icon: QueueListIcon,
    },
    {
        title: "Built-in web search",
        description: "Ground answers in first-party hybrid search results with citations.",
        icon: MagnifyingGlassIcon,
    },
    {
        title: "File search",
        description: "Retrieve relevant context from uploaded documents inside a response.",
        icon: DocumentMagnifyingGlassIcon,
    },
    {
        title: "Code interpreter",
        description: "Generate and execute code within the same agentic tool loop.",
        icon: CommandLineIcon,
    },
    {
        title: "Function calling",
        description: "Use provider-neutral tools with OpenAI-compatible schemas.",
        icon: WrenchScrewdriverIcon,
    },
    {
        title: "Structured outputs",
        description: "Return JSON objects or strict schemas your application can trust.",
        icon: CodeBracketSquareIcon,
    },
    {
        title: "Stateful responses",
        description: "Continue conversations without rebuilding the full context each turn.",
        icon: ArrowsRightLeftIcon,
    },
    {
        title: "Prompt caching",
        description: "Reuse exact and semantically similar prompts to cut cost and latency.",
        icon: BoltIcon,
    },
    {
        title: "Embeddings",
        description: "Generate vectors through OpenAI, Google, or Cohere from one API.",
        icon: CircleStackIcon,
    },
    {
        title: "Vision inputs",
        description: "Send images with text for multimodal understanding and extraction.",
        icon: EyeIcon,
    },
    {
        title: "Custom providers",
        description: "Connect Ollama, vLLM, LM Studio, or any compatible endpoint.",
        icon: ServerStackIcon,
    },
    {
        title: "Streaming",
        description: "Deliver token-by-token SSE responses across supported providers.",
        icon: SignalIcon,
    },
];

export const GatewayCapabilities = () => {
    return (
        <section className="bg-background">
            <div className="mx-auto max-w-6xl px-6 pb-28 pt-12 sm:px-12 sm:pb-36 sm:pt-16">
                <Reveal>
                    <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[2.75rem]">
                        And much more
                    </h2>
                </Reveal>
                <Reveal delay={0.04}>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
                        Everything behind your AI product, available through one gateway.
                    </p>
                </Reveal>

                <div className="mt-14 grid grid-cols-1 gap-x-14 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-12">
                    {capabilities.map(({ title, description, icon: Icon }, index) => (
                        <Reveal key={title} delay={(index % 3) * 0.04}>
                            <div className="group flex items-start gap-3.5">
                                <Icon
                                    aria-hidden="true"
                                    className="mt-0.5 size-[18px] shrink-0 text-muted-foreground/55 transition-colors duration-300 group-hover:text-foreground/70"
                                    strokeWidth={1.5}
                                />
                                <div>
                                    <h3 className="text-[15px] font-medium leading-5 text-foreground/90">
                                        {title}
                                    </h3>
                                    <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                                        {description}
                                    </p>
                                </div>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
};
