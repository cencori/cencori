"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import {
    CheckIcon,
    ClipboardDocumentIcon,
    CommandLineIcon,
    DocumentTextIcon,
} from "@heroicons/react/24/outline";

type CodeKind = "terminal" | "env" | "typescript";
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const PACKAGE_COMMANDS: Record<PackageManager, { init: string; install: string; run: string }> = {
    npm: {
        init: "npm init -y",
        install: "npm install cencori",
        run: "npx tsx cencori.ts",
    },
    pnpm: {
        init: "pnpm init",
        install: "pnpm add cencori",
        run: "pnpm tsx cencori.ts",
    },
    yarn: {
        init: "yarn init -y",
        install: "yarn add cencori",
        run: "yarn tsx cencori.ts",
    },
    bun: {
        init: "bun init -y",
        install: "bun add cencori",
        run: "bun run cencori.ts",
    },
};

const USE_CASES = [
    {
        id: "chat",
        label: "Chat",
        code: `import { Cencori } from "cencori";

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});

const response = await cencori.ai.chat({
  model: "gpt-5.6-sol",
  messages: [
    { role: "user", content: "Explain edge inference simply" },
  ],
});

console.log(response.content);`,
    },
    {
        id: "responses",
        label: "Responses",
        code: `import { Cencori } from "cencori";

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});

const response = await cencori.ai.responses({
  model: "gpt-5.4-mini",
  input: "Find today's AI news and summarize it",
  tools: [{ type: "web_search_preview" }],
});

console.log(response.output[0]?.content?.[0]?.text);`,
    },
    {
        id: "images",
        label: "Images",
        code: `import { Cencori } from "cencori";

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});

const result = await cencori.ai.generateImage({
  model: "gpt-image-1.5",
  prompt: "A quiet data center at sunrise",
  size: "1024x1024",
});

console.log(result.images[0]?.url);`,
    },
    {
        id: "embeddings",
        label: "Embeddings",
        code: `import { Cencori } from "cencori";

const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});

const result = await cencori.ai.embeddings({
  model: "text-embedding-3-small",
  input: "Cencori routes AI traffic securely",
});

console.log(result.embeddings[0]?.length);`,
    },
] as const;

const CODE_KEYWORDS = new Set([
    "async",
    "await",
    "const",
    "export",
    "from",
    "function",
    "import",
    "new",
    "return",
    "type",
]);

const CODE_CONSTANTS = new Set(["false", "null", "true", "undefined"]);

