"use client";

import { type VariantProps } from "class-variance-authority";
import { Menu, ChevronDown } from "lucide-react";
import { ReactNode } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CircleUserRound } from "lucide-react";

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
                        "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                        className
                    )}
                    {...props}
                >
                    <div className="text-sm font-medium leading-none">{title}</div>
                    <p className="line-clamp-2 text-sm leading-snug text-muted-foreground mt-1">
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
                { title: "AI Gateway", href: siteConfig.links.products.ai },
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
                { title: "AI Gateway", href: siteConfig.links.products.ai, description: "Real-time request/response protection." },
            ],
        ],
    };

    const solutionsDropdown: NavDropdown = {
        title: "Solutions",
        type: "dropdown",
        items: [
            { title: "AI-first Startups", href: "/solutions/ai-startups", description: "Rapid safe launch and scaling." },
            { title: "Platform & ISVs", href: "/solutions/platforms", description: "Integrate Cencori into workflows." },
            { title: "Regulated Industries", href: "/solutions/regulated", description: "Fintech and healthcare compliance." },
            { title: "Developer Teams", href: "/solutions/devtools", description: "Reduce developer risk." },
            { title: "Protect Generated Apps", href: "/solutions/vibe-coded", description: "For Cursor, V0, Lovable." },
            { title: "Data-science Sandboxes", href: "/solutions/model-ops", description: "Model Ops safety." },
            { title: "Automation Safety", href: "/solutions/sandboxing", description: "Code execution safety." },
        ],
    };

    const resourcesDropdown: NavDropdown = {
        title: "Resources",
        type: "dropdown",
        items: [
            { title: "Documentation", href: siteConfig.links.docs },
            { title: "API Reference", href: "/docs/api" },
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
        <header className={cn("fixed top-0 cursor-pointer left-0 right-0 z-50 bg-background/80 mb-16 backdrop-blur-xl border-b border-border/40", className)}>
            <div className="max-w-7xl mx-auto px-4 md:px-6">
                <NavbarComponent className="py-3">
                    <NavbarLeft className="gap-6">
                        <Link
                            href={homeUrl}
                            className="flex items-center gap-2 text-lg font-bold tracking-tight"
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
                                                <NavigationMenuTrigger className="h-8 px-3 text-sm font-medium rounded-full bg-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5 focus:bg-foreground/5 data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground border-none">
                                                    {item.title}
                                                </NavigationMenuTrigger>
                                                <NavigationMenuContent className="rounded-xl border-border/40 shadow-none bg-background/95 backdrop-blur-xl">
                                                    {item.type === "mega" ? (
                                                        <div className="flex flex-col">
                                                            <ul className="grid gap-2 p-4 md:w-[400px] lg:w-[600px] lg:grid-cols-2">
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
                                                        <ul className="grid w-[200px] gap-1 p-2 md:w-[300px]">
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
                                                <NavigationMenuLink asChild className={cn(navigationMenuTriggerStyle(), "h-8 px-3 text-sm font-medium rounded-full bg-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/5 focus:bg-foreground/5")}>
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
                                        <DropdownMenuContent className="w-56 rounded-xl border-border/40 shadow-none" align="end" forceMount>
                                            <DropdownMenuLabel className="font-normal">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-sm font-medium leading-none">
                                                        {userProfile?.name ?? "User"}
                                                    </p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="cursor-pointer rounded-lg focus:bg-accent" onClick={() => router.push("/dashboard/profile")}>
                                                <CircleUserRound className="mr-2 h-4 w-4" />
                                                <span>Profile</span>
                                            </DropdownMenuItem>
                                            {/* ... other menu items ... */}
                                            <DropdownMenuItem
                                                onClick={async () => {
                                                    await supabase.auth.signOut();
                                                    router.push("/login");
                                                }}
                                                className="cursor-pointer rounded-lg focus:bg-accent"
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
                                        variant="default"
                                        className="rounded-full bg-foreground text-background hover:bg-foreground/90 h-9 px-4 text-sm font-medium"
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
                                        className="hidden md:inline-flex h-9 px-4 text-sm font-medium rounded-full hover:bg-foreground/5 mr-2"
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
