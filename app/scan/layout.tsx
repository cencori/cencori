"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import {
    ExternalLink,
    LogOut,
    CircleUserRound,
    HelpCircle,
    Book,
    Mail,
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
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTheme } from "next-themes";
import { useScanPath } from "./hooks/useScanPath";

interface ScanLayoutProps {
    children: ReactNode;
}

interface User {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
}

export default function ScanLayout({ children }: ScanLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const { scanPath, isSubdomain } = useScanPath();
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

    // Extract current project from URL (works on both /scan/projects/X and /projects/X)
    const projectId = pathname.match(/(?:\/scan)?\/projects\/([^/]+)/)?.[1];

    // Build breadcrumb items
    const getBreadcrumbItems = () => {
        const items: { label: string; href?: string }[] = [];

        const isHome = isSubdomain
            ? pathname === '/' || pathname === ''
            : pathname === '/scan' || pathname === '/scan/';
        const isImport = isSubdomain
            ? pathname === '/import'
            : pathname === '/scan/import';

        if (isHome) {
            // No breadcrumbs on main page - "Scan" is the wordmark
        } else if (isImport) {
            items.push({ label: 'Import' });
        } else if (projectId) {
            items.push({ label: 'Project' });
        }

        return items;
    };

    const breadcrumbItems = getBreadcrumbItems();

    // User avatar
    const meta = user?.user_metadata ?? {};
    const avatar = (meta.avatar_url as string | null) ?? (meta.picture as string | null) ?? null;
    const name = (meta.name as string | null) ?? user?.email?.split?.("@")[0] ?? null;

    return (
        <div className="flex h-screen w-full flex-col">
            {/* Navbar */}
            <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/40 bg-background px-4 md:px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Logo + Wordmark */}
                    <Link href={scanPath("/")} className="flex items-center gap-2">
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
                        <span className="text-xs font-medium text-foreground">Scan</span>
                    </Link>

                    {/* Breadcrumbs (only show if there are items) */}
                    {breadcrumbItems.length > 0 && (
                        <>
                            <span className="text-muted-foreground/50 select-none text-sm" aria-hidden>/</span>
                            <Breadcrumb>
                                <BreadcrumbList>
                                    {breadcrumbItems.map((item, index) => (
                                        <span key={index} className="contents">
                                            {index > 0 && (
                                                <BreadcrumbSeparator className="text-muted-foreground/50 text-xs">/</BreadcrumbSeparator>
                                            )}
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
                        </>
                    )}
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
                            <Link href={isSubdomain ? "/login?redirect=/" : "/login?redirect=/scan"}>Sign In</Link>
                        </Button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-background pt-12">
                {children}
            </main>
        </div>
    );
}
