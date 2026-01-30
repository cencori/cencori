"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
    Shield,
    Plus,
    ChevronDown,
    ExternalLink,
    LogOut,
    Settings,
    User
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
    SidebarFooter,
} from "@/components/ui/sidebar";

interface ScanLayoutProps {
    children: ReactNode;
}

interface ScanProject {
    id: string;
    github_repo_full_name: string;
    last_scan_score: string | null;
}

const scoreColors: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-blue-500",
    C: "bg-yellow-500",
    D: "bg-orange-500",
    F: "bg-red-500",
};

export default function ScanLayout({ children }: ScanLayoutProps) {
    const pathname = usePathname();
    const [projects, setProjects] = useState<ScanProject[]>([]);

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

    return (
        <SidebarProvider defaultOpen>
            <div className="flex h-screen w-full">
                {/* Sidebar */}
                <Sidebar className="border-r border-border/40 bg-sidebar">
                    <SidebarHeader className="border-b border-border/40 px-3 py-2.5">
                        <Link href="/scan" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <span className="text-[13px] font-medium">Cencori Scan</span>
                        </Link>
                    </SidebarHeader>

                    <SidebarContent>
                        <SidebarGroup className="pt-3">
                            <div className="flex items-center justify-between px-3 mb-2">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Projects
                                </span>
                                <Link
                                    href="/scan/import"
                                    className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                >
                                    <Plus className="h-3 w-3" />
                                </Link>
                            </div>

                            <SidebarMenu>
                                {projects.map((project) => {
                                    const [, repo] = project.github_repo_full_name.split('/');
                                    return (
                                        <SidebarMenuItem key={project.id}>
                                            <SidebarMenuButton
                                                asChild
                                                size="sm"
                                                isActive={pathname.includes(`/projects/${project.id}`)}
                                            >
                                                <Link href={`/scan/projects/${project.id}`}>
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        project.last_scan_score
                                                            ? scoreColors[project.last_scan_score]
                                                            : "bg-muted-foreground/30"
                                                    )} />
                                                    <span className="text-[13px] font-mono truncate">{repo}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    );
                                })}

                                {projects.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground px-3 py-2">
                                        No projects yet
                                    </p>
                                )}
                            </SidebarMenu>
                        </SidebarGroup>
                    </SidebarContent>

                    <SidebarFooter className="border-t border-border/40 p-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start gap-2 h-8 px-2 text-muted-foreground hover:text-foreground"
                                >
                                    <div className="h-5 w-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                        <User className="h-2.5 w-2.5 text-white" />
                                    </div>
                                    <span className="flex-1 text-left text-[13px] truncate">Account</span>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuItem className="text-xs cursor-pointer">
                                    <Settings className="h-3 w-3 mr-2" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-xs cursor-pointer" asChild>
                                    <a href="https://cencori.com" target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3 mr-2" />
                                        Cencori.com
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-xs cursor-pointer text-red-500 focus:text-red-500">
                                    <LogOut className="h-3 w-3 mr-2" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarFooter>
                </Sidebar>

                {/* Main content */}
                <main className="flex-1 overflow-y-auto bg-background">
                    {children}
                </main>
            </div>
        </SidebarProvider>
    );
}
