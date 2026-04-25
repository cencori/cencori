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
                '@ai-sdk/react': '^1.0.0',
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
        <html lang="en" suppressHydrationWarning>
            <body suppressHydrationWarning>{children}</body>
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

@media (prefers-color-scheme: light) {
    :root {
        --background: #ffffff;
        --foreground: #171717;
        --muted: #666666;
        --border: #eaeaea;
        --card: #fafafa;
        --input-bg: #f5f5f5;
    }
}

/* Welcome Screen Styles */
.welcome-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-top: 15vh;
    gap: 2rem;
    animation: fade-in 0.5s ease-out;
}

.welcome-logo {
    height: 32px;
    width: auto;
}

.logo-light { display: none; }
.logo-dark { display: block; }
@media (prefers-color-scheme: light) {
    .logo-light { display: block; }
    .logo-dark { display: none; }
}

.welcome-text {
    font-size: 0.95rem;
    color: var(--muted);
    font-family: var(--font-mono);
    text-align: center;
}

.welcome-buttons {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 0.5rem;
}

.btn-primary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--foreground);
    color: var(--background);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    transition: transform 0.2s ease, opacity 0.2s ease;
}

.btn-primary:hover {
    transform: scale(1.02);
    opacity: 0.9;
}

.btn-secondary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    color: var(--foreground);
    border: 1px solid var(--border);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    transition: background 0.2s ease;
}

.btn-secondary:hover {
    background: var(--card);
}

.welcome-links {
    display: flex;
    gap: 1.5rem;
    margin-top: 2rem;
}

.welcome-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
    font-size: 0.875rem;
    transition: color 0.2s ease;
}

.welcome-link:hover {
    color: var(--foreground);
}

@keyframes fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
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

/* Stealth Editorial Chat Layout */
.chat-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--background);
}

.chat-main {
    flex: 1;
    width: 100%;
    max-width: 48rem; /* max-w-3xl */
    margin: 0 auto;
    padding: 2rem 1rem 8rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.message-row {
    display: flex;
    flex-direction: column;
}

.message-row.user {
    align-items: flex-end;
}

.message-row.assistant {
    align-items: flex-start;
}

.message-bubble {
    max-width: 85%;
    padding: 0.4rem 0.75rem;
    line-height: 1.4;
    font-size: 0.875rem;
    white-space: pre-wrap;
    border-radius: 0.875rem;
}

.message-bubble.user {
    background-color: var(--foreground);
    color: var(--background);
    border-bottom-right-radius: 0.25rem;
}

.message-bubble.assistant {
    background-color: transparent;
    color: var(--foreground);
    padding: 0;
    max-width: 100%;
}

.chat-input-wrapper {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 1rem;
    background: linear-gradient(to top, rgba(10, 10, 10, 1) 40%, rgba(10, 10, 10, 0) 100%);
    display: flex;
    justify-content: center;
}

.chat-input-container {
    width: 100%;
    max-width: 48rem;
    position: relative;
}

.chat-form {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--card);
    border: 1px solid var(--border);
    border-radius: 9999px; /* full rounded */
    padding: 0.5rem 0.5rem 0.5rem 1rem;
    transition: all 0.2s ease;
}

.chat-form:focus-within {
    border-color: rgba(255, 255, 255, 0.2);
    background-color: rgba(26, 26, 26, 0.8);
}

.chat-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--foreground);
    font-size: 0.95rem;
    font-family: var(--font-sans);
    resize: none;
    height: 24px;
    line-height: 24px;
}

.chat-input::placeholder {
    color: var(--muted);
}

.chat-submit {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background-color: var(--foreground);
    color: var(--background);
    border: none;
    cursor: pointer;
    transition: transform 0.1s ease, background-color 0.2s ease;
}

.chat-submit:disabled {
    background-color: var(--border);
    color: var(--muted);
    cursor: not-allowed;
}

.chat-submit:not(:disabled):hover {
    background-color: #fff;
    transform: scale(1.05);
}

.chat-footer {
    text-align: center;
    margin-top: 0.75rem;
    font-size: 0.7rem;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
}

.brand-link {
    display: flex;
    align-items: center;
    opacity: 0.6;
    transition: opacity 0.2s ease;
}

.brand-link:hover {
    opacity: 1;
}

.brand-logo {
    height: 12px;
    width: auto;
    display: block;
}

.chat-footer a {
    color: var(--muted);
    text-decoration: underline;
    text-decoration-color: rgba(136, 136, 136, 0.3);
}

.chat-footer a:hover {
    color: var(--foreground);
}

.loading-indicator {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
    font-size: 0.85rem;
}

.loading-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: currentColor;
    animation: pulse 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(1) { animation-delay: -0.32s; }
.loading-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes pulse {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1.2); }
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
    return <Chat />;
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

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect } from 'react';

const ArrowUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12 7-7 7 7"/>
        <path d="M12 19V5"/>
    </svg>
);

