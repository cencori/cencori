import crypto from 'crypto';
import type { Tool } from '@/lib/providers/base';
import { describeWidgetSpec, validateWidget, type WidgetNode } from '@/packages/sdk/src/widgets/spec';

/**
 * render_ui: the built-in tool a session turn gets with `widgets: true`. The
 * model writes a widget (a JSON tree of components, see the spec) and the
 * gateway runs the tool itself: it validates the widget and sends it to the
 * chat as the tool's output, so any model can answer with UI. An invalid
 * widget goes back to the model with the errors, and it tries again.
 */

export const RENDER_UI_TOOL_NAME = 'render_ui';

export const RENDER_UI_TOOL: Tool = {
    type: 'function',
    function: {
        name: RENDER_UI_TOOL_NAME,
        description: [
            'Show the user UI in the chat: cards, lists, tables, charts, stats, buttons and forms.',
            'Use it when data or choices read better as UI than as text: numbers over time (Chart), records (Table or ListView), a headline figure (Stat), a decision (Buttons), details to collect (Form).',
            'Put the real data in the widget; never invent values. After it renders, add at most a short sentence: don\'t repeat what the widget shows.',
            'Usually start with a Card. Keep it focused: one idea per widget.',
            'Always show UI by calling this tool. Never write widget JSON in your reply text: the user would see raw code.',
            '',
            describeWidgetSpec(),
            '',
            'Example: {"widget":{"type":"Card","title":"Revenue","children":[{"type":"Stat","label":"This month","value":48210,"format":"currency","currency":"USD","delta":0.12,"deltaFormat":"percent"},{"type":"Chart","chart":"bar","x":"month","series":[{"key":"revenue","label":"Revenue"}],"format":"currency","currency":"USD","data":[{"month":"Sep","revenue":39100},{"month":"Oct","revenue":43050},{"month":"Nov","revenue":48210}]}],"actions":[{"type":"Button","label":"Break down by product","action":{"type":"breakdown","payload":{"by":"product"}}}]}}',
        ].join('\n'),
        parameters: {
            type: 'object',
            properties: {
                widget: { type: 'object', description: 'The root component, e.g. a Card.' },
            },
            required: ['widget'],
        },
    },
};

export interface RenderUiOutcome {
    ok: boolean;
    /** What the model reads as the tool's result. */
    modelOutput: string;
    /** The tool_call.completed output the chat receives. */
    eventOutput: { ok: true; widget_id: string; widget: WidgetNode } | { ok: false; errors: string[] };
}

export function runRenderUi(argsJson: string): RenderUiOutcome {
    let args: unknown;
    try {
        args = JSON.parse(argsJson || '{}');
    } catch {
        const errors = ['arguments are not valid JSON'];
        return { ok: false, modelOutput: invalid(errors), eventOutput: { ok: false, errors } };
    }
    const raw = args && typeof args === 'object' && 'widget' in args ? (args as { widget: unknown }).widget : args;
    // Some models send the widget as a JSON string.
    let widget = raw;
    if (typeof raw === 'string') {
        try { widget = JSON.parse(raw); } catch { /* reported by the validator */ }
    }
    const result = validateWidget(widget);
    if (!result.ok) {
        return { ok: false, modelOutput: invalid(result.errors), eventOutput: { ok: false, errors: result.errors } };
    }
    const widgetId = `wgt_${crypto.randomBytes(8).toString('hex')}`;
    return {
        ok: true,
        modelOutput: JSON.stringify({ rendered: true, widget_id: widgetId, note: 'The user can see this widget now; do not repeat its contents. If the user asked for anything else, do it now with the tools it needs. Never say an action happened unless its tool returned success.' }),
        eventOutput: { ok: true, widget_id: widgetId, widget: result.widget },
    };
}

function invalid(errors: string[]): string {
    return JSON.stringify({
        rendered: false,
        errors,
        note: 'Nothing was shown. Fix these problems and call render_ui again.',
    });
}

/** A short line for history so later turns know what was shown. */
export function widgetSummary(widget: WidgetNode): string {
    const w = widget as unknown as Record<string, unknown>;
    const title = typeof w.title === 'string' ? w.title : typeof w.label === 'string' ? w.label : '';
    return `[Showed the user a ${widget.type}${title ? `: ${title}` : ''}]`;
}

