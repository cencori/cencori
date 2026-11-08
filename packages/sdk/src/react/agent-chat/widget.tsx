'use client';

import { createContext, useContext, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { ButtonNode, WidgetAction, WidgetGap, WidgetNode } from '../../widgets/spec';
import { WidgetChart } from './chart';
import { colorVar, formatValue } from './format';
import { Markdown } from './markdown';

/**
 * <Widget>: draws a widget (a JSON tree from the agent) with the chat's theme.
 * Buttons, list items, selects and forms call `onAction`.
 */

export interface WidgetProps {
    widget: WidgetNode;
    /** The widget's id, passed back with its actions. */
    id?: string;
    onAction?: (action: WidgetAction, context: { widgetId: string; label?: string }) => void | Promise<void>;
    /** Turn actions off (e.g. on a widget from an earlier turn that was already used). */
    disabled?: boolean;
}

interface Ctx {
    id: string;
    disabled: boolean;
    run: (action: WidgetAction, label?: string, fields?: Record<string, unknown>) => void;
}
const WidgetContext = createContext<Ctx>({ id: '', disabled: true, run: () => {} });

export function Widget({ widget, id = '', onAction, disabled = false }: WidgetProps) {
    const [used, setUsed] = useState(false);
    const run: Ctx['run'] = (action, label, fields) => {
        if (disabled) return;
        const payload = fields ? { ...(action.payload ?? {}), ...fields } : action.payload;
        // An action that goes to the agent is a one-off: the reply replaces it.
        if (action.handler !== 'client') setUsed(true);
        void onAction?.({ ...action, ...(payload ? { payload } : {}) }, { widgetId: id, label });
    };
    return (
        <WidgetContext.Provider value={{ id, disabled: disabled || used, run }}>
            <div className={used ? 'cen-w-done' : undefined}>
                <Node node={widget} />
            </div>
        </WidgetContext.Provider>
    );
}

const GAP: Record<WidgetGap, number> = { none: 0, xs: 4, sm: 8, md: 12, lg: 20 };
const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const;
const JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const;

function Children({ nodes }: { nodes: WidgetNode[] }) {
    return <>{nodes.map((n, i) => <Node key={i} node={n} />)}</>;
}

function Node({ node }: { node: WidgetNode }): ReactNode {
    switch (node.type) {
        case 'Card':
            return (
                <div className="cen-w-card">
                    {(node.title || node.subtitle || node.status) && (
                        <div className="cen-w-card-head">
                            <div style={{ minWidth: 0 }}>
                                {node.title && <div className="cen-w-card-title">{node.title}</div>}
                                {node.subtitle && <div className="cen-w-card-sub">{node.subtitle}</div>}
                            </div>
                            {node.status && <span className="cen-w-badge">{node.status}</span>}
                        </div>
                    )}
                    <div className="cen-w-card-body"><Children nodes={node.children} /></div>
                    {node.actions && node.actions.length > 0 && (
                        <div className="cen-w-card-actions">{node.actions.map((b, i) => <Button key={i} node={b} />)}</div>
                    )}
                </div>
            );
        case 'ListView':
            return (
                <div className="cen-w-card">
                    {node.title && <div className="cen-w-card-head"><div className="cen-w-card-title">{node.title}</div></div>}
                    <div className="cen-w-card-body" style={{ paddingTop: node.title ? 4 : 2, paddingBottom: 2 }}>
                        <List items={node.items} />
                    </div>
                </div>
            );
        case 'Row':
            return (
                <div className="cen-w-row" style={{ gap: GAP[node.gap ?? 'sm'], alignItems: ALIGN[node.align ?? 'center'], justifyContent: JUSTIFY[node.justify ?? 'start'], flexWrap: node.wrap ? 'wrap' : undefined }}>
                    <Children nodes={node.children} />
                </div>
            );
        case 'Col':
            return (
                <div className="cen-w-col" style={{ gap: GAP[node.gap ?? 'sm'], alignItems: ALIGN[node.align ?? 'stretch'], flex: node.flex }}>
                    <Children nodes={node.children} />
                </div>
            );
        case 'Divider': return <div className="cen-w-divider" />;
        case 'Spacer': return <div className="cen-w-spacer" />;
        case 'Text': {
            const style: CSSProperties = {
                fontSize: { xs: 12, sm: 13, md: 14, lg: 16 }[node.size ?? 'md'],
                fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 }[node.weight ?? 'normal'],
                color: colorVar(node.color),
                textAlign: node.align === 'end' ? 'right' : node.align === 'center' ? 'center' : undefined,
                ...(node.truncate ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }),
                margin: 0,
            };
            return <p style={style}>{node.value}</p>;
        }
        case 'Title':
            return <p className="cen-w-title" style={{ fontSize: { sm: 14, md: 16, lg: 19, xl: 23 }[node.size ?? 'md'] }}>{node.value}</p>;
        case 'Markdown':
            return <div className="cen-text"><Markdown text={node.value} /></div>;
        case 'Badge':
            return <span className="cen-w-badge" style={node.color && node.color !== 'default' ? { color: colorVar(node.color), borderColor: `color-mix(in srgb, ${colorVar(node.color)} 35%, transparent)` } : undefined}>{node.label}</span>;
        case 'Image':
            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="cen-w-image" src={node.src} alt={node.alt ?? ''} loading="lazy" referrerPolicy="no-referrer"
                    style={{ aspectRatio: node.aspectRatio ? String(node.aspectRatio) : undefined, objectFit: node.fit ?? 'cover' }} />
            );
        case 'Stat': {
            const up = (node.delta ?? 0) >= 0;
            return (
                <div className="cen-w-col" style={{ gap: 2 }}>
                    <span className="cen-w-stat-label">{node.label}</span>
                    <span className="cen-w-stat-value">{formatValue(node.value, node.format, node.currency)}</span>
                    {(node.delta !== undefined || node.caption) && (
                        <span className="cen-w-stat-delta" style={{ color: node.delta === undefined ? 'var(--cen-muted-fg)' : up ? 'var(--cen-success)' : 'var(--cen-danger)' }}>
                            {node.delta !== undefined && `${up ? '▲' : '▼'} ${node.deltaFormat === 'number' ? formatValue(Math.abs(node.delta), 'number') : formatValue(Math.abs(node.delta), 'percent')}`}
                            {node.caption && <span style={{ color: 'var(--cen-muted-fg)', fontWeight: 400 }}>{node.delta !== undefined ? ' ' : ''}{node.caption}</span>}
                        </span>
                    )}
                </div>
            );
        }
        case 'Chart': return <WidgetChart node={node} />;
        case 'Table':
            return (
                <div className="cen-w-col" style={{ gap: 8 }}>
                    {node.title && <span className="cen-w-stat-label">{node.title}</span>}
                    <div className="cen-w-table-wrap">
                        <table className="cen-w-table">
                            <thead>
                                <tr>{node.columns.map((c) => <th key={c.key} style={{ textAlign: c.align === 'end' ? 'right' : c.align ?? 'left' }}>{c.label}</th>)}</tr>
                            </thead>
                            <tbody>
                                {node.rows.map((r, i) => (
                                    <tr key={i}>
                                        {node.columns.map((c) => (
                                            <td key={c.key} style={{ textAlign: c.align === 'end' ? 'right' : c.align ?? 'left' }}>{formatValue(r[c.key], c.format, c.currency)}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        case 'Button': return <Button node={node} />;
        case 'Form': return <WidgetForm node={node} />;
        case 'Input':
            return (
                <label className="cen-w-field">
                    {node.label && <span>{node.label}</span>}
                    {node.multiline
                        ? <textarea className="cen-w-input" name={node.name} placeholder={node.placeholder} required={node.required} defaultValue={node.defaultValue} rows={3} />
                        : <input className="cen-w-input" name={node.name} type={node.inputType ?? 'text'} placeholder={node.placeholder} required={node.required} defaultValue={node.defaultValue} />}
                </label>
            );
        case 'Select': return <Select node={node} />;
        case 'Checkbox':
            return (
                <label className="cen-w-check">
                    <input type="checkbox" name={node.name} defaultChecked={node.defaultChecked} />
                    {node.label}
                </label>
            );
        default:
            return null;
    }
}

function List({ items }: { items: Extract<WidgetNode, { type: 'ListView' }>['items'] }) {
    const ctx = useContext(WidgetContext);
    return (
        <div className="cen-w-list">
            {items.map((it, i) => {
                const inner = (
                    <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {it.image && <img className="cen-w-list-thumb" src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
                        <div className="cen-w-list-main">
                            <div className="cen-w-list-title">{it.title}</div>
                            {it.subtitle && <div className="cen-w-list-sub">{it.subtitle}</div>}
                        </div>
                        {it.badge && <span className="cen-w-badge" style={it.badgeColor ? { color: colorVar(it.badgeColor) } : undefined}>{it.badge}</span>}
                        {it.value && <span className="cen-w-list-value">{it.value}</span>}
                    </>
                );
                return it.action
                    ? <button key={i} type="button" className="cen-w-list-item" disabled={ctx.disabled} onClick={() => ctx.run(it.action!, it.title)}>{inner}</button>
                    : <div key={i} className="cen-w-list-item">{inner}</div>;
            })}
        </div>
    );
}

function Button({ node }: { node: ButtonNode }) {
    const ctx = useContext(WidgetContext);
    const common = { className: 'cen-w-btn', 'data-variant': node.variant ?? 'outline', 'data-size': node.size ?? 'md', 'data-block': node.block ? 'true' : undefined };
    if (node.href) {
        return <a {...common} href={node.href} target="_blank" rel="noopener noreferrer">{node.label}</a>;
    }
    if (node.submit) {
        return <button {...common} type="submit" disabled={ctx.disabled}>{node.label}</button>;
    }
    return (
        <button {...common} type="button" disabled={ctx.disabled} onClick={() => node.action && ctx.run(node.action, node.label)}>
            {node.label}
        </button>
    );
}

function Select({ node }: { node: Extract<WidgetNode, { type: 'Select' }> }) {
    const ctx = useContext(WidgetContext);
    return (
        <label className="cen-w-field">
            {node.label && <span>{node.label}</span>}
            <select className="cen-w-input" name={node.name} required={node.required} defaultValue={node.defaultValue ?? ''} disabled={ctx.disabled}
                onChange={(e) => node.action && ctx.run(node.action, node.label, { [node.name]: e.target.value })}>
                {!node.defaultValue && <option value="" disabled>{node.placeholder ?? 'Choose…'}</option>}
                {node.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </label>
    );
}

function WidgetForm({ node }: { node: Extract<WidgetNode, { type: 'Form' }> }) {
    const ctx = useContext(WidgetContext);
    const hasSubmit = JSON.stringify(node.children).includes('"submit":true');
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (ctx.disabled) return;
        const fields: Record<string, unknown> = {};
        const form = e.currentTarget;
        for (const el of Array.from(form.elements) as HTMLInputElement[]) {
            if (!el.name) continue;
            if (el.type === 'checkbox') fields[el.name] = el.checked;
            else if (el.type === 'number') fields[el.name] = el.value === '' ? null : Number(el.value);
            else fields[el.name] = el.value;
        }
        ctx.run(node.action, node.submitLabel ?? 'Submit', fields);
    };
    return (
        <form className="cen-w-form" onSubmit={onSubmit}>
            <fieldset disabled={ctx.disabled} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'contents' }}>
                <Children nodes={node.children} />
                {!hasSubmit && (
                    <div><button type="submit" className="cen-w-btn" data-variant="primary">{node.submitLabel ?? 'Submit'}</button></div>
                )}
            </fieldset>
        </form>
    );
}
