import { createServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default async function InternalKPIDashboard() {
    const supabase = await createServerClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/internal/kpi/login");
    }

    // Verify @cencori.com email
    const email = user.email || '';
    if (!email.endsWith('@cencori.com')) {
        redirect("/internal/kpi/login");
    }

    // Fetch KPI data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Parallel queries for performance
    const [
        { count: totalUsers },
        { count: signupsThisMonth },
        { count: totalOrgs },
        { count: totalProjects },
        { count: apiRequestsThisMonth },
        { count: activeApiKeys },
        { count: securityIncidents },
        { count: weeklyActiveUsers },
    ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
        supabase.from('requests').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
        supabase.from('api_keys').select('*', { count: 'exact', head: true }).eq('is_revoked', false),
        supabase.from('security_incidents').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('updated_at', startOfWeek.toISOString()),
    ]);

    const avgDailyRequests = Math.round((apiRequestsThisMonth || 0) / Math.max(1, now.getDate()));
    const uptime = 99.9; // Placeholder - integrate with monitoring

    // Fetch manual KPI entries for this month
    const periodMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const { data: kpiEntries } = await supabase
        .from('kpi_entries')
        .select('role_id, metric_key, metric_value')
        .eq('period_month', periodMonth);

    const getKPIValue = (roleId: string, metricKey: string): number => {
        const entry = kpiEntries?.find((e: { role_id: string; metric_key: string }) => e.role_id === roleId && e.metric_key === metricKey);
        return entry ? Number(entry.metric_value) : 0;
    };

    const contentPublished = getKPIValue('growth', 'content_published');
    const criticalBugs = getKPIValue('engineering', 'critical_bugs');
    const featuresShipped = getKPIValue('engineering', 'features_shipped');

    return (
        <div className="min-h-svh bg-background">
            {/* Header - Cenpact style */}
            <header className="border-b border-border/40 bg-card/50 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <Logo variant="full" className="h-4" />
                        </Link>
                        <span className="text-muted-foreground text-[10px]">/</span>
                        <span className="text-xs font-medium">Internal KPIs</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground">{user.email}</span>
                        <form action="/api/auth/signout" method="POST">
                            <button type="submit" className="text-[10px] text-muted-foreground hover:text-foreground">
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
                {/* Title */}
                <div className="space-y-1">
                    <h1 className="text-lg font-semibold tracking-tight">
                        {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} KPIs
                    </h1>
                    <p className="text-[11px] text-muted-foreground">
                        Updated: {now.toLocaleTimeString()}
                    </p>
                </div>

                {/* Growth + Product */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Growth + Product</h2>
                        <Link href="/internal/kpi/growth" className="text-[10px] text-primary hover:underline">Edit</Link>
                    </div>
                    <div className="border border-border/40 rounded-lg divide-y divide-border/40 bg-card/50">
                        <KPIRow label="New Signups" value={signupsThisMonth || 0} suffix="this month" target={50} />
                        <KPIRow label="API Keys Created" value={activeApiKeys || 0} suffix="active" target={10} />
                        <KPIRow label="WAU (Weekly Active)" value={weeklyActiveUsers || 0} suffix="users" target={5} />
                        <KPIRow label="Content Published" value={contentPublished} suffix="pieces" target={4} />
                    </div>
                </section>

                {/* Ops + Engineering */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ops + Engineering</h2>
                        <Link href="/internal/kpi/engineering" className="text-[10px] text-primary hover:underline">Edit</Link>
                    </div>
                    <div className="border border-border/40 rounded-lg divide-y divide-border/40 bg-card/50">
                        <KPIRow label="Uptime" value={`${uptime}%`} status={uptime >= 99.9 ? 'good' : 'warning'} />
                        <KPIRow label="P95 Latency" value="<500ms" status="good" />
                        <KPIRow label="Critical Bugs" value={criticalBugs} suffix="open" status={criticalBugs === 0 ? 'good' : 'warning'} />
                        <KPIRow label="Features Shipped" value={featuresShipped} suffix="this month" target={2} />
                    </div>
                </section>

                {/* Company */}
                <section className="space-y-3">
                    <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Company</h2>
                    <div className="border border-border/40 rounded-lg divide-y divide-border/40 bg-card/50">
                        <KPIRow label="Total Users" value={totalUsers || 0} />
                        <KPIRow label="Organizations" value={totalOrgs || 0} />
                        <KPIRow label="Projects" value={totalProjects || 0} />
                        <KPIRow label="API Requests" value={(apiRequestsThisMonth || 0).toLocaleString()} suffix="this month" />
                        <KPIRow label="Requests/Day" value={avgDailyRequests.toLocaleString()} suffix="avg" />
                        <KPIRow label="Threats Blocked" value={securityIncidents || 0} suffix="this month" />
                        <KPIRow label="MRR" value="$0" target={1} isCurrency />
                    </div>
                </section>

                {/* Monthly Targets Summary */}
                <section className="space-y-3">
                    <h2 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">January 2026 Targets</h2>
                    <div className="border border-border/40 rounded-lg divide-y divide-border/40 bg-card/50">
                        <TargetRow label="10 Real Users" current={signupsThisMonth || 0} goal={10} />
                        <TargetRow label="Ship Example Apps" current={0} goal={2} />
                        <TargetRow label="1 Content Piece" current={0} goal={1} />
                        <TargetRow label="First Paying Customer" current={0} goal={1} isCurrency />
                    </div>
                </section>
            </main>
        </div>
    );
}

// Cenpact KPI Row with optional target and status
function KPIRow({
    label,
    value,
    suffix,
    target,
    status,
    isCurrency = false
}: {
    label: string;
    value: string | number;
    suffix?: string;
    target?: number;
    status?: 'good' | 'warning' | 'bad';
    isCurrency?: boolean;
}) {
    const statusColors = {
        good: 'text-green-500',
        warning: 'text-yellow-500',
        bad: 'text-red-500',
    };

    const numValue = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
    const progress = target ? Math.min(100, Math.round((numValue / target) * 100)) : null;

    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
                {progress !== null && (
                    <div className="w-12 h-1 bg-muted/50 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-foreground/50'}`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
                <div className="flex items-baseline gap-1.5">
                    <span className={`text-sm font-medium tabular-nums ${status ? statusColors[status] : ''}`}>
                        {value}
                    </span>
                    {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
                </div>
            </div>
        </div>
    );
}

// Cenpact Target Row with progress bar
function TargetRow({
    label,
    current,
    goal,
    isCurrency = false
}: {
    label: string;
    current: number;
    goal: number;
    isCurrency?: boolean;
}) {
    const percentage = Math.min(100, Math.round((current / goal) * 100));
    const displayCurrent = isCurrency ? `$${current}` : current.toLocaleString();
    const displayGoal = isCurrency ? `$${goal}` : goal.toLocaleString();

    return (
        <div className="px-4 py-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground">
                    <span className="text-foreground font-medium">{displayCurrent}</span> / {displayGoal}
                </span>
            </div>
            <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${percentage >= 100 ? 'bg-green-500' : 'bg-foreground'}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
