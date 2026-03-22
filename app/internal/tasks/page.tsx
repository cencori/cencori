'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, Filter, LayoutGrid, List, X, MessageSquare,
    Calendar, Tag, User, ChevronDown, AlertCircle, Clock, CheckCircle2,
    Inbox, ArrowUpCircle, ArrowRightCircle, Circle, Trash2, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Task {
    id: string;
    title: string;
    description: string;
    department: Department;
    status: Status;
    priority: Priority;
    assignee_email: string | null;
    due_date: string | null;
    tags: string[];
    position: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

interface Comment {
    id: string;
    task_id: string;
    body: string;
    author_email: string;
    created_at: string;
}

type Department = 'engineering' | 'sales' | 'marketing' | 'product' | 'operations';
type Status = 'backlog' | 'todo' | 'in_progress' | 'done';
type Priority = 'critical' | 'high' | 'medium' | 'low';
type ViewMode = 'board' | 'list';

const DEPARTMENTS: { value: Department; label: string; color: string }[] = [
    { value: 'engineering', label: 'Engineering', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { value: 'sales', label: 'Sales', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { value: 'marketing', label: 'Marketing', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { value: 'product', label: 'Product', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { value: 'operations', label: 'Operations', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
];

const STATUSES: { value: Status; label: string; icon: typeof Inbox }[] = [
    { value: 'backlog', label: 'Backlog', icon: Inbox },
    { value: 'todo', label: 'To Do', icon: Circle },
    { value: 'in_progress', label: 'In Progress', icon: Clock },
    { value: 'done', label: 'Done', icon: CheckCircle2 },
];

const PRIORITIES: { value: Priority; label: string; color: string; icon: typeof AlertCircle }[] = [
    { value: 'critical', label: 'Critical', color: 'text-red-400', icon: AlertCircle },
    { value: 'high', label: 'High', color: 'text-orange-400', icon: ArrowUpCircle },
    { value: 'medium', label: 'Medium', color: 'text-yellow-400', icon: ArrowRightCircle },
    { value: 'low', label: 'Low', color: 'text-muted-foreground/50', icon: Circle },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emailToName(email: string): string {
    return email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function emailToInitial(email: string): string {
    return email.charAt(0).toUpperCase();
}

function relativeDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays}d`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function InternalTasksPage() {
    const queryClient = useQueryClient();

    // State
    const [viewMode, setViewMode] = useState<ViewMode>('board');
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState<Department | 'all'>('all');
    const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [createDefaults, setCreateDefaults] = useState<Partial<Task>>({});

    // Queries
    const { data, isLoading } = useQuery({
        queryKey: ['internal-tasks'],
        queryFn: async () => {
            const res = await fetch('/api/internal/tasks');
            if (!res.ok) throw new Error('Failed to fetch');
            return res.json() as Promise<{ tasks: Task[] }>;
        },
        refetchInterval: 5000,
    });

    const tasks = data?.tasks || [];

    // Mutations
    const createTask = useMutation({
        mutationFn: async (task: Partial<Task>) => {
            const res = await fetch('/api/internal/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task),
            });
            if (!res.ok) throw new Error('Failed to create');
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal-tasks'] }),
    });

    const updateTask = useMutation({
        mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
            const res = await fetch(`/api/internal/tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update');
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal-tasks'] }),
    });

    const deleteTask = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/internal/tasks/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['internal-tasks'] });
            setSelectedTask(null);
        },
    });

    // Filter
    const filtered = useMemo(() => {
        let result = tasks;
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(t =>
                t.title.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.tags.some(tag => tag.toLowerCase().includes(q))
            );
        }
        if (filterDept !== 'all') result = result.filter(t => t.department === filterDept);
        if (filterPriority !== 'all') result = result.filter(t => t.priority === filterPriority);
        return result;
    }, [tasks, search, filterDept, filterPriority]);

    // Stats
    const stats = useMemo(() => ({
        total: tasks.length,
        backlog: tasks.filter(t => t.status === 'backlog').length,
        todo: tasks.filter(t => t.status === 'todo').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        done: tasks.filter(t => t.status === 'done').length,
    }), [tasks]);

    const handleQuickCreate = useCallback((status: Status) => {
        setCreateDefaults({ status });
        setShowCreateDialog(true);
    }, []);

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Tasks</h1>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {stats.total} total &middot; {stats.in_progress} in progress &middot; {stats.done} done
                        </p>
                    </div>
                    <button
                        onClick={() => { setCreateDefaults({}); setShowCreateDialog(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                        New Task
                    </button>
                </div>

                {/* Toolbar */}
                <div className="space-y-3">
                    <div className="flex gap-2 w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search tasks..."
                                className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/40 bg-card/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>
                        <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/30 shrink-0">
                            <button
                                onClick={() => setViewMode('board')}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    viewMode === 'board' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={cn(
                                    "p-1.5 rounded-md transition-colors",
                                    viewMode === 'list' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <List className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={filterDept}
                            onChange={e => setFilterDept(e.target.value as Department | 'all')}
                            className="flex-1 sm:flex-none h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                        >
                            <option value="all">All Depts</option>
                            {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                        <select
                            value={filterPriority}
                            onChange={e => setFilterPriority(e.target.value as Priority | 'all')}
                            className="flex-1 sm:flex-none h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                        >
                            <option value="all">All Priority</option>
                            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">
                        Loading tasks...
                    </div>
                ) : viewMode === 'board' ? (
                    <BoardView
                        tasks={filtered}
                        onTaskClick={setSelectedTask}
                        onStatusChange={(id, status) => updateTask.mutate({ id, status })}
                        onQuickCreate={handleQuickCreate}
                    />
                ) : (
                    <>
                        {/* List view: table on md+, cards on mobile */}
                        <div className="hidden md:block">
                            <ListView
                                tasks={filtered}
                                onTaskClick={setSelectedTask}
                                onStatusChange={(id, status) => updateTask.mutate({ id, status })}
                            />
                        </div>
                        <div className="md:hidden space-y-1.5">
                            {filtered.length === 0 ? (
                                <div className="text-center py-16 text-muted-foreground/50 text-xs">No tasks found.</div>
                            ) : filtered.map(task => (
                                <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Create Dialog */}
            {showCreateDialog && (
                <CreateTaskDialog
                    defaults={createDefaults}
                    onClose={() => setShowCreateDialog(false)}
                    onCreate={(task) => {
                        createTask.mutate(task);
                        setShowCreateDialog(false);
                    }}
                />
            )}

            {/* Task Detail Drawer */}
            {selectedTask && (
                <TaskDetailDrawer
                    task={selectedTask}
                    onClose={() => setSelectedTask(null)}
                    onUpdate={(updates) => {
                        updateTask.mutate({ id: selectedTask.id, ...updates });
                        setSelectedTask({ ...selectedTask, ...updates });
                    }}
                    onDelete={() => deleteTask.mutate(selectedTask.id)}
                />
            )}
        </div>
    );
}

// ─── Board View ──────────────────────────────────────────────────────────────

function BoardView({
    tasks,
    onTaskClick,
    onStatusChange,
    onQuickCreate,
}: {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
    onStatusChange: (id: string, status: Status) => void;
    onQuickCreate: (status: Status) => void;
}) {
    return (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:overflow-visible md:pb-0">
            {STATUSES.map(col => {
                const colTasks = tasks.filter(t => t.status === col.value);
                const Icon = col.icon;
                return (
                    <div key={col.value} className="space-y-2 min-w-[280px] snap-start md:min-w-0">
                        {/* Column header */}
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                                    {col.label}
                                </span>
                                <span className="text-[10px] text-muted-foreground/40 ml-1">
                                    {colTasks.length}
                                </span>
                            </div>
                            <button
                                onClick={() => onQuickCreate(col.value)}
                                className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-foreground transition-colors"
                            >
                                <Plus className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Cards */}
                        <div className="space-y-1.5 min-h-[100px]">
                            {colTasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onClick={() => onTaskClick(task)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Task Card ───────────────────────────────────────────────────────────────

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
    const dept = DEPARTMENTS.find(d => d.value === task.department);
    const priority = PRIORITIES.find(p => p.value === task.priority);
    const PriorityIcon = priority?.icon || Circle;

    return (
        <button
            onClick={onClick}
            className="w-full text-left p-3 rounded-xl border border-border/30 bg-card/60 hover:border-border/50 hover:bg-card/80 transition-all group"
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 flex-1">
                    {task.title}
                </p>
                <PriorityIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", priority?.color)} />
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
                {dept && (
                    <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", dept.color)}>
                        {dept.label}
                    </span>
                )}
                {task.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="text-[9px] text-muted-foreground/50 bg-muted/30 px-1.5 py-0.5 rounded-full">
                        {tag}
                    </span>
                ))}
            </div>

            <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-2">
                    {task.due_date && (
                        <span className={cn(
                            "text-[10px] flex items-center gap-1",
                            new Date(task.due_date) < new Date() && task.status !== 'done'
                                ? "text-red-400"
                                : "text-muted-foreground/50"
                        )}>
                            <Calendar className="h-2.5 w-2.5" />
                            {relativeDate(task.due_date)}
                        </span>
                    )}
                </div>
                {task.assignee_email && (
                    <div className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center text-[9px] font-medium text-muted-foreground" title={task.assignee_email}>
                        {emailToInitial(task.assignee_email)}
                    </div>
                )}
            </div>
        </button>
    );
}

// ─── List View ───────────────────────────────────────────────────────────────

function ListView({
    tasks,
    onTaskClick,
    onStatusChange,
}: {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
    onStatusChange: (id: string, status: Status) => void;
}) {
    return (
        <div className="border border-border/30 rounded-2xl overflow-hidden bg-card/30">
            <table className="w-full text-sm table-fixed">
                <thead>
                    <tr className="border-b border-border/30">
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[5%]" />
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[35%]">Task</th>
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[12%]">Status</th>
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[12%]">Dept</th>
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[12%]">Priority</th>
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[12%]">Assignee</th>
                        <th className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/60 w-[12%]">Due</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                    {tasks.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center py-16 text-muted-foreground/50 text-xs">
                                No tasks found.
                            </td>
                        </tr>
                    ) : tasks.map(task => {
                        const priority = PRIORITIES.find(p => p.value === task.priority);
                        const dept = DEPARTMENTS.find(d => d.value === task.department);
                        const statusCfg = STATUSES.find(s => s.value === task.status);
                        const PriorityIcon = priority?.icon || Circle;
                        const StatusIcon = statusCfg?.icon || Circle;

                        return (
                            <tr
                                key={task.id}
                                onClick={() => onTaskClick(task)}
                                className="hover:bg-muted/15 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-2.5">
                                    <PriorityIcon className={cn("h-3.5 w-3.5", priority?.color)} />
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className="text-xs font-medium text-foreground truncate block">{task.title}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                    <select
                                        value={task.status}
                                        onChange={e => { e.stopPropagation(); onStatusChange(task.id, e.target.value as Status); }}
                                        onClick={e => e.stopPropagation()}
                                        className="text-[10px] bg-transparent border border-border/30 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                                    >
                                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </td>
                                <td className="px-4 py-2.5">
                                    {dept && (
                                        <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", dept.color)}>
                                            {dept.label}
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-2.5">
                                    <span className={cn("text-[10px]", priority?.color)}>{priority?.label}</span>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-muted-foreground/60 truncate">
                                    {task.assignee_email ? emailToName(task.assignee_email) : '—'}
                                </td>
                                <td className="px-4 py-2.5">
                                    {task.due_date ? (
                                        <span className={cn(
                                            "text-[10px]",
                                            new Date(task.due_date) < new Date() && task.status !== 'done'
                                                ? "text-red-400"
                                                : "text-muted-foreground/50"
                                        )}>
                                            {relativeDate(task.due_date)}
                                        </span>
                                    ) : <span className="text-[10px] text-muted-foreground/30">—</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Create Task Dialog ──────────────────────────────────────────────────────

function CreateTaskDialog({
    defaults,
    onClose,
    onCreate,
}: {
    defaults: Partial<Task>;
    onClose: () => void;
    onCreate: (task: Partial<Task>) => void;
}) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [department, setDepartment] = useState<Department>(defaults.department || 'engineering');
    const [status, setStatus] = useState<Status>(defaults.status || 'todo');
    const [priority, setPriority] = useState<Priority>('medium');
    const [assignee, setAssignee] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !tags.includes(t)) {
            setTags([...tags, t]);
            setTagInput('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-background border border-border/40 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg md:mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                    <h2 className="text-sm font-semibold">New Task</h2>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-4">
                    {/* Title */}
                    <input
                        autoFocus
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Task title..."
                        className="w-full text-sm font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
                    />

                    {/* Description */}
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Add a description..."
                        rows={3}
                        className="w-full text-xs bg-muted/20 rounded-lg p-3 border border-border/30 outline-none resize-none placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20"
                    />

                    {/* Fields grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Department</label>
                            <select
                                value={department}
                                onChange={e => setDepartment(e.target.value as Department)}
                                className="w-full h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Status</label>
                            <select
                                value={status}
                                onChange={e => setStatus(e.target.value as Status)}
                                className="w-full h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Priority</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(e.target.value as Priority)}
                                className="w-full h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            >
                                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Due Date</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Assignee */}
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Assignee Email</label>
                        <input
                            value={assignee}
                            onChange={e => setAssignee(e.target.value)}
                            placeholder="name@cencori.com"
                            className="w-full h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Tags</label>
                        <div className="flex gap-2">
                            <input
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                placeholder="Add tag..."
                                className="flex-1 h-8 px-2 rounded-lg border border-border/40 bg-card/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                            />
                            <button onClick={addTag} className="h-8 px-3 rounded-lg border border-border/40 text-xs hover:bg-muted/50 transition-colors">
                                Add
                            </button>
                        </div>
                        {tags.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                                {tags.map(tag => (
                                    <span key={tag} className="text-[10px] bg-muted/30 px-2 py-0.5 rounded-full flex items-center gap-1 text-muted-foreground">
                                        {tag}
                                        <button onClick={() => setTags(tags.filter(t => t !== tag))}>
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/30">
                    <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                    </button>
                    <button
                        disabled={!title.trim()}
                        onClick={() => onCreate({
                            title,
                            description,
                            department,
                            status,
                            priority,
                            assignee_email: assignee || undefined,
                            due_date: dueDate || undefined,
                            tags,
                        } as Partial<Task>)}
                        className="px-4 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                        Create Task
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Task Detail Drawer ──────────────────────────────────────────────────────

function TaskDetailDrawer({
    task,
    onClose,
    onUpdate,
    onDelete,
}: {
    task: Task;
    onClose: () => void;
    onUpdate: (updates: Partial<Task>) => void;
    onDelete: () => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(task.title);
    const [editDescription, setEditDescription] = useState(task.description);
    const [commentText, setCommentText] = useState('');
    const [tagInput, setTagInput] = useState('');
    const queryClient = useQueryClient();

    const { data: commentsData } = useQuery({
        queryKey: ['task-comments', task.id],
        queryFn: async () => {
            const res = await fetch(`/api/internal/tasks/${task.id}/comments`);
            if (!res.ok) throw new Error('Failed');
            return res.json() as Promise<{ comments: Comment[] }>;
        },
        refetchInterval: 5000,
    });

    const addComment = useMutation({
        mutationFn: async (body: string) => {
            const res = await fetch(`/api/internal/tasks/${task.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body }),
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['task-comments', task.id] });
            setCommentText('');
        },
    });

    const comments = commentsData?.comments || [];
    const dept = DEPARTMENTS.find(d => d.value === task.department);
    const priority = PRIORITIES.find(p => p.value === task.priority);

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !task.tags.includes(t)) {
            onUpdate({ tags: [...task.tags, t] });
            setTagInput('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full md:max-w-lg bg-background border-l border-border/40 h-full overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 flex items-center justify-between px-5 py-3 border-b border-border/30">
                    <div className="flex items-center gap-2">
                        {dept && (
                            <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full border", dept.color)}>
                                {dept.label}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => { if (confirm('Delete this task?')) onDelete(); }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="px-5 py-4 space-y-5">
                    {/* Title */}
                    {isEditing ? (
                        <div className="space-y-2">
                            <input
                                autoFocus
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="w-full text-sm font-semibold bg-transparent border-b border-border/40 pb-1 outline-none"
                            />
                            <textarea
                                value={editDescription}
                                onChange={e => setEditDescription(e.target.value)}
                                rows={4}
                                className="w-full text-xs bg-muted/20 rounded-lg p-3 border border-border/30 outline-none resize-none"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        onUpdate({ title: editTitle, description: editDescription });
                                        setIsEditing(false);
                                    }}
                                    className="px-3 py-1 rounded-lg bg-foreground text-background text-xs font-medium"
                                >
                                    Save
                                </button>
                                <button onClick={() => setIsEditing(false)} className="px-3 py-1 rounded-lg text-xs text-muted-foreground">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div onClick={() => setIsEditing(true)} className="cursor-pointer group">
                            <h2 className="text-sm font-semibold group-hover:text-primary transition-colors">{task.title}</h2>
                            {task.description ? (
                                <p className="text-xs text-muted-foreground/60 mt-1 whitespace-pre-wrap">{task.description}</p>
                            ) : (
                                <p className="text-xs text-muted-foreground/30 mt-1 italic">Click to add description...</p>
                            )}
                        </div>
                    )}

                    {/* Properties */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 w-20">Status</span>
                            <select
                                value={task.status}
                                onChange={e => onUpdate({ status: e.target.value as Status })}
                                className="text-xs bg-transparent border border-border/30 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                            >
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 w-20">Priority</span>
                            <select
                                value={task.priority}
                                onChange={e => onUpdate({ priority: e.target.value as Priority })}
                                className={cn("text-xs bg-transparent border border-border/30 rounded-lg px-2 py-1 focus:outline-none cursor-pointer", priority?.color)}
                            >
                                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 w-20">Dept</span>
                            <select
                                value={task.department}
                                onChange={e => onUpdate({ department: e.target.value as Department })}
                                className="text-xs bg-transparent border border-border/30 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                            >
                                {DEPARTMENTS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 w-20">Assignee</span>
                            <input
                                value={task.assignee_email || ''}
                                onChange={e => onUpdate({ assignee_email: e.target.value || null })}
                                placeholder="name@cencori.com"
                                className="text-xs bg-transparent border border-border/30 rounded-lg px-2 py-1 focus:outline-none text-right placeholder:text-muted-foreground/30 w-48"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 w-20">Due</span>
                            <input
                                type="date"
                                value={task.due_date || ''}
                                onChange={e => onUpdate({ due_date: e.target.value || null })}
                                className="text-xs bg-transparent border border-border/30 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">Tags</span>
                        <div className="flex gap-1.5 flex-wrap">
                            {task.tags.map(tag => (
                                <span key={tag} className="text-[10px] bg-muted/30 px-2 py-0.5 rounded-full flex items-center gap-1 text-muted-foreground">
                                    {tag}
                                    <button onClick={() => onUpdate({ tags: task.tags.filter(t => t !== tag) })}>
                                        <X className="h-2.5 w-2.5" />
                                    </button>
                                </span>
                            ))}
                            <div className="flex gap-1">
                                <input
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                    placeholder="+ tag"
                                    className="text-[10px] w-16 bg-transparent border-b border-border/30 outline-none placeholder:text-muted-foreground/30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="text-[10px] text-muted-foreground/40 space-y-0.5">
                        <p>Created by {emailToName(task.created_by)} &middot; {timeAgo(task.created_at)}</p>
                        <p>Updated {timeAgo(task.updated_at)}</p>
                    </div>

                    {/* Comments */}
                    <div className="space-y-3 pt-3 border-t border-border/20">
                        <div className="flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/50" />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
                                Comments ({comments.length})
                            </span>
                        </div>

                        {comments.map(comment => (
                            <div key={comment.id} className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                                        {emailToInitial(comment.author_email)}
                                    </div>
                                    <span className="text-[10px] font-medium">{emailToName(comment.author_email)}</span>
                                    <span className="text-[10px] text-muted-foreground/40">{timeAgo(comment.created_at)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground/70 ml-7 whitespace-pre-wrap">{comment.body}</p>
                            </div>
                        ))}

                        {/* Add comment */}
                        <div className="flex gap-2">
                            <input
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) {
                                        e.preventDefault();
                                        addComment.mutate(commentText.trim());
                                    }
                                }}
                                placeholder="Write a comment..."
                                className="flex-1 h-8 px-3 rounded-lg border border-border/30 bg-muted/20 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30"
                            />
                            <button
                                disabled={!commentText.trim()}
                                onClick={() => commentText.trim() && addComment.mutate(commentText.trim())}
                                className="h-8 px-3 rounded-lg bg-foreground text-background disabled:opacity-30 transition-opacity"
                            >
                                <Send className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
