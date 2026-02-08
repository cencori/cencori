"use client";

import { type VariantProps } from "class-variance-authority";
import { Menu, ChevronDown, Settings } from "lucide-react";
import { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CircleUserRound } from "lucide-react";
import { useTheme } from "next-themes";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
    Navbar as NavbarComponent,
    NavbarLeft,
    NavbarRight,
    NavbarCenter,
} from "@/components/ui/navbar";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";

type NavItem = NavDropdown | NavLink;

interface NavLink {
    title: string;
    href: string;
    description?: string;
}

interface NavDropdown {
    title: string;
    type: "mega" | "dropdown";
    columns?: NavLink[][];
    items?: NavLink[];
    footerCtaPrimary?: NavLink;
    footerCtaSecondary?: NavLink;
}

interface MobileNavLink {
    title: string;
    href?: string;
    sublinks?: MobileNavLink[];
}

interface NavbarActionProps {
    text: string;
    href: string;
    variant?: string;
    isButton?: boolean;
    isAvatar?: boolean;
    avatarSrc?: string | null;
    avatarFallback?: string;
}

interface NavbarProps {
    logo?: ReactNode;
    name?: string;
    homeUrl?: string;
    mobileNavItems?: MobileNavLink[];
    actions?: NavbarActionProps[];
    className?: string;
    isAuthenticated?: boolean;
    userProfile?: { name: string | null; avatar: string | null };
    searchSlot?: ReactNode;
    containerClassName?: string;
}

function isNavDropdown(item: NavItem): item is NavDropdown {
    return "type" in item;
}

const ListItem = React.forwardRef<React.ElementRef<"a">, React.ComponentPropsWithoutRef<"a">>(({ className, title, children, ...props }, ref) => {
    return (
        <li>
            <NavigationMenuLink asChild>
                <a
                    ref={ref}
                    className={cn(
                        "block select-none space-y-0.5 rounded-md p-2 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        className
                    )}
                    {...props}
                >
                    <div className="text-xs font-medium leading-none">{title}</div>
                    <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground mt-0.5">
                        {children}
                    </p>
                </a>
            </NavigationMenuLink>
        </li>
    );
});
ListItem.displayName = "ListItem";

