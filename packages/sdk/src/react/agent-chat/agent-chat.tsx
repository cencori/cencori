'use client';

import { useEffect, useLayoutEffect as useLayoutEffectClient, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { AgentChatApprovalItem } from '../../agent-chat/protocol';
import { extractTextWidget } from '../../widgets/partial';
import { Markdown } from './markdown';
import { AGENT_CHAT_CSS, themeStyle, type AgentChatTheme } from './styles';
import { useAgentChat, type AgentChatMessage, type AgentChatPart, type UseAgentChatOptions, type UseAgentChatResult } from './use-agent-chat';
import { Widget } from './widget';

/**
 * Agent UI. <AgentChat>: a complete chat with an agent: streaming replies, tool steps,
 * approvals, and widgets (UI the agent shows). Drop it in a sized container.
 *
 * ```tsx
 * import { AgentChat } from 'cencori/react';
 *
 * <AgentChat api="/api/chat" greeting="Ask about your sales" prompts={['Revenue this month', 'Top customers']} />
 * ```
 *
 * The parts (<Transcript>, <Composer>, <ToolCall>, <ApprovalCard>, <Widget>)
 * and the useAgentChat hook are exported to build your own layout.
 */

export interface AgentChatProps extends Partial<UseAgentChatOptions> {
    /** Pass a useAgentChat() result to control the chat from outside. Otherwise pass `api`, or `agent` with a `publishableKey`. */
    chat?: UseAgentChatResult;
    theme?: AgentChatTheme;
    /** Shown before the first message. */
    greeting?: ReactNode;
    /** Suggestions shown before the first message. */
    prompts?: Array<string | { label: string; prompt: string }>;
    placeholder?: string;
    /** Show tool calls as steps in the reply. Default true. */
    showToolCalls?: boolean;
    /** Friendly names for tool steps: { lookup_order: 'Looking up the order' }. */
    toolLabels?: Record<string, string>;
    className?: string;
    style?: CSSProperties;
}

export function AgentChat(props: AgentChatProps) {
    if (props.chat) return <AgentChatView {...props} chat={props.chat} />;
    if (!props.api && !props.widgetKey && !(props.agent && props.publishableKey)) {
        throw new Error('<AgentChat> needs an `api` route, a console agent\'s `widgetKey`, or a stored `agent` with a `publishableKey` (or a `chat` from useAgentChat).');
    }
    return <OwnedAgentChat {...props} />;
}

function OwnedAgentChat(props: AgentChatProps) {
    const chat = useAgentChat(props);
    return <AgentChatView {...props} chat={chat} />;
}

function AgentChatView({ chat, theme, greeting, prompts, placeholder, showToolCalls = true, toolLabels, className, style }: AgentChatProps & { chat: UseAgentChatResult }) {
    return (
        <div className={`cen-chat${className ? ` ${className}` : ''}`} data-scheme={theme?.colorScheme ?? 'auto'} style={{ ...themeStyle(theme), ...style }}>
            <style>{AGENT_CHAT_CSS}</style>
            <Transcript chat={chat} greeting={greeting} prompts={prompts} showToolCalls={showToolCalls} toolLabels={toolLabels} />
            {chat.error && (
                <div className="cen-error" role="alert">
                    <span>{chat.error.message}</span>
                    <button type="button" className="cen-w-btn" data-variant="ghost" data-size="sm" onClick={() => void chat.retry()}>Try again</button>
                </div>
            )}
            <Composer chat={chat} placeholder={placeholder} />
        </div>
    );
}

// useLayoutEffect warns during server rendering; it only matters in the browser.
const useLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffectClient;

// ── Transcript ──────────────────────────────────────────────────

export interface TranscriptProps {
    chat: UseAgentChatResult;
    greeting?: ReactNode;
    prompts?: AgentChatProps['prompts'];
    showToolCalls?: boolean;
    toolLabels?: Record<string, string>;
}

export function Transcript({ chat, greeting, prompts, showToolCalls = true, toolLabels }: TranscriptProps) {
    const ref = useRef<HTMLDivElement>(null);
    const pinned = useRef(true);

    // Follow the reply as it streams, unless the user scrolled up to read.
    useLayoutEffect(() => {
        const el = ref.current;
        if (el && pinned.current) el.scrollTop = el.scrollHeight;
    }, [chat.messages]);

    const lastAssistant = [...chat.messages].reverse().find((m) => m.role === 'assistant');

    return (
        <div className="cen-transcript" ref={ref} onScroll={(e) => {
            const el = e.currentTarget;
            pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}>
            {chat.messages.length === 0 ? (
                <div className="cen-empty">
                    {greeting !== undefined && <div className="cen-empty-title">{greeting}</div>}
                    {prompts && prompts.length > 0 && (
                        <div className="cen-prompts">
                            {prompts.map((p, i) => {
                                const { label, prompt } = typeof p === 'string' ? { label: p, prompt: p } : p;
                                return <button key={i} type="button" className="cen-prompt" onClick={() => void chat.send(prompt)}>{label}</button>;
                            })}
                        </div>
                    )}
                </div>
            ) : chat.messages.map((m) => (
                <Message key={m.id} message={m} chat={chat} showToolCalls={showToolCalls} toolLabels={toolLabels} live={m === lastAssistant} />
            ))}
        </div>
    );
}

function Message({ message, chat, showToolCalls, toolLabels, live }: { message: AgentChatMessage; chat: UseAgentChatResult; showToolCalls: boolean; toolLabels?: Record<string, string>; live: boolean }) {
    if (message.role === 'user') {
        if (message.action) {
            return (
                <div className="cen-msg cen-msg-user">
                    <span className="cen-action-chip"><CheckIcon /> {message.action.label ?? message.action.type}</span>
                </div>
            );
        }
        const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
        return <div className="cen-msg cen-msg-user"><div className="cen-bubble">{text}</div></div>;
    }

    const streaming = message.status === 'streaming';
    // A call waiting on the approval card is shown by the card, not as a step.
    const awaiting = new Set(message.parts.flatMap((p) => (p.type === 'approval' && p.status !== 'pending' ? [] : p.type === 'approval' ? p.items.map((i) => i.callId) : [])));
    const visible = message.parts.filter((p) => p.type !== 'tool' || (showToolCalls && !(awaiting.has(p.callId) && p.status === 'running')));
    const lastPart = visible[visible.length - 1];
    return (
        <div className="cen-msg">
            {visible.map((part, i) => (
                <Part key={i} part={part} chat={chat} toolLabels={toolLabels}
                    cursor={streaming && part === lastPart && part.type === 'text'}
                    // Only the latest reply's widgets take actions.
                    interactive={live && !streaming} />
            ))}
            {streaming && (!lastPart || (lastPart.type !== 'text' && !(lastPart.type === 'widget' && lastPart.partial))) && (
                <div className="cen-thinking" aria-label="Thinking"><span /><span /><span /></div>
            )}
        </div>
    );
}

function Part({ part, chat, toolLabels, cursor, interactive }: { part: AgentChatPart; chat: UseAgentChatResult; toolLabels?: Record<string, string>; cursor: boolean; interactive: boolean }) {
    switch (part.type) {
        case 'text': {
            // Widget JSON the model wrote as text (instead of calling render_ui) is drawn as a widget.
            const found = extractTextWidget(part.text);
            if (found) {
                return (
                    <>
                        {found.before && <div className="cen-text"><Markdown text={found.before} /></div>}
                        <Widget widget={found.widget} id={`text_${found.widget.type}`} disabled={!interactive || !found.complete} onAction={(action, ctx) => chat.sendAction(action, ctx)} />
                        {found.after && <div className="cen-text"><Markdown text={found.after} />{cursor && <span className="cen-cursor" />}</div>}
                    </>
                );
            }
            return <div className="cen-text"><Markdown text={part.text} />{cursor && <span className="cen-cursor" />}</div>;
        }
        case 'tool':
            return <ToolCall name={part.name} label={toolLabels?.[part.name]} arguments={part.arguments} output={part.output} running={part.status === 'running'} />;
        case 'widget':
            return <Widget widget={part.widget} id={part.id} disabled={!interactive || part.partial} onAction={(action, ctx) => chat.sendAction(action, ctx)} />;
        case 'handoff':
            return <div className="cen-step"><ArrowIcon /> Handed to {part.to}</div>;
        case 'approval':
            return (
                <ApprovalCard items={part.items} decisions={part.decisions} pending={part.status === 'pending'}
                    onApprove={(id) => chat.approve(id)} onReject={(id) => chat.reject(id)} toolLabels={toolLabels} />
            );
    }
}

// ── Tool steps ──────────────────────────────────────────────────

export interface ToolCallProps {
    name: string;
    label?: string;
    arguments?: string;
    output?: string;
    running?: boolean;
}

export function ToolCall({ name, label, arguments: args, output, running }: ToolCallProps) {
    const [open, setOpen] = useState(false);
    const title = label ?? humanize(name);
    return (
        <div>
            <div className="cen-step">
                <button type="button" className="cen-step-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                    {running ? <span className="cen-spinner" /> : <span className="cen-dot" />}
                    <span>{running ? `${title}…` : title}</span>
                    <ChevronIcon open={open} />
                </button>
            </div>
            {open && (
                <div className="cen-step-detail">
                    {args ? `${pretty(args)}` : ''}
                    {output !== undefined ? `\n\n→ ${pretty(output)}` : ''}
                </div>
            )}
        </div>
    );
}

// ── Approvals ───────────────────────────────────────────────────

export interface ApprovalCardProps {
    items: AgentChatApprovalItem[];
    decisions?: Record<string, { approved: boolean }>;
    pending?: boolean;
    onApprove: (callId: string) => void;
    onReject: (callId: string) => void;
    toolLabels?: Record<string, string>;
}

export function ApprovalCard({ items, decisions = {}, pending = true, onApprove, onReject, toolLabels }: ApprovalCardProps) {
    return (
        <div className="cen-approval">
            <div className="cen-approval-head">{items.length > 1 ? `${items.length} actions need your approval` : 'This needs your approval'}</div>
            {items.map((item) => {
                const decided = decisions[item.callId];
                return (
                    <div key={item.callId} className="cen-approval-item">
                        <div style={{ fontWeight: 500 }}>{toolLabels?.[item.toolName] ?? humanize(item.toolName)}</div>
                        <div className="cen-approval-args">{pretty(item.arguments)}</div>
                        {decided ? (
                            <div className="cen-decided">{decided.approved ? 'Approved' : 'Declined'}</div>
                        ) : pending ? (
                            <div className="cen-approval-actions">
                                <button type="button" className="cen-w-btn" data-variant="primary" data-size="sm" onClick={() => onApprove(item.callId)}>Approve</button>
                                <button type="button" className="cen-w-btn" data-variant="outline" data-size="sm" onClick={() => onReject(item.callId)}>Decline</button>
                            </div>
                        ) : (
                            <div className="cen-decided">Not answered</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Composer ────────────────────────────────────────────────────

export function Composer({ chat, placeholder = 'Message…' }: { chat: UseAgentChatResult; placeholder?: string }) {
    const [value, setValue] = useState('');
    const ref = useRef<HTMLTextAreaElement>(null);
    const streaming = chat.status === 'streaming';
    // The run is paused on the approval card: it has to be answered first.
    const waiting = chat.status === 'awaiting_approval';

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(160, el.scrollHeight)}px`;
    }, [value]);

    const submit = () => {
        if (streaming || waiting || !value.trim()) return;
        void chat.send(value);
        setValue('');
    };
    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    return (
        <form className="cen-composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="cen-composer-box">
                <textarea ref={ref} rows={1} value={value} placeholder={waiting ? 'Approve or decline above to continue' : placeholder} aria-label="Message" disabled={waiting}
                    onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown} />
                {streaming ? (
                    <button type="button" className="cen-send" aria-label="Stop" onClick={chat.stop}><StopIcon /></button>
                ) : (
                    <button type="submit" className="cen-send" aria-label="Send" disabled={waiting || !value.trim()}><SendIcon /></button>
                )}
            </div>
        </form>
    );
}

// ── Helpers ─────────────────────────────────────────────────────

function humanize(name: string): string {
    const s = name.replace(/^transfer_to_/, 'transfer to ').replace(/[_-]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function pretty(text: string): string {
    try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

const icon = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function SendIcon() { return <svg {...icon} width={16} height={16}><path d="M12 19V5M5 12l7-7 7 7" /></svg>; }
function StopIcon() { return <svg {...icon}><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" /></svg>; }
function CheckIcon() { return <svg {...icon} width={12} height={12}><path d="M20 6 9 17l-5-5" /></svg>; }
function ArrowIcon() { return <svg {...icon} width={12} height={12}><path d="M5 12h14M13 6l6 6-6 6" /></svg>; }
function ChevronIcon({ open }: { open: boolean }) {
    return <svg {...icon} width={12} height={12} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .15s' }}><path d="m9 6 6 6-6 6" /></svg>;
}
