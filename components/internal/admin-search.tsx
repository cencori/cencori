'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from 'vaul';
import { VisuallyHidden } from 'radix-ui';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import DashboardCircleIcon from '@hugeicons/core-free-icons/DashboardCircleIcon';
import Analytics01Icon from '@hugeicons/core-free-icons/Analytics01Icon';
import Wallet01Icon from '@hugeicons/core-free-icons/Wallet01Icon';
import ComputerTerminal01Icon from '@hugeicons/core-free-icons/ComputerTerminal01Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import Settings02Icon from '@hugeicons/core-free-icons/Settings02Icon';
import UserIcon from '@hugeicons/core-free-icons/UserIcon';
import Building03Icon from '@hugeicons/core-free-icons/Building03Icon';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useIsMobile } from '@/hooks/use-mobile';
import { adminHref } from '@/lib/admin/routing';
import type { AdminSearchResults } from '@/app/api/internal/search/route';

// Admin console search (⌘K): the panel's pages, plus users, organizations,
// payments, sent emails and feedback from /api/internal/search. A dialog on
// desktop, a full-height bottom sheet on phones like the console's nav sheet.

export const ADMIN_PAGES: { href: string; label: string; icon: IconSvgElement; keywords: string }[] = [
    { href: '/', label: 'Overview', icon: DashboardCircleIcon, keywords: 'home requests spend tokens latency errors signups' },
    { href: '/analytics', label: 'Analytics', icon: Analytics01Icon, keywords: 'traffic usage platform charts' },
    { href: '/revenue', label: 'Revenue', icon: Wallet01Icon, keywords: 'payments mrr bachs sync money income' },
    { href: '/tensor', label: 'Tensor', icon: ComputerTerminal01Icon, keywords: 'launch signups tasks active plans conversion desktop app' },
    { href: '/emails', label: 'Emails', icon: Mail01Icon, keywords: 'send compose newsletter campaign' },
    { href: '/feedback', label: 'Feedback', icon: BubbleChatIcon, keywords: 'suggestions users comments' },
    { href: '/settings', label: 'Settings', icon: Settings02Icon, keywords: 'team admins invite access' },
];

const EMPTY: AdminSearchResults = { users: [], organizations: [], payments: [], emails: [], feedback: [] };

function money(amount: number, currency: string) {
    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    } catch {
        return `${amount.toFixed(2)} ${currency}`;
    }
}

function day(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function useDebounced<T>(value: T, ms: number) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(timer);
    }, [value, ms]);
    return debounced;
}

