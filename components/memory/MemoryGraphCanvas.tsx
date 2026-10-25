'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemoryBasePath } from '@/components/memory/MemoryRoute';
import { useMemoryOverview } from '@/components/memory/MemoryOverview';
import { MemoryUserPicker } from '@/components/memory/MemoryUserPicker';
import { cn } from '@/lib/utils';

interface GraphMap {
    truncated: boolean;
    memories: {
        id: string;
        userId: string;
        content: string;
        namespace: string | null;
        importance: number;
        accessCount: number;
        status: string;
        createdAt: string;
    }[];
    updates: { from: string; to: string }[];
    entities: { id: string; userId: string; name: string; type: string; mentions: number }[];
    mentions: { memory: string; entity: string }[];
    relations: { source: string; target: string; relation: string }[];
}

type NodeKind = 'user' | 'memory' | 'entity';
type EdgeKind = 'owns' | 'update' | 'mention' | 'relation';

interface LayoutNode {
    id: string;
    kind: NodeKind;
    x: number;
    y: number;
}

interface LayoutEdge {
    source: string;
    target: string;
    kind: EdgeKind;
    label?: string;
    /** Rest length override; memories ring their user at a radius that fits them. */
    distance?: number;
}

const MEMORY_COLOR = '#3b82f6';
const UPDATE_COLOR = '#8b5cf6';
const ENTITY_COLORS: Record<string, string> = {
    person: '#3b82f6',
    org: '#8b5cf6',
    place: '#10b981',
    project: '#f59e0b',
};
const ENTITY_FALLBACK_COLOR = '#14b8a6';
// Live springs: every node is pulled toward its home and along its edges.
// Low damping is what makes drags and the load-in feel bouncy.
const SPRING_HOME = 0.022;
const SPRING_EDGE = 0.012;
const DAMPING = 0.91;
const REST_SPEED = 0.02;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const USER_PREFIX = 'user:';
const userNodeId = (userId: string) => `${USER_PREFIX}${userId}`;

/**
 * A stable pseudo-random number in [0, 1) for an id, so the scatter looks
 * organic but a graph lands in the same shape on every load.
 */
function seeded(id: string, salt = 0): number {
    let hash = 2166136261 ^ salt;
    for (let i = 0; i < id.length; i++) {
        hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
    }
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/** How far a memory sits from its user, as a share of the ring radius: scattered, not a ring. */
function spokeLength(memoryId: string): number {
    return 0.45 + 0.85 * seeded(memoryId, 1);
}

/** Ring radius that fits a user's memories without them piling up. */
function ringRadius(memoryCount: number): number {
    return Math.max(150, (memoryCount * 16) / (2 * Math.PI));
}

/**
 * One anchor per end-user, biggest first, walked out along a spiral until its
 * cluster clears every cluster already placed.
 */
function placeUsers(users: { id: string; radius: number }[]): Map<string, { x: number; y: number }> {
    const placed: { x: number; y: number; radius: number }[] = [];
    const anchors = new Map<string, { x: number; y: number }>();
    for (const user of users) {
        let t = 0;
        for (;;) {
            const angle = t * 0.5;
            const x = Math.cos(angle) * t * 28;
            const y = Math.sin(angle) * t * 28;
            if (placed.every((p) => Math.hypot(p.x - x, p.y - y) > p.radius + user.radius + 140)) {
                placed.push({ x, y, radius: user.radius });
                anchors.set(user.id, { x, y });
                break;
            }
            t += 1;
        }
    }
    return anchors;
}

/** Rest length per edge kind: memories ring the user, entities sit close to the facts naming them. */
const LINK_DISTANCE: Record<EdgeKind, number> = { owns: 230, update: 70, mention: 95, relation: 120 };

function hexagonPoints(r: number): string {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
    }).join(' ');
}

/**
 * A small deterministic force layout — repulsion between every pair, springs on
 * edges, the user pinned at the origin. Graphs here are capped at a few hundred
 * nodes, so a fixed number of synchronous ticks is cheap and the picture is the
 * same on every load.
 */
