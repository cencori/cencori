/**
 * Next.js Template
 *
 * Generates all files for a Next.js + Vercel AI SDK project
 * pre-wired to Cencori.
 */

export interface TemplateOptions {
    projectName: string;
    includeChat: boolean;
    apiKey: string;
}

export function getNextjsTemplate(options: TemplateOptions): Record<string, string> {
    const files: Record<string, string> = {};

    // ── package.json ──
    files['package.json'] = JSON.stringify(
        {
            name: options.projectName,
            version: '0.1.0',
            private: true,
            scripts: {
                dev: 'next dev',
                build: 'next build',
                start: 'next start',
                lint: 'next lint',
            },
            dependencies: {
                ai: '^6.0.0',
                cencori: '^1.2.0',
                next: '^15.0.0',
                react: '^19.0.0',
                'react-dom': '^19.0.0',
            },
            devDependencies: {
                '@types/node': '^20',
                '@types/react': '^19',
                '@types/react-dom': '^19',
                typescript: '^5',
            },
        },
        null,
        2
    );

    // ── tsconfig.json ──
    files['tsconfig.json'] = JSON.stringify(
        {
            compilerOptions: {
                target: 'ES2017',
                lib: ['dom', 'dom.iterable', 'esnext'],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: 'esnext',
                moduleResolution: 'bundler',
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: 'preserve',
                incremental: true,
                plugins: [{ name: 'next' }],
                paths: {
                    '@/*': ['./*'],
                },
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
            exclude: ['node_modules'],
        },
        null,
        2
    );

    // ── next.config.ts ──
    files['next.config.ts'] = `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
`;

    // ── .gitignore ──
    files['.gitignore'] = `# dependencies
node_modules/
/.pnp
.pnp.js

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;

    // ── .env.local ──
    files['.env.local'] = `# Get your API key at https://cencori.com/dashboard
CENCORI_API_KEY=${options.apiKey || ''}
`;

    // ── lib/cencori.ts ──
    files['lib/cencori.ts'] = `import { Cencori } from 'cencori';

/**
 * Shared Cencori client instance.
 *
 * All API routes import from here — one client, every primitive.
 * When new Cencori products ship (Compute, Workflow, Storage),
 * they're accessible from this same instance.
 *
 * @example
 * import { cencori } from '@/lib/cencori';
 *
 * // AI
 * await cencori.ai.chat({ model: 'gpt-4o', messages: [...] });
 *
 * // Memory
 * await cencori.memory.store({ namespace: 'docs', content: '...' });
 */
export const cencori = new Cencori({
    apiKey: process.env.CENCORI_API_KEY,
});
`;

    // ── cencori.config.ts ──
    files['cencori.config.ts'] = `/**
 * Cencori Configuration
 *
 * Customize your AI settings here.
 * Docs: https://cencori.com/docs
 */
export const cencoriConfig = {
    defaultModel: 'gpt-4o',

    // Models available through Cencori
    models: [
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
        { id: 'grok-4', name: 'Grok 4', provider: 'xai' },
        { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek' },
    ],

    temperature: 0.7,
    maxTokens: 4096,
};
`;

    // ── app/layout.tsx ──
    files['app/layout.tsx'] = `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: '${options.projectName}',
    description: 'AI app powered by Cencori',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
`;

    // ── app/globals.css ──
    files['app/globals.css'] = `*,
*::before,
*::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

:root {
    --background: #0a0a0a;
    --foreground: #ededed;
    --muted: #888888;
    --border: #222222;
    --accent: #00d4aa;
    --accent-hover: #00b894;
    --card: #111111;
    --input-bg: #1a1a1a;
    --radius: 8px;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
}

html,
body {
    height: 100%;
    font-family: var(--font-sans);
    background: var(--background);
    color: var(--foreground);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

a {
    color: var(--accent);
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

code {
    font-family: var(--font-mono);
    font-size: 0.9em;
    background: var(--input-bg);
    padding: 2px 6px;
    border-radius: 4px;
}
`;

    // ── app/api/chat/route.ts ──
    files['app/api/chat/route.ts'] = `import { cencori } from 'cencori/vercel';
import { streamText } from 'ai';

/**
 * POST /api/chat
 *
 * Streaming chat endpoint powered by Cencori.
 * Uses the Vercel AI SDK for seamless streaming to the client.
 *
 * The model can be changed per-request or set a default
 * in cencori.config.ts.
 */
export async function POST(req: Request) {
    const { messages, model } = await req.json();

    const result = streamText({
        model: cencori(model || 'gpt-4o'),
        messages,
    });

    return result.toDataStreamResponse();
}
`;

    // ── app/page.tsx ──
    if (options.includeChat) {
        files['app/page.tsx'] = `'use client';

import { Chat } from '@/components/chat';

export default function Home() {
    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                gap: '2rem',
            }}
        >
            <header style={{ textAlign: 'center' }}>
                <h1
                    style={{
                        fontSize: '2rem',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        marginBottom: '0.5rem',
                    }}
                >
                    ${options.projectName}
                </h1>
                <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
                    Powered by{' '}
                    <a
                        href="https://cencori.com"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Cencori
                    </a>
                </p>
            </header>

            <Chat />
        </main>
    );
}
`;
    } else {
        files['app/page.tsx'] = `export default function Home() {
    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                gap: '1.5rem',
            }}
        >
            <h1
                style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                }}
            >
                ${options.projectName}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
                AI app powered by{' '}
                <a
                    href="https://cencori.com"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Cencori
                </a>
            </p>
            <div
                style={{
                    marginTop: '2rem',
                    padding: '1.5rem',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    maxWidth: '480px',
                    width: '100%',
                }}
            >
                <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    Your API route is ready at{' '}
                    <code>/api/chat</code>. Add your API key to{' '}
                    <code>.env.local</code> and start building.
                </p>
            </div>
        </main>
    );
}
`;
    }

    // ── components/chat.tsx (optional) ──
    if (options.includeChat) {
        files['components/chat.tsx'] = `'use client';