function Row({ icon, title, detail, meta }: { icon?: IconSvgElement; title: string; detail?: string | null; meta?: string | null }) {
    return (
        <div className="flex min-w-0 flex-1 items-center gap-3">
            {icon && <HugeiconsIcon icon={icon} className="!h-4 !w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">{title}</p>
                {detail && <p className="truncate text-[11px] text-muted-foreground">{detail}</p>}
            </div>
            {meta && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{meta}</span>}
        </div>
    );
}

function SearchBody({ onDone, autoFocus }: { onDone: () => void; autoFocus: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const [input, setInput] = useState('');
    const query = useDebounced(input.trim(), 200);

    const { data, isFetching } = useQuery({
        queryKey: ['admin-search', query],
        queryFn: async () => {
            const response = await fetch(`/api/internal/search?q=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('search_failed');
            return (await response.json()) as AdminSearchResults;
        },
        enabled: query.length >= 2,
        staleTime: 30_000,
        placeholderData: (previous) => previous,
    });
    const results = query.length >= 2 ? data ?? EMPTY : EMPTY;

    const pages = useMemo(() => {
        const needle = input.trim().toLowerCase();
        if (!needle) return ADMIN_PAGES;
        return ADMIN_PAGES.filter((page) => `${page.label} ${page.keywords}`.toLowerCase().includes(needle));
    }, [input]);

    const go = (href: string) => {
        onDone();
        router.push(adminHref(pathname, href));
    };
    const compose = (email: string) => go(`/emails?to=${encodeURIComponent(email)}`);

    const searching = input.trim().length >= 2 && (isFetching || input.trim() !== query);
    const nothing = pages.length === 0
        && results.users.length + results.organizations.length + results.payments.length
            + results.emails.length + results.feedback.length === 0;

    return (
        <Command
            shouldFilter={false}
            loop
            className="h-full rounded-none! bg-transparent p-0 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:rounded-lg [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2"
        >
            <div className="relative">
                <CommandInput
                    value={input}
                    onValueChange={setInput}
                    autoFocus={autoFocus}
                    placeholder="Search users, orgs, payments, emails, feedback…"
                    className="text-[16px] md:text-sm"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
            <CommandList className="max-h-none flex-1 overflow-y-auto px-2 pb-3 md:max-h-[min(60vh,480px)]">
                {nothing && !searching && <CommandEmpty>No results for “{input.trim()}”.</CommandEmpty>}

                {pages.length > 0 && (
                    <CommandGroup heading="Pages">
                        {pages.map((page) => (
                            <CommandItem key={page.href} value={`page:${page.href}`} onSelect={() => go(page.href)}>
                                <Row icon={page.icon} title={page.label} />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {results.users.length > 0 && (
                    <CommandGroup heading="Users">
                        {results.users.map((user) => (
                            <CommandItem key={user.id} value={`user:${user.id}`} onSelect={() => compose(user.email)}>
                                <Row icon={UserIcon} title={user.name || user.email} detail={user.name ? user.email : null} meta={day(user.created_at)} />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {results.organizations.length > 0 && (
                    <CommandGroup heading="Organizations">
                        {results.organizations.map((org) => (
                            <CommandItem
                                key={org.id}
                                value={`org:${org.id}`}
                                onSelect={() => (org.billing_email ? compose(org.billing_email) : go('/revenue'))}
                            >
                                <Row
                                    icon={Building03Icon}
                                    title={org.name}
                                    detail={[org.slug, org.billing_email].filter(Boolean).join(' · ')}
                                    meta={org.subscription_tier}
                                />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {results.payments.length > 0 && (
                    <CommandGroup heading="Payments">
                        {results.payments.map((payment) => (
                            <CommandItem key={payment.id} value={`payment:${payment.id}`} onSelect={() => go('/revenue')}>
                                <Row
                                    icon={Wallet01Icon}
                                    title={`${money(payment.amount, payment.currency)} · ${payment.product_type.replace(/_/g, ' ')}`}
                                    detail={[payment.organization_name, payment.customer_email, payment.provider].filter(Boolean).join(' · ')}
                                    meta={day(payment.paid_at)}
                                />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {results.emails.length > 0 && (
                    <CommandGroup heading="Sent emails">
                        {results.emails.map((email) => (
                            <CommandItem key={email.id} value={`email:${email.id}`} onSelect={() => go('/emails')}>
                                <Row
                                    icon={Mail01Icon}
                                    title={email.subject}
                                    detail={[email.single_recipient ?? email.audience_type, email.status].filter(Boolean).join(' · ')}
                                    meta={day(email.created_at)}
                                />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

                {results.feedback.length > 0 && (
                    <CommandGroup heading="Feedback">
                        {results.feedback.map((item) => (
                            <CommandItem key={item.id} value={`feedback:${item.id}`} onSelect={() => go('/feedback')}>
                                <Row
                                    icon={BubbleChatIcon}
                                    title={item.content}
                                    detail={[item.type.replace(/_/g, ' '), item.status].join(' · ')}
                                    meta={day(item.created_at)}
                                />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}
            </CommandList>
        </Command>
    );
}

export function AdminSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const isMobile = useIsMobile();

    // ⌘K / Ctrl+K toggles search anywhere in the panel.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                onOpenChange(!open);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onOpenChange]);

    const close = () => onOpenChange(false);

    if (isMobile) {
        return (
            <Drawer.Root open={open} onOpenChange={onOpenChange}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
                    <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[92svh] flex-col rounded-t-2xl bg-background outline-none">
                        <Drawer.Title className="sr-only">Search</Drawer.Title>
                        <Drawer.Description className="sr-only">Search the admin console.</Drawer.Description>
                        <div aria-hidden="true" className="mx-auto mb-1 mt-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/40" />
                        <div className="min-h-0 flex-1">
                            <SearchBody onDone={close} autoFocus={false} />
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl! border-border/50 p-0 shadow-lg"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Search</DialogTitle>
                </VisuallyHidden.Root>
                {open && <SearchBody onDone={close} autoFocus />}
            </DialogContent>
        </Dialog>
    );
}
