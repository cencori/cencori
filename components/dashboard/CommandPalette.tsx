"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    Search,
    Code2,
    Settings,
    FolderKanban,
    Book,
    Sparkles,
    Key,
    BarChart3,
    Shield,
    ScrollText,
    Play,
    Users,
    CreditCard,
    Plug,
    Globe,
    Home,
    Plus,
    FileText,
    Zap,
    Cpu,
    Network,
    Lock,
    Rocket,
    Building2,
    ExternalLink,
    ChevronRight,
    Github,
    HelpCircle,
    MessageSquare,
    Lightbulb,
} from "lucide-react";

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgSlug?: string | null;
    projectSlug?: string | null;
}

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    action: () => void;
    shortcut?: string;
    keywords?: string[]; // For smart search
}

interface CommandGroup {
    id: string;
    label: string;
    items: CommandItem[];
}

export function CommandPalette({
    open,
    onOpenChange,
    orgSlug,
    projectSlug,
}: CommandPaletteProps) {
    const router = useRouter();
    const [search, setSearch] = React.useState("");
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const navigate = (path: string) => {
        router.push(path);
        onOpenChange(false);
    };

    const openExternal = (url: string) => {
        window.open(url, "_blank");
        onOpenChange(false);
    };

    // Command groups
    const commandGroups: CommandGroup[] = React.useMemo(() => {
        const groups: CommandGroup[] = [];

        // ============ PROJECT CONTEXT COMMANDS ============
        if (projectSlug && orgSlug) {
            groups.push({
                id: "project",
                label: "PROJECT",
                items: [
                    {
                        id: "project-overview",
                        label: "Project overview",
                        icon: <Home className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}`),
                        keywords: ["dashboard", "home", "main"],
                    },
                    {
                        id: "playground",
                        label: "AI Playground",
                        description: "Test AI models",
                        icon: <Play className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/playground`),
                        keywords: ["test", "chat", "try", "sandbox", "experiment"],
                    },
                    {
                        id: "api-keys",
                        label: "API Keys",
                        description: "Manage your API keys",
                        icon: <Key className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/api-keys`),
                        keywords: ["token", "secret", "credentials", "key"],
                    },
                    {
                        id: "project-analytics",
                        label: "Analytics",
                        description: "View usage metrics",
                        icon: <BarChart3 className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/analytics`),
                        keywords: ["stats", "metrics", "usage", "charts", "reports"],
                    },
                    {
                        id: "logs",
                        label: "Request Logs",
                        description: "View API request logs",
                        icon: <ScrollText className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/logs`),
                        keywords: ["history", "requests", "debug", "trace"],
                    },
                    {
                        id: "security",
                        label: "Security",
                        description: "Security settings",
                        icon: <Shield className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/security`),
                        keywords: ["protection", "firewall", "rules", "safety"],
                    },
                    {
                        id: "project-settings",
                        label: "Project Settings",
                        icon: <Settings className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/settings`),
                        keywords: ["configure", "options", "preferences"],
                    },
                ],
            });
        }

        // ============ ORGANIZATION COMMANDS ============
        if (orgSlug) {
            groups.push({
                id: "organization",
                label: "ORGANIZATION",
                items: [
                    {
                        id: "all-projects",
                        label: "All Projects",
                        icon: <FolderKanban className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects`),
                        keywords: ["list", "browse", "view"],
                    },
                    {
                        id: "new-project",
                        label: "Create new project",
                        icon: <Plus className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/new`),
                        keywords: ["add", "create", "start"],
                    },
                    {
                        id: "import-github",
                        label: "Import from GitHub",
                        icon: <Github className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/projects/import/github`),
                        keywords: ["repository", "repo", "git", "clone"],
                    },
                    {
                        id: "org-analytics",
                        label: "Organization Analytics",
                        icon: <BarChart3 className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/analytics`),
                        keywords: ["stats", "metrics", "usage"],
                    },
                    {
                        id: "providers",
                        label: "AI Providers",
                        description: "Configure AI providers",
                        icon: <Cpu className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/providers`),
                        keywords: ["openai", "anthropic", "claude", "gpt", "models"],
                    },
                    {
                        id: "integrations",
                        label: "Integrations",
                        icon: <Plug className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/integrations`),
                        keywords: ["connect", "apps", "services"],
                    },
                    {
                        id: "teams",
                        label: "Team Members",
                        icon: <Users className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/teams`),
                        keywords: ["users", "invite", "members", "access"],
                    },
                    {
                        id: "billing",
                        label: "Billing & Usage",
                        icon: <CreditCard className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/billing`),
                        keywords: ["payment", "invoice", "plan", "subscription", "upgrade"],
                    },
                    {
                        id: "org-settings",
                        label: "Organization Settings",
                        icon: <Settings className="h-3.5 w-3.5" />,
                        action: () => navigate(`/dashboard/organizations/${orgSlug}/settings`),
                        keywords: ["configure", "options"],
                    },
                ],
            });
        }

        // ============ QUICK ACTIONS ============
        groups.push({
            id: "actions",
            label: "QUICK ACTIONS",
            items: [
                {
                    id: "switch-org",
                    label: "Switch organization",
                    icon: <Building2 className="h-3.5 w-3.5" />,
                    action: () => navigate("/dashboard/organizations"),
                    keywords: ["change", "select", "workspace"],
                },
                {
                    id: "new-org",
                    label: "Create organization",
                    icon: <Plus className="h-3.5 w-3.5" />,
                    action: () => navigate("/dashboard/organizations/new"),
                    keywords: ["add", "workspace", "team"],
                },
            ],
        });

        // ============ DOCUMENTATION ============
        groups.push({
            id: "docs",
            label: "DOCUMENTATION",
            items: [
                {
                    id: "docs-home",
                    label: "Documentation",
                    icon: <Book className="h-3.5 w-3.5" />,
                    action: () => navigate("/docs"),
                    keywords: ["help", "learn", "guide"],
                },
                {
                    id: "quick-start",
                    label: "Quick Start Guide",
                    icon: <Rocket className="h-3.5 w-3.5" />,
                    action: () => navigate("/docs/quick-start"),
                    keywords: ["getting started", "tutorial", "begin"],
                },
                {
                    id: "api-reference",
                    label: "API Reference",
                    icon: <Code2 className="h-3.5 w-3.5" />,
                    action: () => navigate("/docs/api"),
                    keywords: ["endpoints", "methods", "rest", "sdk"],
                },
                {
                    id: "installation",
                    label: "Installation",
                    icon: <FileText className="h-3.5 w-3.5" />,
                    action: () => navigate("/docs/installation"),
                    keywords: ["setup", "npm", "install", "package"],
                },
                {
                    id: "security-docs",
                    label: "Security Guide",
                    icon: <Lock className="h-3.5 w-3.5" />,
                    action: () => navigate("/docs/security"),
                    keywords: ["protection", "encryption", "compliance"],
                },
                {
                    id: "ask-ai",
                    label: "Ask Cencori AI",
                    description: "Get help from AI",
                    icon: <Sparkles className="h-3.5 w-3.5" />,
                    action: () => navigate("/docs/ai"),
                    keywords: ["assistant", "chat", "help", "question"],
                },
            ],
        });

        // ============ PRODUCTS ============
        groups.push({
            id: "products",
            label: "PRODUCTS",
            items: [
                {
                    id: "product-ai",
                    label: "Cencori AI",
                    description: "Unified AI gateway",
                    icon: <Sparkles className="h-3.5 w-3.5" />,
                    action: () => navigate("/ai"),
                    keywords: ["gateway", "proxy", "models"],
                },
                {
                    id: "product-edge",
                    label: "Cencori Edge",
                    description: "Global edge network",
                    icon: <Globe className="h-3.5 w-3.5" />,
                    action: () => navigate("/edge"),
                    keywords: ["cdn", "fast", "global", "low latency"],
                },
                {
                    id: "product-knight",
                    label: "Cencori Knight",
                    description: "AI security platform",
                    icon: <Shield className="h-3.5 w-3.5" />,
                    action: () => navigate("/product-knight"),
                    keywords: ["firewall", "protection", "moderation"],
                },
                {
                    id: "product-sandbox",
                    label: "Cencori Sandbox",
                    description: "Safe AI testing",
                    icon: <Play className="h-3.5 w-3.5" />,
                    action: () => navigate("/product-sandbox"),
                    keywords: ["test", "experiment", "playground"],
                },
                {
                    id: "product-insights",
                    label: "Cencori Insights",
                    description: "AI analytics",
                    icon: <BarChart3 className="h-3.5 w-3.5" />,
                    action: () => navigate("/insights"),
                    keywords: ["analytics", "metrics", "monitoring"],
                },
                {
                    id: "product-audit",
                    label: "Cencori Audit",
                    description: "Compliance logging",
                    icon: <ScrollText className="h-3.5 w-3.5" />,
                    action: () => navigate("/audit"),
                    keywords: ["logs", "compliance", "trace"],
                },
                {
                    id: "product-enterprise",
                    label: "Enterprise",
                    icon: <Building2 className="h-3.5 w-3.5" />,
                    action: () => navigate("/enterprise"),
                    keywords: ["business", "scale", "custom"],
                },
            ],
        });

        // ============ RESOURCES ============
        groups.push({
            id: "resources",
            label: "RESOURCES",
            items: [
                {
                    id: "pricing",
                    label: "Pricing",
                    icon: <CreditCard className="h-3.5 w-3.5" />,
                    action: () => navigate("/pricing"),
                    keywords: ["cost", "plans", "free", "pro", "enterprise"],
                },
                {
                    id: "changelog",
                    label: "Changelog",
                    icon: <Zap className="h-3.5 w-3.5" />,
                    action: () => navigate("/changelog"),
                    keywords: ["updates", "new", "features", "release"],
                },
                {
                    id: "blog",
                    label: "Blog",
                    icon: <FileText className="h-3.5 w-3.5" />,
                    action: () => navigate("/blog"),
                    keywords: ["articles", "news", "posts"],
                },
                {
                    id: "status",
                    label: "System Status",
                    icon: <Network className="h-3.5 w-3.5" />,
                    action: () => openExternal("https://status.cencori.com"),
                    keywords: ["uptime", "health", "incidents"],
                },
                {
                    id: "discord",
                    label: "Join Discord",
                    icon: <MessageSquare className="h-3.5 w-3.5" />,
                    action: () => openExternal("https://discord.gg/cencori"),
                    keywords: ["community", "chat", "support"],
                },
                {
                    id: "github",
                    label: "GitHub",
                    icon: <Github className="h-3.5 w-3.5" />,
                    action: () => openExternal("https://github.com/cencori"),
                    keywords: ["code", "open source", "repository"],
                },
                {
                    id: "support",
                    label: "Contact Support",
                    icon: <HelpCircle className="h-3.5 w-3.5" />,
                    action: () => navigate("/contact"),
                    keywords: ["help", "email", "ticket"],
                },
                {
                    id: "feedback",
                    label: "Send Feedback",
                    icon: <Lightbulb className="h-3.5 w-3.5" />,
                    action: () => navigate("/contact"),
                    keywords: ["idea", "suggestion", "feature request"],
                },
            ],
        });

        return groups;
    }, [router, onOpenChange, orgSlug, projectSlug]);

    // Smart search: filter items based on label, description, and keywords
    const filteredGroups = React.useMemo(() => {
        if (!search.trim()) return commandGroups;

        const searchLower = search.toLowerCase();

        return commandGroups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) => {
                    // Match label
                    if (item.label.toLowerCase().includes(searchLower)) return true;
                    // Match description
                    if (item.description?.toLowerCase().includes(searchLower)) return true;
                    // Match keywords
                    if (item.keywords?.some((kw) => kw.toLowerCase().includes(searchLower))) return true;
                    return false;
                }),
            }))
            .filter((group) => group.items.length > 0);
    }, [commandGroups, search]);

    // Flatten items for keyboard navigation
    const allItems = React.useMemo(() => {
        return filteredGroups.flatMap((group) => group.items);
    }, [filteredGroups]);

    // Reset selection when search changes
    React.useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    // Handle keyboard navigation
    const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev + 1) % Math.max(allItems.length, 1));
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(allItems.length, 1));
                    break;
                case "Enter":
                    e.preventDefault();
                    if (allItems[selectedIndex]) {
                        allItems[selectedIndex].action();
                    }
                    break;
                case "Escape":
                    e.preventDefault();
                    onOpenChange(false);
                    break;
            }
        },
        [allItems, selectedIndex, onOpenChange]
    );

    // Focus input when dialog opens
    React.useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        } else {
            setSearch("");
            setSelectedIndex(0);
        }
    }, [open]);

    let itemIndex = 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
                <VisuallyHidden>
                    <DialogTitle>Command Palette</DialogTitle>
                </VisuallyHidden>

                {/* Search Input */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Run a command or search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="border-0 shadow-none focus-visible:ring-0 px-0 h-7 text-sm bg-transparent"
                    />
                </div>

                {/* Command List */}
                <div className="max-h-[400px] overflow-y-auto py-1">
                    {filteredGroups.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <p className="text-xs text-muted-foreground">No results found</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-1">
                                Try searching for "settings", "api", or "docs"
                            </p>
                        </div>
                    ) : (
                        filteredGroups.map((group) => (
                            <div key={group.id} className="mb-1">
                                <div className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                    {group.label}
                                </div>
                                <div>
                                    {group.items.map((item) => {
                                        const currentIndex = itemIndex++;
                                        const isSelected = currentIndex === selectedIndex;
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={item.action}
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors cursor-pointer",
                                                    isSelected
                                                        ? "bg-secondary/80 text-foreground"
                                                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                                                )}
                                            >
                                                <span className="shrink-0">{item.icon}</span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="text-xs block truncate">{item.label}</span>
                                                    {item.description && (
                                                        <span className="text-[10px] text-muted-foreground/60 block truncate">
                                                            {item.description}
                                                        </span>
                                                    )}
                                                </span>
                                                {item.shortcut && (
                                                    <span className="text-[10px] text-muted-foreground/60 shrink-0">
                                                        {item.shortcut}
                                                    </span>
                                                )}
                                                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer hint */}
                <div className="px-3 py-2 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground/60">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-secondary rounded text-[9px]">↑↓</kbd> navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-secondary rounded text-[9px]">↵</kbd> select
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 py-0.5 bg-secondary rounded text-[9px]">esc</kbd> close
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