function HighlightedLine({ line, kind }: { line: string; kind: CodeKind }) {
    if (line === "") return <span className="block">{"\u00A0"}</span>;

    if (kind === "terminal") {
        if (line.trimStart().startsWith("#")) {
            return <span className="block text-white/25">{line}</span>;
        }

        const match = line.match(/^(\s*)(\S+)(.*)$/);
        if (!match) return <span className="block text-white/70">{line}</span>;

        return (
            <span className="block">
                <span>{match[1]}</span>
                <span className="text-[#c792ea]">{match[2]}</span>
                <span className="text-white/72">{match[3]}</span>
            </span>
        );
    }

    if (kind === "env") {
        const separator = line.indexOf("=");
        if (separator === -1) return <span className="block text-white/70">{line}</span>;

        return (
            <span className="block">
                <span className="text-[#00d477]">{line.slice(0, separator)}</span>
                <span className="text-white/35">=</span>
                <span className="text-white/68">{line.slice(separator + 1)}</span>
            </span>
        );
    }

    const nodes: ReactNode[] = [];
    const tokenPattern = /("[^"\n]*"|'[^'\n]*'|`[^`\n]*`|\b\d[\d_]*(?:\.\d+)?\b|[A-Za-z_$][\w$]*|\s+|.)/g;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = tokenPattern.exec(line)) !== null) {
        const token = match[0];
        let className = "text-white/72";

        if (/^["'`]/.test(token)) {
            className = "text-[#00d477]";
        } else if (/^\d/.test(token)) {
            className = "text-[#f6bd7a]";
        } else if (/^[A-Za-z_$]/.test(token)) {
            if (CODE_KEYWORDS.has(token)) className = "text-[#ff5c9a]";
            else if (CODE_CONSTANTS.has(token)) className = "text-[#f6bd7a]";
            else if (/^[A-Z]/.test(token)) className = "text-[#d4a9ff]";
            else if (/^\s*[!(]/.test(line.slice(match.index + token.length))) className = "text-[#c792ea]";
        }

        nodes.push(
            <span key={key++} className={className}>
                {token}
            </span>,
        );
    }

    return <span className="block">{nodes}</span>;
}

function CodeWindow({
    id,
    label,
    code,
    kind,
    copied,
    onCopy,
}: {
    id: string;
    label: string;
    code: string;
    kind: CodeKind;
    copied: boolean;
    onCopy: (id: string, code: string) => void;
}) {
    const isTerminal = kind === "terminal";

    return (
        <div className="w-full max-w-full overflow-hidden rounded-lg border border-white/[0.14] bg-[#090909]">
            <div className="flex h-10 items-center justify-between border-b border-white/[0.1] px-4">
                <span className="flex items-center gap-2 text-[12px] text-white/45">
                    {isTerminal ? (
                        <CommandLineIcon aria-hidden="true" className="size-4" strokeWidth={1.6} />
                    ) : (
                        <DocumentTextIcon aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
                    )}
                    {label}
                </span>
                <button
                    type="button"
                    onClick={() => onCopy(id, code)}
                    className="rounded p-1.5 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    aria-label={`Copy ${label} code`}
                >
                    {copied ? (
                        <CheckIcon aria-hidden="true" className="size-4 text-emerald-400" strokeWidth={2} />
                    ) : (
                        <ClipboardDocumentIcon aria-hidden="true" className="size-4" strokeWidth={1.6} />
                    )}
                </button>
            </div>
            <pre className="max-w-full overflow-x-auto px-4 py-4 font-mono text-[12px] leading-[1.7] sm:text-[13px]">
                <code>
                    {code.split("\n").map((line, index) => (
                        <HighlightedLine key={`${id}-${index}`} line={line} kind={kind} />
                    ))}
                </code>
            </pre>
        </div>
    );
}

export const GatewayGettingStarted = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const activeStepRef = useRef(0);
    const [activeStep, setActiveStep] = useState(0);
    const [direction, setDirection] = useState(1);
    const [copiedStep, setCopiedStep] = useState<string | null>(null);
    const [packageManager, setPackageManager] = useState<PackageManager>("npm");
    const [useCase, setUseCase] = useState<(typeof USE_CASES)[number]["id"]>("chat");
    const activeUseCase = USE_CASES.find((item) => item.id === useCase) ?? USE_CASES[0];
    const managerCommands = PACKAGE_COMMANDS[packageManager];
    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end end"],
    });

    useMotionValueEvent(scrollYProgress, "change", (progress) => {
        const nextStep = Math.min(4, Math.floor(progress * 5));
        const previousStep = activeStepRef.current;

        if (nextStep !== previousStep) {
            setDirection(nextStep > previousStep ? 1 : -1);
            activeStepRef.current = nextStep;
            setActiveStep(nextStep);
            setCopiedStep(null);
        }
    });

    const copyCode = async (id: string, code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedStep(id);
            window.setTimeout(() => setCopiedStep(null), 1600);
        } catch {
            setCopiedStep(null);
        }
    };

    const stepDescriptions: Array<{ number: string; title: string; description: ReactNode }> = [
        {
            number: "01",
            title: "Set up your project",
            description: "Create a new directory and initialize a Node.js project.",
        },
        {
            number: "02",
            title: "Install dependencies",
            description: "Install the Cencori SDK and TypeScript development tools.",
        },
        {
            number: "03",
            title: "Add your API key",
            description: (
                <>
                    Create a secret key in{" "}
                    <Link
                        href="https://console.cencori.com/settings?tab=api"
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground"
                    >
                        Console API settings
                    </Link>
                    , then save it in an <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-foreground/85">.env.local</code> file.
                </>
            ),
        },
        {
            number: "04",
            title: "Create your request",
            description: `Create a cencori.ts file and send your first ${activeUseCase.label.toLowerCase()} request.`,
        },
        {
            number: "05",
            title: "Run your script",
            description: "Your response will print directly to the terminal.",
        },
    ];

    const step = stepDescriptions[activeStep];

    const requestTypeTabs = (
        <div className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Request type">
            {USE_CASES.map((item) => {
                const active = item.id === useCase;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                            setUseCase(item.id);
                            setCopiedStep(null);
                        }}
                        aria-pressed={active}
                        className={`rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${active ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white/80"}`}
                    >
                        {item.label}
                    </button>
                );
            })}
        </div>
    );

    const packageManagerTabs = (
        <div className="mb-4 flex flex-wrap items-center gap-1.5" aria-label="Package manager">
            {(Object.keys(PACKAGE_COMMANDS) as PackageManager[]).map((manager) => {
                const active = manager === packageManager;
                return (
                    <button
                        key={manager}
                        type="button"
                        onClick={() => {
                            setPackageManager(manager);
                            setCopiedStep(null);
                        }}
                        aria-pressed={active}
                        className={`rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${active ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white/80"}`}
                    >
                        {manager}
                    </button>
                );
            })}
        </div>
    );

    const codePanels = [
        <div key="setup">
            {requestTypeTabs}
            <CodeWindow
                id="setup"
                label="Terminal"
                code={`mkdir cencori-demo\ncd cencori-demo\n${managerCommands.init}`}
                kind="terminal"
                copied={copiedStep === "setup"}
                onCopy={copyCode}
            />
        </div>,
        <div key="dependencies">
            {packageManagerTabs}
            <CodeWindow
                id="dependencies"
                label="Terminal"
                code={managerCommands.install}
                kind="terminal"
                copied={copiedStep === "dependencies"}
                onCopy={copyCode}
            />
        </div>,
        <CodeWindow
            key="api-key"
            id="api-key"
            label=".env.local"
            code="CENCORI_API_KEY=csk_your_api_key"
            kind="env"
            copied={copiedStep === "api-key"}
            onCopy={copyCode}
        />,
        <CodeWindow
            key="request"
            id="request"
            label="cencori.ts"
            code={activeUseCase.code}
            kind="typescript"
            copied={copiedStep === "request"}
            onCopy={copyCode}
        />,
        <CodeWindow
            key="run"
            id="run"
            label="Terminal"
            code={managerCommands.run}
            kind="terminal"
            copied={copiedStep === "run"}
            onCopy={copyCode}
        />,
    ];

    return (
        <section
            ref={sectionRef}
            className="relative h-[500svh] bg-background"
            aria-labelledby="gateway-getting-started-title"
        >
            <div className="sticky top-0 flex h-svh items-center overflow-hidden py-20 sm:py-24">
                <div className="pointer-events-none absolute inset-x-0 top-24 sm:top-28">
                    <div className="mx-auto w-full max-w-6xl px-6 sm:px-12">
                        <h2
                            id="gateway-getting-started-title"
                            className="text-3xl font-semibold tracking-[-0.035em] sm:text-[2.75rem]"
                        >
                            Get started in minutes
                        </h2>
                    </div>
                </div>
                <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-8 px-6 sm:px-12 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:gap-20">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={`step-copy-${activeStep}`}
                            initial={{ opacity: 0, y: direction * 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: direction * -12 }}
                            transition={{ duration: 0.32, ease: "easeOut" }}
                            className="min-w-0 self-start lg:pt-11"
                        >
                            <div className="text-2xl font-medium tabular-nums text-muted-foreground">{step.number}</div>
                            <h3 className="mt-2 text-2xl font-medium tracking-[-0.025em] text-foreground sm:text-[26px]">
                                {step.title}
                            </h3>
                            <div className="mt-2 max-w-md text-[15px] leading-6 text-muted-foreground">
                                {step.description}
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={`step-code-${activeStep}`}
                            initial={{ opacity: 0, y: direction * 22 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: direction * -16 }}
                            transition={{ duration: 0.36, ease: "easeOut" }}
                            className="min-w-0 lg:pt-11"
                        >
                            {codePanels[activeStep]}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
};