function layoutGraph(
    nodes: { id: string; kind: NodeKind; userId: string }[],
    edges: LayoutEdge[],
    anchors: Map<string, { x: number; y: number }>,
): Map<string, LayoutNode> {
    const placed = new Map<string, LayoutNode & { vx: number; vy: number }>();
    const golden = Math.PI * (3 - Math.sqrt(5));

    // Users are pinned at their anchors; memories start on a ring around their
    // user, entities a little further out.
    const ringIndex = new Map<string, number>();
    const ringSize = new Map<string, number>();
    for (const node of nodes) if (node.kind === 'memory') ringSize.set(node.userId, (ringSize.get(node.userId) ?? 0) + 1);
    for (const node of nodes) {
        const anchor = anchors.get(node.userId) ?? { x: 0, y: 0 };
        if (node.kind === 'user') {
            placed.set(node.id, { id: node.id, kind: 'user', x: anchor.x, y: anchor.y, vx: 0, vy: 0 });
            continue;
        }
        const count = ringSize.get(node.userId) ?? 1;
        const index = ringIndex.get(node.userId) ?? 0;
        ringIndex.set(node.userId, index + 1);
        const radius = node.kind === 'memory' ? ringRadius(count) * spokeLength(node.id) : ringRadius(count) + 90;
        // Spread evenly around the user, then knock each one off its slot.
        const jitter = (seeded(node.id, 2) - 0.5) * ((2 * Math.PI) / Math.max(count, 1)) * 1.6;
        const angle = node.kind === 'memory' ? (2 * Math.PI * index) / Math.max(count, 1) + jitter : index * golden;
        placed.set(node.id, { id: node.id, kind: node.kind, x: anchor.x + radius * Math.cos(angle), y: anchor.y + radius * Math.sin(angle), vx: 0, vy: 0 });
    }

    // Entities start beside the first memory that names them, not across the canvas.
    for (const edge of edges) {
        if (edge.kind !== 'mention') continue;
        const memory = placed.get(edge.source);
        const entity = placed.get(edge.target);
        if (memory && entity && !(entity as { anchored?: boolean }).anchored) {
            const owner = edges.find((e) => e.kind === 'owns' && e.target === edge.source);
            const user = owner ? placed.get(owner.source) : undefined;
            const dx = memory.x - (user?.x ?? 0);
            const dy = memory.y - (user?.y ?? 0);
            const length = Math.hypot(dx, dy) || 1;
            entity.x = memory.x + (dx / length) * 90;
            entity.y = memory.y + (dy / length) * 90;
            (entity as { anchored?: boolean }).anchored = true;
        }
    }

    const list = [...placed.values()];
    const ticks = 220;
    for (let tick = 0; tick < ticks; tick++) {
        const alpha = 1 - tick / ticks;

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let distSq = dx * dx + dy * dy;
                if (distSq < 1) { dx = (i % 7) - 3 || 1; dy = (j % 5) - 2 || 1; distSq = dx * dx + dy * dy; }
                if (distSq > 250_000) continue;
                const force = (1800 * alpha) / distSq;
                const dist = Math.sqrt(distSq);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                a.vx -= fx; a.vy -= fy;
                b.vx += fx; b.vy += fy;
            }
        }

        for (const edge of edges) {
            const a = placed.get(edge.source);
            const b = placed.get(edge.target);
            if (!a || !b) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 1;
            const pull = ((dist - (edge.distance ?? LINK_DISTANCE[edge.kind])) / dist) * 0.08 * alpha;
            a.vx += dx * pull; a.vy += dy * pull;
            b.vx -= dx * pull; b.vy -= dy * pull;
        }

        for (const node of list) {
            if (node.kind === 'user') { node.vx = 0; node.vy = 0; continue; }
            node.x += node.vx;
            node.y += node.vy;
            node.vx *= 0.55;
            node.vy *= 0.55;
        }
    }

    return new Map(list.map((node) => [node.id, { id: node.id, kind: node.kind, x: node.x, y: node.y }]));
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortId(id: string): string {
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function EmptyGraph({ title, description }: { title: string; description: string }) {
    // A faint sketch of the graph it will become.
    const sketch: [number, number][] = [[-110, -40], [-20, -55], [-125, 25], [-65, 60], [10, 40], [95, -45], [125, 10], [75, 60]];
    return (
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <svg width="300" height="140" viewBox="-150 -70 300 140" aria-hidden className="mb-6 opacity-80">
                {sketch.map(([x, y], i) => (
                    <line key={`l${i}`} x1={i < 5 ? -55 : 55} y1={i < 5 ? 0 : -10} x2={x} y2={y} stroke="var(--border)" strokeWidth={1} />
                ))}
                <rect x={-63} y={-8} width={16} height={16} rx={3} fill="var(--muted)" stroke="var(--border)" />
                <rect x={47} y={-18} width={16} height={16} rx={3} fill="var(--muted)" stroke="var(--border)" />
                {sketch.map(([x, y], i) => (
                    <circle key={`c${i}`} cx={x} cy={y} r={4.5} fill="none" stroke={MEMORY_COLOR} strokeOpacity={0.6} />
                ))}
            </svg>
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 max-w-[46ch] text-xs text-muted-foreground">{description}</p>
            <a
                href="/docs/memory"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline"
            >
                How memory works <ArrowUpRight className="h-3 w-3" />
            </a>
        </div>
    );
}

export function MemoryGraphCanvas({ projectId }: { projectId: string }) {
    const basePath = useMemoryBasePath();
    const { data: overview, isLoading: overviewLoading } = useMemoryOverview(projectId);
    const [pickedUser, setPickedUser] = useState('');
    // Open on the end-user with the most memories, so the page never starts blank.
    const userId = pickedUser || overview?.topUsers[0]?.scopeKey || '';

    const { data, isLoading, error } = useQuery({
        queryKey: ['memoryGraphMap', projectId, userId],
        queryFn: async (): Promise<GraphMap> => {
            const response = await fetch(`/api/projects/${projectId}/memory/graph/map?userId=${encodeURIComponent(userId)}`);
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.error || 'We could not load the graph.');
            }
            return response.json();
        },
        enabled: Boolean(userId),
        staleTime: 30_000,
    });
    const noMemories = !overviewLoading && (overview?.memories.active ?? 0) + (overview?.memories.superseded ?? 0) === 0;

    const graph = useMemo(() => {
        if (!data) return null;
        const memoryCount = new Map<string, number>();
        for (const m of data.memories) memoryCount.set(m.userId, (memoryCount.get(m.userId) ?? 0) + 1);
        const userIds = [...new Set([...data.memories.map((m) => m.userId), ...data.entities.map((e) => e.userId)])]
            .sort((a, b) => (memoryCount.get(b) ?? 0) - (memoryCount.get(a) ?? 0));
        const anchors = placeUsers(userIds.map((id) => ({ id, radius: ringRadius(memoryCount.get(id) ?? 0) + 90 })));

        const mentioned = new Set(data.mentions.map((m) => m.entity));
        const nodes: { id: string; kind: NodeKind; userId: string }[] = [
            ...userIds.map((id) => ({ id: userNodeId(id), kind: 'user' as const, userId: id })),
            ...data.memories.map((m) => ({ id: m.id, kind: 'memory' as const, userId: m.userId })),
            ...data.entities.map((e) => ({ id: e.id, kind: 'entity' as const, userId: e.userId })),
        ];
        const edges: LayoutEdge[] = [
            ...data.memories.map((m) => ({
                source: userNodeId(m.userId),
                target: m.id,
                kind: 'owns' as const,
                distance: ringRadius(memoryCount.get(m.userId) ?? 0) * spokeLength(m.id),
            })),
            // An entity no shown memory names still belongs to its user.
            ...data.entities.filter((e) => !mentioned.has(e.id)).map((e) => ({
                source: userNodeId(e.userId),
                target: e.id,
                kind: 'mention' as const,
                distance: ringRadius(memoryCount.get(e.userId) ?? 0) + 90,
            })),
            ...data.updates.map((u) => ({ source: u.from, target: u.to, kind: 'update' as const })),
            ...data.mentions.map((m) => ({ source: m.memory, target: m.entity, kind: 'mention' as const })),
            ...data.relations.map((r) => ({ source: r.source, target: r.target, kind: 'relation' as const, label: r.relation })),
        ];
        return {
            positions: layoutGraph(nodes, edges, anchors),
            edges,
            userMemoryCount: memoryCount,
            memoryById: new Map(data.memories.map((m) => [m.id, m])),
            entityById: new Map(data.entities.map((e) => [e.id, e])),
            // Oldest → newest, for stepping through with the arrow keys.
            memoryOrder: [...data.memories].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((m) => m.id),
        };
    }, [data]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [view, setView] = useState({ x: 0, y: 0, k: 1 });
    const [selected, setSelected] = useState<string | null>(null);
    const [hovered, setHovered] = useState<string | null>(null);
    const [legendOpen, setLegendOpen] = useState(false);
    const drag = useRef<{
        startX: number;
        startY: number;
        viewX: number;
        viewY: number;
        moved: boolean;
        nodeId: string | null;
        /** Pointer offset from the node's centre, in graph units. */
        grabX: number;
        grabY: number;
    } | null>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const reduceMotion = useReducedMotion();

    // Physics state lives in a ref and is read during render; a frame counter
    // re-renders while the springs are moving.
    const sim = useRef(new Map<string, { x: number; y: number; vx: number; vy: number; hx: number; hy: number }>());
    const restLengths = useRef(new Map<number, number>());
    const frameRef = useRef<number | null>(null);
    const [, setFrame] = useState(0);

    const stepPhysics = useCallback(() => {
        if (!graph) return false;
        const nodes = sim.current;
        const held = drag.current?.moved ? drag.current.nodeId : null;
        const ax = new Map<string, number>();
        const ay = new Map<string, number>();
        const push = (id: string, x: number, y: number) => {
            ax.set(id, (ax.get(id) ?? 0) + x);
            ay.set(id, (ay.get(id) ?? 0) + y);
        };
        graph.edges.forEach((edge, index) => {
            const a = nodes.get(edge.source);
            const b = nodes.get(edge.target);
            if (!a || !b) return;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 1;
            const force = (dist - (restLengths.current.get(index) ?? dist)) * SPRING_EDGE;
            push(edge.source, (dx / dist) * force, (dy / dist) * force);
            push(edge.target, -(dx / dist) * force, -(dy / dist) * force);
        });
        let fastest = 0;
        for (const [id, node] of nodes) {
            if (id === held) { node.vx = 0; node.vy = 0; continue; }
            node.vx = (node.vx + (node.hx - node.x) * SPRING_HOME + (ax.get(id) ?? 0)) * DAMPING;
            node.vy = (node.vy + (node.hy - node.y) * SPRING_HOME + (ay.get(id) ?? 0)) * DAMPING;
            node.x += node.vx;
            node.y += node.vy;
            fastest = Math.max(fastest, Math.abs(node.vx), Math.abs(node.vy));
        }
        return held != null || fastest > REST_SPEED;
    }, [graph]);

    const kick = useCallback(() => {
        if (frameRef.current != null) return;
        const loop = () => {
            const moving = stepPhysics();
            setFrame((frame) => frame + 1);
            frameRef.current = moving ? requestAnimationFrame(loop) : null;
        };
        frameRef.current = requestAnimationFrame(loop);
    }, [stepPhysics]);

    // A new graph blooms out of its end-user: every node starts at the centre
    // and springs to its place. Reduced motion skips straight to the layout.
    useEffect(() => {
        if (frameRef.current != null) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
        const next = new Map<string, { x: number; y: number; vx: number; vy: number; hx: number; hy: number }>();
        restLengths.current = new Map();
        if (graph) {
            const origin = [...graph.positions.values()].find((node) => node.kind === 'user') ?? { x: 0, y: 0 };
            for (const node of graph.positions.values()) {
                const start = reduceMotion || node.kind === 'user' ? node : { x: origin.x + (node.x - origin.x) * 0.15, y: origin.y + (node.y - origin.y) * 0.15 };
                next.set(node.id, { x: start.x, y: start.y, vx: 0, vy: 0, hx: node.x, hy: node.y });
            }
            graph.edges.forEach((edge, index) => {
                const a = graph.positions.get(edge.source);
                const b = graph.positions.get(edge.target);
                if (a && b) restLengths.current.set(index, Math.hypot(b.x - a.x, b.y - a.y));
            });
        }
        sim.current = next;
        setFrame((frame) => frame + 1);
        if (graph && !reduceMotion) kick();
        return () => {
            if (frameRef.current != null) { cancelAnimationFrame(frameRef.current); frameRef.current = null; }
        };
    }, [graph, kick, reduceMotion]);

    const pos = (id: string) => sim.current.get(id) ?? graph?.positions.get(id);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [graph]);

    const fit = useCallback(() => {
        if (!graph || size.width === 0) return;
        const points = [...graph.positions.values()];
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        const minX = Math.min(...xs) - 60;
        const maxX = Math.max(...xs) + 60;
        const minY = Math.min(...ys) - 60;
        const maxY = Math.max(...ys) + 60;
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(size.width / (maxX - minX), size.height / (maxY - minY), 1.4)));
        setView({ k, x: size.width / 2 - ((minX + maxX) / 2) * k, y: size.height / 2 - ((minY + maxY) / 2) * k });
    }, [graph, size.width, size.height]);

    const center = useCallback(() => {
        setView((current) => ({ ...current, x: size.width / 2, y: size.height / 2 }));
    }, [size.width, size.height]);

    const zoomBy = useCallback((factor: number, originX = size.width / 2, originY = size.height / 2) => {
        setView((current) => {
            const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
            const ratio = k / current.k;
            return { k, x: originX - (originX - current.x) * ratio, y: originY - (originY - current.y) * ratio };
        });
    }, [size.width, size.height]);

    // Fit whenever a new graph lands or the canvas first gets a size.
    useEffect(() => {
        setSelected(null);
        fit();
    }, [graph, size.width > 0]); // eslint-disable-line react-hooks/exhaustive-deps

    // Wheel zoom needs a non-passive listener to keep the page from scrolling.
    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = element.getBoundingClientRect();
            zoomBy(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
        };
        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    }, [zoomBy, graph]);

    const step = useCallback((direction: 1 | -1) => {
        if (!graph || graph.memoryOrder.length === 0) return;
        const index = selected ? graph.memoryOrder.indexOf(selected) : -1;
        const next = index === -1
            ? graph.memoryOrder[direction === 1 ? 0 : graph.memoryOrder.length - 1]
            : graph.memoryOrder[(index + direction + graph.memoryOrder.length) % graph.memoryOrder.length];
        setSelected(next);
    }, [graph, selected]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === 'z' || event.key === 'Z') fit();
            else if (event.key === 'c' || event.key === 'C') center();
            else if (event.key === 'ArrowRight') step(1);
            else if (event.key === 'ArrowLeft') step(-1);
            else if (event.key === 'Escape') setSelected(null);
            else return;
            event.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [fit, center, step]);

    // Hover (or the selection) lights up a node and its direct neighbours.
    const focusId = hovered ?? selected;
    const neighbours = useMemo(() => {
        if (!graph || !focusId) return null;
        const set = new Set([focusId]);
        for (const edge of graph.edges) {
            if (edge.source === focusId) set.add(edge.target);
            if (edge.target === focusId) set.add(edge.source);
        }
        return set;
    }, [graph, focusId]);

    /** Screen point → graph coordinates. */
    const toGraph = (clientX: number, clientY: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        return {
            x: (clientX - (rect?.left ?? 0) - view.x) / view.k,
            y: (clientY - (rect?.top ?? 0) - view.y) / view.k,
        };
    };

    const onPointerDown = (event: React.PointerEvent) => {
        if (event.button !== 0) return;
        // Read the node now: pointer capture retargets the pointerup to the svg.
        const nodeId = (event.target as Element).closest('[data-node]')?.getAttribute('data-node') ?? null;
        const point = toGraph(event.clientX, event.clientY);
        const node = nodeId ? sim.current.get(nodeId) : undefined;
        drag.current = {
            startX: event.clientX,
            startY: event.clientY,
            viewX: view.x,
            viewY: view.y,
            moved: false,
            nodeId,
            grabX: node ? point.x - node.x : 0,
            grabY: node ? point.y - node.y : 0,
        };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: React.PointerEvent) => {
        const state = drag.current;
        if (!state) return;
        const dx = event.clientX - state.startX;
        const dy = event.clientY - state.startY;
        if (!state.moved && Math.hypot(dx, dy) < 3) return;
        if (!state.moved) {
            state.moved = true;
            if (state.nodeId) setDraggingNode(state.nodeId);
        }
        if (state.nodeId) {
            // Drag a node: it follows the pointer, its neighbours trail on springs.
            const node = sim.current.get(state.nodeId);
            if (!node) return;
            const point = toGraph(event.clientX, event.clientY);
            node.x = point.x - state.grabX;
            node.y = point.y - state.grabY;
            node.hx = node.x;
            node.hy = node.y;
            kick();
            return;
        }
        setView((current) => ({ ...current, x: state.viewX + dx, y: state.viewY + dy }));
    };
    const onPointerUp = () => {
        const state = drag.current;
        drag.current = null;
        setDraggingNode(null);
        if (!state) return;
        // Released a dragged node: it stays where it was dropped, and the
        // springs settle everything around it.
        if (state.moved && state.nodeId) { kick(); return; }
        // A click, not a pan: pin the node's card, or clear it.
        if (!state.moved) setSelected(state.nodeId);
    };

    // Hovering previews a node's card; clicking pins it with its actions.
    const cardId = draggingNode ? null : (hovered && hovered !== selected ? hovered : selected);
    const pinned = cardId != null && cardId === selected;
    const cardPosition = cardId ? pos(cardId) : null;
    const cardLeft = cardPosition ? cardPosition.x * view.k + view.x : 0;
    const cardTop = cardPosition ? cardPosition.y * view.k + view.y : 0;
    const cardOnLeft = cardLeft > size.width - (pinned ? 380 : 280);

    const renderCard = () => {
        if (!cardId || !graph || !data) return null;
        const memory = graph.memoryById.get(cardId);
        const entity = graph.entityById.get(cardId);
        const ownerId = memory?.userId ?? entity?.userId ?? cardId.slice(USER_PREFIX.length);
        const style = {
            left: Math.max(12, Math.min(cardOnLeft ? cardLeft - (pinned ? 336 : 260) : cardLeft + 20, size.width - (pinned ? 336 : 252))),
            top: Math.max(12, Math.min(cardTop - 24, size.height - 220)),
        };

        let body: React.ReactNode;
        if (memory) {
            const latest = memory.status === 'active';
            body = (
                <>
                    <p className="line-clamp-5 px-3 pt-3 text-xs leading-5">{memory.content}</p>
                    <div className="mt-3 border-t border-border/40 px-3 py-2">
                        <span className={cn('text-xs font-medium', latest ? 'text-emerald-500' : 'text-muted-foreground')}>
                            {latest ? 'Latest' : 'Superseded'}
                        </span>
                    </div>
                    <dl className="space-y-1 border-t border-border/40 px-3 py-2 text-[11px] text-muted-foreground">
                        <div className="flex justify-between gap-3"><dt>Written</dt><dd className="font-mono">{formatDate(memory.createdAt)}</dd></div>
                        <div className="flex justify-between gap-3"><dt>Recalled</dt><dd className="font-mono">{memory.accessCount === 0 ? 'never' : `${memory.accessCount}×`}</dd></div>
                        {memory.namespace && <div className="flex justify-between gap-3"><dt>Namespace</dt><dd className="truncate font-mono">{memory.namespace}</dd></div>}
                        <div className="flex justify-between gap-3"><dt>Memory</dt><dd className="font-mono">{shortId(memory.id)}</dd></div>
                    </dl>
                </>
            );
        } else if (entity) {
            const related = graph.edges.filter((e) => e.kind === 'relation' && (e.source === entity.id || e.target === entity.id));
            body = (
                <>
                    <div className="px-3 pt-3">
                        <p className="text-sm font-medium">{entity.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{entity.type} · named in {entity.mentions} {entity.mentions === 1 ? 'fact' : 'facts'}</p>
                    </div>
                    {related.length > 0 && (
                        <ul className="mt-3 space-y-1 border-t border-border/40 px-3 py-2 text-[11px]">
                            {related.slice(0, 6).map((edge, i) => {
                                const other = graph.entityById.get(edge.source === entity.id ? edge.target : edge.source);
                                return (
                                    <li key={i} className="flex items-center gap-1.5 truncate">
                                        <span className="rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{edge.label}</span>
                                        <span className="truncate">{other?.name ?? '?'}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            );
        } else {
            body = (
                <div className="px-3 py-3">
                    <p className="text-[11px] text-muted-foreground">End-user</p>
                    <p className="mt-0.5 truncate font-mono text-xs">{ownerId}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        {graph.userMemoryCount.get(ownerId) ?? 0} memories shown
                    </p>
                </div>
            );
        }

        return (
            <div
                key={cardId}
                className="pointer-events-none absolute z-10 flex gap-3 duration-150 animate-in fade-in-0 zoom-in-95"
                style={style}
            >
                <div className={cn(
                    'w-[240px] overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-lg backdrop-blur',
                    pinned && 'pointer-events-auto',
                )}>
                    {body}
                </div>
                {pinned && (
                <ul className="pointer-events-auto mt-1 space-y-1.5 text-[11px] text-muted-foreground duration-200 animate-in fade-in-0 slide-in-from-left-1">
                    <li>
                        <Link href={`${basePath}/memories?user=${encodeURIComponent(ownerId)}`} className="flex items-center gap-1.5 hover:text-foreground">
                            <ArrowUpRight className="h-3 w-3" /> Open memories
                        </Link>
                    </li>
                    <li>
                        <button type="button" onClick={() => step(1)} className="flex items-center gap-1.5 hover:text-foreground">
                            <ArrowRight className="h-3 w-3" /> Next memory
                        </button>
                    </li>
                    <li>
                        <button type="button" onClick={() => step(-1)} className="flex items-center gap-1.5 hover:text-foreground">
                            <ArrowLeft className="h-3 w-3" /> Prev memory
                        </button>
                    </li>
                    <li>
                        <button type="button" onClick={() => setSelected(null)} className="flex items-center gap-1.5 hover:text-foreground">
                            <X className="h-3 w-3" /> Close
                        </button>
                    </li>
                </ul>
                )}
            </div>
        );
    };

    const dimmed = (id: string) => neighbours != null && !neighbours.has(id);

    const picker = (
        <MemoryUserPicker
            projectId={projectId}
            value={userId}
            onChange={setPickedUser}
            source="memories"
            placeholder="Pick an end-user"
            emptyLabel="No end-user has memories yet."
            className="w-[200px] border-border/60 bg-background/90 backdrop-blur"
        />
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div
                ref={containerRef}
                className="relative min-h-0 flex-1 select-none overflow-hidden bg-background"
                style={{
                    backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
                    backgroundSize: `${18 * view.k}px ${18 * view.k}px`,
                    backgroundPosition: `${view.x}px ${view.y}px`,
                }}
            >
                {noMemories ? (
                    <EmptyGraph
                        title="Nothing to plot yet"
                        description="Every memory your users build lands here, linked to the people, places and projects it mentions."
                    />
                ) : !userId && !overviewLoading ? (
                    <EmptyGraph title="Pick an end-user" description="Each end-user has their own graph. Memories never cross that boundary." />
                ) : !userId || isLoading || overviewLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Skeleton className="h-40 w-40 rounded-full opacity-40" />
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        {error instanceof Error ? error.message : 'Could not load the graph.'}
                    </div>
                ) : !graph || data?.memories.length === 0 ? (
                    <EmptyGraph title="Nothing to plot for this end-user" description="They have no active or superseded memories." />
                ) : (
                    <>
                        <svg
                            className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerLeave={() => setHovered(null)}
                            role="img"
                            aria-label="Memory graph"
                        >
                            <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
                                {graph.edges.map((edge, index) => {
                                    const a = pos(edge.source);
                                    const b = pos(edge.target);
                                    if (!a || !b) return null;
                                    const faded = dimmed(edge.source) || dimmed(edge.target);
                                    const active = neighbours != null && !faded;
                                    const stroke = edge.kind === 'update' || edge.kind === 'relation' ? UPDATE_COLOR : 'var(--muted-foreground)';
                                    return (
                                        <g key={`${edge.kind}-${index}`} opacity={faded ? 0.08 : 1} className="transition-opacity duration-200">
                                            <line
                                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                                stroke={stroke}
                                                strokeOpacity={edge.kind === 'owns' ? (active ? 0.6 : 0.3) : edge.kind === 'mention' ? 0.35 : 0.9}
                                                strokeWidth={(edge.kind === 'update' || edge.kind === 'relation' ? 2 : 1) / Math.sqrt(view.k)}
                                                strokeDasharray={edge.kind === 'mention' ? '3 3' : undefined}
                                            />
                                            {edge.kind === 'relation' && active && edge.label && (
                                                <text
                                                    x={(a.x + b.x) / 2}
                                                    y={(a.y + b.y) / 2 - 4}
                                                    textAnchor="middle"
                                                    fontSize={10 / view.k}
                                                    fill={UPDATE_COLOR}
                                                    className="font-mono"
                                                >
                                                    {edge.label}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}

                                {[...graph.positions.values()].map((layoutNode) => {
                                    const live = pos(layoutNode.id) ?? layoutNode;
                                    const node = { ...layoutNode, x: live.x, y: live.y };
                                    const faded = dimmed(node.id);
                                    const isSelected = node.id === selected;
                                    // Hover and grab pop the node with a little overshoot.
                                    const lift = node.id === draggingNode ? 1.35 : node.id === hovered || isSelected ? 1.2 : 1;
                                    const liftStyle = {
                                        transform: `scale(${lift})`,
                                        transition: reduceMotion ? undefined : 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                                    };
                                    if (node.kind === 'user') {
                                        return (
                                            <g key={node.id} data-node={node.id} transform={`translate(${node.x},${node.y})`} opacity={faded ? 0.25 : 1}
                                                onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)}
                                                className={cn('transition-opacity duration-200', node.id === draggingNode ? 'cursor-grabbing' : 'cursor-pointer')}>
                                                <g style={liftStyle}>
                                                    <rect x={-16} y={-16} width={32} height={32} rx={5} fill="var(--muted-foreground)" fillOpacity={0.55}
                                                        stroke={isSelected ? 'var(--foreground)' : 'var(--border)'} strokeWidth={isSelected ? 2 : 1} />
                                                </g>
                                            </g>
                                        );
                                    }
                                    if (node.kind === 'memory') {
                                        const memory = graph.memoryById.get(node.id);
                                        const superseded = memory?.status !== 'active';
                                        return (
                                            <g key={node.id} data-node={node.id} transform={`translate(${node.x},${node.y})`} opacity={faded ? 0.15 : superseded ? 0.55 : 1}
                                                onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)}
                                                className={cn('transition-opacity duration-200', node.id === draggingNode ? 'cursor-grabbing' : 'cursor-pointer')}>
                                                <g style={liftStyle}>
                                                    {isSelected && <polygon points={hexagonPoints(20)} fill={MEMORY_COLOR} fillOpacity={0.15} />}
                                                    <polygon
                                                        points={hexagonPoints(12)}
                                                        fill={MEMORY_COLOR}
                                                        fillOpacity={superseded ? 0.05 : node.id === hovered ? 0.35 : 0.18}
                                                        stroke={MEMORY_COLOR}
                                                        strokeWidth={isSelected ? 2.5 : 1.5}
                                                        strokeDasharray={superseded ? '3 2' : undefined}
                                                        style={{ transition: 'fill-opacity 150ms' }}
                                                    />
                                                </g>
                                            </g>
                                        );
                                    }
                                    const entity = graph.entityById.get(node.id);
                                    const color = ENTITY_COLORS[entity?.type ?? ''] ?? ENTITY_FALLBACK_COLOR;
                                    const showLabel = view.k >= 0.75 || isSelected || node.id === hovered;
                                    return (
                                        <g key={node.id} data-node={node.id} transform={`translate(${node.x},${node.y})`} opacity={faded ? 0.15 : 1}
                                            onPointerEnter={() => setHovered(node.id)} onPointerLeave={() => setHovered(null)}
                                                className={cn('transition-opacity duration-200', node.id === draggingNode ? 'cursor-grabbing' : 'cursor-pointer')}>
                                            <g style={liftStyle}>
                                                <circle r={isSelected ? 8 : 6} fill={color} fillOpacity={0.85} stroke="var(--background)" strokeWidth={1.5} />
                                            </g>
                                            {showLabel && (
                                                <text y={18} textAnchor="middle" fontSize={11 / Math.max(view.k, 0.75)} fill="var(--muted-foreground)">
                                                    {entity && entity.name.length > 22 ? `${entity.name.slice(0, 21)}…` : entity?.name}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>

                        {renderCard()}

                        <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
                            <button type="button" onClick={fit} className="flex h-8 items-center gap-2 rounded-md border border-border/60 bg-background/90 px-2.5 text-xs backdrop-blur hover:bg-muted">
                                Fit <kbd className="rounded border border-border/60 px-1 font-mono text-[10px] text-muted-foreground">Z</kbd>
                            </button>
                            <button type="button" onClick={center} className="flex h-8 items-center gap-2 rounded-md border border-border/60 bg-background/90 px-2.5 text-xs backdrop-blur hover:bg-muted">
                                Center <kbd className="rounded border border-border/60 px-1 font-mono text-[10px] text-muted-foreground">C</kbd>
                            </button>
                            <div className="flex h-8 items-center gap-1 rounded-md border border-border/60 bg-background/90 px-2 text-xs backdrop-blur">
                                <span className="w-9 font-mono tabular-nums">{Math.round(view.k * 100)}%</span>
                                <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)} className="rounded p-0.5 hover:bg-muted"><Minus className="h-3 w-3" /></button>
                                <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className="rounded p-0.5 hover:bg-muted"><Plus className="h-3 w-3" /></button>
                            </div>
                            <div className="w-[200px] overflow-hidden rounded-md border border-border/60 bg-background/90 text-xs backdrop-blur">
                                <button type="button" onClick={() => setLegendOpen((open) => !open)} className="flex h-8 w-full items-center gap-1.5 px-2.5 hover:bg-muted">
                                    <ChevronRight className={cn('h-3 w-3 transition-transform', legendOpen && 'rotate-90')} />
                                    Legend
                                </button>
                                {legendOpen && (
                                    <ul className="space-y-2 border-t border-border/40 px-3 py-2.5 text-[11px] text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="-7 -7 14 14"><rect x={-6} y={-6} width={12} height={12} rx={2} fill="var(--muted-foreground)" fillOpacity={0.55} /></svg>
                                            End-user
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="-7 -7 14 14"><polygon points={hexagonPoints(6)} fill={MEMORY_COLOR} fillOpacity={0.18} stroke={MEMORY_COLOR} /></svg>
                                            Memory
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="-7 -7 14 14"><polygon points={hexagonPoints(6)} fill="none" stroke={MEMORY_COLOR} strokeDasharray="2 2" opacity={0.6} /></svg>
                                            Superseded memory
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="-7 -7 14 14"><circle r={4} fill={ENTITY_COLORS.person} /></svg>
                                            Entity (person, org, place, project)
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 14 14"><line x1={0} y1={7} x2={14} y2={7} stroke={UPDATE_COLOR} strokeWidth={2} /></svg>
                                            Update or relation
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <svg width="14" height="14" viewBox="0 0 14 14"><line x1={0} y1={7} x2={14} y2={7} stroke="currentColor" strokeDasharray="3 3" /></svg>
                                            Mentions
                                        </li>
                                    </ul>
                                )}
                            </div>
                            {picker}
                        </div>
                    </>
                )}
                {/* Without a drawn graph the controls are hidden, but switching users must still work. */}
                {!noMemories && !(graph && data && data.memories.length > 0 && !isLoading && !error) && (
                    <div className="absolute bottom-4 left-4">{picker}</div>
                )}
            </div>
        </div>
    );
}
