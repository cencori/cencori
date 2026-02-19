
import { createServerClient } from "@/lib/supabaseServer";
import { Button } from "@/components/ui/button";
import { SparklesIcon, ShieldCheckIcon, CpuChipIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { OpenClawLogo, AutoGPTLogo, N8nLogo, CrewAILogo, PythonLogo, CustomAgentLogo } from "@/components/icons/BrandIcons";

interface AgentsPageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>
}

export default async function AgentsPage({ params }: AgentsPageProps) {
    const supabase = await createServerClient();
    const { orgSlug, projectSlug } = await params;

    // 1. Get Project ID
    const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', projectSlug)
        .single();

    if (!project) {
        return <div className="p-10">Project not found</div>;
    }

    // 2. Get Agents (join agent_configs for model)
    const { data: agents } = await supabase
        .from('agents')
        .select('*, agent_configs(model)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <h1 className="text-lg font-semibold">Agents</h1>
                    <p className="text-xs text-muted-foreground">Manage your autonomous agents and their configurations.</p>
                </div>
                <Button size="sm" asChild>
                    <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/agents/new`}>
                        Deploy Agent
                    </Link>
                </Button>
            </div>

            {agents && agents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent) => (
                        <div key={agent.id} className="group relative rounded-xl border border-border/40 bg-card p-5 hover:border-border/80 transition-all">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                        {agent.blueprint === 'openclaw' ? <OpenClawLogo className="w-5 h-5" /> :
                                            agent.blueprint === 'autogpt' ? <AutoGPTLogo className="w-5 h-5" /> :
                                                agent.blueprint === 'n8n' ? <N8nLogo className="w-5 h-5" /> :
                                                    agent.blueprint === 'crewai' ? <CrewAILogo className="w-5 h-5" /> :
                                                        agent.blueprint === 'python-interpreter' ? <PythonLogo className="w-5 h-5" /> :
                                                            agent.blueprint === 'custom' ? <CustomAgentLogo className="w-5 h-5" /> :
                                                                <SparklesIcon className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium leading-none mb-1">{agent.name}</h3>
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border ${agent.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-muted-foreground/20 bg-muted/10 text-muted-foreground'}`}>
                                            <span className={`w-1 h-1 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                                            {agent.is_active ? "Active" : "Stopped"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-4">
                                {agent.shadow_mode && (
                                    <div className="flex items-center gap-1 text-emerald-600/80">
                                        <ShieldCheckIcon className="w-3 h-3" />
                                        Shadow Mode
                                    </div>
                                )}
                                <div className="flex items-center gap-1">
                                    <CpuChipIcon className="w-3 h-3" />
                                    {agent.agent_configs?.model || "Not configured"}
                                </div>
                            </div>

                            <Button variant="outline" size="sm" className="w-full h-8 text-xs" asChild>
                                <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/agents/${agent.id}`}>
                                    Manage Agent
                                </Link>
                            </Button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 rounded-xl border border-dashed border-border/40 bg-muted/5">
                    <div className="w-12 h-12 bg-muted/50 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <SparklesIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium mb-1">No agents deployed</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
                        Deploy your first autonomous agent to allow it to perform complex tasks on your behalf.
                    </p>
                    <Button size="sm" asChild>
                        <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/agents/new`}>
                            Deploy Agent
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
