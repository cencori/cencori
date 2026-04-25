/**
 * TanStack Template
 *
 * Generates all files for a Vite + React + TanStack Query project
 * pre-wired to Cencori via the cencori/tanstack adapter.
 */

export interface TemplateOptions {
    projectName: string;
    includeChat: boolean;
    apiKey: string;
}

export function getTanstackTemplate(options: TemplateOptions): Record<string, string> {
    const files: Record<string, string> = {};

    // ── package.json ──
    files['package.json'] = JSON.stringify(
        {
            name: options.projectName,
            version: '0.1.0',
            private: true,
            type: 'module',
            scripts: {
                dev: 'vite',
                build: 'tsc -b && vite build',
                preview: 'vite preview',
            },
            dependencies: {
                cencori: '^1.2.0',
                '@tanstack/react-query': '^5.90.0',
                react: '^19.0.0',
                'react-dom': '^19.0.0',
            },
            devDependencies: {
                '@types/node': '^20',
                '@types/react': '^19',
                '@types/react-dom': '^19',
                '@vitejs/plugin-react': '^4.0.0',
                typescript: '^5',
                vite: '^6.0.0',
            },
        },
        null,
        2
    );

    // ── tsconfig.json ──
    files['tsconfig.json'] = JSON.stringify(
        {
            compilerOptions: {
                target: 'ES2020',
                useDefineForClassFields: true,
                lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                module: 'ESNext',
                skipLibCheck: true,
                moduleResolution: 'bundler',
                allowImportingTsExtensions: true,
                isolatedModules: true,
                moduleDetection: 'force',
                noEmit: true,
                jsx: 'react-jsx',
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true,
                paths: {
                    '@/*': ['./src/*'],
                },
            },
            include: ['src'],
        },
        null,
        2
    );

    // ── vite.config.ts ──
    files['vite.config.ts'] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
`;

    // ── .gitignore ──
    files['.gitignore'] = `node_modules/
dist/
.DS_Store
*.local
`;

    // ── .env ──
    files['.env'] = `# Get your API key at https://cencori.com/dashboard
CENCORI_API_KEY=${options.apiKey || ''}
`;

    // ── index.html ──
    files['index.html'] = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${options.projectName}</title>
    </head>
    <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
`;

    // ── src/main.tsx ──
    files['src/main.tsx'] = `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>
    </StrictMode>
);
`;

    // ── src/app.tsx ──
    if (options.includeChat) {
        files['src/app.tsx'] = `import { Chat } from './components/chat';

export function App() {
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
        files['src/app.tsx'] = `export function App() {
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
                    Your Cencori client is ready. Import from{' '}
                    <code>@/lib/cencori</code> and start building.
                </p>
            </div>
        </main>
    );
}
`;
    }

    // ── src/index.css ──
    files['src/index.css'] = `*,
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

    // ── src/lib/cencori.ts ──
    files['src/lib/cencori.ts'] = `import { Cencori } from 'cencori';

/**
 * Shared Cencori client instance.
 *
 * All API calls import from here — one client, every primitive.
 * When new Cencori products ship (Compute, Workflow, Storage),
 * they're accessible from this same instance.
 */
export const cencori = new Cencori({
    apiKey: import.meta.env.VITE_CENCORI_API_KEY,
});
`;

    // Update .env to use VITE_ prefix
    files['.env'] = `# Get your API key at https://cencori.com/dashboard
VITE_CENCORI_API_KEY=${options.apiKey || ''}
`;

    // ── src/lib/use-chat.ts — lightweight chat hook ──
    if (options.includeChat) {
        files['src/lib/use-chat.ts'] = `import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { cencori } from './cencori';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

/**
 * Lightweight chat hook using TanStack Query + Cencori SDK.
 *
 * For streaming, use the cencori/tanstack adapter directly.
 * This hook provides a simple request/response pattern.
 */
export function useChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');

    const mutation = useMutation({
        mutationFn: async (userMessage: string) => {
            const newMessages = [
                ...messages,
                { id: crypto.randomUUID(), role: 'user' as const, content: userMessage },
            ];

            const response = await cencori.ai.chat({
                model: 'gpt-4o',
                messages: newMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            });

            return { userMessage, assistantMessage: response.content };
        },
        onMutate: (userMessage) => {
            const userMsg: Message = {
                id: crypto.randomUUID(),
                role: 'user',
                content: userMessage,
            };
            setMessages((prev) => [...prev, userMsg]);
            setInput('');
        },
        onSuccess: (data) => {
            const assistantMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data.assistantMessage,
            };
            setMessages((prev) => [...prev, assistantMsg]);
        },
    });

    const handleSubmit = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            if (!input.trim() || mutation.isPending) return;
            mutation.mutate(input.trim());
        },
        [input, mutation]
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setInput(e.target.value);
        },
        []
    );

    return {
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading: mutation.isPending,
        error: mutation.error,
    };
}
`;

        // ── src/components/chat.tsx ──
        files['src/components/chat.tsx'] = `import { useRef, useEffect } from 'react';
import { useChat } from '@/lib/use-chat';

export function Chat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } =
        useChat();
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

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
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
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

    // ── cencori.config.ts ──
    files['cencori.config.ts'] = `/**
 * Cencori Configuration
 *
 * Customize your AI settings here.
 * Docs: https://cencori.com/docs
 */
export const cencoriConfig = {
    defaultModel: 'gpt-4o',

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

    // ── README.md ──
    files['README.md'] = `# ${options.projectName}

AI app powered by [Cencori](https://cencori.com).

## Quick Start

\`\`\`bash
# 1. Add your API key
#    Open .env and set VITE_CENCORI_API_KEY=csk_...
#    Get a key at https://cencori.com/dashboard

# 2. Start the dev server
npm run dev

# 3. Open http://localhost:3000
\`\`\`

## Using the SDK

Import the shared Cencori client from \`src/lib/cencori.ts\`:

\`\`\`typescript
import { cencori } from '@/lib/cencori';

// Chat
const response = await cencori.ai.chat({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.content);
\`\`\`

## Learn More

- [Cencori Docs](https://cencori.com/docs)
- [Cencori SDK](https://github.com/cencori/cencori)
- [TanStack Query](https://tanstack.com/query)
`;

    return files;
}