export function Chat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
        useChat({ api: '/api/chat' });
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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

    // Handle Enter key to submit
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                // Manually trigger submit since we're intercepting Enter
                const formEvent = new Event('submit', { bubbles: true, cancelable: true }) as any;
                handleSubmit(formEvent);
            }
        }
    };

    return (
        <div className="chat-container">
            {/* Messages Area */}
            <div className="chat-main" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="welcome-container">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2.5rem' }}>
                            <img src="/logos/ww.png" alt="Cencori" className="welcome-logo logo-dark" />
                            <img src="/logos/bw.png" alt="Cencori" className="welcome-logo logo-light" />
                            <div className="welcome-text">
                                <p style={{ marginBottom: '0.5rem' }}>1.Confirm your Cencori API key in your .env.</p>
                                <p style={{ marginBottom: '0.5rem' }}>2. Get started by typing a message below and send.</p>
                                <p style={{ marginBottom: '0.5rem' }}>3. See the AI stream instantly.</p>
                            </div>
                        </div>

                        <div className="welcome-buttons">
                            <a href="https://cencori.com/dashboard/organizations" target="_blank" rel="noopener noreferrer" className="btn-primary">
                                Dashboard
                            </a>
                            <a href="https://cencori.com/docs" target="_blank" rel="noopener noreferrer" className="btn-secondary">
                                Read our docs
                            </a>
                        </div>

                        <div className="welcome-links">
                            <a href="https://cencori.com/academy" target="_blank" rel="noopener noreferrer" className="welcome-link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                                </svg>
                                Academy
                            </a>
                            <a href="https://cencori.com" target="_blank" rel="noopener noreferrer" className="welcome-link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                    <path d="M2 12h20"/>
                                </svg>
                                Website
                            </a>
                            <a href="https://cencori.com/ai/models" target="_blank" rel="noopener noreferrer" className="welcome-link">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                                    <line x1="6" y1="6" x2="6.01" y2="6"/>
                                    <line x1="6" y1="18" x2="6.01" y2="18"/>
                                </svg>
                                Models →
                            </a>
                        </div>
                    </div>
                )}

                {messages.map((message) => (
                    <div key={message.id} className={\`message-row \${message.role}\`}>
                        <div className={\`message-bubble \${message.role}\`}>
                            {message.content}
                        </div>
                    </div>
                ))}

                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                    <div className="message-row assistant">
                        <div className="message-bubble assistant">
                            <div className="loading-indicator">
                                Thinking <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 68, 68, 0.1)', color: '#ff4444', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                        {error.message || 'Something went wrong. Check your API key.'}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="chat-input-wrapper">
                <div className="chat-input-container">
                    <form onSubmit={handleSubmit} className="chat-form">
                        <textarea
                            ref={inputRef}
                            name="prompt"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={onKeyDown}
                            placeholder="Ask a question..."
                            className="chat-input"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="chat-submit"
                            aria-label="Send message"
                        >
                            <ArrowUpIcon />
                        </button>
                    </form>
                    
                    <div className="chat-footer">
                        Powered by{' '}
                        <a href="https://cencori.com" target="_blank" rel="noopener noreferrer" className="brand-link">
                            <img src="/logos/ww.png" alt="Cencori" className="brand-logo" />
                        </a>
                    </div>
                </div>
            </div>
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

    // ── public/logos/ww.png ──
    files['public/logos/ww.png'] = '__BASE64__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';
    
    // ── public/logos/bw.png ──
    files['public/logos/bw.png'] = '__BASE64__iVBORw0KGgoAAAANSUhEUgAADDcAAAKlCAYAAABl8ObgAAAACXBIWXMAACxLAAAsSwGlPZapAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAOdEVYdFNvZnR3YXJlAEZpZ21hnrGWYwAA485JREFUeAHs/Q28bWleF3b+bt1quxua7uI1CAKrUeRFAtW8iDhRdqMRRmbs6kHRBCf3tCZoMmpVR8fEjHpuR2ZkkvlMVRPNaGK8t6OZIRrT3UIiEPDuIoCAQlXLa1A5qwTBBrGqsaG7qZc7z+Pa23vq1r23zj5n77XXs/b3+/n8Pvvcc27dunfvtZ611vM8/+e5FAAAAAAAAAAAAAAAOJtFyZesXher7z1T0q9enyx5avW6DAAAAAAAAAAAAAAAwBY8UPJIyY2Smxvmxuq/7QIAAAAAAAAAAAAAALChWtRwXPJ0Ni9quFOeiEIHAAAAAAAAAAAAAADgDLZd1HC3HR0eCgAAAAAAAAAAAAAAwG0ezm6LGm7PSclRAAAAAAAAAAAAAACAg/dght0Ubu4pihwAAAAAAAAAAAAAAOCAHWd/RQ2KHAAAAAAAAAAAAAAA4IB1JU9kOoUNtxc5PBgAAAAAAAAAAAAAAGC2Hi55OtMsbDidaxmKMAAAAAAAAAAAAAAAgBl5NNMvarh9F4ejAAAAAAAAAAAAAAAAzetKnkhbhQ2n80Ts4gAAAAAAAAAAAAAAAM3qMuyA0Eohw71yHAAAAAAAAAAAAAAAoCmLkqfTVgHDy+Vk9e8CAAAAAAAAAAAAAAAm7kraKlrYNI+WPBAAAAAAAAAAAAAAAGCSjtNWocJFdnHoAgAAAAAAAAAAAAAATMpx2ipQ2EaOAwAAAAAAAAAAAAAATEKd5N9CMYJdHAAAAAAAAAAAAAAAYIaO01Yxwq4KHI4CAAAAAAAAAAAAAACM7jhtFSHsOscBAAAAAAAAAAAAAABGUyfyt1BwMHaeKOkCAAAAAAAAAAAAAADs1HHaKjgYOydR4AAAAAAAAAAAAAAAADtzJW0VGuwzjwQAAAAAAAAAAAAAANiqRdoqLphCjgMAAAAAAAAAAAAAAGxFV/J02iosmEoeDQAAAAAAAAAAAAAAcCFdyUnaKiiYWp5YvY8AAAAAAAAAAAAAAMCGuihs2FZOosABAAAAAAAAAAAAAAA2VnccaKV4QIEDAAAAAAAAAAAAAADMzKNpq3BAgQMAAAAAAAAAAAAAAMzIcdoqGGgtT5c8GAAAAAAAAAAAAAAA4I4WaatQQIEDAAAAAAAAAAAAAADMSFdykraKBBQ4AAAAAAAAAAAAAADATDwQhQ0KHAAAAAAAAAAAAAAAYI8eTVtFAQocAAAAAAAAAAAAAABgRh5OW8UAc8xJSRdGcSkAAAAAAAAAAAAAAExJl2FiPfvXl7xx9coO3RcAAAAAAAAAAAAAAKbigZIbYSq6DJ9HFwAAAAAAAAAAAAAAOBCPltyUyeUkChwAAAAAAAAAAAAAADgAR2lrwv+h5YkMO2sAAAAAAAAAAAAAAMAsdRl2B2hlov+h5p1hJy4HAAAAAAAAAAAAAIB9q5PmHwxT9xmr18cDAAAAAAAAAAAAAAAz8nDa2r1Akithqy4FAAAAAAAAAAAAAIB96UqeKHkgtOSZkjeU9GEr7gsAAAAAAAAAAAAAAPtyLQobWlQ/sxvx2W3N5QAAAAAAAAAAAAAAsA8Pl/zB0Kpa2PCqkm8JAAAAAAAAAAAAAAA0qCt5uuSmNJ9FuLD7AgAAAAAAAAAAAADA2I4zrPxP+67FZ3lhlwMAAAAAAAAAAAAAwJiOSq6GuaiFDR8qWYZzuxQAAAAAAAAAAAAAAMZ0UtKFOXmm5A0lfTiX+wIAAAAAAAAAAAAAwFiOo7BhjuruDY+Gc7NzAwAAAAAAAAAAAADAOLqSJzJMhGee3liyDBuzcwMAAAAAAAAAAAAAwDjqrg0KG+btOJyLnRsAAAAAAAAAAAAAAHavKzkJh+D1JX3YiJ0bAAAAAAAAAAAAAAB2z4r+h+MobMzODQAAAAAAAAAAAAAAu9XFrg2H5JmSjwwbsXMDAAAAAAAAAAAAAMBu2bXhsDxQsggbUdwAAAAAAAAAAAAAALA7XclRODQPhY0obgAAAAAAAAAAAAAA2B27NhymK2EjlwIAAAAAAAAAAAAAwC50JSfhUL2+pA9nYucGAAAAAAAAAAAAAIDdWIRDtghnprgBAAAAAAAAAAAAAGA3jsMheyCcmeIGAAAAAAAAAAAAAIDtW5R04ZA9E85McQMAAAAAAAAAAAAAwPZdCYeuD2emuAEAAAAAAAAAAAAAYPsW4dD14cwUNwAAAAAAAAAAAAAAbNeipAuH7JkobtiI4gYAAAAAAAAAAAAAgO26Eg7dk2EjihsAAAAAAAAAAAAAALZrEQ7de8JGFDcAAAAAAAAAAAAAAGxPtwqHbRk2orgBAAAAAAAAAAAAAGB7FoHkybARxQ0AAAAAAAAAAAAAANvzJeHQ1cKGPmxEcQMAAAAAAAAAAAAAwPY8GA7d42FjihsAAAAAAAAAAAAAALZHcQPvChtT3AAAAAAAAAAAAAAAsB0KG+hLlmFjihsAAAAAAAAAAAAAALbjgXDoluFcFDcAAAAAAAAAAAAAAGxHFw7d28K5KG4AAAAAAAAAAAAAANiOZ8IhW5b04VwuBwAAAAAAAAAAAACAbfixkksli3CI6q4NT4ZzUdwAAAAAAAAAAAAAALA9yyhwOER9yVvCud0XAAAAAAAAAAAAAAC26WrJO8Ih8XkDAAAAAAAAAAAAADBJ10tuykGkCwAAAAAAAAAAAAAATNADJU+krUn6snmuhQu7FAAAAAAAAAAAAAAAdqUWONwoeTDM1etL+nAh9wUAAAAAAAAAAAAAgF15puSNJU+GOboehQ1bYecGAAAAAAAAAAAAAIDds4PDPNm1YUvs3AAAAAAAAAAAAAAAsHvrHRz6MBdvi88TAAAAAAAAAAAAAIAGdSUnJTel6Zxk2I0DAAAAAAAAAAAAAACa1JU8kbYm88uLcxS26lIAAAAAAAAAAAAAABhbXfX/RsmDoTV9yevDViluAAAAAAAAAAAAAADYDwUObaqFDX3YqvsCAAAAAAAAAAAAAMA+PFPyxpInQyveHoUNAAAAAAAAAAAAAADMUN3B4Z0lN2XSOVl9VgAAAAAAAAAAAAAAMFvX09Zk/0PLIgAAAAAAAAAAAAAAcAAeS1sT/g8lj4WduhwAAAAAAAAAAAAAAKbim0suxS4BU9KX/FslHww7o7gBAAAAAAAAAAAAAGBallHgMCVvKPmnAQAAAAAAAAAAAACAA/RIyU3Za64GAAAAAAAAAAAAAAAO3EMlT6etgoC55EYAAAAAAAAAAAAAAIB/6cGSk7RVGNB6Tkq6AAAAAAAAAAAAAAAA/0oXBQ5j5qEAAAAAAAAAAAAAAAAv0ZU8kbaKBFrM1QAAAAAAAAAAAAAAAPf0WNoqFmgpN8JeXA4AAAAAAAAAAAAAAC355pJLJYuwTX3Jm0ueCaNT3AAAAAAAAAAAAAAA0J5lyftKfkPJq8JF1YKGL85Q4AAAAAAAAAAAAAAAAGygKzkpuSkXyiMBAAAAAAAAAAAAAADOrYsCh4vkagAAAAAAAAAAAAAAgK14LG0VFUwhjwUAAAAAAAAAAAAAANiqq2mruGCfeSIAAAAAAAAAAAAAAMBOPFhykrYKDcbOSUkXAAAAAAAAAAAAAABgZ7oMOxO0UmygsAEAAAAAAAAAAAAAAGbqatoqPNh1no7CBgAAAAAAAAAAAAAAGN1Rhkn9LRUh7Kqw4cEAAAAAAAAAAAAAAAB70ZWcpK1ihG3noQAAAAAAAAAAAAAAAHv3WNoqSNhWjgIAAAAAAAAAAAAAAEzGUQ5rF4ejAAAAAAAAAAAAAAAAk9OVPJG2ihQUNgAAAAAAAAAAAAAAwAxdTVvFCgobAAAAAAAAAAAAAABghrqSk7RVuKCwAQAAAAAAAAAAAAAAZuaBksfSVgHDnfJ0ySIAAAAAAAAAAAAAAECzjtLuLg4nGXahAAAAAAAAAAAAAAAAGteVXE9bhQ1PRGEDAAAAAAAAAAAAAADMzlHa2MXheskDAQAAAAAAAAAAAAAAZqnLtHdxeCQAAAAAAAAAAAAAAMBBOMq0dnGof5dFmI1LZ/j5zdXXn1Ly0SWvDQC3W4ZD98qSV5c8s/r1fSUvBAAAAAAAAAAAAObjgZKrJQ9nv5Ylbynpw2zcrbjhcsnzJb+y5M+V/LaS1wSAu/mwkg+EOXpVhpuxTyr5dSWfUfKpJZ+c4Tr54avf84pV6nHw7SV/JMNN0/qaCgAAAAAAAAAAAHPRldxYvY6pLkD8tpLHwuzcqbjh/tXrd5X8+gyrTt8XAO5FcUPbagHCx5T86yVfkuH692CG3Ypelc3VXY/qNfZ7Sr44w7X1uQAAAAAAAAAAAMC8PJJhF4cuu/dkht0angyzdHtxQ53c+ZklP5hhEub9AeAsXl3ywTBF9Vp389Sv604Ln1byvy/58pLPybAzwy6sCwQ/t+RHosABAAAAAAAAAACA+elKrpZcyW7U3Rrevvp/MGOnixtqIcMXlXxnyfMZCh0AOJtfUfJsmIp1QUMtLPhVJW8q+T0Zdmb4iIxrXSz4b5R8bxQ4AAAAAAAAAAAAME8Plrwz293FYZlht4Y+zN66uKEWMnxcyU9HYQPAedR284WwD+trWS1mqJ/DZ5f82yW/u+RTMg3rHRw+vuTno8ABAAAAAAAAAACA+ToqOc7Fihz6DEUNy3AwLuXW6tbPrV7vDwCbUtwwntO7DtXr1idkuBH6/SWfmul6bpVX59a1FwAAAAAAAAAAAOaoK7laciWbeabk7SWPrb7mwNSVpP90bhU3iIjIZvlQ2LV1MV71ipLfWvItJR9MW8dK3R3pT+fFBRoAAAAAAAAAAAAwV13J9bz8/LqnMxRDPBAO1npyZT0g6orj9wWATdUJ9q8O23b6GvXhJV9Z8idKPuPU91srEljfhF0OAAAAAAAAAAAAHI6HSh7NUOxw2rLkHSXvip0aDl6dFPpFJd8TAM7r50o+LmzDeoeGWnBXCxr+rZI/VfLJabOY4U7qv+M3lXxXAAAAAAAAAAAA4LAclTxc8niGgoZlYKVOEv2rJV8dAM7rp0s+MVzEpVOvbyr5upJfm/kUNJxW/03/bYYbNAAAAAAAAAAAAACK+1cB4PzeH85jXbRQJ/t/VsljJb919evbf8+c1H/TIgAAAAAAAAAAAAD8K7Ww4R8FgIv4Z2ET92UoYHh1yR8t+eMlryl5YfXzORY03O5fCwAAAAAAAAAAAAD/Si1ueG8AuIg+vJxLq9QChk8v+cslvyFDkcN6p4b7cjheFQAAAAAAAAAAAAD+lTqR9J8GgIv4iXA366KGWsDwb5c8XfIjJb/+1M8PqagBAAAAAAAAAAAAgDuoE0p/MgBcxFPhdvX6UgsXXlnyaMnzJf9tyWtP/RwAAAAAAAAAAAAA/qX7S346AFyE4oZbatFC3aWhFjFcL3nT6tfVehcHAAAAAAAAAAAAAHiRWtzwdAC4iD5czrA7w0eVvLPk31j9ulLQAAAAAAAAAAAAAMA91eKGDwaAi/jZHK66U8MLJR9d8j+VfMHq19XlAAAAAAAAAAAAAMAZ1EmpvxwFDgAX8S9yeOr1o+7I8EDJ3yl5b8kbTv0MAAAAAAAAAAAAAM5sPQH1FwLAeXwot3YqOAT3rfLqkr9V8vMlX7j6mZ0aAAAAAAAAAAAAADiXdXHDTweA83hvDkPdpaFeM2ohx18oeX/Jb1n9TFEDAAAAAAAAAAAAABeyLm74ewHgPH4y83d/yc2Sr1m9/v7V6/0BAAAAAAAAAAAAgC1Q3ABwMd+d+VrvyPDrSn6h5M9n2LmhXjsuBQAAAAAAAAAAAAC2ZL3q9nsCwHl8b+bn0iqvylC88Tklz+dWQRwAAAAAAAAAAAAAbNV6ouqPBoDz+JHMSy16u1nyp0veX/JZq+9fDgAAAAAAAAAAAADsyKXVay1yeD4AbOrVJR9M++p1oBY1fFrJD2T4d62/z25cCgAAAAAAAAAAAAD/0nrS6gslzwSATdSisNYLG+oE+7pbQ70OvKvkfyt5ZYbrg8IGAAAAAAAAAAAAAEZxeuLqjweATZykbevdGr4wQ3HD/2H1/fsDAAAAAAAAAAAAACM6XdzwtwLAJn447Vrv1vDtJd+9+tpODQAAAAAAAAAAAADsxenVub8zAGzifyi5lGH3g1asd2v47JInMhQ1VJcDAAAAAAAAAAAAAHtyepXuvxsANvH9aauwoRYw1GKGv5qhsOG52K0BAAAAAAAAAAAAgAm4dNuv60RXq3cDnE3d/eb5TN+lVR4o+cclr8pQ1HAp7JP3HwAAAAAAAAAAAGDl9hW7nwoAZ/G+tFHYUAvW6u4Sv6/k50teufqeifUAAAAAAAAAAAAATMb9t/36fy351ADwcp7M9NU2vu7I870lX1jyQl7a7gMAAAAAAAAAAADA3p3euaGu4v0NAeAs/lqmu/tB/XvV3RkeKHm25AtW37svAAAAAAAAAAAAADBBpye63iz5OwHgLL4901Tb9dqe/66Snzv1PQAAAAAAAAAAAACYrDutOv7BklcGgHuZ4q4Nr8iwU8NfL/mdJS9EYcOUTXXnDwAAAAAAAAAAAIDR3X+H7/39ki+ISZcAd/OPMz21Pa+FDT9d8nGr7ylsAAAAAAAAAAAAAKAJd5r4+g1R2ABwL/9LpqO217Ww4YGSmyUfW3I5AAAAAAAAAAAAANCQOxU3vCsA3MtfyjSKwC6t8r8r+bmS53LnHXkAAAAAAAAAAAAAYNLuNjn3+dy58AGA5FeUPJv9qm30CyX/UcnXZWi37djQFrskAQAAAAAAAAAAAKzcrYDhRwLAnfxs9l/YUHdnqIUNf73kz66+VtgAAAAAAAAAAAAAQLPuVtzwVwLAnXxT9usVJc+VPFny5gyr/9tpBwAAAAAAAAAAAICmXbrL9z+h5J8EgNt9QckPlNzM+GphQ9014udKHsiwgwPtuhQAAAAAAAAAAAAA/qV7Taz8YMkrA8Bp+5qQvt6x4QMll6OwYQ4UNwAAAAAAAAAAAACs3HePn31n9rMyOcBU/Vj2oxYy1Pb6hShsAAAAAAAAAAAAAGCG7lbcUFeT/vpYVRpgrRZ7/aWM3y7WQoYPy7CbznNR2AAAAAAAAAAAAADADN1rku6rS34pAKx9fMnPZrxdbWohw0eU/PMobJgjBYQAAAAAAAAAAAAAK/fd42cfKPmZjDeJF2DK3l/y3oxb2PBRUdgAAAAAAAAAAAAAwAG472V+/vWxsjRA9dczXnu4LmyoxRQKGwAAAAAAAAAAAACYvUsv87OPLPn5APDZJT+S3e/cUAsZXpuh7VXYMG+KBwEAAAAAAAAAAABWzjKx8pkME21NwgQO1Qsll7N79f/xmgztrsKG+XNdBQAAAAAAAAAAAFh5uYmzdeLlf13yxwJwuL4pu1fb41rcoLABgPN4YJW17h4/e7nv30t/h+89s8qdfn2n3w8wJ92pr+/VFucM37+b29vZtf4ev+4DAAAwrqn2T93tmQoAAACACXq5VaPvK/mokp8LwOF6Q8l7Sm5mN15R8uzqz3929Wvmz84NwGnrgdzu1NfrvO4O31sP+nZpR3/b63pg+alT33/mVNa/Btil7tRrd9v3PuUOv6c6z+SbfXnmtlT96uv35cVt7vpnfYAx1fbk4ZKHMpx/j5c8WbIMsAtdyYO59fz1Kbnzs9ay5G1xXQQOy+m2sIv+Kf1TAC/1aIb76do2vmf1+uQq2kuYp67kePVaz3N9V8xJV7LI8GzzuXnx81C1jP4h5mWRoU2valten4WXq69hUs46sbLenLw2JmICh6cWHNyX3VkXNvxyhjbWjg2HwzUV5m/d+fHgqa/XE2e6vHSyLHfW58UDz/UBez1gkhg0AV6qy4sn49TX04UK6++3UqCwD7dP5Kmv78utNtkkH7i4dVHDI7l7e/SukndnGFzoA2xi/SxWUwenF9n82asveXvJYwFol/6p7ehz5/6pPrf6qTwfAXNXJ8JdvcfPTxc6PBWTn6F19f6x9l0d3eXn9ZyvfVe12OF6YPrqM9Ci5Etyq5/orONEVzMUOUCrFhnu5RZ3+Xmf4b6tjke8KzABl874e/7Tkj8ZgMNSCxv+Rsnvym7UQobnSv5Zhhvmy+GQKG6AtnV58cDw7YPCXRjbehC5z62BE4PLMD/dbTnd/p5eTYdxrNvddZ667dfaX3ipLsMgwkPZrMjqegwswL3U86meV5+7eu2yPX3JG6PICJie2/ui9E/tn/4pYK7qBOfHcj7rgod3r177AFO2yL0nwN7JutDhHVHUxLR0GfqJ3pTNjuk76TMUOFwPtGMRbTqNOsvEyrpied1q9J8H4PB8ZsmPl7yQ7aqFDM9n2K7zs2LHhkOkuAGmbT0QvC5eWG9DeXqVO9px++Tb96xeDSzD9HR56eScddvbhdacnsTzntwawLa9LYeoyzCIcJSL6TMMoi1jQgiHbf18Vgent13McDdXY5U+YFz6p+Zn/UxUsy5+0D8FTF297jyR7elza2Xg+qoNhGlYZPMJsHfSxwRw9qs+Jx1lOwUNd3I9wzHeB6Zrke226cs45hnZJhMr31vyMRmKHQDmru7a8Eslr8n2XVr9+bXK8SuisOFQKW6A/Ts9QFxfP+XU1waHD0cfq7DC2Lq8uO09/WsOx/UYAOAw1PatrnB5lO27HucRh2W9O8N6cHofz219PD8A26V/iqqP6wttqu2Uienz1mUobNjlNWmZW4UOFsSA8S2ynQmwt+sz9F29I+5xGMciuzmW76QveXNct5ieRXZ3HlyP8QgmqBY0HGVYufymiMgBpO6q8HXZfkHXpVX+ZLSphx5gPF2GCTCPlFzL0BH/dNpqM2T3OQ6wTevVRI9KHi15Z8lJ2moXZPc5yW4mfMMULEpuZJxz6VoUiDFf69X26vk0lee4p+P6BWyui/4pefkcB9qxyK2+nhsZ7o+6MCddxu/Pq/+/2pf4YIBdW0TfFe2r/Ub1Gas+X93cQ44D07DIuG36IjARdSLuK7Kfi4CIyL7ykdl+cUPdpeHLVn/+80luysEG2L4uwwDK1QwPVCdpq12Q/eckOldhU4oYZBs5DszHIuMNItyea3Evw3wsMhzTU574exyAl+qif0oulpO4p2P66u50dzuG6+TCOsmwC63b10TR0+2hYwm2bxF9V7Svjk0dZxr9RnVcrAvsR11E4Ub2c+zX/+8iMBHfEZNxRWT+qe3cj2f7Lpd84qn/R0vviWw/wPl1eelKd62c+9JGjgPcSRdFDLK71Ot5F2jXIvsbRLg91+J8ok1TGpg+a27E+QaHqoudGGS3OQ5MU+0XOutxXNvGo7hfatEmn/MYuRG7p8FFLTKNvqt6z3wc1wbOZ6p9RydxTDOuo0xnnPZGFDmwZ3X18s/JNE4IEZFd58sz7FqzLfevXuuf/WySm3LwAc6my62JtDdikFjGy7XohOJw1c7hRUzSkfFzEm0v7VlkOkUNp7MeKH4gMH2LTPM8cv0C1rq8uNDb85GMFavAMiX12eJGzn881//2KLTgONNtF0+i7x42tcg0n7nr+XwUOLu6c9SUn8XqMf1gYLeOMt3F527EPRp79i9KXsg0TxARkW1lmy6vXn+25LkkN0UC3El92D/KMFBsIq1MISfxAM783V7IUI/7qZ+bMu/U678BAFqwSBuTsU9ioJhpanGXhpc711y/YB70T8nUchLXGPavy/b6jOqf82j0u05VnTg6pTbwXqkFYIsAd7OIvivmYZG2xq4eCWzXuh/1JG2cA9fiXp89qLs3/IkobhCR+eb5kndkaO+2Yb37wzfFjg3y4sCh62KgWNqJTijmQiGDtJQrgWlapM0V5k9ioJhp6DI8B871GdCzA7Slix1DpZ0cB/ajy+76kK7FxKcpqYVUU2nzNslJPO/CaUcZxl5bOYdPn8sPBW7p0u5On8eBi2t9cZhrca/PiOok3VelrZNERGTTfGy2V9xQd224kozy95a2AoekPnTVzigDxdJy6vELrekyDGRcS5uDGSImiDIli7Q7mHY6J7GyJfuxyDzOobPkOMAU6Z+SOUT/FGOrk91Psvtj+0Y8p+xbl/YXQjmJIgcO21HmsaBR3ZWlC4dsPaG7lWP2bjkOnM/cdrw9jnadkdQCh2/PsLp5KyeIiMhZUtu1H8321MKGTzr1Z7f0XsjuA3N3FKuCy/xSJ4d3gemqnV0m6sjcchzYr0XmOSH7WtzXMI5FDqeowfULpuco+qdkfjmJ+zjGUQsbxu5fuhFFDvtQ+xRr27Lv9m2b7eRR4DDU8/co87zfvRb3PIdokXkdz8eBs5tbUcPpnMT9GSOoq5n/qrR1coiInDVfnKGI66LuX73WP/PZZJS/u7QVmLM6sbal81Fkk5xEZyrT1MWEHZlvjgPjO8ph7HpzLe5t2I1FDrOowfULpqOegy20FSLnyUncw7Fb+yhsOJ1rcYyPaa5jOicxiY75mvME2NtzHA7BevGuVo5LxzDbdEht+kncnzGC98ZK5CIyn9T27JeyHeviiO+PdlLuHpij+tB1I22diyLnSe1YeCgwHXXA+SRtnUcim+Y4MI6jHF6belLySGA7FvFceDrHAcZW+6eupa22QuQ8qf1TVwLbt+/ChtO5FkUOu3acaXzWu8xJTKJjPg5pAqzz+HAsMv/+2OPASx1qm15zLe7z2ZG6e8NvK3khbZ0UIiJ3Sy1C+JoM7dtF1T+jTgrQRsq9AnPTxcRaObwcB/bvSg6z00sOM1cCu1EHEY7ifvYkBoo5v0UUNdwtxwHG0uUwdl4SOZ3jwPZ0mV4/00kc57tSF/CZ0me969yISXS065AnwN5+TejCXMx5t4Y75Tgw0KbfSm0DusAO/GKsSi4i7WddhFCtd104r8sln7j687SPcq/AnFgxXA45x4H9qcdfC+eJyDZzJbA9BhHunGsxoMDZLaKo4Sw5DrBrXfRPyeHmOHBxXabdjp7Ec8o2dTnc6+a1OJZoh74r5/FcLXKY16Er4ZBp0++ck1h0iS2rK5P/+7EyuYi0n1qE8PW5+K4Nl1evz5U8m4z295c2A3NxJR6+RK5l6IyAMR3SajYit2cRuBiDCGfLceDuapH7jbR1TDunYL4WcV0XeWf0T3F+XdqZYFj7xBzrF1Pfv1Y+713lJCbRMW36rpzHc/Zw2jrWtp0Hw6Hpok0/S06icI0tWa9u/kIUOIhI+7kvFy9uqL4pChvkbIE5OPSOB5HTeSIethlHHdS4kbbOD5Ftp3YAGwDgPAwMb56TGCjmxep5dC1tHcdTynGAbdM/JXIr+qc4jy7tTXQ/iWP9Iq6lrc/bscQh0XflPJ6zLsa3ap6OY/ZQdHHfdZ5ci3OELagTgb82ihtEpN3UXRvqajbrgq3zqrs2/OaM83eWeQRad5y2zjmRMXISD9rsVherqomscxJtLmdnYPjiuRbn3KFzHm0vxwG2pZ5PLZz3ImPmJO7bOLt6j1eLYlo5vm/PcdhUfc9a+GwdSxwaz9wXz7W4B5qyRYxvnc5J7EQ1Z10UNWzjHDkKXMB6pfN6QClwEJFW85pcbNeGy6vX+mc9l93+XWU+gVZZpVPk3jmJzlN2o4uOX5HbcxJtLvdmYHi7qe/jI+EQHcV5tO04l+DirqWt815kzJzEsxJncy1tHdt3ih1Lzm6Rtj5bbSeHQN/V9s/jozA1x2nrOBorN8LcLDIssNzKMdhC6vvZBc6pTgj+LzKsft7SgS8iUtutb83FrHd8+DvRDspmgRa1voqTyFg5KXkwsD2LGNwQuVtOomOTlzIw7LxjOxYZBlpbOC5bzJUA51Gv8zfS1vkuso/Ue2H9U9zLcdo6pu+Vkwz3rtxdFwunnDXHgd3rMhSY6bvaTa5F39UU1Gc3E73vnUfDHCyin2LXOQ6cQy1uuD/DQWT3BhFpLa/LrZ0XzqP+t1+247+jzDPQmi46vkU2iQFktuVK2jr2RfaRkxisYqCoYdwch7nqYkX0MeKZATbXRf+UyCap15qHAi/1cNo6ls+a43A3J2nrs9x3TqKvid3o4nl7rNT7oOOwL11ce84au3u2axFFDWPmJO7POIda4PD1sWq5iLST2l59cy5mXRRR/7znkp3/nWVegZbUyRYnaescE5lKrgTO7zhtHe8i+8xJhontHCZFDfs99xZhTo7jXBoz9b3uApxFF/1TIufNlcAttb+/lWP3PLkR91e3O05bn+GUchzYjtr2Xktbx/9cchLXhbHV4lp9S2ePxS/as4iihn3mOMYD2cB9q9SDx+4NItJKPjwX27WhuhGFXXK+QCsW0fkgctFcCWzuOG0d5yJTyBPRoXlougxbd7tf3X/q5+D8a9siJg3vKycx0QJeTp3o4XovcrEcBw6nUOwkJgmuHaWtz26KuRH365zfIibATiXHYQz1fW7heJhaTqJvtQWLaNOndM4sAmdUixv+TBQ3iMj0U4sR/kbJpZxfbfO+KLv/u8p8Ay24krbOK5Ep5zhwdtfS1vEtMqUocDgMXbSVU8xJhpXZaEtX8s60dazNMa5fcHdXorBBZFs5Does3mucpK1j1jF/MV1cQ7eVkwyFInBWi5gAO9VzuQu7Uhc/aeVYmGKuhalaRJs+1Vh0iTO5b/X6fKxiLiLTzboAq1q3W5ta/3f1z3o22fnfWeYZmLrjtHVOibSQ48C91c6XOrGtlWNaZKoxQXS+uihqaCHXYqC4FQ/HZKepnTvAi9V2qpVzWKSVHIdDdS1tHavbyqM5TIdYzDJGjgP3togJsC3kWvRdbZOxre3lkTAli2jTW8hJFKFyBnXC7++P3RtEZLqpxVf/r5LLOb/a1v2XJc9lnL+zzDMwZcdp63wSaSnHgTvrovNXZJtR4DAvixhEaDHHYaoejHPKeQPTV8+HFs5bkRZzqJO9D9lx2jpGt53aR9DlsFg9e3c5iUnRvNQinrNbPJePwkV1UUy3zTwd15gpWESb3mKuxfnDPVxavb4/dm8Qkell3S5V59214f6Sj1r9OQq55CKBqdLhLbL7XAu8WBedvyK7SJ28QNsWMYjQek5ioHhKatGXZ77p50qA47R13oq0mHdGQfihqIWtLR2bu8pJDmeyk52PxjmeHgrou5rL+dyF86j3GPX9a+FzbinGNfanXttvpK3jRV6ckxiP4B7qaui/KW0d1CJyGKnFDV+di+3aUP1oFHDJxQNTdC1tnUciLceK4qx10fkrsstcCy1axCDCHM/FLuzTIu45Wkldpe/BwOG6lrbOWZGWo39q/rq4Bzydk8z/PqvLcD/ZymfSeo7DoVpE39Xcci36rjZxJa43u4yd1sZ1FPfMc0st5u8Cd9HH5F8RmU6eLXkmg/UuM5uquz28Mbv/u8phBKakDmDVgayWziGROeQQt0Pnxepgqs5fkd3nWmjFIgaG55x6zTsOY7NbQ5s5iWcFDk9tr+rgcyvnqchcchLXnDm7kbaOxzFSn0uuZJ7qtfQkbX0ec8iNaEcPySLa1jnnJFb8Pgs7BI2TRdi1o7h3mnPqff8jgdvcX/JxaetgFpH55/MyFCicx7og4oUo3JLtBKaii8IGkX3mJAY+DtUiChtExsy1MGWLGBg+pJzE/c9YFjFA13JuBA6HhTdE9puTuD+bo+O0dRyOnTlOdFLUvL+cRDs6d4vouzqkXItz+m6O09Zn2XJOYpe1Xajv6XH0mR5SbkSbzm3qROC/EZOARWT/qe3Q9+ZiLpf8qZLnMs7fWeYfmIIuHtpEppCTeKA+NFfS1jEqMpcch6lZxMDwIec47IrdGuaTRwPz10X/lMgUchL9U3PSpa3jb185znwcpa33fo55OlZ8n6OjKMI95HPait8vpq9p/OgX2p51UYOF5w4z2vQGXcru1NXR6wrnN1ev510tHeAiahtU27pXZShMeD6bu5xbhVraM7Zll9dgOIsuKpRhSvqSN65embe6Xe9jAfblasnbwr4tMgwkLMKh6+MeaNseLHlnPOvNyVHJOwLz1EX/FExJH/dmc7DeDacLZ3E17fcTdHE9nZKr0fc0B0cZ+q66cOiWJW/JYd8frRfROAr7UO/Pl+G86vFbx2YfiZ0w0KY3ZZcTdOsE4Doh+PfGBE5gf2pb9Gdy/sKG9Z/xjVHYAMxHFx3dMDVdnJeHoA6GKGyA/boaq8Xv0yLD9e5GFDYw6DKsEuy83I46UGci2/zU+8cuMD9dPAfD1HRxXs6BybibuZr2n0ect9NyNVbablWd9HqUoZ/iWpxXDBYZ+loOdcXvel7U68xR2Jdr4TzWOzXUNv1qFDYwWESb1oxdFx3UP7+udP7eko/OUOwAMJZa0FALEl6ZW7vJbKq2W68r+fnAdin8Y1/qKp71Zt3DG0xTHyvkzVXtQLsaYCreGsVGYzoquRIFDdxbH/dB59VlGOhchLnqS95Q8kxgHrqYiAlTVq839b7sydCao5gAd15X0+Zq+/ocp6u2oW+OZ9wWWNWbs7qe4VrR5zB0GXYHfTDsWx3LeGs4C206Z3U9h9WmN2eMiZX3Z2gofi5DoYPJnMCY6k32D+X8uzZU31PyhbFrA9vlesg+KGyANvQZBj0MIM+HQUaYpqOSd4RdOopVQ9lMnUhXB+quh7Oqg3VX4znvEBjIZi70T0EbFDi0p4vCsYs6Slv9BPWa+kSYsj6K+KfMBFjOoy95S8ky89bFfcXU1OvJMtyNNp3z6HMYbTr3UCcE/5cZJhffFBEZIbW9+dZcTN214fXZ/d9VDjMwtkXJ02nrPBE55NTz1Uoo81C3IG/p2BM5tCzCLhxl2O65leNAppd6/eTe6iDdtbT1ucrF80igbfU5V/+USDvRP9WWa2nr+JpqHkobunjubiUn0ZZOSX2Wruf5jbR1HMn0cpz56uIaM8WcxKT9O6nvyXH0NcjFchwmZ6xVo2txwwslH8iwk8P9AdidWthQCxMurV4vsmvDD5Z8VuzawPbZuYExXYmVT6FFVshr37UME3yB6dLWbo+Vkdi2Pla4vJs6MeadsXreIarXrTfEeUGb6iSy+ozkPgHa4pmpDUcZ2lgurpVjXr9jW+pxVftL7CC6P4uSN2U4b9yPsi3vyrDi9zOZjy52bJgyu3reYjyCbetjPGJSxpxYWQsafnXJjwVg9/7NDDfc5y1sqEURv7bkRwK7obiBsShsgLYZQG6XAUZoRx8dlhdhEIFd6uP8vF093x4Lh6w+G9TzYk6TJ5g//VPQNv1T09bFJMRt6zPt55CjKGZp1dWSt4Wx1H6qowxFDYvAbvSZT99VF/cULaiLXhzyfXmXoY/BeAS70Ge4V7se9m7siZX1//cNJb8zVkEHdqPuEvN9JV+coc25mfP70QwFDtordkFxA2MwcAzzYHXWttSOtEejsAFa08cE6k0pamAs7oUG9TyruzUsAlbqoy36p2AeFDhMlwU2dmOqBaVdTDxt3dUocNi1RYZ70LpzmD4rxtBn6LtqeRGCLq4vraj3KG/I4elKjuO+l3Fcjfu1vRt7YmWdIFwnHn9o9fX9AdieuktD3XGhtm21fXku51P/jE/LUNwAu6K4gV2rD3ZXA8xFH5NuW1AHSmrn74MBWtSn/UGoMShqYB/qfdAyh2uRYdJaF7jl0M8L2qCwAeZFgcP0HMUK/rs0xYLS2ve4CK27GhPmtk1/Ffv2+rQ7htdFYUNr6v3Joezs2kVRA/txSOfZJI29GnktbHhFyWdnmHh8kRXVAW5XixJ+y+r1vIUNVS2S+GsZ2iyAFilsgPnpomNx6hQ2QPu6DOexAdA7q+9Lvc88yXCv6X1iTIdcdFQnZ7gP5E7qREZtMVNW7xuuB5iT9U5SXZiCLkNby+48sspU1M97Eebgapy/27LI8Mz8dPRXsV992tRFv1OL6jWky7wtMjx71PGIo8D4LIS2Z/taNboWVfz5kq/J+AUWwDzVgoRvL/myXEwtjPikDDdHsEt2bmBXFDbAvPWxg8MUKWyAeble8pawZuU7pqDl1e/Oq55vdfL6Q4G7e1fJmwPTo38K5q2P/qkpqPeKR2HX6qSmj8z+dTF+PUfXow/qPBYlXxJ9VUxLi/M/upIn4jxq1TLDPfncLKKgk2mwa+6e7bO4oa6IXh8EPzzDLg4A51V3aajtSG3TanHC87mY7yr54ph8zm45vtgFA8dwGPoYQJ4ShQ0wT3Wr2bfmsClqYEoOrbih3ldYFZmzskU6U6N/Cg5DH/1T+7TI0B/F7r0t07iu1cKGLszR9ShwOIvaN3VU8qaY8Mr0TKUQbhNd7NgwB3OafL2Iogam5RAXXJqUfU6srBORa2FDvcDXQgc7OADncTNDW/bpJf8oFytsqO3QazNsWQi7priBbTNwDIflyQwdVrZD3C+FDTBvVzNMYjg0ihqYokN6hq7n39U4/zi7+kzwhhhsYxr0T8Fh6TNcg/RPjc9E93G8PcOz8b65vs7f9ShwuJtFhoKGo3hOZrr6DJNgW9FFYcNc9Gn/fnwRRQ1Mk3l9e7bPgoK60vr7S67EgQCcXy1u+NqSf5iL79hQ/dcZCq4AWqJjGw5PnUx/LeyTwgaYv6sZ+q0ORVfyaIZJMldjwBj2oZ6DdQV+5x+bqMeLZwOmQP8UHJ4uw25TjKu2t13YtT7TKGzo4vp6CI7inv60+oxT27raR1X74C3AwdS1NLG8i8KGOekyjfuV81hkOBZvRGED0/Nk2Lt9FxXU/3+dmPzdJV+YYTcHgLOqRQg/UfJpGYq1LlKUsG6PbgbGobCPbTFwDIetTn57axhbF52/cEjmtLXznXQZ7imPAtNUB4g/MvPWZZgYqGiSi6jPBY8F9kP/FBy267Hi+Fi6DJN92a0+Q19An/2zS8dhuZ7Dbk8XsXo3bVpmuG5MXRdjW3NU+05fn3aKbBbR1jN9y7TRrs/aPnduqOok4sslv3H19XMBOJvaXtQ2rBY21MKoi+62UCea/0exawPQFgPHQF2N4ziMqYvOXzg0dcJxl/npMqwKWCdKHAWmq+Vt1c+iFjTYDYptsIoz+6J/CjiK/qmx3AhjqJPL++yf+7vDc5TD28GhPgvXY/3pWL0bdqmLsa25qjvbPJrpW8RODbSjD3u37+KG6vmSV5R8QrYzQRmYv1oMVduL+qBbC6S2URhV256vDUA7DBwDa0dhLF10/sIhqoMDczr3Fxn+PYoaYP8eLnki7i3Yjnq9OrSJUOyf/ilg7ZGwa/XesQu79rZMY/fGLq6xh+oo8y8Yq88u9bpR+6fqM/HV1fegVe/LtHUxtjV3R5luwcAiihpoz1Nh76ZQ3FA9m6EK96sznb8TMG21Y+kHMxRIXVRtd35ThoIJbRDQAgPHwGl9GMPcJjcDm+ky7ODQ8kDrIgYRaFOfeaorqj0W2K5FyUOBceifAk7rwy510eaO4clM5322S8dhu5p5FjgsMjwLn6xeF4F5eDrT1cXY1qGY2nWj9k8Zj6BVT4a9m9Ik3rpq+v+35Btj9wbg7uouDd+f7XYs1Tbnv4q2B2iDgWOA8SlsAKq6e2CrK2JfjUEEmIr1fYXVjdmVeq2y6im7pn8KuN0zYZdqu+v6vlt9yZszDXbpoLqaeRQ41Lar/jvqDg3rZ2HtGXMz1Z0buhjbOiSLTKf/v7b5dbGoRaBNnm8nYErFDTcz/H1+R4aKxucC8GLrduELM+yysI1ihNrufEzJZ8SuDcD0GTgG7qQPu7SegPhgAIbVhh5NewwawzR0GQb3FoHdWU8egl3RPwXcSR925WgVduttmcZx3MV1lluupt3C+EWGfvU6/+tq9K8zb1OcBFv7Burk8i4ckqn0BxmPoHV2bpiAqU3krROVX1HysRkmLitwANZqe1DbhdeWXM5224c/G7s2ANNn4Bi4m6fCLilsAG73SNobWO4D7eozD4sMhQ1dYPfqdWoR2L4r0T8F3NlUVyyeA0WLu3d9lSmwSwe3q4tsPJQ21H70egzXggY7iMJ+Gds6TItM45rRB9pm54YJmOIq5c9mmLj8ydneyuxA2+rOLrU9+OIMbcTz2Z7axvy7JZcCMF0GjoF78XC9O9ei8xe4szqwvEg7XCtgvx7OMKhskhJjanGnIaat9k9dD8CdeebYjTpJuAu71GfYtWEKjmKXDu5syv3U9Tm3FlfXZ95a0H81nn05PFO7DzK2ddim0B9kYT5aZteGiZhicUNVV2T/6ZI3Zfg73gxwyGrhwVtLvi/b3bGh/rm/+dTXAFNUK+uvB+Du+rALtfPvKAB319K23jpjaVnrqwDXCWmPBcZXJzJcDWxHPZ6uB+Du+rBtXVzLx1ALG/rsXxe7dHB3tVhgav1Qiwx96CdpbxEQ2LYpFTfUa8lROGRd9n8M9IF2KdyfiKkWN1R1ZfZvLPnPo7gBDlltC/7HDIPA224L6p/39bFDDDBddeD4WgDuzQP29tXO30cCcG91YLmVldj7QLtavdepbUN9nrsa2J+6a0gXuJjaP3UjAPfWh22zC9PuXc90ivfs0sHL6bL/fqj6/67H6hOrv8sjsUsDVFPpu6rn59XA/gsm+0C73hMmYcrFDVVdSf2Pl3xHtrtaO9CGet7/g5KvzPZ3cantyytLPjfTbwuBw9RlWIVFpyDwchQ3bJfOX2ATXYZ7tql7Jq4XMKYuw0SPo8B+1T4FEyO5iC76pwD24SjDrs7sTp9h14YpqJ/1UeDlddlPP9QiwzPu0xn6zh8McNoU+l2NbXFal/3eW9hJmpYZS5uIqU/oraupXy55Y8lPR4EDHJK6Y8Mvl3xmyf3Zze4KXxO7NgDT1GXoJOwC8PL6sC11ZdurAdjMIvtfCeks+kCb+rSly/A8Z7IHU1Enyy0Cm+uifwo4uz5sy3pldHarFjb0mQbFqGxikXGOmS5DW1QLGm7EMwVM2ZUY2+KlHs7+mBxOyxTnTEQLq5XXCc51YvOnlDwbBQ5wCOq5XgubPjzD+b+L877uAvEfB2B66sCFgWNgEzqItqNO+nosAOdzNdNfVdNWurB7taDhiXieY3quxcr7bEb/FLCpPmxLnYjWhV1allzPNNTJ411gM4+ssm0PrP7ceh94kqG/y3MEvLx9jtPVvqjrgZeqx8Yi+9HH+DXtcuxORAvFDVWd2PyK7HaiMzANY5zvl0o+ruQT0k47CBwOA8fAJvqwDV2GCV8AF1HbkS7TZbUZWtXKYEJdJa8+z5n4wRR12c3kJ+Zr6vc1wLSY/LE9Xay8PIa3ZBq6+Lw5v7p7wyLbsVj9eSdb/nPhUOzrXqjL0BcFd7PP3cD6QJuMpU1ES5N6x1jJHdivel7X8/uTSz6U3Z7nfzjD7g0AU1I7DB8MwNkZPL64LiYiAttR25F3ZrrtiQ5ZWtXC/U4dKLwe9xNMm1WgOavapk19RypgWvRPbc8+J6AdirdlOpPt3hm4mHoMdTmf+vxa25wbqzwSz7RwXvu4F+pibIuXt8j+CtYeD7TnmXi+nYzWViyvE53rhOdfGQUOMDfrwoY3lPxMyfPZnVrU8O8HYFpqB6JVFIFNebi+mNrpa8ccYJtqoepUJ6MoboDdqOf81cD0rScvwb1o04Dz6MM2HK3C7vQZipKn4CgWu+Li1v3bm0xuXqz+m6cz3PctAlzU2GN1xrbYxL76gvpAe/owGa0VN1R1wvM/K/n0KHCAuXghw/n8pSU/lN2e15dKPr7ko1dfA0zBlRg4Bs6nDxdxLTp/ge2rBatTXO24DrL1gfZMuZiz3ktcDbTjKCYvcXf1/uVqADb3vrANihB3byq7NnTxebM9XYad4e9lXehcCxrqhOhFgJZdZNcWDs8i+zleloH2WFhyQlosbqjqxOefKPm8KHCA1tXChtoWfUXJd2S3Ozas/cEMuzcATEFX8lgAzsfg8fnVwZwpTj4G5qFOeJ7iluC2gqZFUxxQqOd3HUg+CrTHRDrupMtw/wJwHk+Hi3o4JinuWp/p7NpQ78e6wPYc5aW7wz+w+v7pXRqm2FcFreszrlrMtAhs5ijj6wPteU+YjFaLG6pa0PCDJV+UocBhjAnRwHatCxveXPItq1/vuuig/vn/XgCmocvm28UCnGb1gPOpA8ZXA7A79f5uihMEnwxwUfX8rs9xiiRp1SImQvBiXfRPARfzVLiILi+dlMz2vTXT0EWRNLuxnvC8WH19kqFvahFgLmpxnHsGzqOOi479zF/HsI1H0Jo+TEbLxQ1VLXD4gZIvLrkcBQ7QknVhw1eW/M2MU9hwqeQ1JZ+w+hpg32wZCVxUHzbVRWEDMI468XlqkwSXgfb0mY6u5ImSBwNts3sDp9VJb10Azs/iGxdjFf/de9cqU3AjsDt13LEeY3Xys8JVGMdY90EW7eIi1rv5jM1O0rSmD5PRenFDVQsc/l6GHRwur34NTNu6sKFO9KgdSTez+8KGtd8ZgGmoAxYmxAAX1YdNdLEiKTCuqU3yqSslmXgE59NluI/oAu1bxIrBDGr/1CIAF9OH8+rimjyGqezacBTPE+yWfm8Y3xh9rXVOwWOBi3lTxmfnBlrTh8mYQ3FDtd7B4fNL7o8CB5iyusNKbXu+ouSbMm5hQ/3/vDXj/f8A7sbKCgD7YUVSALs30JapFON0UdjA/Ni9gaPonwK2QwH1+T0adu16pjFJqYv7LwA212XYlQUuapHxFzdYBtrSh8mYS3FDVQsa/n7Jr4sCB5iqel7WHVbeWPItGXZwGLvQ4HNKLgVgf7oYOAa2pw9nZUVSgIGtoGnJFCbK1dXxnojCBuani5WiD1kXE2qB7VHccD5HGXa5Z7felmmofZNdAJibPrtTd2Ox2AbbNPa9Zx9j2bTjmXi2nZQ5FTdUdeL0j5d8YoYCh2cDTEU9P+t5+YaS78z4hQ21oOHzA7Bf6w4I28IC29KHs6iddVcDQPWuAGdVCxs8wzFnVg8+TPqngG3rw3m4Du/e9Uxn14ajAMBm7EbOtl3J+H0BFluiFX2YlLkVN1R1AvXPlnx4yStiBweYgnVhwyeX/NDq12Pv2FD9BwHYr7oiXheA7bBywNl0sSIpsB99pqmPTlra0Wd/anGkyb/MXRe7mx0iK0cD26aPanNH0RaPYSq7NtwIAHP1vuxGfW6zwxPbVvs5jzKuZaANT4VJmWNxQ1UnTv9yhpXaX4gCB9indWHDa0p+Jvs7H2sxxf8xAPvzcKzMA2yXgeOzsbINwEu9O8C91FXM3hmFDRwGq0YflqOSRwKwPX04D9ff3bueaRyfR9E3CTBnuxirq/MKrgZ2400Zl52kaUUfJmWuxQ1VnUBdd254Zck/jQIH2Id63n0oQ6HRh7Lf8/DVJR8bgP3oogMC2L4+vJw6ULwIALczoAB3VwsbrgcOxyLumQ9FF7vaAdtn8Y3NHcVk9zFMYdeGLgpZANjMgyWPBXZnkXEXdKnPC8vA9PVhUuZc3FA9m2HF+E8q+e4MK7ffDDCG50tOMuzYUAuN9l1g9CUB2J+65bAVP4Ft29VWt3PRRWEZwN0sYxISbegzLoUNHCqT7g6D/ilgFzxXbM51d/eWmcbkpLrydhcA5qzP9nQZdhKFXRt7R8fHA9P3ZJiUuRc3VHVC9eUME5v/fIYV5F8IsCvrIqJvLPm1GQqMns3+/YEA7EcdqOgCsH1Ph7upE3ZuBGC/pj7J5x0BTqvPbtcDh2kRuzfMnf4pYFf6sAnt8TimsmvD2BMHAWjXelyrC+ze2AsELwPTp3B/Yg6huKGqK8jXf+sfLvmq1df7XkUe5qiea7WA6I+XvDnTOtd+UwDGt4hVw4HdeSrcjYFiYAqm3hH6rsD0jbVTVb13uBo4bA+FueqijQN2x86iZ9eVHIVd6zONCXR26AA4DH2249EY12I8i4x7vC1j4jjT14dJOZTihmq9W8P/WPJpGVaTfz7Atqx3Sfmikv93prVLyitLPjoA46qrK1wLwO7oBLqzo1gVDeAslnEtYfrGOEYVNsDgSoa+DObHrnbALnmmOLt6re3Crk1h14ajKGQB4Oxq39RRYFxHGZedpJmyZ+LZdnIOqbhhrRY0nGT4t78/dnCAbajnVS1keG3JD6y+vpnp+LwAjM+q4cCu9eF2XayKBrCJtwcOm8IGuKUWNhyFudE/BexaH86ii+vsGPqS69k//ZMAnFXdRfFqYHxfknHZSZopezJMziEWN1R1InbduaF21v/t1femssI8tKQWMNRz54cy7I7wgUyzYOirAjCuRawaDuye1QNeysQdgM0sA9PWZ3cUNsBLvSnMSRftHLB7fTgLuzaMYwoF/EfxWQMckj7n15VcC+zHIuPes9TJ48a2mar3hck51OKG6tkM//4vK/n9q6/t4gBnV8+XSyVfW/JgyeVM9xz6HQEYl04IYAw6gF7sKFbAA6alhc7QZRQ4cJgUNsCdLVZhHm4EgCnoos9qLPteEbiLXRsAOJsHMjyzPRDYn4cynmdK3h2YpifD5Nyfw1ZXnK+Ts99R8m0lT2WYnH3o7wu8nPV58jklP5yhOOj5TNfrAzAeq4azb/2G3197IHfuQOvCVPXhNAOH7EJ/6vWZ3Coqemr1evp7p3//3f6sLvd2+uen2+VPue3n6591YcqeThvqgMIiME3PZPsUNsC91YHtZWid/in2rd/w+2v6p9rTh5dj14ZxXM/+j0fXX4DDc96+q0fjmsH+1R08H8t4rme4N4ap2cU4BBd0KazVVefr5Oy/W/L5JTdz2DtbwJ3cXOUnSz41bex48vElPxOYHtfgeepKTgLn1596XX9dJ9Cenjzb3/Z6+9e7dHqAuTv1/e6210859XvXk2+tPLJ9riW3mKTIpvoM7WpdieN9p37d56WFDFN3e6FDl1vt7ro9fjDa4X24XvKWTF89Nk7iGGGa3pjtTrJ2zwAvr94DvT4G9VrWRf8UF9Ofel1/rX+Ku9E/dW9dhlWZu7Br23522FQX11+AQ3SeeyH9U0zJR2bcPqC6KJTnMqZm388S3IEdCm6phQ31/fjCkq8p+Yur710OUK13a/i6kv9k9fXUCxuq3xCA8dwI3F2fF0+kfTK3JtKuX6fuToPYm6gdFUcZViPhYvqw1kUnMC+1bldvb3OfzPzOn3Xb3J/h93a35XOj+IHh+Hl77IDD/NVVwa4GeDn1nmBR8q7QKs/c3EuflxZ699E/xfkohHt5dm0YR5/9T0byTA3AWSyif4ppWWTcPqB3lDwcmBbPthOkuOHF6kTtWlH535S8s+SnMqxS733i0NVCn3pu/JoMK060sGPD2lcEYBxHMUjBrYm0T+XWwPAcJ9KeVyuD5C3wgH3LO8MhW0/KeU+0u2fR5+7vjdVyDtv1mIjBNG3rnqdOKrse4KzqILPihjYdlTwUDl2fO/dPtbRD3S6tnyO5uD7cS5ehXWb33pb9WsRnDXCI+mymK7kWmJZFxu0Dqv8vxQ1MjT6CCTJp/6VqMUOdyF0H9V9Z8g0lvzu3Vq2HQ7LeveQ7Sr40wznwQtrypQHYvS4mgx2aPrcGiZ/MrYm0BohfXh+2wbE2OMqw4jyHoc+wCt+6kEERw3b1cT5t21NpR5/h/FoEpmUb9zwKG2Bz612dPHe0pX5m+qcOSx/9U+fVh21wrN2bXRvGs8x+magKwFnciHsDpudNJY9kPMsMz67Go5gKz7UTZbL+3dVihro6/e8p+c9L/l4UOHBY1sf7byn52xmKHFrZreG0TwrA7tXK8i7M0Xqngcdza9JfHw84F9GHbehDZeLOfPW5VciwnqSj7d2t+l7rTD5sdaXLRWBeFDbA+dRJ8nX1/+uhJfqn5mvdP7XetW4Z/VMX5b3bjveFu6nX0qMwhndnv32lR3H9BThU/Qa/t45ndYHp6VbpM556/2Y8iqmwa8NE1YnL/9nq60slv1TyzzOs1l47I36y5AMZOnj+xerrmg/mMKxXqK8HcH1/vrnky6LIgXmrx30t7Pn7JV+w+roe/8+nPa8teUUAdqvLuJXs7Fa973s8tybSepDZvmdWeSBchMFjHcFzUtuEdfu7jEKGfanv+5VwyJaxewPT0+f86gDZYwHOS3FQW7qSq2Eu9E/tnv6p7ejD3dQiwS6M4Xr2y+IrALyco3heY9q6jHtvX/ts3UMxFeZdTFSdoP9/zebq5OcPZfhgazHEj5T8g5Ify7DDwc+uvv9C5qFO6q6r1n95yReVfM+p78GcrI/rWsTzrRnaiBZ3a6hqQcYnB2D3FqFVdQBzmRcPFptMOw6DxxfnWNX+tqwev+/KrRVHTdSZhj5g9wbmoxY23Ih7TriIeh7Vc8izRxu60Cr9U/vTx2qhF+VYvTuTtcbRZ+hj2heLrwDwcrqSRwPTNvZ9/fo5eBHYP+PUE3Xe3QfqSu6vXuXjSz7rLr+v7vbw3gzFAN9d8p0lP1Hyi6uf18nHN0+9Ttl61fq/m+Hv+9dKflfs4sA8rI/jZclvzVDgcCntFjasvTEAcEufW4PFy5jEuU99DPpcVB9ox7qYQfs7bTrvqJYxqMB0nHdQrYvChtbVz/4dGXYO8DnuT33v66TfZWhBF1rRR//UVPRR3HBRihvu7Cja5bEssz9dhs8agMPVv8zP63O1PipasI/7egstMRV9mKRdT8r/iFV+TcnvPfX9OmG6L/mOkv+p5LsyFEFUUy90qLtR1OKOryr51Aw7Vbxu9bP7Am25ucqzJW8o+aEMhQ3Pp3313/UbA7B7OiOmqy95d4bJmnVSrcG26XgqXFQfmK7TK4/W9rcPLehjZ51t69MmgwpMxXnu37sYNG5Z/czfnmFr+vr150Z7tG8PRXEDXFQf/VNT9b5wUX24E7s2jOcd2Z8uilgAuDc7/NCKPuNbZnhOVnDOvvVhkva140D9//6aVX7fqe//w5JvzrArwveVfOjUz6ZU9PDC6rVOyvqokv9LyZ/LrcIHaMF6t4avK/lPcqs9mENhw9rnBWD3TJqZpjpQ/PowVX3g4rowVW8tuR5a1EdHMnZvoF1dhsKGLrTm9qKGtVoouQj79KaSR0IL9E9Nk/6paevDRSnWeamjuB8dS5/9FmEu49kZ4NDdazG3h+N5Gl5OLVQ1JsW+ea6dqKlNxK/FDn8ow44OHyx5OsPODl9e8mGr33NplSmok8Dr3+UvrF4fP/V9mKp1cc6PlLym5E9maAuey/x8UgA4VO8KU9aHi+oD06UNbtd7AoO3B/av3+D3dlHY0Kq6W0yd+Hs1Lx1IWoZ96+K8aoXihml6PExZHy6qD7e7Esby7uzf2wIAL9VlWMABWtBnf67HxHL278kwSVPfZaB2xv72kr9V8v6Sny/5K3nxauz7Lnaou0nUYobLJV9a8hklP7f62QuB6bi5Sj2XatVj3da9FhG9kHkeq7VdeHUAds/g8TQZPJ42nRQX14cuTNEyzvGW6cBjrRYp9YE21GcyhQ3tWebuRQ1rrkvT8FCA81L4PW19uCjP/y+2iFX8x3Q9+7eMe1YAXmzdTwWt2Oc9ff1/vyOwP32YrKkXN9zuo0q+uuTvZZik/YMl/15uTSrcZ6HDereGf1jyK0u+IsP7O9eJ47Sjniv1GKznxr9b8rqSH1r9bM67jPxrARiH4oZpMng8bX24CAPHTJlOyLb1YZv6tM0KlJtzjR6fwob21Mlfb1ylf5nfW8+pZdg3/R5t6MIULcOU9eGi3P++mF0bxtNnOkUFdj4EOFz9Hb53HM9ntGXf9/TXA/vTh8lqrbjhdp9d8hdK/nnJe0v+7yWfsPpZnci9j3/f86v/97esXv9UbhU5wNjWx+OfX71eX73OuahhTXEDwOFaxsDa1PXhIvrAdC1Dy6w2yGnX45rzcuo5Uyey1EnaH1ny7rBN/Rl+z6MZdihl+uoz2ltL3pDN7hfeE4A21fuEPkyZ/sOL6cNpXclRGMsy03E92hMABg+XPBLOq15P3xyLGI7tfdmv+uy8DOxHHyar9eKGar1Tw8eW/MclP5XhYveflXz86mf3ZdwdHepK+etJ5f/P1etfXv1MkQNjWB9n7yx5VYab53WRzc0chk8PwDg+JUyNSWXT90wM+FyE986qN1O1jE6g1vXRxvBidm94sXUxQx1kq8UMdZJ27XNZZjh3+jCmWthwFFpQB6Xr+fJYNqfwbv/60ILXhal5PEyd/qmL6cNpx2FMU9s51O4NQCvc+2xXf+rrruRqOK/a/1P7jmof0lNhTE9n/4xDsC/amwmbQ3HD2qXcKmB4bcl/WPJPMuzo8MdKPuwOv2/X1kUO9X3+AyWXc6u6UJEDu7A+rr4tw2DGV5U8t/r+oR1zvzEAHKplaIEO1PPb9woacDeKy+ahD9xyPYd9TNytmKH2793pXqYP23Sve546ecxKeNO3XnGvps/5LMO+eXZrwwNhaqw22oY+cHG1DV6EsfSZ3j1iLeJ1zwRM1TLDxOHXZ3rFYXNyI57Lzqsel3Vn3H71awtdjGsKk7uX0QfIfvRhsuZU3HBaLV5Y/9vqjg5/tuT9JT9c8lszFB2c/j27dnpi+e/MsJL+3zz1M7io00UNdbD9y0t+MbcKbA7Rrw4Ah6iPDo9W+JzOrw86iKdpGebgPYEXO6RVk/psVszAbt3tPa+FDVfD1NVzqU6cuOjk3j7Ov33z/sPm6nmzDC3ow3n1Ye2h2GV0TMtMT2337d4ATMkytwoa6qTxqxmu3X3Yhbq7aBfOox6nR3lx34Mx5MNkATX2oQ+TNdfihtNOFzF8Rsm3Zpjw/VdLPv7U7xljN4cXVv/vZ0v+TyWvKPkrt/0MzqoeL+uihnqBrzs11KKGf5HDLmpY++QAjKMLU7IMrbD7wPmZXKS4YYr66HCeC5/j9sylvb6e+Xbw9hkmoLwlQzFDHfC9SDFDH3btShQ2TN16t4ZHsr12cBmAtjweWjGFVUpb5b275TiMaaoT3+zeAOzbMncuaDhNO7VdfYaJ+XYX3dy6/+jqHX7WhzH1mYbrOew2ar1IQh/G1IfJOoTihtNO/3t/T8k/KflHJV+aYTL4fRnnPVkXMtTX35ehsOL/sXo9PWEd7mR9/NTj5S+WvLrkK2Onhtt9QgA4RAaP29GH8+oD07MMc9GHbZlTR/xbMg997lzMcD3b+bz6sE39bb9+MMNnxXQtM+x4ctHdGm5n8uR+9aEFXZiSbbeD7E4fzsvkyMEi2uCxLTNN9Zx4RwDGtczLFzSc5vq9XV0UOZ5Hn3v3Hz0Tx+qYpvJeH+JOWOt/c22/1+044+rDZB1accNp6397V/JtGSaM/6er753e7WGXXlil/v+OV69fXfILp34Oa+uihg+U/JEMx+gfKvnlKGq4k48IwDisHj4ty9CKPpyXDj1t7xTZLnY+7NzAnSzT5n1Wn2Ey/K6KGW7nGr07XcmNMGVvzTAA12f7XJuA1ixDK9y/nZ/3bnAljGmZaR97jwVg95bZrKDhtLP+Ps6mzvXrwiZqH89Z+o/ca45nSu/1IeyEtczQhtfzoI5ZPJIX3+MaAx+PPueJuz+cLmL4EyX/t5JvzrBt1HtLLmf3k8Zv5tZK/P99yf+v5PNL/lKGFcnWBRCXwqFZHxv1OP3Jkn+n5Dty61hQAHN3rwzAODxcTEd9+OhDK3RKnZ/3Tts7RcswF32GdsZ5xu1qh/si09ZnaI8ez362cHaN3q71+9llKGzQLk1TX/Lm7HYwaBn2qQ8t0EZOh/6ptvThvPrQZZhTwHimvjNCn+HedRGA7Vpm6O+6notdg/VdbdcibGKZoQ/pLMdhfa7qwhim1C6sd8J6OPNR/031eK6LxF3Py7/f+nfG45o4cYe8c8PtTu/W8NtK/mnJD5T8mtX3xniv6iT29WT1JzJswVQrtP5iTGY/NOtdGqpa8PIxGW7avivDsXDz1M95KYUNAIfp8dASlfDn1wemZRkdQHOjjd6OuZ0Xy0xvgnF9j69n2Jnh9au8JRcf6L2IPmxL/Xy7DIUNXZiid2Xow971daOPew14OQa/p8O9dFv6cF6uzSY07kMLbezbArAdy5x/h4a76QP7USes1+P4rPeQ7wtjmdp9/WNpX31P357hmF+34WfZlULfzrj6MGmKG+5s/b58bsmPlfz46uvTP9u1dRHDL5T8oQwT2mtD96Onfq7QYV5OFyzU4pqvzHC8fXXJ06vvPx9FDWfx4QEYh4eLaXlXaIkB0PPz3pngODXvDnPznrANc2yv9z1JY13M8NYMgwJ1UZB9FzPcznV6u94Z1/2pqufhWVfb24Y+7EMfYFOej9rSh/Ny3+s+dWx92ihuWMbOY8D5LbP9gobbuYYztjrJ+yib6cNY+kxLnzbnfSwztN+17a7jFo9k88XhzD8a11Nh0u4P97IuZPjVGXZx6DNMOK9fX84w0XzXThcw1NWIP7vkNSV/tOQ/LHlthsnul0KL1gUN9Vj7QMlfKPnaDMUM9Xt2aTif1wRgHB4upsXKeG15ZhXn0eZ0PDM12t/56QN3tlxlkXHUa14dyHjP6rXP9PUlD4ZtOI73cor6DEVFy4yrtgOOB7izLkzJMrSmj/PoPPrAuJZpR53YtgjA2SwzzAe7nnGur8bmGFO9Jl7N5vpwyGpBzEOZttqW1vHRusDB9Wxn/L4LYzK+PXF2bjib9fv0SSXfX/IPSz5j9b3LGc96gvsvlvyZkteVfFrJf5dxCi3YnnXRSv3c6kXuMzPsNvDHcmtrrfp7FDWcz0cFgEOzjAnfLfKZba4PTEs9j5dhbnTocS+73L1hXcxw+84Mj6Wda6At07dnEaamXh/q6mPLjM+1aT/6AJtYRl9Hi3xmm/OeDUwMHVdLO+Mso78MuLdldr9Dw930gXGct7Chcr85jj7TtMw076XWO0vX3WzX7fdjcby2yuc2cXZu2My6kKE2Tj9U8oMlv73kpzLeTg7V6ZX8f6Lk3yn5P2fY1aGuaFYr1+4/9Xvs6rB/pz+L50q+OcMN3PfnxZ+PXRq248MDMI4uTMXjoUV1glIXNtGHqgtTof2dJxNIuZdlyTtKruTi1gVSj69e53Ds6RBnrup5/0j2d4y7NsHdmVw7He8JLepjd6BN9aHS/o6rtfvBev+8CMAty4y7Q8PdPBXYvYsUNlT6WMcx5fd5KjthrXdnWGb3BReeL8alv3niFDecz3onh19X8pMlf7vky3NrUvoLGc/p/9cPl3zV6u/x6SV/dPXr161+Xr+v0GE/finDhe7PZiiMub2gge36iABwaJahRVY2hva9K8zRM7E9+UXNffDlasmbsvkxMsdihtv1gfm56ID0NvRhHzyztcE923R4PmqTCX6bM9ls8Lowlvrs2Kct10sejes0HLplplHQAGPaRj9SH8Yw5fv65SqLjG+ZYZ5nfcbvMx73jePyXDtxihsuZl3ksCj55ZL/ouSPZNjFoRYdjD1p/fT/78dL/kDJ15R8XMnvLvmDJZ8VxnJS8l+V/DclP5ehoGH9GSlo2K2PCQCHZhla1IdN9aEyeDwdVrWYr/rZLsJ5zb1TtC95e4YdRO+lvg+nVzY6hDZDhzhzUo/nt2aYhLFvfRTe7cPTATbh+ahNfdiU4reB+5LxtLpz6Fmem4H5WWbaBQ19YHemsEAGZzf1+/qxdm+ofY61kOHx1eu++vi7MBb9Nw1Q3LAd6yKH/6DkD5f8jpJvzPD+Ppf9OD15vk6s/3MZii+qN2T4u/72kk8I21IHev7nkv9PyfeVPBs7NOzLRwVgHF2YgmVoVR82ZTXBgcHjaeij82fO3hPFDdzbYyUP58Vt8ulihvq6zOFR3MBc9CVvzrSu9X3Jg2FMJq+2wfPRNCzjPqBVPrfN9YFxLdOmOz03A/O0TDs7NPSB3dhmYUMfxjD1RS2W2d3uDX1u7c6wDIdGP0ADFDds13rHhr9Z8lMlv3H1emn1/X25fVJ9HZD6mtX36zHwBSVXSr6s5PXhrH625FtL/nLJ95R8ILd2Z1gXNShoAIDda3XVJjw0nof3jClZhjlTuMLLWa/oXvuUDrmY4XZ9oH19yRszveO5Ft4pbhiX5482mDA5De8JrerDplwfBtrf8SzTpnqu2L0B5muZdgoaYNfs2NCmFhbV2+buDcvcKmjoMz1dGIs+nAYobti+9S4OH1/yj0v+h5LflaHw4flMw+kJ93VniTox/3tza1L+p2UYvPq9JZ9Z8tHhF0p+pOQbMhQ0/IMM793dihkUNezXrwzAOAxeTMMytMrE2c0ZPB5of6dBcdm8aaM5i+urcItrNa2r7X/tG57isVz/blfCmLRpcHbL0Ko+bKoPlf6pcdR7wJbvSezeAPOyTPsFDX1gu96R3RQ29DHZm4vt3lDvIWshw+Or16nfU74ujEWfZwMUN+zO+r2tW3fXie7/Zsm3rb7/XKbn9KT8H1/lL66+94oMOzr85pIvL/n8kl+VeR4/z2bYkeEHSv7nDBe3k5IP3uX3K2aYpo8MwDh0Rk+DyZft8tC4uT5U2t9pWIY568NF9OFQ9YF21cHoo0yX54fxec/b0IUpWIZW9WFTrg+MqfXFNer5Uu+zHw7QqmXmtUNDH9ieOk5/FFrVpw11B+knzvh7+9zanWGZthj/Ho85Rg1Q3LB7dceGF0r+l5LvL/nCDO973cWhlQnxdcJ/3amgFjz8pVPf/7CSTyz59SWfV/JFGTrR604Pr8p01UKFuhPDT5R8X4aL398p+Scl7w9zoNgE4HAsYzCtZc+s4kH97BzvTEUfgyBzV9ubPibLwXm4v6FFdYv3q5k2g07j8/wBZ9P6quJ49tmU433QhTEs07717g1AO5aZV0HDaa7jbEufYfdP2tWnDfWZuxaL3m1H12VuFTT0gZfnWtgAxQ3juG/1+oYMhQ6/p+S/z3R3cbiTO00W/6UMRQ81/91tP6v/trpVTi10+OSSz8qw20P9+hNXX9fiiF+xer2UYYeITT27+rt9cPV1LU74qZKfKfnJkn9c8r9lKGT4Z6uffygAsB1d2Lf3hNaZ/LcZD9qDLuyb9vcw1A7jLsCm3N/QmhYKG6o+jM3zB5yN4qv2ae820wfGM4c2ts8w6W4RYMqWmW9Bw2nue9iGPkNhg+OJsTxS8qYM/e71uKuFDI+vXudyHHZhLPpxGqC4YVy1yKEWN3xDyZ8q+Zy0VeCwifpv+vlV6o4P33aG/2ZdBFJ3u6hFD5fu8Hturv7sZ1e/fiEAwCFbhtaZOLuZPjAN7wqH4KkA59HH/Q3taKWwobLzG9xZF/bt3aF1tYD/wXBWJrExltp33Gce6n33IsDULHMYBQ236+M5gvPrMxQ29NmtPo7TXWvpvr7+Xd+yel1mnvR5jmPdx8zEKW4Y33oC/2eWPJ+houxvZr5FDpt44dTrswGA6Xtd2DcV1e17XzgrD9lMifb3MPic4XwUBtGKOiB4PW3pY/LpmPoAZ+G+uX36XDbj/TLRbixzal+XsXsDTMUyh1nQcJprORfx5ugvmIvW2oK5L7ymuGEcfWjCfWFf1rs41NVc/tcMhQ2XA2zDpQCMw8PFfs1p1aZD1oez6kPVhX2rnZ0m7xwGn/P59QGYthYLG6r3BLidxTf2q497vznow1n1gfE8nnl5W4B9WWY4B1+fYcX5qznsa1ofOJ+3xrjBnPRhKsw9Go8Cv0bYuWG/1sUlv6HkZsm/XvLDGSZmvxDgvH4xABwCK+LOQx/OyoM2U6Hj+nD0Ac6jD0xXvaesK+wt0yb3xOPqQwsMgO+Xoqt5cH05uz5UXRjD3PqglrF7A4xpGTs03I1d1fn/s/cv4Lpd513Y+5dkOxcSy3LIlYCmc4MQimROCCQF/AnC9UAsk8IhB4q2gJ5CA0iCphDgoC1KT8qlSOLSAoV6iVsLabFMCCXAqT6HAgmksRQSICTBUyF1Ak4iK1cn1uWM0fl9Z629tffa6/LN++/3PO/zLa0tydZac445xxjvO96LqAVCT4SlMAeaFms7w7GOMxM6N0xDLTKpnRv+eYk/lq6wQeEJXNz7A8AabMMSWDg5O4vNHYs741vaqXncXB2j2wDn1QamqY7r9YTKbeZLkSUwNduwBJ4vMD1L7Rz6ZIA+baNDw1nYm+O8nk53P7EcxoFpacJQ2jALEuinY/+7qO2bvjjdi/a+6AE4nx8LwDCaMCabjsvg93h2bagUN4xvG9akjtNNAJi7fWHD3N+/bbwOpw1zYY40Lusay+D5cnZtYBhLHV9rcmgbay1wSNvo0HBebeDs2hIPhqVpA+vUhllQ3DA9tZvGTy7xaol703VzeHUXwNkobgBYh21YApvHZ+dnxVRI3lmX58NF6Lazbm1gWpZS2FB5D4HXUtwwLuPSMrThrMwRO03o25I7hz5V4tEAl7GNgobLsN/EWe3XlFwz0C9rO8NpwyzcHqbojnQdG+qC6O9LV9igEAXO7jsDMAwTjPFsw1J8MBbEzqoNlbF3XHWe6p5dF8laF+M+Wbc2MB1LKmyojK/DaQPcivnRsrThLFzzDGWb5Xoi7iW4iG2Jx0q8Jd0892o8vy/KGMRZ1Y4NbVgiBzRNi/3v4bRhFhQ3TFctZnilxB8q8Y/TFTsocICzeSkAwzDBGM9zYUnacBYWmzvG3nFJdF8fv3M4P89spmJphQ2V4mh4rSaMxbvysni+nE0bKutT/VvyGFvHmycDnMU2Chr60AZurd57T2c83rf69UKYkiYMwdryjChumLb6+7mtxM8u8WO7rxU4wK19XwBYum1YkjachYk2U/CesDZtgPPyzGYKlljYsOceG4YT/ODWzI+WxWEqZ+M53JFs1681dMbRvQFubhsFDX0z/nAr23T33pi8b/Xr+cD6tGE2FDfMQy1oqL+rHy/xOSXuSFfoANyY6lJgCE0YUxuWRNLM2bShasKYnEy6PnWjqw1wXm1gPEsubKi8jwzDGivcmvFoWST5nY2fE0NYQ7Kd7g1wrW0UNAypDdxcW+LBsHTe66elCUNQ1DMjihvmoxY4vJRuofQ3lHg1fn9wMz8SAJasTrRtHi9LG86iDYzL+Ltefu/n14a1sznEWJZe2FApjh6Gn/M8NGFM3pOXpQ1n0YaqCX3aZh2OAuu2jYKGMVm74mbeEffiGhgDpuXOMIQ2zIbk+HmpBQ6vpJvk/oXd13cEuN4PBaB/2iCOx8bx8rQB5sD4u15OMoHzawPjeCTLf2a3YQg2ueF027A0xr2z8XNiCGtZg2pLPBVYl20UNEyFZzo3Uu/PqTyHm9CnNkyJ/KNhtGE2XhfmZl+QUts//fQSX1Di9SU+HGDvQwHon8nFeJ4LS9OGW2nDXhPGYvxdL4UtcH5OPGcMdc34KMsnAWMYfs7zYH1qPOZHy2Pec2tt2HOyar/WdD8elXggsGzbEu9Jd723YSra2G/hWtt0BUfA8KzvDMO8f0YUN8xXLXL42SXeX+JT0v0uXwpQvVrix0u8IQAs0TYsTRtupQ2MbxvWymIfnJ+kYIZWOzYcZR3cX8Pwc54Hm9/j8Y68PMa9W/MzOmb87U8dX9d0rW13sQksyzYKGqZOt15OatMdmsF6tGFKzC+GYU47I4ob5q3+/j6+xI+V+MgocICTavcGxQ1An0wuxtOGpTGJ5DycjDeeNqxVG87Ls402MJzHSjyR9WjDEDzL4HSKG5anDbfi2cAQ1phsW9/nN4H520ZBA8xVfRa1mY4m9M27/bTIPxpGG2bj9jB3taCh/h5fKfH6KFiBvfcHoF8mF+Ook2ybx8vzwVhAuZU27Bl/x2P8Xa86RrfhPDzXcA0wlLr5fDXr0oYhGMfmwfxoPOZHy9SG07Rhz/jbn23WZxsdU5m/bYn70s1P2zAHbaDzZKbXDdS7Vv+s+0yLa75/clJmRnHDMtSChg+X+JF0A50CB0i+MwAskY3j5WrDabQHZmzbsHaewXA+FskZwhoLGyr3Fxyz+T0O78bL5RlzuhfDnvG3P2sdYx8LzFsb5qYNdNfBw5ke71r9Mu+ZFtf7MKzlzIzihuWoXRtqgcMHStwdBQ7wHQHoVxPG8FxYqjacxiLTMQs84zD+rtub4t6D82oD/Xoq6yxsqLwbD6MNcDMOIFguc9/TeQYzhLUmHW3j/QuA4d0X1sh7/bTYfxuGYv2ZUdywLLXA4aUS317iM6PAgXX7xgCwRG1YKpPJ07VhzwLPONqwVveXeF+JTYDzsEFEn7YlrmTd2tA349g8NGEM27BUxr7TtWGvCX34YNZ9Hz4ZgOG0Ye1q16A202QvsF9tmJImDEHnhplR3LA8taChFjj8ixKfHQUOrNc3B4AlMuFYrjacxuY6YzP+rk9T4pkS74qNhIswbtMG+tGWeEcwzvbPzxhuzvxoudpwmjbQr7WPr0fxDsZ8OcBqftqwZm2m3RHUngRwaN6zZ0ZxwzLtCxy+KQocWK/vDEC/mjAGm8fL1YbTmGwfa8IYjL/r8lCJ90a3hsswblO5Dji0tsR9cW1VfgbAmMyPlsvzhbOQbNef57JudQzSvYG58gydH7+zdbsvrFkbpqQJQ7CWMzOKG5brZIHDZ0SBA+vzvQFgaepkw0LbcrXhNG1gPMbf9dikK2p4IpI14BCMnRxSm27juQ3V86FPbZiLJgztg/GMXzLJDqdrQ2W+3J9tqGsynjPAEIw16/VYpv9e14Q+6bbDGnnuzYzihmXbFzj8y3QPfQUOrMmPl/hQAPpzZxiaycayteE0rn/GJHlw+WpixuMlnilxb4BDaQOHUd8F3xHXFMAUSH5fNusvp2sD/WqD7g3AkNqwNm2Jq2HtzHumpQlDsJ4zM4oblm9f4PBt6ZIVFDiwJt8fgP44nWl47wlL1oabacNeE8ZgsWfZrpR4X4mHAxya4jAO5cF4Hl+vDX1qw1w4fGN4z4Ula8PNSIA61oS+eOftPBGYnzbMkef7+tyXeZCL0S/3Pmvjmp8hxQ3rUAsaPlziAyU+IgocWI9vDABLYmNj+dpwIybbjM34u0y1Q0Pt1PDO2CjoQxuAw3isxNPhet6RoeM9bnhtWLo23IhnL32z/nSs3m9PBaB/bViTusbUZh7Mdfvl3X5amtA3c40ZUtywHq9P18Hhh0q8EgUOrMM/DUB/TKiH14als5ByY34ux4y942jDktT76PES7y2xCdCnNnA5ddP5argR78j9ejHAzdgQX7423Egb6JfOd9e6WuIdOS529vwB+mDutx5t5rXGpEthv9owJa73/nnezZAE93Wpv+9a4PCj6To41IKHDweW6bYSf6/EHwpAPyTYDs/i/fK16U4S51pt2DP2jsP4uxxX0hU2uJdgGG3g4moC09VwM4ob+vVCmAvvdcMzP1o+CdY3JhnkWBP6YHy9VruL67u41fXz5kTck+59YA3r6m26ecAHczzffv667538+okSD4WhmKPNk9/betyXeTHXZU1c7/0z15ghxQ3rsy9w+J4Sn1TijhIvB5bn1RLfFgCWwmRjHWwe35jNY8Zk/F2GusFdixo2AWAO2hIPhtNIwOiXudl82AAf1j5hkmXzO74xhW/0zRrU2Tybm/+s6ntBc+Jz//WdOS7K2X9vyHeI9gZfn3ymPn+TP2tv8M+fh2tqWJ6f89SGNTiK3zXXasOUWNvpXxtmR3HDOtXf+8eV+LoSP7fE7SVeCSzP96cr5jHWAX1owpAsiq5DG27E9X/M4s7wJLbNW71nHi3xcBiScZu9NnB+bbrT9Iwlp2sDMDxJkuvQhhuxPnDM+lQ/vP9eXv0ZnvdZdbLQ4SJFDzcq/JtKMaDnNtyasXf52hKPZX6a0Cf3/rSYX/SvDbMj4Xe96u/+Z5f4CyV+S4nb0p10D0tTCxw+IQDM3XNhDSyk3Fgb9izuDM8m4Hw9VOJq3Ddj8Dxjrw2cTx0/amFDGxiXZ9l8NGFI1qfWoQ034tlwzDy7H9agxrHkrkRtgFvxfF++WtjQZn68b/XLvT8trvf+ueZn6PawZvX3/5tL/KZ0xQ2wRF8bAJagDWvQhhtpA+OxsTw/mxLPlHgiFkRhbBbMOa8H493vrNxf/fLzhRtrwxq04UbaQH+WnGDPeOo11YahtGGO2rBkT5c4yjzZ2+iPd67pcb33z373DClu4JUSf7HE50QnD5bpawJweE0YmsnGOrSB0zVhaBY556NJV9RQYxNgCoyhnEc9Se/pcFbur375+cKNWZ9aB2Pgjfm5HGvCoRlf6YtrC07n+b5sj2SeJHr3y30/La73/rVhlhQ3UK+Bl0t8U7riBgUOLM3fDQBLYAF6HdpwI21gPMbf6asLn4+WeG8UNcAUtYFbe7LE1XBeNmP742c7D00YmntjHdpwI65/+vRcoB/PBzhNG5aqHqLRZp4ke/erDVPieu9fG2ZJcQPVHSVeKvH9u887Asvx3QE4PBOMYWlJvS5tuF4b9oy/w2pj/J26h0q8L11CrPtjOtrAMeMot9JGYcNFub+AoSn+Xo82XK8Ne3eGQ2sD/WjDUMzP5svvbnnaEk9kvprAejShb22YJcUN7NWODa8v8Q3pOjm4NliKej1/IACHJXlwWDaO18Ui6rX8PK5l/B1WG6Zqk65TQ92gcF/AtLWBm2tL3BfvfExPG+bAe+CwrE+tSxuu533lmPH38Iyx9KUNQ/GcmC+/u+WpXRv8XrmZNrAuOnnNlAR2TqoFDm8t8QcDy/I1AWDOXgxr0oaTLD4ypufC1Nxb4pld3BtgDrzLcpp3xPvvZXhX7o+f7TxIrh2WzfB18fu+Vhvol3cP+qJwBm6tDUtSx72jzFsT+mS9elqa0Lc2zJLiBq53W7oKzs9JV+wAc1ev6a8MwGHZPB6Wxed1sXl8rTacdHcYUhumor57vDNdt4ZNgDmRpMPNPBJznctyf/XHzxZeqw1rYhy8lp/HtewPHJ73YvrSBrgV+3LL8o7Mn3etfnm3Z23aMEuKG7heTQR/qcQ3lXglChyYv1dLvCcAh2VCPSwbG+vShpOcnsGYjL/jq+8cj5Z4X4krAeaoDbzWkyWeCJdlM5a1sz41rDasSRtO8sy9lvH3sNpAv9rQtzbAFBxlGfejd61+ebeflib0rQ2zpLiBG6kFDbXA4fndp+uEuatJgT8SAObKBHtd/L6v9UJgPO7HcT2Urqjhaizmz00bOGYs5Xq1ePDhcAgKgfvRhrnwjjgsxd/r0oaT2kB/2kC/2gCnacMStCUeyzI0oU/Wq1mbNsySpHVuphY4fEqJPxFYhm9I18UB4BCaMCSbx+vi930t7YCvJXlnWO7Hcdyfrqihnujtmof5s1nESW2JdwSmzbgFN9aGNWnDSQoKr9WEQ2oD/bLGDqdrwxI8leX8Lu8OfWrDlDShT/a6Z0xxA6e5rcQjJX5qumIHmKt6Lf+F3ScA8/LBSKxYG7/va/l5XEui93As9gxvU+KZEu+KxUxYkjZwrBY2tIFpMweZjyYMqQ1r0oaTPBvok8Rz+taGvnlOwLjadB2ggfm5M/TJO8qMKW7gNDUR/KUS/2L3eUdgvr4qAMxRG9amDSe1gXFY7BnOJl1RwzO7r4FlMZ6y91gUDx5aG4BhGL/Xx4Er12rDnoM3Dq8N9KsNffPMnLc2zN1jWZYm9KkNU2J+0a82zJbiBm6ldmx4ucQ/3X3CHL2abkL9IwE4jCYMxalN69SGPZsC12rCUJ4LfWuiqGGpXgwcawPJk3GCHvPRBrieufk6+b0fa8Oe5KPDawP9Mp7D6dowZ9sSR1mWJvTJc3FazC/6Jd9oxhQ3cBa1Y8Pnlvji6N7AvL0nXaEDAPPRhjWyqHLMz4KxtKEvTYl3lnhfFDUslbGb67km1q2Nwoa+uLdYuyYMRfH3OrUBhtAG+qUDE5zO3HreHsyySPTun3t+Wlzz/fIeOGOKGzirmhD+P6fr5PC6wPzcVuJP7j4BLuvOMJQ2rJGkgWNt2LO4MyyLPYdXr+HH0xU1XAmwJjaM1qv+7u+La6Avfq79cKIZvJbxZp2Mh8fasNeEQ2sD/fIc758upvPmHpmvoyzvOdqEPrnfp8f+d79c8zOmuIGzqtfKSyW+efcpQZy5qQU62wAchgnGcNqwRiaZx/wsjhl7h+XaO5x67T6arqjh4QBr1Ia1eiR+/0B/HL4xHMXf69SGvTbQjzbQvw/GWmffXghz14Y5eizLYy+wX56H0+Oa75f1nBlT3MB51I4Nn1biN0ZxA/P0oRLfna7QAYB5aMMataFqA+Ox2HN5J4sarsYCJayZU3/XqW4wH4U+2ZDth5/rfHi/HI77Yp3aULn+6VMbGIaxDE7nHpmfuu7UZnma0Kc2TIl1nf55vs2Y4gYu4qkSr09X7ABz899GcQ5weSYZw2nDGplkdvwcrtWEobThMhQ1YPwG2nTPAPplvO2Hnyu8VhvWyHjYacNJTTikFwPDaEOf3Mvz14Y5abPcAzWawHrYP+yXg/xmTnED51WvmZdKfOPuE+bmzwXg8kwyhqFV8HqZaHZc/4ylDRehqIE94zfXa8OatCXuC8xXG+bC++Zw2rBGbajMb+hTGxiGjor98qyYPwUq87LUrg2VeW6/2jAlTeiT95OZU9zARdSODT+9xC8pcUdgXj5Q4odKvBoApq4Na2Wi2WkD42jDeShqAG6lDWvySPzOh9IG1s175zDasFZtqCQ7XsvYe1htYBj2HOB07pH5aLPcrg3VPaFP3u1Zk+fCrClu4KJeKfE1JV6O64h5ua3EVwbgcpowBAtp69WGymlS17J5PBzX3tkoagDgevXkvKcD82YuDtdqw1rpKttpw0nm/ofVBoZhPIfTtWEuHsuyedfql+fhtDShT673mZOUzkXVa6cWOPz1OAGf+fmKdEUOAExbG9asDVzLguZwng2nUdTArVgw5XptWIM23XMB5s5zbD6aMAQnW66bMdHPgH65vhhKG/rUhrkzHs9Dm2V3baia0Cf3+rTYX+yX/e6ZU9zAZdTr59eW+OQSdwTmoRbjfFuJD0VhDsDUOTl83Syu2BC4ngWe4bj/bkxRA2flHuJ6bVi6tsR9YWjG2374ucK1bIavWxvacFITDqkNDMM7LpzOPTIPj2T57Lv0y70+La73frneZ05xA5f1UrqF3ZfjJHzmo16r7wrAxTRhKG1Ys+dCG06ywDMcyTvXUtQAXJZF9OV7LN7dxuDe6oef6zx4Jx2Oe2LdHL7iHqBfri+G4lqD07Vh6rYlns6y3Rv61oYpsbbTL/vdM6e4gct6XYmfWOLXxPXEvPyBKMgBmLo2rJnNBhiP+6/TlHhniReiqAG4HOPqsj1Z4iiwDMar+fBuOpw2rFkbPBuudWc4lA/G9cVw2tAn9/L8+R1O34NZPvNc1sY13x9zjQWQjM4hvFrir6fr3uCaYg7qNftvSvzw7muA8zDBGI7Jxrq1oQ0nGX+H4RSLZFPimXSdGq4E4DDasERtiYcDy2EeDq/lvli3NrThJOtTh2N8heVwP89fG6bsKOv4HTWhb22YEoXT/WnD7ElE5xDqdVQTxP9MJIozH7Vrw1+I7g3A+dm8GE4b1qy2Vn0kXZvVNambANt0/+1tOMn4O4w1b0Rt0hU1PLP7GuCQbPQv031hbG04JGPVfDRhKG1Ys226U3Lr59rGyG2sT9GvNjCcNsCtmA9O12NZhyb0zX0+Lfa+++NaXwDFDRxKTRD/z0p8dIk7AtNXr9n/MgBMlTZxtCWeSJcwdtvusy7ebbM89Vo/SrdZ/pZ0/61PBMbRZn2uRFEDh9UGXqsNSyPZjyUyD4fXasOatenWbOpazV1Zz/rU/r/V+tRrSUA6nBcDw/KuC6dzj0zTUdYzJ2lC39zn02Ju0Z/nwuy9LnAYNeHs5RJ/O04sYx5eKfF9JT5Q4idGBwfg7EwwhtEGrrXNtRvHmxL3lnjb7rPJfNSFo9qZok6qtyWeDWdxdxjC81mH+jx/qMTD8WwHhiFxZ1mOItkPYA3awLW2ufn6VLP7ei723UPfE+tT52EN4XBeCAyrjnvu4X5Ill2GNpLLp2gtXRsq+4D9MlZPj/eS/rRh9hQ3cEi1Y8OmxCeX+Hfpksdhymr3mi8r8c4AnJ0JxjBMrrmV7S72SWX13rw3xxvK+78e+55t020OP7/73MZkmmlrs2yKGoCxeL9djjbr2lhmXdowF95lh9EGTrfNzdenmhL3xPoU3MxaDthgOszL++NnuwzG5ek5yrre2cxz+9WGqWlCX9owe4obOLTaveFrS3xmYPpeLfHX0k0IAJgWJ9tyXvvT5mqcPEX3ZJHD/vOe3Z81ufyiQbv7395/Pp/jDeP992BO2izTpsSju0+AMbRhKR6M3ycwPkkfw7A+xXmdXJ86yfrUcjThUFyXDM01B8zN2g7XmFMXtDnyHGRN2jB7ihs4tNq94TNKfFaJ70hX7ABTVYsbXirxD0r8wnSdHABupQlDaAOHsd9Urp4+5e9rdp9vys2TRD6Y44Wfk18zjCYMYWnX9SaKGhheG3gt7w3LUDeVt2FK3FuH5aROuFYbOAzrU/Barl2G5prrj5/tMrRhSo6yrt9JE1iXJvSpDbOnuIE+1IKGZ0r8pMA8/LYS3xYApsRCKENrA1Rt5q8mgDxU4uE40RaYDu+389eWuBqmxr3FWjVhCMYYhtaGKbPGcFhtYFg6MvXHO9MytGFK1ta1oQl9awPr4BCAhVDcQB9q94ZPKfGzSjwX3RuYttq94dvTPdTeGN0bAKaiDcC1bCD3b+6LPbVl8QMlrsT1AkxPG+buvsDytQFOagNwzFoDADCEo6xvLuI9q3+K/KalCX1pwyJI4qUvr5T4O1HYwDzUsfCRErcF4NaaMIQ2ANeysNm/NvO0Sdc98L3RrYHxOQ2Gm3FtzFs9La8NwHR45x2G5zdAf9rAsNoAp2nDVKyta0N1b+ib+S1r8XxYBMUN9KVeW59Y4p50nRxgymr3hqN0xQ2vBoApMLkGGN6cxt6azPVoiRfSFTZsAuPblnhr4MbaMFfbElcD69CGuVDcMAzrU8BJTTgkYywsQxuWog1TcJR1/i6a0Lc2TEkT+tKGRVDcQJ9q14a/Hd0bmL5a0FALG/5yAG7tzjCENgDHJO4Mo830bUo8XuJ96RJNXRtMxZMl7ot3GE4neWd+6u/swQCwVm0A6Iv5EcC0GJenYY1dG6q7Q9/c49Nif7M/bVgExQ30qXZs+NQSnx7XGtNXixt+x+4T4DQmGcMwuQZOMvYOY6ptOuvv/0q6Dg01Ho5rgulo0xU1PBy4Ne+48/NIbIawLsap+ZD4MYw2APTBOwdjaAOcxtg8vqOsd6y6N/SpHs60DVNin7M/z4ZFkHBO314p8fTuE6asXqMvlviGuF4BxmbxDGAcUxt/mxKPpuvS8M50XRtgSuqGwFtjU4Cza8OcHO0C1sR8HI65H4DrNeFQjLGwHO7nZWnDmNbataGqnVONJ4fX5vhwJj/faVHc0B/X+kIobqBv9Rr7GSV+YlxvTF/tNvJr4loFTmeS0b82ANdqwhCmcpLFJl2HhlrUcDWevUxPGxsCXMxUO+TwWm3WvaHMenmuwTH3A0B/jLGwHO7nZfH7HM9R1r1HXg9OrmvursHDcTjTtNn77E8bFkECL0Oop+D/pRKvBqbt5XQPuPdH9wbg5kwy+mfRAmB96vO1dml4IV1hwyYwTTYEYB1qYUMbWB/z8floQt/aAFzL3sDheOdgDK47uLU2jMUhG90BXAocLm+bbg/D4UzTdmfowwfjul8MxQ0MoV5nv7zER8Q1x/TVa/SL41oFGNOLAWAMbYZVkwLuT1fMUIsarkaiANPVRrcGLq8Nc3C0C1gbzzcAOJ01C5g377twa/Zox3EU64Z7tcChJua34bz2xSH3ZTqd2rk5c4t+uPYXRPIuQ6ldGx6L7g1MX+3Y8HXpkqt0bwBupAl9awNwrSYMoc0wNiUeL/G+Eu+KLg1MX13P0K2BQ2jD1LVxUh7rJdlrXmyC968NAH1pAyyFZPhlMS8ch7Woa7XpEvTbcBZtiQdjD2NurOv0w3vJgihuYEi/K4obmIc7Svy6ErcFgDFYOAMYXt9jb12kqyfeP7OLh2PhjunbptsQuBrvJ7AWdTO5DayTZ928eJfu3/MBuFYTAK73QliSNgztKH7uN9JGgcOtbNMVNbwlutDOkXWdfujcsCCKGxhKTRKvCeO/avcJU/Zyib9X4gejewNwLROMYUioAK5n/O1fm35s0nVnqF0aHo8uDcxDfRd5JNo3c3htmLKj2Ahk3czFAYChKCADmCbzwuHp2nBzbRQ43Mg23c+lxlGYqyb0wXNsQV4XGE7t2vDnS3xyYPr23Ru+OgDHJNcOw4QDuJ7xt3+HHHvvLfH26M7APB2lK2zwPkIf2jBVbWwmA/PhHXsYbQCudWeAOWtDH14MS2JNdFhHMTbdSpsuib92BG+yXvXefCrdNeNAJrg598eCKG5gSLVTyCeV+IQS3xsn4jNttXvD/5puMv7G6HQDMKQ2AAytzeXUBKsr6YoaNoH5qQuetahhG+iPDeLpqoUNbWDd2jAXihuG4bkNXM/4ezjGWFgO9/OytGFIT4WzaLPeAodtiSd3n8bb5WhCX9wnCyJZl6HVgoY/ma6LA0xd7d5wf4yVwLEmAIzB5nH/LnLCVv291PfluqD8QonHo7CB+akLnbWo4a1R2ED/LKxP01G0cAfgtTy3AfpjjAWYJuPzcLaxHn0ebboChzWcyr5Nt2dxV7r/5qfj3oSz0rlhQXRuYGg1SfzXlvh1gemr3RveU+IDJd6crtgBgP61AbiW4ob+nWdhdJOuQ8OV+N0wb/XEo6uxMcCw2iianpI2XdcGIHk+zEUThuAdEbieNRAAlq4NQ3kynFeb4w4O92ZZtiXene4AFnPR5WtCH9w7C6O4gbH8qhJfna6TA0xZLWjYlPiWADAUkw6A4bW3+PNNFDSwHNt0yczbwPC8605LHQvaAMBreWYD17MecjjGWFgO9/Py1N+pZ16/2nSn8XN+9fpcQoFD/e+o18B7ojMDHIquDQujuIGxPFHiqwLTV7s3/IsS/7rEp0f3Blg7CznDMHkHrnd36Ft7g+9tSrytxMPxDGQZ2hIPRlED42qzvJPF5mqb7jQ0oNMGOKkNwLWsjRyOPQBYDvfz8ihu6J8uopdTr9G3plvXeyDzsC9meG732YY1a0IfXgyLoriBMdxW4tNKvLHED5Z4NTBttaDhPyzxgQBrZyGnfxZBAca1SVfQcCUW11iO+n5R23w/Ee8ajM8C+3Q8GIB5agLAGOwPALAGbcw5+tTGYRuHcmX3ObUChzbdoSrP7b5+NooZuJZ5RT90blgYxQ2MpRY0/M4S/1Vg+mr3hu9L123kV0T3BoA+STgEGEdd/H1nbFqwPPUULEUNTIlrcRrq2NAGOKkNsNcGAICzsM6xPM+HPunacFhX0o1DD2V4bbpk6ud3n/siBuMit6K4oR9tWBTFDYzpd5f4w4F5qB1HfnWJD6crzrktwBo1oW9tAF6rCX27EliW2tr5kXi3YHraMLa2xNWwFDYDWSPXPcDwjL2H1QZYCkm8cHZtdG3ow8PpxqJHc3htuqKF+u9/7rq/Nv5xUeYW/WjDoihuYCw1MbwO1J9Q4gPpksVhyl7Zff7nJf5oFDcAAABM0Tbd6VfbwDTZ9BrffWFJbAYejvFpPlz3/WsDcC1jLwBr0Ya+PB36cnX3eZ4ChzbdWsj+8/kTX++7MEAfzC36YW1zYRQ3MLY/kHFaQ8FF1CKc/yZdosxHlrgjwNqYZPTvxQC8lvEXuJVtFDUAt/ZkbEzCzdgABAAAgP48Gfp0Nd3axj27v35+99me+Gyv+x6M4c7Qh2fDoihuYGxXSvzOwDzU4oY6bn5+iW8KsEaSa/v3QgBey/gL3Exb4sEoamA+PNPG0+b4FDfgtRQ3zIdnSf8cvgFcrwkAN2IeAWdzFAn1Q3giMH3WdQ6vDYtze2BcH1viE0vcFpiHl0r88xJfX+LlAHBoNo8BgLNo0xU1vCUKG5gXGxfjqd1dJF3Azbk/5sOzpH8O3wDoVxtgKcwj4GweC0DHus7htWFxFDcwBV8WmJc7SvyC3ecrAdbk7tA3i6DA9SzwACfVd4W6EfTWdKddwdx4ro3jKMYMOI25OFzr+QAAABzGuyPxFjhmj+Dw2rA4ihuYgt9U4tXAfNSODbWDw28NAAB9s8ADVPuihtqp4WokYTJfnmvD248fLFMTDsFzdV4cvgEwvCYA3Ii5BNzaEwE41oRDc0jFAiluYAru2sVtgfmoBTl/rsT3pit2AOAw2gAAHFPUwNJISB3ekzHPgFvxfAUAAC7CXAJO15bYBoA+tWFxFDcwBTVJ/EsC81Kv29eV+Gkl7ojuI7AWTQAYWhNgjRQ1AIfQphtDgNN5zsK12gBcqwkAwPnpJgqc1IQ+tGFxFDcwFY9Ecjjz81KJF0v84bh+AQ5FQgUArJuiBpbuTWFI7wjA8jQBgPkyz2csTQCG1ZY4CsAx+wP9aMPiKG5gCm4r8RnpTsGHOfp/l/iBdMUOwLKZaPTPxgYArJOiBtbCnGI4RyWeDUvWhENpA5zUBoC+mO/Dcrif4XRPB+Ba9gf60YbFUdzAlPzcdIUOMCevlLijxKenK9DRwQGWzUQDYHhNgCVr03VzVNTAWjRhCG26gingbF4Mc2J9CmB4TQC4nnU8ON2TAaBvDjhaKMUNTEVNCP8dkRjOPL2cbuL+e+IaBrgsC6EAsA51sfHBdEUNT8Q7AHBYtbChDXBWnsPzorgBAABg2o5ibQp4rSYcmnXNhVLcwFTUjg2/NDBvf7TE+0u8FGCJbBwPw8QDuJ7xF5ZlW+K+Em9Nt8EDa3JvGEIb48taNAHoh/Up4Hp3BoDreWeCm9O1AbgR+95wRoobmJK6KPSxgXl6pcTrSnzG7vPlAEtjkgEwDuMvLMM2XVHDfbuvYY0eCkO4L8B5tWEuzI+GIVEPuJ7xF+bPfXx43pngxrbpOhcDXM/7CJyR4gam5NUSX5iuiwPM0Uu7+GUl7ggAF9EGAFiSbRQ1QNWUuBL6dhRzCmDZbIIDAFyM9yhgKE8F4Ma8j8AZKW5gav6TdEUOMFe1Y8PXlPjq6N4AS9MEgDFY5IH5qae21bbbb4miBth7NPStLfFYWBPviYfTBjjJKcTA9bx3AABn0aY7fAPgRswr4IxeF5iO2rHhPwzMXy0c+5UlfrjEG2KsBQC4DIs8MB/7ooYnIiEMTmqia8MQ6vjThjXxnsgaNWEI3mWB63nvAHitFwNc7+kA3NzdAc5Ewi1T88YSH1PihwLz9Uq68fWT003o61/rlAMAACyVogY4na4N/WvTjUHAxXh+A8DpFDfA/DXh0F4IcL0nAwBcmmRbpujnpuviAHP2UrrODW+PsRaWogl9awPwWk6wgOnalniwxF0lrkZiJNxIE10bhvBYWKMmHIpnOACcTnEDAHArR7HfDZzOvALOSMItU/TFJV4NzN/LJf5Wif8pXfcGAACAJdiWuG8XRwFOo2tD/45iLILLasNcNKFvbQAAAM7vqQCcTnEDnJHiBqbo7YHlqOPsl5T4QLpuDsB8mWQAAGtWT3SuLbX3RQ3bALfSRNeGIejasF7m6QDAELxzwDK4lw/v+QB7df18G4DTNQHO5HWB6fnEwHLUjg2vL/FJ6TqSfHj318D8WPQEGEcTYEz7ooYndl8DZ6drQ//q+NSGtTJPPwzP93lx3QMMz9gLy+BeBvpkbg0AB6S4gSmqJ93XAod/F1iGWtBQx9tPLfFd6QoedM4BeK02AMBUbEu8u8RRbMzARTTRtaFvbbrCK+ByPOfnRVIeAADA9JirAbfSBDgzybVM1X2BZXmpxPeUuD/d2PtqgLmxIAEwDuMvDGubbk5eQ7cGuDhdG/r3WBRIr93d4RDaACd5/wWu1wRYAvOHw/PeBMfsZQG3YpyAc1DcwFT98sDyvFzib5V4PIobYI5MNADGYfyF/tWNyJok/JZ0RQ3bAJfRRNeGvrXpOssArI35Uf8k6QEAnI33JgA4O2s6cA6vC0zTFwaW6bYSv6vE55X4OTEOAwAA42lLPJkuQdhmJByOrg39eyRgQ/BQXgxz4roHAAAAABZNUi1T9RMDy/RKurH355X47nTXurEY5kG7WoDhNQH6sE3XqWEb4NCaEpvQp6MSTwckeR/KCwEATtMEWALzh8NzWAoAnF0T4Mwk1DJVbyhxZ5waxTK9VOL1JT65xI/v/tp4DAAA9KluNu67NLQB+vJAbFL07bFApwmHYA1+Xhy+AcDcNYFxKG44PMUNAHB23kXgHCTTMmVNiecCy/ThdGPwR+++VuAAIKECeC2LPHB52xLvTlfUYMMR+ncl9OkoCrTg0LwfAMDpmgAAAFyOfW84h9sD0/WLA8v20u7zzekKG14KMGVN6NsLAbiWRR64uG2J+3bxRCQuwhCuxLyhT3Uc07WBPe+JAADAeTQBzuJtAaAP1jPhHBQ3MGU/J7B8taDhB0t8ZhQ4AAAAl7NP/L0rXVHDNsCQHg19ejK6NnDMZuDhtGFOmgAAwDQ4TGV5NrsA4PCsZ8I5KG5gyj43sA61oKEt8XnpChxeDjBFJhoAwFRt0xUz1KKGq7GxCGO4EgmnfWrTjW+w14RD8d4A12oDcK0mwNzZ4+uHucTyPBAA+nJ3gDNT3MCUfWJgPWqBwzeW+KUl7ijxSoCpsfAJMLwmwM3suzS8Nbo0wBTo2tCvxwL0RULSvFifAmAJmsCwvEPBrTXpDu/g4poAAAfxusB0fVS6a/SlwDrUjg3/oMSvKvFV6QocFKEBAAAnbUu8u8RRJCPCVFyJzcu+tYFrNYF1kpgHMDwnrML8NQFuxcEdAP2ypgPnoLiBqfu4Ev8usB61oOHvlPjVJf5mFDjAVJhkAIzD+AudWsTwVImno0MDTNEDAYbmPfFw2gAAAJxfG5aiia4NAH2zngnnoLiBqfvUKG5gfWpBQz2J9YtL/C9R4ABTYJIBMA7jL2u3jS4NMHWbXQDD8p7IGrnuAQAuxnsUnO7+ANC3JsCZSZZl6j47sE61oKGeyvpF6cbqVwIAAKxBLWJ4ssR9u3giChtgynRtGEYbuJbkpMNpw1y47gHG0YRDawLD8h4Fp3soAAAToriBqfu8wHrVgoavLvHL043XLwUYSxMAxtAE1mNb4pESbynx8O6vgWlrSlwJMAbJSQAAwFk14dAcxrIcV+IeAehbE+BcXheYtk8PrFstcPj7JT6/xD9JV+Bg7AYAgGXYd2moXdueDTA3jwYYy93hECQkzUsTAMagqPLw/EwZmmvu8MwllsP6FkD/vIvAOUmQZep+SoCXS3xDic8u8S9LfLjE6wMAsHx3BpZpW+Kx6M4Ac9ZE1wZg/iQkAcCtSUQ6PD9ThuaagxvbRBE1wBC8i8A5KW5g6j41QFU7Nnx7iY8v8YHo4ABDawLAGCz0sCT7Lg1PRCIhLMEDYUht4FpNOIQ2AACwfDq/wY1Z3wIAJkliLFP3UQH2akHDC+m6NvxYFDgAAMDU1SKGp0s8FV0aYGmuBBiTIljWqAkAQ/PO0Q8/V4bmmju8NsxdE+tbAENpApyLpFim7iNK3Fbi1QDVy+nG7jtK/PsSd8VYDkOw6AkAnMe2xLtLHEWXBliiK7EZAWMzTz+MFwMAnMY7Rz/8XBmaaw5e69FwaE0U/gA35l0EzklCLHNQCxw+FGCvdmyo3Rs+ocQ/LvFz0hUB3RagLyYaAONoAvNRixieTFfYsA2wZDZ/YVxNOJQXwpxYnwIYnrEXlqEJcL1NABiKeQWck+IG5uCjorgBrvfhdGP4F5T470r81hKvlLg9AADAUGpBw1Mlno6CBliLTSRFwNiacCg6N8yLjXCA4Rl7+3F3YDju436YS8zblZhbAwzJ+wick+IG5uBj4wQpuJHawaEWM/y2Ev9bib+x+56xHQ7PRANgHMZfpqgWNDxb4rHd5wcDrMlDYWhtgL54j4HXuisAwJLcG/ogh2fedCUFGJY9bzgnCbDMwZtLfGeAG3ll9/k3S3xGiW8v8XKJOwIckokGwDiMv0zJtsS7SxxFIiCsVVPi/gBja8KheKeZlyYM4c4AHLM21Q+FZADj2cTcAmBoOpfBOSluYA4sGsGt1YKGtsRtJT6Q7r4xxgMAwOVso6ABOOZUO5iGJhyK9xsAOJ196n4oJGNIOjfAtR4IAMDESXxlDj4iwFnUAofXl/j4dAlYX5Sus8PtAS5LFfUwmgAcawLj2JZ4T7qChjYAnSbdyXbA+CQZHo7ihnmRCArAUjSB4Zg/9OP5MEdNiSsBYGjeR+CcFDcwB58c4Kw+nK6Y4e0lfk2Jv1HipRjvAQDgNG2Jp9IVNmwD8FqbSMAZSxu4ls3Aw1HcMC+ufYDhNQHmrgmw91AAGIM1HTgnya7MwccGOI9Xdp/vStfF4bujwAEAmB+LPPStJvM9GQUNwNk8GmAqdFcEAJi3JjAc8wc4dn8AGEMT4FwkujIHdwS4iFrQ8EKJ15f4ByV+UbrCh9sDnFcTAIamuIE+1IKG2qHh6ShoAM5uE3MCmBLviYfTBgBgHPWdThcphtCEPrh/5+dK3A99s14BAAeiuIE5+JQAF/VyugKhLyzxjhJ/88T3AABgDRQ0AJf1UIApaQLr1IQhNAE41oS+KG5gKE3og/t3fh4IfVPcANxIE+DcFDcwBx8b4DJe3n1+VYmPTHci2yeUuG0XwK1ZiAAYnrGXy1DQABxKU+L+AFPiPfFw2gAAjMM7HUNoAlRNus6kAAzPey9cgOIGgPV4aff5ySW+osTv3X3PswBuzWRjGE0Ajhl7OS8FDUAfHg1jawPHmsB6mSMBDO/u0BfPNYbQBKisbwGMx3svXICEVoB1qcUMt5f4/SX+uxL/Kl33htujiwMAAPPTpito2EZBA9CPTYApacKhtGFubIYDsCRNoH9N6Esb5mQTAIAZUdwATEkdkz6qxMeV+CnpOgz85N3XP7XEm0t85O7zjhIfW+LV3T/3+tw4Ob/+eU3o//Duzz+4+973l/jREi+kS/B/vsS/LfE9Jb6rxAd2f/5Klmf/3/T+Eh9d4r8t8duiiwPcjI1jgHE0gRtro6ABGMaVeB7B1JijAwAsg/c6htAEuBL3AsCYmgDnJokV6EstJHj1Bt+vBQmfWeKnlfgFJX5GupauPzFd4UIf/z/esIvqo3efP+nE3/NLT/nnf6zEd6creHhviX+YrhjiO0r8SOZt38Xht5f4ihLfVOKNuz+7PcCeBXYAGN+2xHtKHMWpYMBwHggwNU04lDbMSROGYi0QOKkJfTHeMoR7AljfAhiX9164AMUNzMFtYepuVMhQixg+p8QXpmtx9zPTdVyYW9L8R6RbuKzx80r8jhN/Vjsg1O4Htdjha0o8s/v6hzMfJ7s43FXi96YrdKjfV+AADM2kDoCTtiXena6g4YMBGNa96dYzGN/zgWPmjUDfjDMAw7g70L8m9MV67Tw0sb4FMDbrDHABihuYgx8IU3N9MUMtZKib/l9S4m0lPqPE67N8Nfn/U3fxhSe+/+ES/zJdscNfLfEtubbLw826Wozp5XT/v/5YicdLfH26kyzq9+8IrFsThmJSB5zUhLWpG2LPRkEDMA0PBZiiJhzKi2FOrJkAjMP425+7Av1rQl+s3c7DowFgbOYUcAGKG5iD7w5juz4Z/5NLvKPEry3xuSU+OpxUCzt+5i72yRC1uOGflPgrJf5euk4Je1Mpdqj/H/ZFDrVYpRaqbHffuz26qAAAcHh1E+zpdAUN29gUA6ahKXF/gClywu/hvBDmxEY4wDiMv/3xXkffmriHYRMAxuZ9BC5AcQNz8FIY2skk9prw/nElfl2JK+kS9tfQleHQagHIL9pFVa/r/6PEny/xt0p8b6ZT5LC/5/5huv9Pf7TEl5V4JV2RAwDAEO4MS1ULGJ5KV9SwDcD0bGLDAabKvXk4OjfAzTUl2gDQJ+919K0JrNuVuA+G1gTgtRT1wgUobmAOfigMYV/QUJPr31DiF6TrOnBfusT8V+Pk/kOq4+/P2UVVr/OvKfHfpOvwUJ38nYxhX8zw5SV+f4n/b4mfn66Twx2B9WjCkJrYPAY6NjiXZVviPbvPbQCm7dEwJbr6cNK94VDcW/NifgQwvCb0qQn0y9yhX22YugcCADBTihuYg/eHvpxMnn9jid9Q4neXeMspfy/9+JgSX7yL6pvTFTp8ZYkfTldk8GqGL3R45cTXteDlM9MVYbwlOjkAAHBzNVnu2RLvLnEUyXPAfGwiyWZqPEPYk9x9WO6teXH9A7BETSRI058msF5NujUuAMZnTQcuQFIqc/ChcEi35bhQoT48/0CJ7023mfWncuPCBob3OSX+h3QdHZ5P10Xjjbs/q2P30MUmL+8+/02JT0tX6LDvqvJKYNlMNADGYfydnzqneDJd97e37D6fiMQ5YF6cagfT5eTVw/KOBjdnPgpUxoL++RnTp3sC66UrKcB0eOeFC1DcwBy8GC6rJsLv7/ePLfFfpCto+P4Sj5W468TfxzScLEL5ySX+eLoNx1ro8J+W+Igb/H1D2Bc5/KMSd5b4onTFDfuAJTLRGJafN7BnPJiHbbo5RS1kqPOKh3ffkywHzFFT4kqAqfJ+eFje1+alCUMy3gCVsaB/TaA/iqP7Yy4xfZsAMBVNgHNT3MAcmBhd3G0n4ovTtfWsxSJfkWsLGowF03byd/SpJf50iR8t8c9L/OISr2b43+Mru//Nry7x+hK/4cT3FTkAl2HDCGDa6vxsW+KRdHOKWtRwdfc9gLnbBJiyJhySdXcAYGxNoB9viv2mPplLTNv9Mb4CADMnoZk5+JFwHidP8v/0En833Wn7f73ETznx97j/5+n2HP/ufnqJr0lX3PCuHE9Q658P0c2h/u/uixzq9XVHiV9f4sO7P1fkwFI0AWAMTZiKtsST6QoZ3rL7fCI2sYDleShMURvoNAEYRhMAidFDaAL90LWBNXsgAExFE+BCJDczBz8QzmKf0P66El+aLtHo20p84e7PTxY9sAwnx/AvKvEdJd5f4ksybDeHk0UOf6PER5b4ZTlOdlPkAJxHEwDGdrI7w1t28fDuewoagKW6N5IfYOruCYfUhjlpAsDQFDf0rwn0w/yetWrSdW4AYBrMKeCCFDcwBx8KN1OTye/Yff0TS/ytEj9e4k+W+Njd993n67AvXPnEEn8pXcHBXyvx5t33hy5y+PslPq7Ez0lXZLP/c5ijOwMAy9fmxt0Z2gCsg64NMH02AwEAlkXxKn15W+hTG6ZqEwCmxHomXJCkZ6bux8ON7IsaarL4zy3xfIl/V+JXnPhz9/c63Z7j3/2vLfGBEs+V+Jkn/rzvDh77Iofqn5X4aSXuLvHM7nuvRDcH5sVkA2B4TRhaLWbQnQFYs02AqWvCIbVhThy+MawmAMaCITSBfjSBdXJ4x7jkFQDAgUh+Zup+OJy0L1qoyeNfUuIHSvzvJT519+fuaU7aXw8/o8R7S/z7Er843fUzRJFDctyt4btK/KJ0RTlXS7y8+74iB+B6TQAYg0V3YM2uxHsoTN2b4n2FdXP9A7BUTeDw7g2sz71x7Y9NUTpwvSbAhUiEZuq+O1S37aImin9ZiQ+X+EslfsLuz93LnGZ/fXxcib+b7vp5MN31VIsNhihy2Bcx1P/N/6rEG0p8QYlvOvHnCh0AgD2JO8PzMwfW7IEwZW1AgsahtQFOY34EVMaCYXjP49BcU6yVrg0A02NOARckIZqp+86s275TQ/WH0yWGf0WOT913D3Met5/4/PPprqffmWGLHOr/1r6I4etKvDVdkc5j0amF6WrCkO4OgIWeMTQBWKemxCbA1Hk/ZO3cA8Ny4ipQGXuH0QQOS3FD/9owRZsAMDXmFHBBEqOZuu/IOu0LF2oi+B9Klwz+5bu/VtTAZd2+i3pd/fF019WXZtgih+z+96ofTVe888YSn13ibwUAAACGcX+AOZCgdFhtmBub4QAsVRM4LHMH1qiubzUBYGqs58AFSZBm6v5p1qUmldfk8pr0/cju8/elS0K/LcMlnbMOJ4scHk93vf0/d59DPh9OdnP41+km3vVa//wSXxsYn8nGsO4KgLF3DH7mwFo9FGAO7gnAcJoA6DI8lCZwWOYOrNHbA8AU2X+FC1LcwNR9S9ZjX9Twa0r8eIk/luOiBvcqfTpZ5HBU4kMlfuHuz+7IsOr/h31Hh68v8bZ098AXlHgmMA6TjWHdGQBj7xj8zIE1qqc5NmHq2oB3lUN7McxNE4ZkzAEYjkR0Dm0T+vZ8mJKmxJUAMEUKpuGCJEwzdd+T5dsnj9eFmw+W+Gu77ylqYGj7IofXl/j7Jb6rxGft/mzoIofq1RNf/5N0BRf1vviZ6YowXjzx970aYCmaADAGyTtwPvWeacLc6doA83FvOKQXApzG/AhgOE2MuxzOJrA+mwAALIzEaabuu7Nc+0TyN5b41hL/R4mPiaIGxre//j6pxL8o8Y9KvC7H1+zYvrnEb0q30PnxJf5fJb4p0I8mAIyhCUPTOQdOV+cf95d4PF1XuZoU+t4Yr+ZuE2AO3hQJb4fmpFUAuLUmDKUJHIaiaNbogQAwVdY04YIkUDNlHyrxSpanFi/UU/Drf9tfLPH9JT5t92djnI4PN7O/Hn9uuvvxv0533Y59nZ7s1PB96e6julBV762fWuKxEv86wFyZ3AGM464AJ9V3kivpihlqEUMtZnhXiYdznBBf/553hrnaRAINzIUEJdauCUNrAsCQvO9xKG8LQ/hgmIomDu8AmDL5L3BBihuYsvdneerp9zUp+1fuPn/j7vN1gemqz4p6nf6u3ecX7L4/hev2ZKFD9W3pihtqkUMtdqiFQ4+U+LoSPxo4PxON4fmZswZNuoTZmhBbE2Zt3jEFdwfWrcnx2Py+dMUM9etazHDaOL3Z/T3Mj1Pt5kHCBJV54uG5t+DWjD0sXZPjgu46B9qE6xkHhmN9lENpwhDMJ6ZjE6bEIVLA9ZoAFyKhmil7Lstx2y4+psSzJX5KuhPwFRgxF/uOIy+X+NoS31ji83LcheTVTMP1/z/aEk/sovrYEj+txH9U4gtLfHaJjwrcnM2LcTTp7l9YiibdAvPbcuNToutJ4G+NDYGTmjA0zzzWpilxf4l7cvkT/B8tcRTj+Nxswhy4r6gkux2ee2tevKuPo/7c3SssSZPT16dqcbf1qWsZf4fTBC6v3rPmDqzNQ2FK7gwAcBCKG5iyr88y1PvspRJfUeL3pEsO3xc7wNzcsfusC0P1uv4dJf50jq/zqbm+2OEHS/yzXey9vsRbSvzfSvyydP9tn1HiowMAF9PkOGG2ft5qI7T+/fXU76uB8diwZ+k26d7194k8h7zm67/LOD4vm0iegTm5JxyaxNV58a4+Dj935q7J+Qq665+b1zAW73scwiawLvdGQQ/AlDUBLkxxA1P299IVAEzlRPjz2ndl+JQS35IuUbqecH9HYP7q9V2v5ydL/P4S/0GJ79/92SuZlw+X+Ne7+B9PfL+OPx9f4lNLfHq6BbHP2v31J5f4CfEchb400bmBeamLx5tcLmG2nq5zFNf+ntNthidxhyXZn9S3H5fvTf/XeB3Ha8c4yaLz8ECAOWnCoXlewa2ZIzE3+/Wpsx62cSP7rnRtaMKQmuiYw+VtwlDaMAVXAsCUWVeAS5CUyZQ9n/kWNuxPsf/vS/yW3de3B5Zlf03XAoAPlPgvS/zBTLeLw3nV8eff7+IbS3zlDf6e+jP4yHQ/gzfu4hNKfGK6gqZPS/eyWgsl3rz7e+c6rq1VE8ZgksfUHaKY4Xr131E3kB8MlXFgHE1sTDFP+2KGt+f4xLKhxxHdG+ZlE2BOnETJ2pkfjaMJTFsf61PV4yXeERheU+LZwMXpAMLavD0ATJn1HLgExQ1M1cs5PgV+Tm7bRU1srqfAf0S6RGb3GktWu5HU67x2cPht6bob/EC6Dg5LT+Sv/40/kq4YCzgckzymZpNrk2b7ukavlHgskssBbqWOw5tc25lhCnRvmIdNJCvOSRvWTmFDP9owJ9ZJgGqTYdan7t/9b22zbsbe4dXrWnEDl7EJrMcm1rcAps6cAi5BwjVT9f7Mz/60+j9S4st2X98RWId9Yc9d6QqTfnuJP5PldHFgvZowBpM8xrQ//ftkwuyQ16TuDR3jwDiaSHRjmpp0Y3I9ge/+TPcdTfeGeXggwJx4L+yHQjy4tSYwnv361BDFDDdS35m3WTfvIMNT1MplbALrYn0LYPrMKeASFDcwVV+b+agJ3ben69Lw3SXenO40d/cXa1QLeur1/6fSFTh8dhQ4AOdnkseQxi5muF5N2n0kko2MA+NoAtPQpBsPazHDJvO6NnVvmL5NgDmR5NYPz6l5acIYzEsZ0tTWp67E+hTDuydwcZswpDaMbRMAps66AlyC5Gum6u9mHmoi98slflWJd6VL4L49sG77e+CzSrxa4ueX+N93338lALd2d6A/+83i/al3m0yLU78Zk0U2xrIfj/eJPHO+Fuv/91qYcRSmaBMJojA3TQDGcWegP9evT41dzHAja1+fskYyPEWtXMbbAuuxibkywByYU8AlKG5gqt6TriPCq5mufWHD15T4JdGtAa5Xixlqwc8/LPFXSvzH0cWB+WnCGO4KHE5dNNjk2pPvpq6e+n0169aEMVhkYwj7JJ6TiTxLu/ZqW/ijMEX3h7l5MaydE3wPrw1wFk3gcE6uT03xsI0bWXtXOmskw6s/8ybeVbgYxTGsyQMBYA7MKeASJGIzVf8201WLLmrS9k8o8T0l3rD7vo4N8Fr758yXlPhlJT4xChyAW3MyHpexPzG7JkFtMs9Njf2G9zYwLJ1z6MMcTiQ9tE2M41P19jA3L4S1k6QEkuzHIgmBy5jjYRvXq/8NV9IVOMBQ6r3SBs5nE8/tobVhTJswVU0Ajnk/gUtQ3MAUfVemqxYw1G4Sv7zEV6VL0L4jwK3U+6SexF67nXx+ia9PVyj0SmDaJNmPowmc3clihvrZZBkejaRYhqdzDoewhCSeQ6jPpG2YknotNgHmZA0FcWNoA5yF8YfzWOr6VC0OXmtxQxPGsCnxdOB8NoH1WNJ7BsDSOVQOLkFxA1P0NZmm15f4cIm/XOI3pEvKdg/B2dUCh1oQ9E9K/JESvze6ODB9NjHH4efOaZpcmzTbZJk26e6FD2Z9mjAWi2xcRJNuzFpaEs9l1fbwV7POcXyqNgHmxtwQOg7fGEcTuLkm61mfaqIwjuHcEzi/twXWQ1dSAGAVJGYzRf9TpqfeK7Ww4d+W+OR03RtuD3Be++fOl5X4whKfGwUOwGtJYOGkJscn322yruSCh9MlxsJQjL+cRZP1jsvnse9g4cTJ6bD5C/Oz1u4/fXsxzI339PGs9dABXqvJOooZbuRK1rk+Zewdh/c/zmu//gJrcX8AmIsmwIUpbmCKvj7TcVu60+bryUjfmy4B+44Al1WLg2oy1I+X+JgocGC6bGCMp4kTwdaqyXHSbP1c83241hOnjL3jaQKvVRMLNjlO4nGPnt1DUdwwFU0kO8zV82HNnMDajxcCnJXihvVqYn1qb9+Vbm3MfcdRf+5N7A1wdgpihteGsaz9nQQAWBHFDUzND5X4wUzDbbv4+SX+t3SJ1+4ZOJx9QcOPpVt4+uYSLwemxQLRePzs10PS7M1tdrHNurgGxtXEBtWa1fvv3l28fffpnry4TSTETcUmwBw1oQ+KhubH+9h4mpgfrcV+fUoxw2s1Wef6FOPZlDgKnI1T7FkTXUkB5qUJDG9fMP5sZk6iNlMzla4N9VT5V0r8vhJ/OF3CtfsFDm9f4FAfqP9xib+S4/sPWLcmC3jZ5oY26TaMFTOczSY2jxmWe3Jd9sUM+0IGxQyHd6XEE2FsNn9hnpzCCh3vZ+NpwlI5bON8avLwNutydxiLd0DOQ7c31kQxDwBwI3VN40quPbjukcx8f1KyNlPz59J1S3g149knW39Vif97uiTrOwL0pd5z9T77yyU+v8SXprvndHFgCpowFhuKy+AE8Mt7oMTVrItrZFxNFJctWb2/Nuk2fvfJPPSrPv8UN4zP5i/Mj6S2/ugoBGdnfrocm1ifuoy6PvVwYBiS1TmrJuYNY2jDGHSWApiXJtCvTY4PbNjc4M8fTdcRb7ZrwYobmJq/n3HtCxv+ZYnPTFdocVuAvt2++/ytJX56iftKvL7EhwOsVRPmaF/MsJ9E2Sy+vGYXbdbDNTOuJixJk248vifdBlgThrZJN65JJB2PwoZ5c++sVxP64r6anyaMpQlzZH3q8PaF8ttA//b3rHcWbmUTWA9dSQHmxRyUQ9uvddR3giu59TVW/7weUnA1M6W4gSn5gYy7SLEvbHixxEdHtwYYQy1y+Hkl/k2JT4sCB1gzbb/n4eQEat+hwUT98K5kfd0bGE8T5qzJtSd1NGEKrkT3hjHZ/J03CU3rtQl9abMudY5aC92ejQ5lnN+dYQ4UMwxjk3UVNzRhTPU+3gZOZ77PmmzCHHgHBfaMBxzCfl3zbblYF6eH0u1PznKfRXEDU/IPMp56L9QODS+XeCXuDRhTvf9+cokfLvETclx4BENrwpjuClO0P6WtTp7ujcXUoaytFXsTxiR5Z172Y/G+M4PF0mmqm+2KG8azCTBH9wQu5uS89WTnqrbEW6NoivNpwhRdf9jGJgyh/ryvBoahuIGz2ATWYRPvpXNhfR7YMx5wUU26Nc06B9/kcmbdvUECN1NSN/prgcGrGVa9D2oCdd3UeCnuC5iC/X1Yi43ekK6TyssB1kQiyzScTAqpn/eGMWyiFTvDcZ9P2ybXnkhqcXQeNjGOj6XeL02AOfJO0p+lPY/OmuTclHhniXdkXpowpiZMgfWpadi/W7dZB/PtcTkkgFvZxH06ljYM7YEAMDfeUziPTbo50MmDWg5ltt0bJHEzJf8o4xQ2fFKJfxuFDTA1+44NH05XgPTj0cGBYZlsjMvPfxz7tnb7E8CbMBX193EU6J/xdzr2iXonE3j8fubrSiRmjGET5k5R0Do18czr09zvq+vfkTbn+Gfv38XTgbMxFo3j5PrUJooZpqT+XtYyr3H/j8t9z61I9mZNNgFgbswnOM3+EId9QUOf18tsuzdI5GYKakHDt6U7oX1I9fr/tBLfGoUNMFX1vqzFDT9c4q4SPxQFDgzHZGNcb4oTjofQpJs0KWaYvpq4c5R1aMKYmjCWk6eRnnbqMPPk1MlxvD3MnfnAOklm69cc76tNru3OcJk1m9q9YZv5/BysT43L+tQwHLYxH+Y1DGW/RrIN3NgmsA6beDcCmCPrOVyvXhNXcpj1zfOaZfcGydxMxZ8tcVuG69xQr/2fWuKbo7ABpu716QocXijx8eketAocYB1sHh9ek+PE2U0siM5J3dx/MDCMJtqLD8FppOuyiXeboe2TYYD58Uzs1xyeRU2696T93PWQm3313/VoiUcyDzbDx9eUeDYcUhPrU3O1T8BY+rymCVNQr7dt4LXqtdGEsTwfhnR/AJgj6zlUm1ys++yhzbJ7g4RupqAWNfzVDKde959d4puisAHmYl/g8IESn1Ti+6LAgf6ZbIyvieTay2py7cl3ruv5WtNpZXeHsdUNwjYcWhMJPGt3JU45HdImwFzdE9amybBz17qZ9+5ImORsmihuuKwm1xZ2N2Gu6vgs4Zyh6BTCzWwC66ErKcA8yctYp/2cuT6/r2Ra18HsujdI6mYKvr/Ev88w6jX/06KwAeaoFjjU+/Z7ooMDwzDZGF8TzqtOlDZRzLBUm9g8ZhjGjsMwJnM9iRnDsvkL86VzQ3/aTMO+g9WYRZ+Pl3hrps875PiacF5NHLaxZPV3us2yuWanYS2dQjg/8/1xHYWh6FICMF8O81uPOme5ku4ddT+HmaLZdW+Q2M3YXi3x19J1b3g1/arX+6eV+OdR2ABzVe/bfQeHN5f4wShwgCVrwq3sE2f3CSE23pbtbYFhNOEiNunGZWMyN7OJxIwhbcISuF/Wp46TTejLWPfUvhNdfU+qSbFNxlff2+qG3tQLD71Tjq8Jt2J9al3WsD7lGp4GnUK4kSbm+2M6io6/Q9oEAJiifXeGTeb1vK7dG65mJiR3M7Za1PB4+lev9Z9U4lujsAHmrnZwqAUOtevLx+y+p8CBPjRhbKrZX2uT44nSlKu+6ccm60iKdV2Pz/h7a/sN9n3yjjGZs6oJnUehb028zy+F4ob12YQ+DXVPnWzBvk96nqJH0z2XjTWc5s5wvU0Udq/Z/hTpNtC/NXQK4Xw2YSz1nfmxMCRdSgDmqwlLs0n3bJ7KwS0Xse8ycZQZkODN2H6kxL9Jv+5IlwDdRmEDLEUtcKj38w+VeEOOCx6AZbkr6yZxlhu5kumfLHpZrvPx3Ruud/K04Skn6DF9D0RxwxA2AebKe8g8XT9/3WQe5tCOvQljW/u4tL+/HbbBSTWZY8nrU67x6dDJlus9EMbyZBS2DamJ9a25auJeAViCOi+sc999J9qlzBNns08pyZsxvVLiL6Xr3vBq+vG63b//hShsgKWp93O9rz+UrohJgQMszz1ZF8UMnMUmyy9uYHxN2C9Y1WfRJhKaOJz9890J0f1ysh3MlwS2frU5nE2Wkexc27HXOZZnMzeztrUZ61OcRR37FTcwBHNoTmoi2XssbexLDG0TAOasCXPUpNsfrnPeTZZps4ttJk6iN2O6vcQfSX/FDftE5/rvVtgAy7QvcPjBEh974q/hEJowtibLtt8s3ieCbAK3toZkryaM7U1Z38Zxk+PODJu4DunP/vm/DX3aBJgrBYXTtZ+37t+XlpL4Wf87Hi3xSODGmix7fnT9+pRiBs5CwjlDuhJJ1XQ2YSyPxZg/NAd3AMAwNunWO69kPfvDdS10m4mT7M1YasHBi+mvFVe9tmthww9HYQMsXb2/PzLdeNKk6+LwcoClaLKc1p11w2+Ta0++g/PaX0fbQL+aEs9muZocd2ZYUitR5qFec9vQl03c00vShjWRUNu/58/x9zZZz/vSwyWezDTHnCZMwZKSuE+uTzlsg4taetF2E6Zk6Z1COLsHwhjaEkdhaJsAMFdNmLL9fLa+W651j3iT7mcw6VwACd+MpRY3/Kl03RteyWHVxOZa0PCvSrwhrnNYg3qff2qJ96TblOljbGF97gxT0GS+CU2KGejLJsvdPJbMNh2TX9A4p026/6alnTTMPNXEjIdDX7xzwXw1YUz1/ahu6K21k1U9sezBwI3V94s282R9ir4suWh7KcVMS6FTCFUTyd5juS8MbRPr1wBzZgyfnvo7uZLjrpV+R93PY9J7lZK+GUtNPH48XZHDId2W7sT2v1Pi0+MahzWphU0/r8SfKfGl6caDQ48xrIuX2WloMh/7RJD9qZZNoB9vy3IZe6ejyXztT9w4mbzj2mJKmiyrO9XUvD3AXG1C39oTX59MeDaH7Tb0Hsv0ns8O35iGJvNhfYqh3JPlWtJhD0uwH9eOwpptwhiOYv1qDPcHgDmzJzkNmxzvFW/C9WrniquZcBG5xG/GUE9Tf1+JF3JYt+0+6wbELzvx18B61MKp/6zE15f4K1HcAEvQZLqaXDshagLDcFoZQ7g787EvZtiftqGYgTmom5RPhD5sAszVkpMkp6L+jOuhQ5s4vf1GHs70TizzXjsNTaarSXdPK2ZgaJssd31qm+6/yxg8HTXx5iisVb0XHwpDa9Pl3jC8JR9wBbAG5hHjOLlffCV+D7dSfz51HfRqJkpxA2Ooycf/eQ5/qno9tf0Xl/iD6QooFDfAOtX7/6kS31jiX5V4KXAxXnSnYUrJtU0UMzAN+4n5NsvThKmYcrLbyVOG66fEPOZIAm8/NmFJFHKuzyb0bWqJ+1Mz+RPLGE2T6WhifYrpWOr6VPXudM8FpsFhL+ty/UEmmzCGKXY1W4Mm1rsB5k6u0bCaEu/KcQE+Z7dfC50kxQ2M5ekctvigFjZ8Yom/ky6x+fYAa1Xv/5dL/PMSH737ngIHLsJL7zSMuYDXpDvxbn/ynWuCKVny5jHT0GQ6mjiJlOXZhD5swpJIXFqXTWB8UzyxzFrENIxZmNrkeH1qE/MhpqVem9ss01EUN0xJfR7W6+0oLJFihulp434byyYAzJ21nGE1sVZyUU26d49tJkhxA0OrnRr+dg7btaFexzVx+bt2n65roBY81fHg+0t8VI7HCWB+mgxnv2i+P/nOpJMp25R4ItCfOgY2Ged0riaSd1i+JuPdY0v2tgBz5WRKpuKhdHOtqRRYWZuYhiF/D/v1KYdtMAdL7kj3bLpngXtwOmqxyVFYgibHz7r6aS4wPfeFsbw9AMydOQRz8mgUN8D/pRY1PJTDFTfsE5jfn+6kdtc0sLcfD+oCdF0Uqx0dXgmcXROm4E3pr930Jt34oJiBOVpq8qb7cFrqGNmmf4rLWKtNJGYc2ibAXClOYiqm2L2B8fVZ/G0+xJwtOSG5rkc/lW5fm2nYpL+9Avqz78pgL2Y+HovDOMa0CXPXxD0Ea+ddhznZZKLzLIngDKkmFdcihPflMGqBRC1o+F9KfHy6QgeAk+pz7j8o8V+X+PIAc9WkK1S6rE2ubW1sUsmcjXmqfp/cl9PS5PBObmgaj1k7JxMe1iYsjaSldTEmMiU1kfVqpqEJU3Go4u9NzIdYjv0c/xBrt1P0dBQ3TM2V6GY7ZSfX/XRknac2inzHtIl3Q4AlMJYzN5M86EVxA0OqxQi/PYft2nB/iV8dgJurY87vKfE3S3xjum4vwLxcZINsv4i+PwnIZjFLtIkTv+lXk8vbj8f7xB3jMRy7JxzSJiyN4ob1aCLpiWmp76ubTLQlO6Npcn7Wp1iDJRc3bHexCVNRi03qmPpcut9NG6djj6VJd2/cs/v63ninX4L7wpgU/QMsw92BeZnSQS//f4obGEotZqgJxu/efV5WvXbrAvBXpusIcXsAbqyOOXWc+PoSH7n7ngIHbqUJU3KWxTzJs6zREhe6mzAlF0m83ieCnUzeAW7M/XFYbwswV8ZDpujRjF/cYF1jWpoz/D2KGVijpT/H6972JkxFs4t6AOKju+/Vouhnd/H87rONoodD2HcP3ndi2K/7NWGJnoz7ZmxvDwDA8CZ50IviBoZSixv+VLoihFdyObVjQ01M/p7dp+sYuJU69tTx4v0lPi6HGYuA4TQ3+N71xQybwPo0gX6dJUGhyfEpbffHdQnnsU8SaMMhSI6G+doEpmeT8Tf1JMVPS3OD71mfguV3pDtKl0RvTJ6ufSLO5rrv16KHdhfPnfh6H3SaHD/P6td357g4rwlr0WaCp/Wu0CYALEETmJ8pHPRyDUnhDKUmEv+eXF49gf3ldDdSLZhwDQNnVceLO0s8VeJK4HQf3IUNi2k4eSKQk8Dh2BI3jz8YpuRNuzj5e2nSFTHU628TC3RwWfWdpg2XtYl3d5gznVeYqvreu814rE9Ny/XrU4oZoLP0ddo6DtfTzB8Nc7NP2K9x/w3+vN1F/R0/l+NiiJNFEXO3X9s7Waxw93Xf855BdV+szY9tEwCWwvsVc7TJxA5kkxjOEGoRwteW+FAur3Zt+I9iwwu4mDqG/MYSf7bEP0vXzQFuxIbFtDQlXghwvSavTTyfu6M4DW9qruw+98VlfjdwWE04BIWvy/RiWIN9YhVM0QPpTrAda85lfWpamlifghu50cEIS/NEiYdiTWRpmhzPye+/yd9zsuBhH8/v/uzk93Pd120O72Qhwv7r5sTXd9/ge65ZzuKxOHhjCu4PAEvhHYy5upIJdfOqp+C/GujfTynxf5Z4JRdXi3E+qsQP7P49twfg/Pbjx+t2nx8O3FidcLwvJh7AtL21xLNZlodLPB6AdTgq8WC4rHfFJvASHcX9sQabEs8EpuuRdEmtY7E+BczBEtenrrcvcIDzOln0cF5NoF9tibeEKajz4k1YgtoJZRtgrer6jYMRmKs6b3lLJnJ4geRw+laTiL+lxL/N5Qob6rX60u7f81Jcu8DF7ceTb01X2HBb4Mb2p+MBTNm9WZ66WdwGYB2WOI6Pwc8R5kthElP39ozL+hQwB2t4Hx+z0I1523dTuEhA3+4LU1DHiU0AWAKHUzBnk3onkSBO3+o19utz+Wutdhj58yV+QrrT1gEuo44jtdKwngztWchpJNgCU9dkmZzSDKyFhe7Lq4lUTYC5uicwbZuMv6l3NdangGlbQ3FDW+KxACxHHdPaMAUO7VgW672wbsYA5m4yHQsldNKnl0t8Z4nncrmuDXeU+OwS/8nua4BDqB0bHi/xxiia4ubq6XiPBGC67s4ybaNtL7AOTbisJizVi2HpnE7JXEyhw4gCcGDK7sw61MOQPhiA+dumK6BlGnQ0XBaJzbBuxgDmbpOJXMeKG+hTLUT4f6RLIL7Mv6MWSXxziZcu+e8COKmOJ3Vc+Y7dp2ciN/N0JNgC03VXlqsm79gwBtagCZexCUvlPWD5nE7JXDyQ8Tf1trE+BUxXk3Wo76dPBmDe2iicnRodDQGWQ3EDS/BwJkAiJ32pBQnfU+LrSryai6v/nr+5+3SyOnBodVypJwr9fwKnk2ALTNWSF73b2DAG1sFi9+W8LcBcbQLzUJ/VUyjGsT4FTFWT9dC9AZi7x9KtvTMNOhoCLIv9Hpbg7ZkAxQ30pXZc+OJcvmvDf1DiHVHYAPSnjlNfnu7ka2MNN9OmW+wDYFhXSzwbgGVrwkVNJdkUuBjFSczJoxlfG+tTwDStKYGnFjYYi4G5qocJHYUpsa4FsCxNYP7q+8kmI1PcQB9ql4X/s8Q/zsW7Nty++/fURKaXAtCfWtxQx5tvTTfeXKYoi2WrJzJJsAWmpsnyPRKAZXOSz8XZAIZ52wTmoz5zpvDMrutT2wBMy9rmNMZiYI7adIcJMS2bAABMzyYjU9xAH2rHhS/K5a+vv1DilThJHehfHbdq54aHo7iB09VuQlpOA1Oz9A3kbboTpQDgeoobls3ca9k2gXmp8677Mw0PxhgJTE+TddG9AZib++Idcop0NARYliawDA9kZIobOLRajPBtJb5x9/VF1GKGTyrxm6OwARhOLWp4vMRHxNjDzbWxaQFMzxpOx6sFiLrnAEulc8PF2QBeNkkXyzaVJHE4j6k8d9pYnwIY2zYO4wDmo747tmGKHNwBAExRk5EPKFLcwKHVa+pXpDsF/SJqcvFLJf7Z7hNgKPvx5xti/OF0Wk4DjEP3HGCpFDdcnA1gmK97AvNTi3Km8ty2PgVMzRrnNVcjWRiYvqN04xXTU9e1rAsCLMvdgeXYZESKGzik2qnhn5T49hIv52LqNfnrS3xynJwODK+OOz+9xC/IxYu0WIcHI8EWmI61LH63cTopAMeaaPEMc1XfXzeB+anX7pQK62oBeBuAaVhjcmbdI3gwANPVxpr6lG0CADBdo3axVdzAIdXr6Zfk4gnB9Z+rRRF/pcSrARhHLdT6++nGI89JbqZNt4EMMAVr2jyup5M+FQDQtWENFJQv1yYwX/dnOiTVAoxvW+LJAEyTYthpGzVhkN40AdasCSzHJiPmokja5FBqEvBfKvHDuXjXhvrPfXW6xGLXJjCWOv7UDg5/InC6bZx2AjCGh2NDBlgWCdwXo7hh+dwby7UJzNfbMy3bEo8EgDFdjbUqYHrqHuazYcqaALA0a+xox7JdyUgkkHMItRihdl14oMRtuZiaSHx3iV8R1yUwvjqW1U3Bj8rFu9GwDlfTbSIDMJya6HhfJDwCy1DHMhvNF+N0O5gv9y9z1mR6SUg63AGMSycdYGqeTreHyXTV5FcHdwAsj+IGlmaTkUgi51B+fboE4FdyMS+VeGb3CTC2WtywH5cu2o2G9dDSFWB4bWwaA/O2TVdQ/ZYolgXWpYkEDuZvk+nR4Q5gXNsSTwZgfG109pqDJgAsjcIGlmi0g4oUN3BZNen3+0r8tVy8sKFeh78w3Yb+6wIwDXU8+tklPjO6N3A6J4gDY2uzTvX0qccCMB/1fbEmu9y3iyfiHfIyJA7BPG0C8zfF7iPWpwDGVwvNdOYDxuZQtnmoz4ttAFga6zIsTS3a2WQEihu4rJrw+/N2n6/m/Orp6LUo4mty8eIIgL7UAq5/HN0buLU23WIhwFBOJsi2Wa+rJZ4KwLTVMbsWY9VDHWqyyzYcQi1ya8OS2QhapikmhcN5bTJNbaxPAcOq72tH6dantqGq47D3WGAsdf1JkdV8OLwJYFnqPED3JJZolE7Mihu4jFqM8L+W+Ne5eOJvvQa/dPfpegSmphZufVyJXx7dG7i1bUxUgP5JkH0tp+IBU7VNl+RzV7piLAkuh2cTeNncM8u0Ccxfs4sp2sb6FNC/k+tTD8b61EltjMPAOOphSFfDnGzjGQqwNEdxKBPLs8kIJJNzUbWwoV4/vyIXT/it/3wtivjTAZiu2pXmf043Xt0WON0TkWAF9GMbCbI3U38Wa+9gAUzHPsmnjtdOL+3fUYz/MCf1hKcmsAybTJf1KaAv23SdCaxPne4oXZIxwFDaKGyYK+/tAMvzYGBZRunGrLiBi6rXzhelK2y4aNeGmiT8x3NcKAEwRXV8+sgSvyWKGzibqyWeCsDl1Q3iuhF6XyTI3ooCB2Bs23RJPvXk0quR5DMkm8AwH5vAcozSjv0crkZiLXAY169PPR3OQqdRYChtuvHZWtQ8bWPvB2BptjG2syxvygiHFtUkzVcD51OLGb61xOfk4tdQTRZ+ZffPvhoJw8C01XGqjlmvi2cnZ/dMJG4AF9OmK5Kqp23akDifpsR7002wAfpWx+g6Xtfknm0Y0/viNPglqicCexdaFvNklqQmrL4103dU4oEAnN++qMH61MU16d5/mgD0px62ofBs3jbpnhcsQ31/ejjA2m1ibGdZakeSowzIafmcV03urd0a6qlENcn3Mgm+f3H371PYAEzdbbv4XTFmcXZ1MdHJTMB5bNOdsOTU74tr45QqoH/bEo+kG68fjsKGKdC9YZk8z5elFp9uAsvRZB6cHA6c1zbd2kotNL0a72SX0aZLAAHoS10PUdgwf9tYX1ySOwPQjes6arIkg3exdfo051WLEX5riXeWeCkXc7JrA8Bc7DvN1AIvz0/OqiZv1BPEmwDc2P4UvKN0G54cxv0l3hWAw9GlYfqcCL88DhdYFu9nLFEtdGwzfXV9qj4nB9+EBGZjP985ioKoPtRCs8cDcFhOh1+WTZzwvRRHUdwIdOp6zPt2nzB3g3ex1bmB83i5xHeW+O93X19GLY54JQDzsU+q+LJIsODs6qZQPeWqDcC1tjk+9ftqjBOHVpOPLR4Dh7CNLg1zoXsDTFvd/HDyM0uzyTxYnwJuZptr5zsKG/rxRJzaChxWm25fgeXYxrojwNLU9Rj7FixFk4E5eZqzqoUItRjmDemuGV0bgDXSvYGLatKdttEEWLuadF83M7dhCFfSFVYDnEddcN7GeD1Hujcsi4MFlkf3BpZmbqflNrE+BXS26ZJstmFI5ivAIbRRuLpUTboTvpm3ozh8C7iWeQBLMWgXW50bOKt6rfyGXK6wYe9PRtcGYJ5u28V/GkkWnE8bC42wZvtTGe4q8Y7YOB7SUSwiA2dXTymt43VdnDNez5NTkJbDCf/LtC/0haVoMi9trE/Bmp1cn6pjwTYMrc4zdccALquOJW1YorbEUwFgaepetfVuluDeDEhxA2dRCxHeW+Kvlng5F3fb7t/1OyIpGJivWuRVWwgr0uK82thAhrXZprvv66bx1Vi0GMtRFDgAN1fH5ppsW8frt8Z4PXfbSNJaCvfhcl2NeTHLcU/mp431KVibbaxPTUX92UtKBi7jkSiSWrraGc6zGmBZ2jiYiWVoMiDFDdxK7dJQr5OfVeJ16ZJ6L6oWNPwX6RKCFTcAc1XHxI8o8atL3BE4nzY2kGHp9qfg1QRZp+BNx1EUOADX0qVhuYz3MG37pD7JGixBk3lq081XJcbBctXnbO2WdF+sT01NG3sEwMXUdawnwtLtn+EALEt9hm8D8zboQS81wfwyyeqsw+eV+MZcvmvDq7uoxQ0Ka4A5q+PYiyXeHLiYpsS7MnDLLqBX2xLvTpdEL1Frujbpxt83BVijOj5v020QbsOS1Y2Ch8KctemKj1iuehrl44H5q2NVm3mq86JnYn0KlmQb61NzUcfeOgZbowLOoq5lPRzWoj4b3hfPiLk6isNXgBtrSrw3xnfmqx6U8tYMRII5p6ldG/6HEt+QyxU2VLW44VfuvnbdAXNXx7HawvlnxZjGxbRxQh4swfWn4D0RG8dTt033u/J7gnXRpWF9rsZYP3d+f8tX352dRskSNJmvOtbW+dHTAeas3sv1PrY+NS91nnpfAG6tjhcKG9Zl3yEcgGVpY3xn3gYtzJGQyc3UYobvK/Gb0xUmXFY95fwv7j4BlqCOZ/9jjGtcXF2YqhWtTwWYmzbHSbJ1U2Eb5mR/okAbYMlOJvjUe/5qJPisiU3g+XO/rkN9l1b0z9w1mbc63tbiT8VGMD/7d15F3PNV34Oc7Aycpk03xrM+tVhxG+borgDcnPGdOWsyYIGD4gZupHZsuKPEp5R4XS6fuFuvs59R4hPimgOWo45nn1XizTG2cTlXIvEK5mKbLkm2bhpfjaS7OWvT/S7bAEuzLfFIJPjQbRK0AaaujtVtYL6aLEMtNrI+BfOwTbemURPnrsb61NwdRYEDcGNtrGGvnffzebozAKezHsqcKW5gNK+mK2j4gnQdG17K5enaACxVHdf+bLqxEy7jaixQwVTtT8GrG8Z1I2EblqJN9zt1WjDMXx2r62nD9+3iiUjwoSNJCKavTbehZ9xmru7OclyN9SmYKutTy3YU4y9wrX13rTas2TZdZ1oAlqU+5+1dMFdNBqK4gevVBN0/UeLrSrycy6vX2EeX+Ly43oDlqePar0lXDHZb4HKupjtlGJiGbZyCtwZtut/zUwHmaJvjLg0PR4IPr7WN6wLmoBabmg/DNFyNDXaYkm2sT63F1ShwAI7V9zGH8lDVubLnP8DybOP9n3nSuYFR1GKGbynxu3PYJN1Ho2sDsFy1KOw3RnEDh1FPGX5rnMQCY3EK3jrV3/uVWECCudClgfOqCQGukfl5MazNUbyPMS/bdM+YJRYCHMX6FIxpvz5V70PrU+tyNd6HgC6Z3Wn97LXp1kIBWJ6r8cxnPrbp1igGu2ZrIuargeTDJe7YxetKvJTDqUUTTjUHlqoWb9XNho8LHE5T4pkM2M4LVm6bbnG4fkp+XLd68vvjAaZom67LSl00M1ZzXlfTHb7BfBzFyeFrVYvWHgpM1zZd4uk2y9fE+hQMaRtzHjpXY/4Ca1XfM68GXut98V4+F9t0yZ8AZ1FPwX9vjPFMV12j2OfSDErnBqpayPD6Em/MYQsbajHDF6S7zhQ2AEtVx7g3l/jJ8VzlcNp0J3M9FaAv15+CZ+OYqibTvSVOKIWp2I/V9b6sY/VRjNVcTB3f2wBzUItNzYWZom2OO0dtsw5tujmzk2KhP9d3pjuKOQ86OMBaKWzgNA6AAFimOv+7L+aBTM9Ruv3Zd2SktVBJmNTOHbWgoRYh/FgO27Gh/rv/dLpTzQGWrI5zfyq6IXFYdfJyJTYx4NC26do614nY1RLPBq7VpltEcm3AeLbp7sO70o3VbeBy6ru1TWCYj1rg4F2MqdhmfUUNJ9VnaL0nrU/BYW1zvD71cNY5vnC6qzH2wprUAu+rgZvbxkEAAEvVxv4F03GUbq2iXpNtRlRP05eISW3zfegihHptvaHEhwKwHrfFs5V+bEq8M1rRwUXVZIy66Fu7M2wDZ3e1xKMBhlCTWN+d7oR9J9TQl3p9PRTmoJ5g/HBYs9qS/ZkS9wbGsU2XVLoNe/V+fFesT8FFWZ/iIq7G2hQsXX0uvCNwa3We/L7dJ9O1TVccD3BedT388cDw9l0ljzKhA+d0bli3l0t8ZYk/mcMn4tbk3i+Nrg3AetRx9IvSjX9waNt0iyBtgPPYxil4XM7VdKcSSLSGfuwXy+p7zlvT3XPuN/p0Na6xufB7ol4DNcGnDQxrm3V3ajhNLUbV5Q7ObxvrU1zc1ejgAEtW36uc1MxZ1XmyZwLActXDmZ4MDGf/blHXK65mYmvxTpder5dK/IsS96QrcumjCOEDJd4cRTTAOtTn6beX+KxAv67GSU1wGqfg0Ycm3cnBTYBD2Kbr0nAUCcwM7/50p04zbXVB/WrAexjD2UanhvO4GutTcBrrUxza1Rh3YWnadId9WBvjvOoceROmqk2XJApwUUclHgj0Z3/43BOZ8Luo4oZ1qoUNP1LizhKv2/31IdVihp9U4jsDsD4fk26M9XylT1fSbWQ0Afa2kShL/+oE/6EAF7FfKKvJPU77ZWw2gadPcQMnNVHgQH+2UdRwUbVg8PG4N+GkbaxP0Z+rUeAAS9FGx3Yurinx3hJvClPURnEDcDl1fK9rofcGDmsWRQ17TtRfn1rIcEe6wobX5/CFDVVN6P3ySOwF1qeOe78l0L+jWPSEat8mr55uVO+JWUzCmLWH07UJbwOcxX6RrI7Rd6VLxFDYwBTUsdw7A8xHG3NgDm+b7rq6LwobLqoWrdafn/c71u7kvMf6FH26WuKRAHPXxvyGy2nT7Y0BsEx1PuldgUPa59XU4rurmcmahc4N6/LhdAUNb0j3e++jsGHvR0t8ZADW5ZUS31/i4wPDuRqnNbE+23SbxvXTZjFjaOL0YDjNtsRT6RLejNNMVS1YezxMVS1AOQpcq4l3MC7vKN1mXhsO6WqsT7E+2+jSwDiulHhngDlqI1mRw9GZdJra6NwAHEYTa6Fczqw6NVxPccN61EKG15V4c4kfKPFy+lGvqc8s8a0BWK96Ku2L8YxlOJt0mxlNYLnqZKsmyh7FqZBMx9VI4IG9bST2MD82gadLcQM3oy07F3UURQ19q/flu2J9imXbr0/VQu5tYDx1zK3vRG8KMBf7U5jtb3AoTYn3xrNgatoobgAOp4kCB85v1kUNe7eHNdgXNtSXpx9Mf4UNe18eCb3AetXx77cGhrVNtyD6VGB5tunardd32XrCsoV/puRqibdGghTrtW9jWu+D+i4y60UyVqkm0LtmYV4kBHEe+428Op+sY34b+lTvS+tTLNU2165PbQPj2o+5bYC5MI/h0Np0a7MALFcb7/2c3X7ftq5dXM3M9790bli+fWFDPb3hW3Z/3bcfLfGRAVin+lz9vhIfHxjHlXSniDeB+XIKHnNTT0aqSd0PBJbPGM3SXEnXBY1p0bmBsziK9y9ubBGnk83clVifYv7MfZiDJk5yhTkwx6VPOpNOSxudG4DDa+K9n5tr061fLGotVHHDsu0LGz63xHPpv7ChXk9NiX8TAO5M1y3Hc5YxNOkStDaBedmWeHe6RX4JKMzRlUjgYbm26ZIE66cxmqV5V4n7w5S8I10iIdzK1XTvX1ApapiWJt09qgiJudnG+hTz0kSiE0yZwgb61pR4b7pDmBhfG8UNQD+aeO/nWm26Tg1HWaDbw1LtCxs+P8MUNux9aSTyAtRx8NcFxtOma01XW6XbgGPq9skn9+1CEgpzdpTuOn4qsAzbdO8Td6W7tmuisTGaJaqJBm2YEmMNZ3U13QYO67aolusL0qYrALc+xRxYn2LO2hJvLfFsgKmp70FHgX616da2AFi2Nt18tQ1r16Z79te10KMslM4Ny3SysOEbMlxhQ/WBEh+X7toCWKv6bP32Ep8VGF8TXRyYpm2cgseyXYkuDszTPqnnKBZIWZdNulOPmIa6SbMNnN2VEo/HSZVro1PDfDTRxYFp2sb6FMtSn4kPBZiCWnx7NTAcz4BpaKNzA9CvJjo4rNU23VroKrpeK25Ynn1hw+dm2I4N9Vq6s8QLAWDvDSU+HJiGh9Ml2Ur0YEx1k7ieaF8nW9vA8jWRwMM8GJ+hYxN4OhQ3cBH3lnhXbOytgaKG+boSReCMz/yHpbuabqwFxqOwgTHUPeD3xrv2FDgQGOhbEwUOa7JN9365zcq8KhYTH9593pOuwGFI9cXsN2eePzchhOgrNjFxZVqadKeQzek+EsuIZ9IV2CiuYa2ulHhf5nXfinXEM+neWY3PcKzeF3O4f5cem8DFNPHeteSohytdjXeXuWtifUqME8/E+hTrUa/1udybQiwtrgbGU4v+53S/LDUAhrAvapvT+CjOF89k5Xslc/lFidPjx3efd2f4woa9b8z8fm5CCNFXvJKunbXiBqboSiR7iP6jJp3UUzQ3Aaom3T0xp/tYLDOeiYQeOE2T7j1mLvf0UuPewMXVZ5z3rmWFooZluhLrU6L/sD7FmtV36vdlXvesEHOPq4HxKXAbPwCGdJR5jZHi1vFMrGP8XwmXHqrz91K6goa7SvzQ7q/H4Fri/9fenYXalt3lAv+qKgm519wbuTfeq9jN2CG+pGywAZulPqslQdAHzYrdgwSiIAj6kJ03fZAYRQQjnhMFRWwqERREdC1bbKlobFDRvUuNYlmYE5tSU3VOOYZjrdq7Tp1zdreaOeb6/eBj7bN2pepkrjXHHHPM8R8DeLFnSj4kME5D2iDrGwKbtUwr7rpZcivA3YbYJpTdq+3x29Pa5pMA53ms5PGwT6+N9orrOyp5S+jZug/zPXF/OVVD2uSrNwc2axnjU1ANMQ4Fu/LWKG5gPOq41mNhXyyACezaUYyDTsEyrU+5DIobJqAWMjxc8j9Lbmc/hQ31e/QpJX8UAO72YSVPB8ZriIcbXF99SPzOknfFjRZcVJ3AUweZrD7Ltmib4XrqRFoTLfdHcQObMiu5Efe8vTlJe5BX+zEmJR+GIcanuD73QHBvQ1p/aBZgW96YVlAHY1GfOzwR/et9UdwA7MNRFDj0ahlFDfc0lq005PJ5NqcD+y/P/tRO2dtK7qSv4ycisot8Y6APdZLtcfo6v2T/WaR9d0zOhqsZYqtQ2XwWaRMWtM1wffUhcC/n/tQyBDZniPO5lxyXzMMhm8f4lFw+ixifgos4Sl/ntkgvmQfG6dH0dS5NKQD7UnfteX/6ajMPOYsoQn+gXj5IeXHqDg3vXX2G+yxsWHsyihtERO5ObRd/O9CPISbZyvmpN8N1JeNZgE2pA03H6astkHFlEZN5YBuGeBCwr2jP2Iaj9HUeHFJq8ck80AwxPiXnx/gUXE0dO+jpXBcZc+q1aBYYN+3+fgKwT0M8dx57FtGPPFddcd9FtS/rz+unS76i5JGS29mv+j26EwDupRajjaEIDS5jSOtMD4FTy5J3p00wuBVgG+Zp24UOgfPVtvjtae3ySYBtmaX1jdmthwLbMY/+1pgsY8t17m8oeTxtxVlYW8b4FFxXbVdr+zoEuKp6DfrCkvcExq8WhL457JJxLWDfhpIbMYF+bN6V9mx3GS5kjJUpcu88t3r9ltVn93D2r3bIbGUmIvLgfHigT/Oo6D70WAUPdm+IVUrl/tEuw35Y5W73gW0a0nYK6OmcmFoW0Z/h4uYxPnXocR8EmzdEf0jkqjmO4iD6UnfH1ObvNgBjcZS+2s+p5kb0H6+klw/40PPs6vWz04oaxlTl+bb0dSxFRHadr4vqfPp2lL7OObl+FiWPpQ14AvsxRJGDnGaRNpFHuwz7czN9tRu9B3bhKH2dF1PIIiYnc3VHUeRwiG1GLTJ1HwTbc5S+2gWRfec4JqbRpyGtYLSXc6336L8CYzKPa8C+ciP6jldWJ1o+H8budtrn9H9LnknbwWFM/qzkkwLAvdT2+9dLPj/QtyHtQccbwlTVbZTrFnh1KzxbKcN41EKjWlA+hEOzLHl32oTqWwH2rT6UXKTtYMr2WSCAXRnSzu0hbNOy5K2x5TrXN8T41NQZn4Ldm6eNPZmICQ+2LPnyGKejX7O0+1+277UlJwEYjyHGQHdlPa5xM64F1za2ahU5zZ20woY/WX1WL8s49XRMRUT2kX8LTMcQq9ZOLYtYORN6MI9VSg8hdeWUo5g8DWM1RFu8ixwHdqtO5LuZvs6TXrKI+022Y4jzdorthV1EYX+GuNcReVC+JzANdVesns69XjMEYJxqn6an9rSnrJ/xGtfYoJ6+AIeU51av3736nMZa2FCrTXs6riIi+8qrAtMyS3vo2Ms5KC+OGyvo1zweNk+xTa6DibMAPajFRz21MT3mOLAf8+hnbSqL6NuwG0OMT/Uc41MwPkfpqx0R2UWOAtNiYuv2MwRgvOZp9+M9tatjjrGNLerpi3AoeXb1+lklD68yRnV7+K9OX8dWRGRf+cK0dhOmZh6TP3rKIiaYwBQMaYMkx+mrDZKXtslWJoU+WeVuuzkO7M8Qq8FfJ4u452Q/ZnF/pK0ANmUWbapITZ2oNg9M0yJ9nY+9ZQjAuA3R579uFDXsQE9fiKnnTsntkqdLXlHySMY/EfYX0tcxFhHZV74vMG3zuPkZa56ImyqYqiGKHHrLIm1StDYZ+neUvtqfnnIc2L96vbaC2cWziInKjMM87o/GGg/9oS9DFHzKYec4bedGmKraJ6vf8x7Oxx4zBKAPR+mrfR1DjG/sUE9fjCnnudXrO1afy8vSh6fS13EWEdlX/jhwGOYxGDaG1Buquq3sLMAhGNIeOJuAN942+SjaZJiim+mrPeolTwTGYUj7PvZ0/uw6N2LSF+M0j/GpMaTeCz0e90LQs3m0p3J4WcTEZA7DEG38tjIEoB9DXA8uEkUNe9DTF2SqeXb1+mlpOzU8nD7Uv2tPx1lEZJ/5YOCwzOMGaB9ZxIrgcMiG2MlhLKkDXDdiEg9MXe1zmfi8+SwC43KUvs6hXeRGTNagD/O4P9pHFjE+BVMypJ3XPbQ/ItdNXTQKDkktVrdo0uYzBKAv9f699oN6amt3FUUNe9TTF2VqubPKe9MKBXrZrWHtE9LX8RYR2XdeFTg883iIvO3YpQG42xBFDvvKIibxwKEZor3dRlsKYzPEub4u3hwC/ZlHQeIu2gjjUzBtdbzDBFiZaup3ex44TPP0db72kCEAfZrFGOg6ihpGoKcvzJSy3q3hjavPobfChur16euYi4jsO58XOFyzWN1p01nEBFrgwYYoMttF1oNbQ4BDNURbu8ksAuN1lMOb1OdBHlMyi/GpTWcR41NwSIZoR2V6OY5xPaj9uV7O2R4yBKBf9f7+KH21u5vMcYyFjkYvX5qppO7UcLvkb0s+pOSRtF0bevTj6evYi4jsO98WYFZyM32du2OKVfCAq5rHxFvtMbBNj8YqppvKIjBuQw5jUp+iBqZsiPGp67YP7ofgsM1jnEn6zyL6u3DWUfo6h8ecWQD6N+Sw+vzHsZPX6PTy5ZlC1rs1vGl17HvcreGsP01fx19EZJ+pxW2/GmBtiIfIl8kiVsEDNmMeK+xpj4FtqQUOvbRnY86NQB/mmeYDPkUNHJIhxqcuk0XcDwGnhmhDpa/Ufu4irmXwILWAtZdzesyZBWA6jtJXG3zZHEdRw2j18iXqOXWnhjqp9S/T/24NZ30wfX0OIiL7zlMB7jakDZQdp6/zeRexCh6wTbN4AH3RHMcEP+Di5umrjRtjbgT6MWQ6fSpFDRyyIW2i43H6Om931TYYnwIeZB7tp4w3xzm9junnwsXcTF/n+RgzC8C0DJne9WFR8lgYtV6+TL3mudXr61fHu/fdGtZekb4+BxGRMaQWugH3N4+HIDWLWDkI2J0hbTDqOH21lduOCTzAdcxjl5yr5jhWSaJP8/Tbn1LUAC82j/ujmkWMTwEXV9uKo/TVzsk0U/u2j6ddw4YAV2Vhuqtnkba7K8AUzdP/9WERz3+70cuXqresixp+Lm2Xhqns1rD2Cenr8xARGUv+d4DzzHJ4q4KYRAvsW30IPY8HFotYyQ3YnNqWzNIm+dT2pfb5emgLd5njtH7wPCae0L/eJvUpaoAHm8X4FMBlDWkTy3tq+6Tv1GvXIq1fOwuwaUPaqta1j/hE+mofdtkG2SEGODRH6au9rllEf7ErdbL982GT1sfzVslnpD2ge7jkdqblS0p+NgBc1qeWvCfARQxpN0VfkOlOdFqWvDvtYfmtAIzDLG2S6RtyGJbRFgO7U1duG9La2tetfh5yGE7S2tw/SLsvrtHuMkVD2qS+sa7UWM+7t6dNvnAOwvmGnN4fDZmmZdwTAZs1L3lLFDCzHcu0+8p3xX0l7MMsp+Nbr1v9fAiT+mtbU9ucs+Na5n0Ah2xIm88z9ufJy5K3rl7piOKGzVlX+NRChq8tuVHysrQdHKboKG1AAoDLWV8jgMuZp90UzdK/Ovj1zrSB92UAxmvIdCfxrCf1LaMtBvavPgB+9Mzr6+56rycnOX3Y+2ROCxpOAodnnnFN6lPUANc3z7TGp+rYVB2jWgZgO44y7eIwdmOZNpl4uYq+LIzPsMrZoof12FZPbuWl41onqz+fBIB7qW19XehlyLgso6iha4obNqPuyvBIyY+WfM3q5zuZ9rFdpq2iDMDlfH/JmwJc1ZB+d3NYxip4QL8eW6Xn3RwUlwG9Whc5DKvXmo/NaX/4Q8/8fhtOzryuH/J+4MyfT84EeLGh5JtL3pz9OUl7kFf7QO5FYTOG9Ds+VSdm1fEphU7ArgzpY0VXxuHsyuh2ZoBpODumNZz5+WNzuqjH+r1tLPJx666crN5fFy/cuusVgKuZZxwLvSyjqGESFDdcz7qo4fdKvrjkX9OO6e1M31+WfFwAuKzfKfmsAJuwnmT7WMbLKnjA1Axpq5SOaRXi8yxzWtTgYShwKIZz/nzW+uHuee8BVzdk95P6TtIe5N0MsE09FILXa/oyp7vXAezDEEUOvNRJXrwzw3sC8NJCh/MKH+41jnUSAPZhnv08R15GUcPkPC+Xzu3V69/k9CR8JIflmfT1mYmIjCV/F2DThrQbpCcynnO9/l2Osp0VRgDG4tG0yXLHGU/7u84ibZVk7TAAMCbzbL/v9MTqvwPs1pB27tV7kTHcE9W8P8angPEZ0saTxtJWym6vS4u03YNqYaDrEwDANA1p4xG1/7ftPmbtX87CJI3lRqaHrIsa/rHk01bH79CKGqqH09fnJiIyptTiMGB7hrSB8ePs5xx/PG6cgMM0S3swvYtBqvtlPXHn0QAAjNs8m79vXcT9KIzFkFZsvenzXHsATMkQRQ5TztlChnn62QEWAIDNGbK9Pn/ta87CpI3pBmesWRc1PF3yuavjdohFDWv/K319fiIiY8vLA+xCndy6i0IHq+ABvFhdee1mdlPoUP8bta2fBQCgL0NaP+a6/aFF9IVgzIxPATzYkP0uWCSbuQYtcrojwxAAADg1ZHNFDjeiv3kwxnbjM6asixqeKvmc1fGqRQ0P5bC9Nn19jiIiY8urAuzaNh4kL2ICCcB5tlHoUP9d651yTNwBAHo35GoP99yTQn/W41NPxPgUwL3M09rIfe4MKg/Ocdq4nB0ZAAC4rCFXL3K4EX3Pg1In6T8f7nan5OG0G7MvK3lvWlFDfd/xSr6o5JcCwFV9VMn7AuzLkDbZtvbzZrmcWyVvTxu4vxUALmOW9tDzC3K1wadlybvTBr20wQDA1Axpq66/4Zx/blny1tUr0K8hxqcAzjOkLWxxNuv3Xp3T8aWzv+P6bq3ynpInV681J3HdAQDg+oZcbBy09j3fmTb+cRIOiuKGU+sKn1rU8KslX1ny92lFDbfDWfO0SigAruYzS343wBgMaQ+Qax402XYZk0cANqmuWDrL+RN5llHQAAAcltpPelte2kdaxn0pTFWdkFsLHWYxPgVwXR96gbz6zM/VcNfr1J3ktHjhA3f9+VZMHAMAYDeGtCKHu8dCLOqA4oa03RjWx+EHS7615JnVe3fCvbwlrVEB4GpeX/IzAcZoljaR5MtWr26YALavPkiepU3meV1am/sr0f4CAIdtljYWX5nMDIflbDH4enzqXWmTTgHYvruLIXLOz68+878d7vPvygXfv5+Tc95b/1yLFW7dIydnfgYAgDEZ0sZB3py26J1nxBx0cUMtXKi7NDxd8qaSn0g7HooazvfDJW8MAFdVrzvfHwAAAAAAAAAAAAD+W53c/1wORy1aWBdz/HzJR5d8WMlP5rTQQ2HD+T4xAFzH/w8AAAAAAAAAAAAAL6jFDf+QaXs+pwUNT5V8VckjJV9a8r7V+2eLHjjfawLAdXx8AAAAAAAAAAAAAHhBLW74rUxvYv/ZgoZ/Kfmukv9T8hFpuzQ8f9c/w+W8KgBcxysCAAAAAAAAAAAAwAtqccMPZRrOFir8e8mNko8peXXJt5d8YPU7uzRcn0m5AFdXr0HvCAAAAAAAAAAAAAAveCitwOF22mTLh9KXdZFC/Xv/c8mPlXxnyZM5/f+ikGHzavHIKwPAVfV2vQUAAAAAAAAAAADYqlrYUCf//3D6LAL4u7RdGV6TtkPDN5X89ep3z0dhAwDjUncPqjsLPRwAAAAAAAAAAAAAXrDeuaFOtqyFAHUHh0cyPutdJf615JdLvrfkN0r+I3Zo2LX1Th8AXM5zJS/Li6+9AAAAAAAAAAAAAKRNsryzev30kt9f/XksK0o/U/KbJTdLfr7k/TktZlhT1LBbjjfA5dW2s15rPzOtiFCRGAAAAAAAAAAAAMAZZwsFakHD15a8I/srcHi65BdLfqTkt0punfld/buaWL9/dXLuswHgota7D319yY3YsQEAAAAAAAAAAADgJR66x8+vL/nJtFWlH8l21Imd/1jy2yU/VfLrJU+u3j/7d1LMMD6vLPn3AHARz6UVhX1FyU+v3nNtAwAAAAAAAAAAALjLQ/d4rxY0vKbkD0v+X663i8MHS54q+eOSZcmvlfxJyftDr/5HyTMB4EHWxXr/VPLJade9+p7CBgAAAAAAAAAAAIB7eOg+79cCh7pzw6zkB9ImZp5VJ2jWwoV/S9uB4e9L/rzk91avf5E2ofM/7/PfNLmzX4obAF6qXtfOXlP/quQbSn45beeG5wIAAAAAAAAAAADAfT10gd/XCZuvLPnIkn9Om9heixZM1DxMLy/5jgBwt/elFfj9btq1su569HwU9AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH7b8AWy02hKuHEgQAAAAASUVORK5CYII=';
    
    // ── app/favicon.ico ──
    files['app/favicon.ico'] = '__BASE64__AAABAAMAEBAAAAEAIABoBAAANgAAACAgAAABACAAKBEAAJ4EAAAwMAAAAQAgAGgmAADGFQAAKAAAABAAAAAgAAAAAQAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/6SkpP+fn5//ISEh/2VlZf/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/6CgoP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/Q0ND//////+fn5/9SUlL//v7+//////////////////////+IiIj/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/0NDQ////////////f39//4CAgP/9/f3////////////BwcH/DQ0N/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/9DQ0P///////////56env8AAAD/KCgo/1xcXP9fX1//paWl/7Ozs/8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/Q0ND///////////9qamr/AAAA/wAAAP8UFBT/4+Pj///////Q0ND/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/0NDQ///////FxcX/CAgI/wAAAP8AAAD/eXl5////////////0NDQ/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/3h4eP9oaGj/UlJS/2JiYv8mJib/AAAA/52dnf///////////9DQ0P8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8SEhL/zc3N/////////////Pz8/29vb/9zc3P////////////Q0ND/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/kJCQ///////////////////////7+/v/MDAw/9ra2v//////0NDQ/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/6Ghof/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/0hISP8WFhb/kpKS/6Ghof8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAAACAAAABAAAAAAQAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/xUVFf9ZWVn/UlJS/y4uLv8YGBj/BAQE/wAAAP8AAAD/AAAA/wEBAf81NTX/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9aWlr/FRUV/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/1paWv/8/Pz//v7+//Pz8//Gxsb/gICA/ycnJ/8BAQH/AAAA/wICAv+AgID//f39///////////////////////////////////////////////////////////////////////////////////////8/Pz/UlJS/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY///////////////////////+vr6/9PT0/9LS0v/AgIC/wAAAP9oaGj/9/f3///////////////////////////////////////////////////////////////////////////////////////6+vr/OTk5/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////7+/v/k5OT/RUVF/wEBAf88PDz/5+fn///////////////////////////////////////////////////////////////////////////////////////Y2Nj/Hh4e/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY//////////////////////////////////+/v7/3t7e/zExMf8NDQ3/urq6//////////////////////////////////////////////////////////////////////////////////z8/P+Xl5f/CgoK/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY////////////////////////////////////////v7+/7i4uP8LCwv/Pz8///n5+f///////////////////////////////////////////////////////////////////////////+jo6P9AQED/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY////////////////////////////////////////////+vr6/9KSkr/AgIC/39/f//19fX/////////////////////////////////////////////////////////////////9/f3/4GBgf8CAgL/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////////////////////v7+/+EhIT/BAQE/xAQEP+Ojo7/9fX1///////////////////////////////////////////////////////u7u7/hISE/wgICP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////////////////////////+srKz/Dw8P/wAAAP8NDQ3/ZWVl/+vr6//+/v7//////////////////////////////////v7+/+Tk5P9dXV3/CQkJ/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY//////////////////////////////////////////////////AwMD/FhYW/wAAAP8AAAD/AQEB/xoaGv+JiYn/0dHR/+Li4v/o6Oj/6Ojo/+Li4v/Nzc3/goKC/xsbG/8cHBz/Pz8//3R0dP+Wlpb/Pj4+/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY//////////////////////////////////////////////////CwsL/FhYW/wAAAP8AAAD/AAAA/wAAAP8BAQH/EBAQ/y8vL/8/Pz//Pz8//y0tLf8PDw//JSUl/4GBgf/MzMz/+fn5//7+/v/+/v7/Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////////////////////////+zs7P/EhIS/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wEBAf9DQ0P/z8/P//v7+///////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////////////////////7+/v+SkpL/BwcH/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AQEB/zo6Ov/c3Nz/////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////////////////////Hx8f9cXFz/AQEB/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8BAQH/JCQk/9HR0f/+/v7/////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY////////////////////////////////////////////9PT0/8YGBj/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8FBQX/qKio//7+/v//////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY///////////////////////////////////////8/Pz/1dXV/8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP89PT3/5+fn////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////////////////////7+/v/w8PD/fHx8/wMDA/8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wMDA/95eXn/+vr6////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY////////////////////////v7+//Pz8/95eXn/CwsL/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wwMDP+ioqL/////////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/2NjY/////////////z8/P/u7u7/ysrK/0tLS/8CAgL/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/xQUFP+7u7v/////////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/0RERP+qqqr/np6e/4CAgP9OTk7/ERER/wMDA/8eHh7/Pz8//09PT/9LS0v/NjY2/xISEv8AAAD/AAAA/wAAAP8AAAD/AAAA/xYWFv/AwMD/////////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wYGBv8PDw//CwsL/wMDA/8BAQH/NTU1/6ioqP/b29v/6Ojo/+7u7v/s7Oz/5eXl/9LS0v+BgYH/ExMT/wEBAf8AAAD/AAAA/xMTE/+3t7f/////////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/xQUFP+CgoL/8/Pz//7+/v/////////////////////////////////+/v7/3t7e/0pKSv8ICAj/AAAA/woKCv+cnJz/////////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/FhYW/6Ojo//4+Pj//////////////////////////////////////////////////////+vr6/9ra2v/CAgI/wICAv9ubm7/9/f3////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8ICAj/oqKi//z8/P/////////////////////////////////////////////////////////////////q6ur/RERE/wEBAf8uLi7/4eHh////////////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wEBAf9VVVX/7u7u////////////////////////////////////////////////////////////////////////////1tbW/w4ODv8BAQH/jY2N//z8/P//////////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/w4ODv+oqKj//v7+/////////////////////////////////////////////////////////////////////////////v7+/21tbf8AAAD/FBQU/7i4uP/9/f3/////////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/yMjI//j4+P//////////////////////////////////////////////////////////////////////////////////v7+/8bGxv8ICAj/AAAA/yUlJf/BwcH//f39////////////////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/0FBQf/9/f3//////////////////////////////////////////////////////////////////////////////////////9/f3/8mJib/AAAA/wAAAP8lJSX/tbW1//Ly8v/+/v7/////////////////Y2Nj/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/1RUVP/8/Pz//////////////////////////////////////////////////////////////////////////////////////+fn5/84ODj/AAAA/wAAAP8AAAD/Dg4O/11dXf+rq6v/5OTk//z8/P/8/Pz/Wlpa/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/xQUFP9aWlr/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/2NjY/9jY2P/Y2Nj/1tbW/8YGBj/AAAA/wAAAP8AAAD/AAAA/wEBAf8PDw//IyMj/z8/P/9TU1P/FBQU/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8BAQH/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

    return files;
}