export default function Navbar({
    logo = <Logo variant="mark" className="h-5 w-5" />,
    name = siteConfig.name,
    homeUrl = siteConfig.url,
    mobileNavItems = [
        {
            title: "Products", sublinks: [
                { title: "AI Gateway", href: siteConfig.links.products.aiGateway },
                { title: "Compute", href: "/compute" },
                { title: "Workflow", href: "/workflow" },
                { title: "Integration", href: "/integration" },
                { title: "Data Storage", href: "/storage" },
                { title: "Edge", href: "/edge" },
                { title: "Scan", href: "/scan" },
            ]
        },
        {
            title: "Solutions", sublinks: [
                { title: "AI-first Startups", href: "/solutions/ai-startups" },
                { title: "Platform & ISVs", href: "/solutions/platforms" },
                { title: "Regulated Industries", href: "/solutions/regulated" },
                { title: "Developer Teams", href: "/solutions/devtools" },
                { title: "Protect Generated Apps", href: "/solutions/vibe-coded" },
                { title: "Data-science Sandboxes", href: "/solutions/model-ops" },
                { title: "Automation Safety", href: "/solutions/sandboxing" },
            ]
        },
        {
            title: "Resources", sublinks: [
                { title: "Documentation", href: siteConfig.links.docs },
                { title: "API Reference", href: "/docs/api" },
                { title: "Academy", href: "/academy" },
                { title: "SDKs & Quickstarts", href: siteConfig.links.products.developerTools },
                { title: "Guides & Tutorials", href: "/resources/guides" },
                { title: "Changelog", href: siteConfig.links.company.changelog },
                { title: "Use Cases / Case Studies", href: siteConfig.links.company.customers },
                { title: "Security & Compliance", href: "/security" },
                { title: "Status & Incidents", href: "/status" },
            ]
        },
        { title: "Pricing", href: "/pricing" },
        { title: "Documentation", href: siteConfig.links.docs },
        { title: "Blog", href: siteConfig.links.company.blog },
    ],
    actions = [
        { text: "Sign in", href: siteConfig.links.signInUrl, isButton: false },
        {
            text: "Get Started",
            href: siteConfig.links.getStartedUrl,
            isButton: true,
            variant: "default",
        },
    ],
    className,
    isAuthenticated = false,
    userProfile,
    searchSlot,
    containerClassName,
}: NavbarProps) {
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    const productsDropdown: NavDropdown = {
        title: "Products",
        type: "mega",
        columns: [
            [
                { title: "AI Gateway", href: siteConfig.links.products.aiGateway, description: "One API for every provider with security and observability." },
                { title: "Compute", href: "/compute", description: "Serverless functions & GPU access." },
            ],
            [
                { title: "Workflow", href: "/workflow", description: "Visual AI pipeline builder." },
                { title: "Integration", href: "/integration", description: "SDKs & platform connectors." },
            ],
            [
                { title: "Data Storage", href: "/storage", description: "Vector database & RAG." },
                { title: "Edge", href: "/edge", description: "Platform integrations & edge middleware." },
                { title: "Scan", href: "/scan", description: "Security scanning & vulnerability detection." },
            ],
        ],
    };

    const solutionsDropdown: NavDropdown = {
        title: "Solutions",
        type: "mega",
        columns: [
            [
                { title: "Vibe Coders", href: "/solutions/vibe-coders", description: "Generate secure apps with AI." },
                { title: "Developers", href: "/solutions/developers", description: "Add AI to existing apps." },
                { title: "AI Builders", href: "/solutions/ai-builders", description: "Full-stack AI infrastructure." },
                { title: "No-Code", href: "/solutions/no-code", description: "Bubble, Zapier, & Make." },
            ],
            [
                { title: "Startups", href: "/solutions/startups", description: "Ship fast, stay secure." },
                { title: "Agencies", href: "/solutions/agencies", description: "Build for clients." },
                { title: "Enterprise", href: "/solutions/enterprise", description: "Compliance & governance." },
                { title: "Fintech", href: "/solutions/fintech", description: "Regulated industry focus." },
                { title: "Healthcare", href: "/solutions/healthcare", description: "HIPAA & PHI protection." },
                { title: "Hackathons", href: "/solutions/hackathons", description: "Free tier & instant setup." },
            ]
        ],
    };

    const resourcesDropdown: NavDropdown = {
        title: "Resources",
        type: "dropdown",
        items: [
            { title: "Documentation", href: siteConfig.links.docs },
            { title: "API Reference", href: "/docs/api" },
            { title: "Academy", href: "/academy" },
            { title: "SDKs & Quickstarts", href: siteConfig.links.products.developerTools },
            { title: "Guides & Tutorials", href: "/resources/guides" },
        ],
    };

    const navItems: NavItem[] = [
        productsDropdown,
        solutionsDropdown,
        resourcesDropdown,
        { title: "Pricing", href: "/pricing" },
        { title: "Documentation", href: siteConfig.links.docs },
        { title: "Blog", href: siteConfig.links.company.blog },
    ];

    return (
        <header className={cn("fixed top-0 cursor-pointer left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border/30", className)}>
            <div className={cn("mx-auto px-4 md:px-6", containerClassName || "max-w-screen-xl")}>
                <NavbarComponent className="py-2">
                    <NavbarLeft className="gap-6">
                        <Link
                            href={homeUrl}
                            className="flex items-center gap-1.5 text-sm font-semibold tracking-tight"
                        >
                            {logo}
                            {name}
                        </Link>

                        <NavigationMenu className="hidden md:flex">
                            <NavigationMenuList className="gap-1">
                                {navItems.map((item, index) => {
                                    if (isNavDropdown(item)) {
                                        return (
                                            <NavigationMenuItem key={index}>
                                                <NavigationMenuTrigger className="h-7 px-2.5 text-xs font-medium rounded-full bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:bg-muted/50 data-[state=open]:bg-muted/50 data-[state=open]:text-foreground border-none">
                                                    {item.title}
                                                </NavigationMenuTrigger>
                                                <NavigationMenuContent className="rounded-xl border-border/40 shadow-none bg-background/95 backdrop-blur-xl">
                                                    {item.type === "mega" ? (
                                                        <div className="flex flex-col">
                                                            <ul className="grid gap-1 p-3 md:w-[380px] lg:w-[500px] lg:grid-cols-2">
                                                                {item.columns?.map((col, colIndex) => (
                                                                    <div key={colIndex} className="space-y-1">
                                                                        {col.map((link, linkIndex) => (
                                                                            <ListItem key={linkIndex} title={link.title} href={link.href}>
                                                                                {link.description}
                                                                            </ListItem>
                                                                        ))}
                                                                    </div>
                                                                ))}
                                                            </ul>
                                                            {(item.footerCtaPrimary || item.footerCtaSecondary) && (
                                                                <div className="flex justify-end p-4 border-t border-border/40 bg-muted/20">
                                                                    {item.footerCtaSecondary && (
                                                                        <Button variant="ghost" size="sm" className="mr-2 rounded-full" asChild>
                                                                            <Link href={item.footerCtaSecondary.href}>
                                                                                {item.footerCtaSecondary.title}
                                                                            </Link>
                                                                        </Button>
                                                                    )}
                                                                    {item.footerCtaPrimary && (
                                                                        <Button size="sm" className="rounded-full" asChild>
                                                                            <Link href={item.footerCtaPrimary.href}>
                                                                                {item.footerCtaPrimary.title}
                                                                            </Link>
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <ul className="grid w-[180px] gap-0.5 p-1.5 md:w-[260px]">
                                                            {item.items?.map((link, linkIndex) => (
                                                                <ListItem key={linkIndex} title={link.title} href={link.href}>
                                                                    {link.description}
                                                                </ListItem>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </NavigationMenuContent>
                                            </NavigationMenuItem>
                                        );
                                    } else {
                                        return (
                                            <NavigationMenuItem key={index}>
                                                <NavigationMenuLink asChild className={cn(navigationMenuTriggerStyle(), "h-7 px-2.5 text-xs font-medium rounded-full bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:bg-muted/50")}>
                                                    <Link href={item.href}>
                                                        {item.title}
                                                    </Link>
                                                </NavigationMenuLink>
                                            </NavigationMenuItem>
                                        );
                                    }
                                })}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </NavbarLeft>

                    <NavbarRight>
                        {searchSlot}
                        {actions.map((action, index) => {
                            if (action.isAvatar && isAuthenticated) {
                                return (
                                    <DropdownMenu key="authenticated-avatar-menu">
                                        <DropdownMenuTrigger asChild>
                                            <Avatar className="h-8 w-8 cursor-pointer rounded-full border border-border/40 transition-opacity hover:opacity-80">
                                                {userProfile?.avatar && userProfile.avatar.length > 0 ? (
                                                    <AvatarImage
                                                        src={userProfile.avatar}
                                                        alt={userProfile.name || "User avatar"}
                                                    />
                                                ) : (
                                                    <AvatarFallback className="bg-muted">
                                                        <CircleUserRound className="h-5 w-5 text-muted-foreground" />
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-66 p-1" align="end" forceMount>
                                            <div className="px-2 py-1.5 border-b border-border/40 mb-1">
                                                <p className="text-xs font-medium truncate">
                                                    {userProfile?.name ?? "User"}
                                                </p>
                                            </div>
                                            <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">Account</p>
                                            <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => router.push("/dashboard/profile")}>
                                                <CircleUserRound className="mr-2 h-3.5 w-3.5" />
                                                Profile
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => router.push("/dashboard/settings")}>
                                                <Settings className="mr-2 h-3.5 w-3.5" />
                                                Settings
                                            </DropdownMenuItem>
                                            <div className="my-1 border-t border-border/40" />
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
                                            <div className="my-1 border-t border-border/40" />
                                            <DropdownMenuItem className="text-xs py-1.5 cursor-pointer" onClick={() => router.push("/dashboard/organizations")}>
                                                Dashboard
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-xs py-1.5 cursor-pointer text-red-500 focus:text-red-500"
                                                onClick={async () => {
                                                    await supabase.auth.signOut();
                                                    router.push("/login");
                                                }}
                                            >
                                                Log out
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                );
                            } else if (action.isButton) {
                                return (
                                    <Button
                                        key={index}
                                        variant="default"
                                        className="rounded-full bg-foreground text-background hover:bg-foreground/90 h-7 px-3 text-[11px] font-medium"
                                        asChild
                                    >
                                        <Link href={action.href}>
                                            {action.text}
                                        </Link>
                                    </Button>
                                );
                            } else {
                                return (
                                    <Button
                                        key={index}
                                        variant="ghost"
                                        className="hidden md:inline-flex h-7 px-2.5 text-[11px] font-medium rounded-full hover:bg-muted/50 text-muted-foreground hover:text-foreground mr-1"
                                        asChild
                                    >
                                        <Link href={action.href}>
                                            {action.text}
                                        </Link>
                                    </Button>
                                );
                            }
                        })}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 md:hidden rounded-full"
                                >
                                    <Menu className="size-5" />
                                    <span className="sr-only">Toggle navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-full border-none bg-background/95 backdrop-blur-xl p-6">
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center gap-2 mb-8">
                                        <Logo variant="mark" className="h-6 w-6" />
                                        <span className="font-bold text-xl tracking-tight">cencori</span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto -mx-6 px-6">
                                        <Accordion type="single" collapsible className="w-full">
                                            {mobileNavItems.map((item, index) => (
                                                "sublinks" in item && item.sublinks ? (
                                                    <AccordionItem key={index} value={`item-${index}`} className="border-border/40">
                                                        <AccordionTrigger className="text-base font-medium hover:no-underline hover:text-foreground text-muted-foreground">
                                                            {item.title}
                                                        </AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="flex flex-col space-y-2 pl-4 pb-2">
                                                                {item.sublinks.map((sublink, sublinkIndex) => (
                                                                    <Link
                                                                        key={sublinkIndex}
                                                                        href={sublink.href || "#"}
                                                                        className="text-sm text-muted-foreground hover:text-foreground py-2 transition-colors"
                                                                    >
                                                                        {sublink.title}
                                                                    </Link>
                                                                ))}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ) : (
                                                    <div key={index} className="border-b border-border/40 py-4">
                                                        <Link
                                                            href={item.href || "#"}
                                                            className="flex w-full items-center text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            {item.title}
                                                        </Link>
                                                    </div>
                                                )
                                            ))}
                                        </Accordion>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </NavbarRight>
                </NavbarComponent>
            </div>
        </header>
    );
}
