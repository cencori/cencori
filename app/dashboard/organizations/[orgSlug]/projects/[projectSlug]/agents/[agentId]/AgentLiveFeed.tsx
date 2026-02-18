"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, Terminal, MousePointer2, Loader2, AlertTriangle, PlayCircle } from "lucide-react";
import { toast } from "sonner";

interface AgentAction {
    id: string;
    type: string;
    payload: any;
    status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
    screenshot_url?: string;
    created_at: string;
}

interface AgentLiveFeedProps {
    agentId: string;
}

export default function AgentLiveFeed({ agentId }: AgentLiveFeedProps) {
    const [actions, setActions] = useState<AgentAction[]>([]);
    const [loading, setLoading] = useState(true);

    // Initial Fetch
    useEffect(() => {
        const fetchActions = async () => {
            const { data, error } = await supabase
                .from('agent_actions')
                .select('*')
                .eq('agent_id', agentId)
                .order('created_at', { ascending: false })
                .limit(50); // Last 50 actions

            if (error) {
                console.error("Error fetching actions:", error);
            } else {
                setActions(data || []);
            }
            setLoading(false);
        };

        fetchActions();

        // Subscribe to Realtime Updates
        const channel = supabase
            .channel('agent-live-feed')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'agent_actions',
                    filter: `agent_id=eq.${agentId}`,
                },
                (payload: any) => {
                    setActions((prev) => [payload.new as AgentAction, ...prev]);
                    if ((payload.new as AgentAction).status === 'pending') {
                        // Play a sound or notify?
                        toast.info("New Action Request Pending Approval");
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'agent_actions',
                    filter: `agent_id=eq.${agentId}`,
                },
                (payload: any) => {
                    setActions((prev) =>
                        prev.map((action) =>
                            action.id === payload.new.id ? (payload.new as AgentAction) : action
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [agentId]);

    const handleAction = async (actionId: string, status: 'approved' | 'rejected') => {
        const { error } = await supabase
            .from('agent_actions')
            .update({ status, approved_at: new Date().toISOString() })
            .eq('id', actionId);

        if (error) {
            toast.error("Failed to update action status");
        } else {
            toast.success(`Action ${status}`);
        }
    };

    const pendingActions = actions.filter(a => a.status === 'pending');
    const historyActions = actions.filter(a => a.status !== 'pending');

    return (
        <div className="space-y-6">
            {/* Pending Requests (Shadow Mode) */}
            {pendingActions.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium flex items-center gap-2 text-amber-500 animate-pulse">
                        <AlertTriangle className="w-4 h-4" />
                        Pending Approval ({pendingActions.length})
                    </h3>
                    <div className="grid gap-4">
                        {pendingActions.map((action) => (
                            <Card key={action.id} className="border-amber-500/50 bg-amber-500/5 overflow-hidden">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <CardTitle className="text-base font-mono flex items-center gap-2">
                                                {action.type === 'tool_call' ? <Terminal className="w-4 h-4" /> : <MousePointer2 className="w-4 h-4" />}
                                                {action.payload?.tool || action.type}
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                {new Date(action.created_at).toLocaleTimeString()}
                                            </CardDescription>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">
                                            WAITING
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-background/50 rounded-md p-3 font-mono text-xs overflow-x-auto mb-4 border border-border/50">
                                        <pre>{JSON.stringify(action.payload, null, 2)}</pre>
                                    </div>

                                    {/* Screenshot Preview */}
                                    {action.screenshot_url && (
                                        <div className="mb-4 rounded-md overflow-hidden border border-border/50">
                                            <img src={action.screenshot_url} alt="Agent View" className="w-full object-cover" />
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <Button
                                            size="sm"
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                            onClick={() => handleAction(action.id, 'approved')}
                                        >
                                            <Check className="w-4 h-4 mr-2" /> Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={() => handleAction(action.id, 'rejected')}
                                        >
                                            <X className="w-4 h-4 mr-2" /> Reject
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Action History */}
            <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Activity Log</h3>
                <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/20">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : historyActions.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            No recent activity. Active your agent to see live updates.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {historyActions.map((action) => (
                                <div key={action.id} className="flex gap-3 text-sm group">
                                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${action.status === 'executed' ? 'bg-green-500' :
                                        action.status === 'rejected' ? 'bg-red-500' : 'bg-gray-400'
                                        }`} />
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium font-mono text-xs">
                                                {action.payload?.tool || action.type}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(action.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground break-all line-clamp-2">
                                            {JSON.stringify(action.payload)}
                                        </p>
                                        {action.status === 'rejected' && (
                                            <p className="text-[10px] text-red-500">Action blocked by user.</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
        </div>
    );
}
