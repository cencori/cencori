"use client";

import { type VariantProps } from "class-variance-authority";
import { CreditCard, Menu, Settings, UserPlus, Users, Shield, Book, Rocket, Code, Laptop, Share2, Building2, Workflow, DollarSign, LifeBuoy, Rss, Layers, Search, BriefcaseBusiness, UsersRound, Factory, ScrollText, CalendarDays, Handshake, Ship, LockKeyhole, HardHat, FileText, Blocks, FlaskConical, Gauge, Terminal, Globe, User, BookOpen, FileWarning, Package2 } from "lucide-react";
import { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CircleUserRound } from "lucide-react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

import { Logo } from "@/components/logo";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as React from "react";
import { TechnicalBorder } from "./TechnicalBorder";
import { GitHubStarsButton } from "@/components/animate-ui/components/buttons/github-stars";

type NavItem = NavDropdown | NavLink;

interface NavLink {
    title: string;
    href: string;
    description?: string;
    icon?: ReactNode;
}

interface NavDropdown {
    title: string;
    type: "mega" | "dropdown";
    columns?: NavLink[][]; // For mega-dropdowns
    items?: NavLink[]; // For regular dropdowns
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
    icon?: ReactNode;
    iconRight?: ReactNode;
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
}

function isNavDropdown(item: NavItem): item is NavDropdown {
    return "type" in item;
}

const ListItem = React.forwardRef<React.ElementRef<"a">, React.ComponentPropsWithoutRef<"a"> & { icon?: ReactNode }>(({ className, title, children, icon, ...props }, ref) => {
    return (
        <li>
            <NavigationMenuLink asChild>
                <a
                    ref={ref}
                    className={cn(
                        "block select-none space-y-1 rounded-none p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground border border-transparent hover:border-border/50",
                        className
                    )}
                    {...props}
                >
                    <div className="flex items-center gap-2">
                        {icon && icon}
                        <div className="text-sm font-medium leading-none">{title}</div>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                        {children}
                    </p>
                </a>
            </NavigationMenuLink>
        </li>
    );
});
ListItem.displayName = "ListItem";

