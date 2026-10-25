"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import DashboardCircleIcon from "@hugeicons/core-free-icons/DashboardCircleIcon";
import UserSettings01Icon from "@hugeicons/core-free-icons/UserSettings01Icon";
import LeftToRightListDashIcon from "@hugeicons/core-free-icons/LeftToRightListDashIcon";
import UserMultipleIcon from "@hugeicons/core-free-icons/UserMultipleIcon";
import Store01Icon from "@hugeicons/core-free-icons/Store01Icon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import Folder02Icon from "@hugeicons/core-free-icons/Folder02Icon";
import Wrench01Icon from "@hugeicons/core-free-icons/Wrench01Icon";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { agentIdFromPath, useAgentsBasePath } from "@/components/agents/studio";

/** The sidebar while one agent is open: back to the agents list, then its sections. */
export function AgentSubnav() {
    const pathname = usePathname() ?? "";
    const basePath = useAgentsBasePath();
    const agentId = agentIdFromPath(pathname);
    if (!agentId) return null;

    const agentHref = `${basePath}/${encodeURIComponent(agentId)}`;
    const items = [
        { href: agentHref, label: "Overview", icon: DashboardCircleIcon, exact: true },
        { href: `${agentHref}/configure`, label: "Agent", icon: UserSettings01Icon },
        { href: `${agentHref}/knowledge`, label: "Knowledge", icon: Folder02Icon },
        { href: `${agentHref}/tools`, label: "Tools", icon: Wrench01Icon },
        { href: `${agentHref}/runs`, label: "Runs", icon: LeftToRightListDashIcon },
        { href: `${agentHref}/customers`, label: "Customers", icon: UserMultipleIcon },
        { href: `${agentHref}/marketplace`, label: "Marketplace", icon: Store01Icon },
        { href: `${agentHref}/settings`, label: "Settings", icon: Settings02Icon },
    ];

    return (
        <>
            <SidebarMenuItem>
                <SidebarMenuButton asChild size="sm" className="gap-1 text-muted-foreground">
                    <Link href={basePath}>
                        <ChevronLeft className="!h-5 !w-5" />
                        <span className="text-sm">All agents</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                        asChild
                        size="sm"
                        tooltip={item.label}
                        isActive={item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    >
                        <Link href={item.href} prefetch>
                            <HugeiconsIcon icon={item.icon} className="!h-5 !w-5" />
                            <span className="text-sm">{item.label}</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            ))}
        </>
    );
}
