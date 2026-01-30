"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import {
    Plus,
    ExternalLink,
    LogOut,
    Settings,
    CircleUserRound,
    HelpCircle,
    Book,
    Mail,
    Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sidebar,
    SidebarContent,
    SidebarProvider,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarHeader,
} from "@/components/ui/sidebar";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTheme } from "next-themes";

interface ScanLayoutProps {
    children: ReactNode;
}

interface ScanProject {
    id: string;
    github_repo_full_name: string;
    last_scan_score: string | null;
}

interface User {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
}

const scoreColors: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-blue-500",
    C: "bg-yellow-500",
    D: "bg-orange-500",
    F: "bg-red-500",
};

export default function ScanLayout({ children }: ScanLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [projects, setProjects] = useState<ScanProject[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Check auth
    useEffect(() => {
        const checkAuth = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (!error && data.user) {
                setUser(data.user as User);
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    // Fetch projects
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await fetch('/api/scan/projects');
                if (response.ok) {
                    const data = await response.json();
                    setProjects(data.projects || []);
                }
            } catch (err) {
                console.error('Error fetching projects:', err);
            }
        };
        fetchProjects();
    }, []);

    // Extract current project from URL
    const projectId = pathname.match(/\/scan\/projects\/([^/]+)/)?.[1];
    const currentProject = projects.find(p => p.id === projectId);

    // Build breadcrumb items
    const getBreadcrumbItems = () => {
        const items: { label: string; href?: string }[] = [];

        if (pathname === '/scan' || pathname === '/scan/') {
            items.push({ label: 'Projects' });
        } else if (pathname === '/scan/import') {
            items.push({ label: 'Projects', href: '/scan' });
            items.push({ label: 'Import' });
        } else if (projectId) {
            items.push({ label: 'Projects', href: '/scan' });
            const repoName = currentProject?.github_repo_full_name.split('/')[1] || projectId;
            items.push({ label: repoName });
        }

        return items;
    };

    const breadcrumbItems = getBreadcrumbItems();

    // User avatar
    const meta = user?.user_metadata ?? {};
    const avatar = (meta.avatar_url as string | null) ?? (meta.picture as string | null) ?? null;
    const name = (meta.name as string | null) ?? user?.email?.split?.("@")[0] ?? null;

    return (
        <SidebarProvider defaultOpen>
            <div className="flex h-screen w-full flex-col">
                {/* Navbar */}
                <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/40 bg-background px-4 md:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link href="/scan" className="flex items-center">
                            <Image
                                src="/logo white.svg"
                                alt="Cencori"
                                width={16}
                                height={16}
                                className="dark:block hidden"
                            />
                            <Image
                                src="/logo black.svg"
                                alt="Cencori"
                                width={16}
                                height={16}
                                className="dark:hidden block"
                            />
                        </Link>

                        <span className="text-muted-foreground/50 ml-1 mr-1 select-none text-sm" aria-hidden>
                            /
                        </span>

                        {/* Breadcrumbs */}
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem>
                                    <BreadcrumbLink asChild className="text-xs font-medium text-foreground hover:text-foreground/80">
                                        <Link href="/scan">Scan</Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>

                                {breadcrumbItems.map((item, index) => (
                                    <span key={index} className="contents">
                                        <BreadcrumbSeparator className="text-muted-foreground/50 text-xs">/</BreadcrumbSeparator>
                                        <BreadcrumbItem>
                                            {item.href ? (
                                                <BreadcrumbLink asChild className="text-xs font-medium hover:text-foreground/80">
                                                    <Link href={item.href}>{item.label}</Link>
                                                </BreadcrumbLink>
                                            ) : (
                                                <BreadcrumbPage className="text-xs font-medium">
                                                    {item.label}
                                                </BreadcrumbPage>
                                            )}
                                        </BreadcrumbItem>
                                    </span>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Help Button */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full border border-border/40 bg-transparent hover:bg-secondary transition-colors cursor-pointer"
                                    aria-label="Help"
                                >
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 p-2">
                                <div className="px-2 py-1.5">
                                    <p className="text-xs font-medium">Need help?</p>
                                    <p className="text-[11px] text-muted-foreground">Check our docs or contact support.</p>
                                </div>
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem asChild className="text-xs py-1.5 cursor-pointer">
                                    <Link href="/docs/scan" className="flex items-center gap-2">
                                        <Book className="h-3.5 w-3.5" />
                                        Scan Documentation
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild className="text-xs py-1.5 cursor-pointer">
                                    <Link href="mailto:support@cencori.com" className="flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5" />
                                        Contact support
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {/* User Avatar Menu */}
                        {user ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="w-7 h-7 cursor-pointer inline-flex items-center justify-center rounded-full border border-border/40 bg-transparent hover:bg-secondary transition-colors overflow-hidden"
                                        aria-label="User menu"
                                    >
                                        {avatar ? (
                                            <img src={avatar} alt={name || "User"} className="w-full h-full object-cover" />
                                        ) : (
                                            <CircleUserRound className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 p-1" align="end" forceMount>
                                    <div className="px-2 py-1.5 border-b border-border/40 mb-1">
                                        <p className="text-xs font-medium truncate">{user.email}</p>
                                    </div>
                                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">Theme</p>
                                    <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => setTheme("light")}>
                                        {theme === "light" && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-foreground" />}
                                        {theme !== "light" && <span className="mr-2 h-1.5 w-1.5" />}
                                        Light
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => setTheme("dark")}>
                                        {theme === "dark" && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-foreground" />}
                                        {theme !== "dark" && <span className="mr-2 h-1.5 w-1.5" />}
                                        Dark
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => setTheme("system")}>
                                        {theme === "system" && <span className="mr-2 h-1.5 w-1.5 rounded-full bg-foreground" />}
                                        {theme !== "system" && <span className="mr-2 h-1.5 w-1.5" />}
                                        System
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="my-1" />
                                    <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => router.push("/dashboard/organizations")}>
                                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                        Main Dashboard
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs py-1.5 cursor-pointer text-red-500 focus:text-red-500"
                                        onClick={async () => {
                                            await supabase.auth.signOut();
                                            router.push("/login");
                                        }}
                                    >
                                        <LogOut className="mr-2 h-3.5 w-3.5" />
                                        Log out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button asChild size="sm" variant="outline" className="h-7 text-xs px-3">
                                <Link href="/login?redirect=/scan">Sign In</Link>
                            </Button>
                        )}
                    </div>
                </header>

                <div className="flex flex-1 pt-12">
                    {/* Sidebar */}
                    <Sidebar className="border-r border-border/40 bg-sidebar">
                        <SidebarHeader className="px-3 py-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Projects</span>
                                <Link href="/scan/import">
                                    <Button variant="ghost" size="icon" className="h-5 w-5">
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </Link>
                            </div>
                        </SidebarHeader>

                        <SidebarContent className="px-2">
                            <SidebarGroup>
                                <SidebarMenu>
                                    {projects.length === 0 ? (
                                        <p className="text-[11px] text-muted-foreground px-2 py-1">No projects yet.</p>
                                    ) : (
                                        projects.map((project) => {
                                            const isActive = pathname.includes(`/scan/projects/${project.id}`);
                                            const repoName = project.github_repo_full_name.split('/')[1];
                                            return (
                                                <SidebarMenuItem key={project.id}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={isActive}
                                                        size="sm"
                                                        className="h-7"
                                                    >
                                                        <Link href={`/scan/projects/${project.id}`} className="flex items-center justify-between w-full">
                                                            <span className="text-[12px] font-mono truncate">{repoName}</span>
                                                            {project.last_scan_score && (
                                                                <span className={cn(
                                                                    "w-4 h-4 rounded text-[10px] font-medium flex items-center justify-center text-white",
                                                                    scoreColors[project.last_scan_score] || "bg-gray-500"
                                                                )}>
                                                                    {project.last_scan_score}
                                                                </span>
                                                            )}
                                                        </Link>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            );
                                        })
                                    )}
                                </SidebarMenu>
                            </SidebarGroup>
                        </SidebarContent>
                    </Sidebar>

                    {/* Main Content */}
                    <main className="flex-1 overflow-y-auto bg-background">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}