import { useChat } from 'ai/react';
import { useState, useRef, useEffect } from 'react';

export function Chat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
        useChat({ api: '/api/chat' });
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    return (
        <div
            style={{
                width: '100%',
                maxWidth: '640px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--card)',
                display: 'flex',
                flexDirection: 'column',
                height: '500px',
            }}
        >
            {/* Messages */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}
            >
                {messages.length === 0 && (
                    <div
                        style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <p
                            style={{
                                color: 'var(--muted)',
                                fontSize: '0.875rem',
                            }}
                        >
                            Send a message to get started.
                        </p>
                    </div>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        style={{
                            display: 'flex',
                            justifyContent:
                                message.role === 'user' ? 'flex-end' : 'flex-start',
                        }}
                    >
                        <div
                            style={{
                                maxWidth: '80%',
                                padding: '0.625rem 0.875rem',
                                borderRadius: 'var(--radius)',
                                fontSize: '0.875rem',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                                background:
                                    message.role === 'user'
                                        ? 'var(--accent)'
                                        : 'var(--input-bg)',
                                color:
                                    message.role === 'user'
                                        ? '#000'
                                        : 'var(--foreground)',
                            }}
                        >
                            {message.content}
                        </div>
                    </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div
                            style={{
                                padding: '0.625rem 0.875rem',
                                borderRadius: 'var(--radius)',
                                background: 'var(--input-bg)',
                                fontSize: '0.875rem',
                                color: 'var(--muted)',
                            }}
                        >
                            Thinking…
                        </div>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div
                    style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                        color: '#ff6b6b',
                        borderTop: '1px solid var(--border)',
                    }}
                >
                    {error.message || 'Something went wrong. Check your API key.'}
                </div>
            )}

            {/* Input */}
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    borderTop: '1px solid var(--border)',
                }}
            >
                <input
                    ref={inputRef}
                    name="prompt"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type a message..."
                    autoComplete="off"
                    style={{
                        flex: 1,
                        padding: '0.75rem 1rem',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: 'var(--foreground)',
                        fontSize: '0.875rem',
                        fontFamily: 'var(--font-sans)',
                    }}
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    style={{
                        padding: '0.75rem 1.25rem',
                        background: 'transparent',
                        border: 'none',
                        color:
                            isLoading || !input.trim()
                                ? 'var(--muted)'
                                : 'var(--accent)',
                        cursor:
                            isLoading || !input.trim()
                                ? 'not-allowed'
                                : 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                    }}
                >
                    Send
                </button>
            </form>
        </div>
    );
}
`;
    }

    // ── README.md ──
    files['README.md'] = `# ${options.projectName}

AI app powered by [Cencori](https://cencori.com).

## Quick Start

\`\`\`bash
# 1. Add your API key
#    Open .env.local and set CENCORI_API_KEY=csk_...
#    Get a key at https://cencori.com/dashboard

# 2. Start the dev server
npm run dev

# 3. Open http://localhost:3000
\`\`\`

## API Routes

| Route | Description |
|-------|-------------|
| \`POST /api/chat\` | Streaming chat — send messages, get AI responses |

## Using the SDK

All routes use the shared Cencori client at \`lib/cencori.ts\`:

\`\`\`typescript
import { cencori } from '@/lib/cencori';

// Chat
const response = await cencori.ai.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.content);
\`\`\`

## Switching Models

Change the model per-request or update the default in \`cencori.config.ts\`:

\`\`\`typescript
// Any model supported by Cencori — OpenAI, Anthropic, Google, xAI, DeepSeek, and more
const result = streamText({
    model: cencori('claude-3-5-sonnet'),
    messages,
});
\`\`\`

## Learn More

- [Cencori Docs](https://cencori.com/docs)
- [Cencori SDK](https://github.com/cencori/cencori)
- [Vercel AI SDK](https://sdk.vercel.ai)
`;

    return files;
}
