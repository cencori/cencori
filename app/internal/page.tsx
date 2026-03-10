import Link from 'next/link';
import { BarChart3, Mail, TrendingUp, Settings, ArrowRight } from 'lucide-react';

const SECTIONS = [
    {
        href: '/internal/analytics',
        label: 'Analytics',
        description: 'User metrics, traffic, and engagement data',
        icon: BarChart3,
        color: 'text-blue-400 bg-blue-500/10',
    },
    {
        href: '/internal/kpi',
        label: 'KPIs',
        description: 'Monthly targets, growth metrics, and engineering stats',
        icon: TrendingUp,
        color: 'text-emerald-400 bg-emerald-500/10',
    },
    {
        href: '/internal/emails',
        label: 'Email Center',
        description: 'Compose emails, manage sender profiles, view send history',
        icon: Mail,
        color: 'text-purple-400 bg-purple-500/10',
    },
    {
        href: '/internal/settings',
        label: 'Team Settings',
        description: 'Manage admin access, invite team members',
        icon: Settings,
        color: 'text-orange-400 bg-orange-500/10',
    },
];

export default function InternalOverviewPage() {
    return (
        <div className="max-w-3xl mx-auto px-6 py-10">
            <div className="mb-8">
                <h1 className="text-xl font-semibold">Internal Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Welcome to the Cencori internal panel.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SECTIONS.map((section) => (
                    <Link
                        key={section.href}
                        href={section.href}
                        className="group rounded-xl border border-border/40 bg-card/30 p-5 hover:bg-card/60 hover:border-border/60 transition-all space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className={`h-9 w-9 rounded-lg ${section.color} flex items-center justify-center`}>
                                <section.icon className="h-4.5 w-4.5" />
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div>
                            <h2 className="text-sm font-medium">{section.label}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
