"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { 
    Mail, 
    MessageSquare, 
    Lightbulb, 
    CheckCircle2, 
    Clock, 
    Search,
    ChevronRight,
    User,
    Calendar,
    Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function FeedbackDashboard() {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<string>("all");

    const { data: feedback = [], isLoading } = useQuery({
        queryKey: ["internalFeedback"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("feedback")
                .select(`
                    *,
                    user:user_id (email),
                    project:project_id (name, slug)
                `)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data;
        },
    });

    const filteredFeedback = feedback.filter((item: any) => {
        const matchesSearch = 
            item.content.toLowerCase().includes(search.toLowerCase()) ||
            item.user?.email.toLowerCase().includes(search.toLowerCase());
        
        const matchesFilter = filter === "all" || item.type === filter;
        
        return matchesSearch && matchesFilter;
    });

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'integration_suggestion': return <Lightbulb className="h-3.5 w-3.5 text-amber-500" />;
            case 'general': return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />;
            default: return <Mail className="h-3.5 w-3.5 text-muted-foreground" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'new': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-1.5 py-0 text-[10px]">New</Badge>;
            case 'reviewed': return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-1.5 py-0 text-[10px]">Reviewed</Badge>;
            case 'implemented': return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1.5 py-0 text-[10px]">Implemented</Badge>;
            default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold">User Feedback</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Manage and review user suggestions and integration requests.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search feedback..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-9 w-full sm:w-64 pl-8 text-xs"
                        />
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="h-9 w-32 text-xs">
                            <Filter className="h-3 w-3 mr-2" />
                            <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All types</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="integration_suggestion">Suggestions</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border/40 bg-card/30 p-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Feedback</p>
                    <p className="text-2xl font-bold">{feedback.length}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/30 p-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">New Submissions</p>
                    <p className="text-2xl font-bold text-blue-500">{feedback.filter((f: any) => f.status === 'new').length}</p>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/30 p-4 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Integration Requests</p>
                    <p className="text-2xl font-bold text-amber-500">{feedback.filter((f: any) => f.type === 'integration_suggestion').length}</p>
                </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-card/30 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/40 bg-muted/20">
                                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Type</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Content</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">User</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Project</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Date</th>
                                <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-4 py-4 h-12 bg-muted/5"></td>
                                    </tr>
                                ))
                            ) : filteredFeedback.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-xs text-muted-foreground">
                                        No feedback found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredFeedback.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-muted/10 transition-colors group">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                {getTypeIcon(item.type)}
                                                <span className="text-[11px] capitalize text-muted-foreground">
                                                    {item.type.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 max-w-md">
                                            <p className="text-xs font-medium text-foreground line-clamp-2">
                                                {item.content}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {item.user?.email || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {item.project ? (
                                                <span className="text-[11px] text-muted-foreground">
                                                    {item.project.name}
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-muted-foreground/40">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                <Calendar className="h-3 w-3" />
                                                {format(new Date(item.created_at), "MMM d, yyyy")}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {getStatusBadge(item.status)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Minimal Select components since we need them
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
