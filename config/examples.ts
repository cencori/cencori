/**
 * Example Projects Configuration
 * 
 * Defines all example projects that showcase Cencori's capabilities.
 * Each project links to its GitHub repository.
 */

export interface ExampleProject {
    id: string;
    name: string;
    description: string;
    repoUrl: string;
    demoUrl?: string;
    stack: string[];
    category: 'app' | 'api' | 'agent';
    featured?: boolean;
}

export const EXAMPLE_PROJECTS: ExampleProject[] = [
    {
        id: 'repokeet',
        name: 'Repokeet',
        description: 'chat with any GitHub repository.',
        repoUrl: 'https://github.com/bolaabanjo/repokeet',
        demoUrl: 'https://repokeet.vercel.app',
        stack: ['Next.js', 'Cencori SDK', 'Tailwind CSS'],
        category: 'app',
        featured: true,
    },
    {
        id: 'ai-chat-starter',
        name: 'AI Chat Starter',
        description: 'Multi-provider chat application with streaming, provider fallback, and cost tracking.',
        repoUrl: 'https://github.com/bolaabanjo/wisc',
        stack: ['Next.js', 'Cencori SDK', 'Vercel AI SDK'],
        category: 'app',
        featured: true,
    },
    {
        id: 'rag-knowledge-base',
        name: 'RAG Knowledge Base',
        description: 'Chat with your documents using retrieval-augmented generation.',
        repoUrl: 'https://github.com/cencori/rag-knowledge-base',
        stack: ['Next.js', 'Cencori SDK', 'Pinecone'],
        category: 'app',
    },
    {
        id: 'provider-fallback-demo',
        name: 'Provider Fallback Demo',
        description: 'Demonstrates automatic provider failover when primary provider is unavailable.',
        repoUrl: 'https://github.com/cencori/provider-fallback-demo',
        stack: ['Node.js', 'Cencori SDK'],
        category: 'api',
    },
    {
        id: 'cost-tracker',
        name: 'Cost Tracker Dashboard',
        description: 'Real-time AI spending dashboard with per-request cost breakdown.',
        repoUrl: 'https://github.com/cencori/cost-tracker',
        stack: ['Next.js', 'Cencori SDK', 'Recharts'],
        category: 'app',
    },
    {
        id: 'langchain-cencori',
        name: 'LangChain + Cencori',
        description: 'Use Cencori as the LLM backend for LangChain applications.',
        repoUrl: 'https://github.com/cencori/langchain-cencori',
        stack: ['Python', 'LangChain', 'Cencori SDK'],
        category: 'agent',
    },
];

export function getExamplesByCategory(category: ExampleProject['category']): ExampleProject[] {
    return EXAMPLE_PROJECTS.filter(p => p.category === category);
}

export function getFeaturedExamples(): ExampleProject[] {
    return EXAMPLE_PROJECTS.filter(p => p.featured);
}