export default function Navbar({
    logo = <Logo variant="mark" className="h-4" />,
    name = siteConfig.name,
    homeUrl = siteConfig.url,
    mobileNavItems = [
        {
            title: "Products", sublinks: [
                { title: "Protect", href: siteConfig.links.products.ai },
                { title: "Audit", href: siteConfig.links.products.audit },
                { title: "Knight", href: siteConfig.links.products.knight },
                { title: "Sandbox", href: siteConfig.links.products.sandbox },
                { title: "Insights", href: siteConfig.links.products.insights },
                { title: "Network", href: siteConfig.links.products.network },
                { title: "Edge", href: siteConfig.links.products.edge },
                { title: "Enterprise", href: siteConfig.links.products.enterprise },
                { title: "Developer Tools", href: siteConfig.links.products.developerTools },
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
                { title: "Code Execution & Automation Safety", href: "/solutions/sandboxing" },
            ]
        },
        {
            title: "Resources", sublinks: [
                { title: "Documentation", href: siteConfig.links.docs },
                { title: "API Reference", href: "/docs/api" },
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
}: NavbarProps) {
    const router = useRouter();

    const productsDropdown: NavDropdown = {
        title: "Products",
        type: "mega",
        columns: [
            [
                { title: "Protect", href: siteConfig.links.products.ai, description: "Real-time request/response protection and policy enforcement.", icon: <Shield className="h-4 w-4" /> },
                { title: "Audit", href: siteConfig.links.products.audit, description: "Immutable logs and exportable compliance reports.", icon: <Book className="h-4 w-4" /> },
                { title: "Knight", href: siteConfig.links.products.knight, description: "Build-time CI scanning and PR enforcement.", icon: <HardHat className="h-4 w-4" /> },
                { title: "Sandbox", href: siteConfig.links.products.sandbox, description: "Hardened execution environment for model-generated code.", icon: <FlaskConical className="h-4 w-4" /> },
            ],
            [
                { title: "Insights", href: siteConfig.links.products.insights, description: "Analytics, risk dashboards, and alerting.", icon: <Gauge className="h-4 w-4" /> },
                { title: "Network", href: siteConfig.links.products.network, description: "Opt-in threat intelligence and signature feeds.", icon: <Share2 className="h-4 w-4" /> },
                { title: "Edge", href: siteConfig.links.products.edge, description: "Platform integrations and edge middleware (Vercel, Supabase).", icon: <Laptop className="h-4 w-4" /> },
                { title: "Enterprise", href: siteConfig.links.products.enterprise, description: "VPC/on-prem, SLAs, and compliance services.", icon: <Building2 className="h-4 w-4" /> },
                { title: "Developer Tools", href: siteConfig.links.products.developerTools, description: "SDKs, CLI, and quickstarts.", icon: <Code className="h-4 w-4" /> },
            ],
        ],
        footerCtaPrimary: { title: "Try Protect (Free)", href: "/signup?product=protect" },
        footerCtaSecondary: { title: "Contact Sales", href: "/contact?topic=enterprise" },
    };

    const solutionsDropdown: NavDropdown = {
        title: "Solutions",
        type: "dropdown",
        items: [
            { title: "AI-first Startups", href: "/solutions/ai-startups", description: "rapid safe launch and scaling.", icon: <Rocket className="h-4 w-4" /> },
            { title: "Platform & ISVs", href: "/solutions/platforms", description: "integrate Cencori into developer workflows.", icon: <Layers className="h-4 w-4" /> },
            { title: "Regulated Industries", href: "/solutions/regulated", description: "fintech, healthcare, legal compliance.", icon: <ScrollText className="h-4 w-4" /> },
            { title: "Developer Teams", href: "/solutions/devtools", description: "reduce developer risk during deploy.", icon: <Terminal className="h-4 w-4" /> },
            { title: "Protect Generated Apps", href: "/solutions/vibe-coded", description: "(Cursor, V0, Lovable)", icon: <Blocks className="h-4 w-4" /> },
            { title: "Data-science Sandboxes & Model Ops", href: "/solutions/model-ops", description: "", icon: <FlaskConical className="h-4 w-4" /> },
            { title: "Code Execution & Automation Safety", href: "/solutions/sandboxing", description: "", icon: <LockKeyhole className="h-4 w-4" /> },
        ],
    };

    const resourcesDropdown: NavDropdown = {
        title: "Resources",
        type: "dropdown",
        items: [
            { title: "Documentation", href: siteConfig.links.docs, icon: <BookOpen className="h-4 w-4" /> },
            { title: "API Reference", href: "/docs/api", icon: <Code className="h-4 w-4" /> },
            { title: "SDKs & Quickstarts", href: siteConfig.links.products.developerTools, icon: <Terminal className="h-4 w-4" /> },
            { title: "Guides & Tutorials", href: "/resources/guides", icon: <LifeBuoy className="h-4 w-4" /> },
            { title: "Changelog", href: siteConfig.links.company.changelog, icon: <FileText className="h-4 w-4" /> },
            { title: "Use cases / Case studies", href: siteConfig.links.company.customers, icon: <UsersRound className="h-4 w-4" /> },
            { title: "Security & Compliance", href: "/security", icon: <LockKeyhole className="h-4 w-4" /> },
            { title: "Status & Incidents", href: "/status", icon: <FileWarning className="h-4 w-4" /> },
        ],
    };

    const navItems: NavItem[] = [
        productsDropdown,
        solutionsDropdown,
        resourcesDropdown,
        { title: "Pricing", href: "/pricing", icon: <DollarSign className="h-4 w-4" /> },
        { title: "Documentation", href: siteConfig.links.docs, icon: <BookOpen className="h-4 w-4" /> },
        { title: "Blog", href: siteConfig.links.company.blog, icon: <Rss className="h-4 w-4" /> },
    ];

    return (
        <header className={cn("sticky top-0 z-50 px-4 pb-4 bg-background/80 backdrop-blur-md border-b border-border/40", className)}>
            <div className="container mx-auto relative">
                <NavbarComponent className="py-4">
                    <NavbarLeft>
                        <a
                            href={homeUrl}
                            className="flex items-center gap-2 text-xl font-bold"
                        >
                            {logo}
                            {name}
                        </a>
                    </NavbarLeft>

                    <NavbarCenter className="hidden md:flex justify-center">
                        <NavigationMenu>
                            <NavigationMenuList className="gap-2">
                                {navItems.map((item, index) => {
                                    if (isNavDropdown(item)) {
                                        if (item.type === "mega") {
                                            return (
                                                <NavigationMenuItem key={index}>
                                                    <TechnicalBorder cornerSize={8} borderWidth={1} className="p-0">
                                                        <NavigationMenuTrigger className="h-9 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent border-none">
                                                            {item.title}
                                                        </NavigationMenuTrigger>
                                                    </TechnicalBorder>
                                                    <NavigationMenuContent className="rounded-none border-border/40">
                                                        <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-2">
                                                            {item.columns?.map((col, colIndex) => (
                                                                <div key={colIndex}>
                                                                    {col.map((link, linkIndex) => (
                                                                        <ListItem key={linkIndex} title={link.title} href={link.href} icon={link.icon}>
                                                                            {link.description}
                                                                        </ListItem>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </ul>
                                                        {(item.footerCtaPrimary || item.footerCtaSecondary) && (
                                                            <div className="flex justify-end p-4 border-t border-border/40 bg-muted/20">
                                                                {item.footerCtaSecondary && (
                                                                    <NavigationMenuLink asChild>
                                                                        <Button variant="outline" className="mr-2 rounded-none border-foreground/20" asChild>
                                                                            <a href={item.footerCtaSecondary.href}>
                                                                                {item.footerCtaSecondary.title}
                                                                            </a>
                                                                        </Button>
                                                                    </NavigationMenuLink>
                                                                )}
                                                                {item.footerCtaPrimary && (
                                                                    <NavigationMenuLink asChild>
                                                                        <Button className="rounded-none" asChild>
                                                                            <a href={item.footerCtaPrimary.href}>
                                                                                {item.footerCtaPrimary.title}
                                                                            </a>
                                                                        </Button>
                                                                    </NavigationMenuLink>
                                                                )}
                                                            </div>
                                                        )}
                                                    </NavigationMenuContent>
                                                </NavigationMenuItem>
                                            );
                                        } else { // item.type === "dropdown"
                                            return (
                                                <NavigationMenuItem key={index}>
                                                    <TechnicalBorder cornerSize={8} borderWidth={1} className="p-0">
                                                        <NavigationMenuTrigger className="h-9 rounded-none bg-transparent hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent border-none">
                                                            {item.title}
                                                        </NavigationMenuTrigger>
                                                    </TechnicalBorder>
                                                    <NavigationMenuContent className="rounded-none border-border/40">
                                                        <ul className="grid w-[200px] gap-3 p-4 md:w-[300px]">
                                                            {item.items?.map((link, linkIndex) => (
                                                                <ListItem key={linkIndex} title={link.title} href={link.href} icon={link.icon}>
                                                                    {link.description}
                                                                </ListItem>
                                                            ))}
                                                        </ul>
                                                    </NavigationMenuContent>
                                                </NavigationMenuItem>
                                            );
                                        }
                                    } else { // item is NavLink
                                        return (
                                            <NavigationMenuItem key={index}>
                                                <NavigationMenuLink asChild>
                                                    <Link href={item.href} className={cn(navigationMenuTriggerStyle(), "rounded-none bg-transparent hover:bg-transparent focus:bg-transparent p-0")}>
                                                        <TechnicalBorder cornerSize={8} borderWidth={1} className="p-0">
                                                            <div className="h-9 px-4 py-2 flex items-center justify-center text-sm font-medium">
                                                                {item.title}
                                                            </div>
                                                        </TechnicalBorder>
                                                    </Link>
                                                </NavigationMenuLink>
                                            </NavigationMenuItem>
                                        );
                                    }
                                })}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </NavbarCenter>

                    <NavbarRight>
                        <TechnicalBorder cornerSize={8} borderWidth={1} className="p-0 mr-4 hidden md:block">
                            <GitHubStarsButton
                                username="bolaabanjo"
                                repo="cencori"
                                variant="ghost"
                                className="h-9 rounded-none hover:bg-transparent"
                            />
                        </TechnicalBorder>

                        {actions.map((action, index) => {
                            if (action.isAvatar && isAuthenticated) {
                                return (
                                    <DropdownMenu key="authenticated-avatar-menu">
                                        <DropdownMenuTrigger asChild>
                                            <Avatar className="h-8 w-8 cursor-pointer rounded-none border border-border">
                                                {userProfile?.avatar && userProfile.avatar.length > 0 ? (
                                                    <AvatarImage
                                                        src={userProfile.avatar}
                                                        alt={userProfile.name || "User avatar"}
                                                        className="rounded-none"
                                                    />
                                                ) : (
                                                    <AvatarFallback className="rounded-none bg-muted">
                                                        <CircleUserRound className="h-5 w-5 text-muted-foreground" />
                                                    </AvatarFallback>
                                                )}
                                            </Avatar>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56 rounded-none border-border/40" align="end" forceMount>
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-sm font-medium leading-none">
                                                        {userProfile?.name ?? "User"}
                                                    </p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="cursor-pointer rounded-none focus:bg-accent" onClick={() => router.push("/dashboard/profile")}>
                                                <CircleUserRound className="mr-2 h-4 w-4" />
                                                <span>Profile</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer rounded-none focus:bg-accent" onClick={() => router.push("/dashboard/billing")}>
                                                <CreditCard className="mr-2 h-4 w-4" />
                                                <span>Billing</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="cursor-pointer rounded-none focus:bg-accent" onClick={() => router.push("/dashboard/settings")}>
                                                <Settings className="mr-2 h-4 w-4" />
                                                <span>Account Settings</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="cursor-pointer rounded-none focus:bg-accent" onClick={() => router.push("/dashboard/organizations")}>
                                                <Layers className="mr-2 h-4 w-4" />
                                                <span>Dashboard</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={async () => {
                                                    await supabase.auth.signOut();
                                                    router.push("/login");
                                                }}
                                                className="cursor-pointer rounded-none focus:bg-accent"
                                            >
                                                <span>Log out</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                );
                            } else if (action.isButton) {
                                return (
                                    <Button
                                        key={index}
                                        variant={(action.variant as "default" | "destructive" | "outline" | "secondary" | "ghost" | "link") || "default"}
                                        className="rounded-none"
                                        asChild
                                    >
                                        <a href={action.href}>
                                            {action.icon}
                                            {action.text}
                                            {action.iconRight}
                                        </a>
                                    </Button>
                                );
                            } else {
                                return (
                                    <TechnicalBorder key={index} cornerSize={8} borderWidth={1} className="p-0 hidden md:block mr-2">
                                        <Button variant="ghost" className="h-9 rounded-none hover:bg-transparent" asChild>
                                            <a href={action.href}>
                                                {action.text}
                                            </a>
                                        </Button>
                                    </TechnicalBorder>
                                );
                            }
                        })}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 md:hidden rounded-none"
                                >
                                    <Menu className="size-5" />
                                    <span className="sr-only">Toggle navigation menu</span>
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="rounded-none border-l border-border/40">
                                <nav className="grid gap-6 text-lg font-medium pt-10">
                                    {mobileNavItems.map((item, index) => (
                                        "sublinks" in item && item.sublinks ? (
                                            <details key={index} className="group">
                                                <summary className="flex w-full items-center justify-between text-muted-foreground hover:text-foreground cursor-pointer">
                                                    {item.title}
                                                    <span className="transition-transform group-open:rotate-90">&gt;</span>
                                                </summary>
                                                <ul className="ml-4 mt-2 space-y-2 border-l border-border/40 pl-4">
                                                    {item.sublinks.map((sublink, sublinkIndex) => (
                                                        <li key={sublinkIndex}>
                                                            <Link href={sublink.href || "#"} className="text-muted-foreground hover:text-foreground block py-1">
                                                                {sublink.title}
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </details>
                                        ) : (
                                            <Link
                                                key={index}
                                                href={item.href || "#"}
                                                className="text-muted-foreground hover:text-foreground"
                                            >
                                                {item.title}
                                            </Link>
                                        )
                                    ))}
                                </nav>
                            </SheetContent>
                        </Sheet>
                    </NavbarRight>
                </NavbarComponent>
            </div>
        </header>
    );
}
