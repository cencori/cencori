'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface PromptEditorProps {
    initialContent?: string;
    initialModelHint?: string;
    initialTemperature?: number;
    initialMaxTokens?: number;
    changeMessage?: string;
    onSave: (data: {
        content: string;
        model_hint: string | null;
        temperature: number | null;
        max_tokens: number | null;
        change_message: string;
    }) => void;
    saving?: boolean;
    saveLabel?: string;
}

function extractVars(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
}

export function PromptEditor({
    initialContent = '',
    initialModelHint = '',
    initialTemperature,
    initialMaxTokens,
    onSave,
    saving = false,
    saveLabel = 'Save',
}: PromptEditorProps) {
    const [content, setContent] = useState(initialContent);
    const [modelHint, setModelHint] = useState(initialModelHint);
    const [temperature, setTemperature] = useState(initialTemperature ?? 0.7);
    const [maxTokens, setMaxTokens] = useState(initialMaxTokens ?? 4096);
    const [message, setMessage] = useState('');
    const [testVars, setTestVars] = useState<Record<string, string>>({});

    const variables = useMemo(() => extractVars(content), [content]);

    const preview = useMemo(() => {
        let result = content;
        for (const v of variables) {
            result = result.replaceAll(`{{${v}}}`, testVars[v] || `[${v}]`);
        }
        return result;
    }, [content, variables, testVars]);

    return (
        <div className="space-y-4">
            {/* Content editor */}
            <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Prompt Content</Label>
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-48 rounded-lg border border-border/30 bg-secondary/30 p-3 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                    placeholder="You are a helpful assistant for {{company_name}}..."
                />
                {variables.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                        Variables: {variables.map(v => `{{${v}}}`).join(', ')}
                    </p>
                )}
            </div>

            {/* Variable test inputs */}
            {variables.length > 0 && (
                <div className="rounded-lg border border-border/20 bg-card p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Test Variables</p>
                    <div className="grid grid-cols-2 gap-2">
                        {variables.map(v => (
                            <div key={v}>
                                <Label className="text-[10px] text-muted-foreground">{`{{${v}}}`}</Label>
                                <Input
                                    value={testVars[v] || ''}
                                    onChange={(e) => setTestVars(prev => ({ ...prev, [v]: e.target.value }))}
                                    className="h-7 text-xs mt-0.5"
                                    placeholder={v}
                                />
                            </div>
                        ))}
                    </div>
                    {Object.values(testVars).some(v => v) && (
                        <div className="mt-2 pt-2 border-t border-border/20">
                            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-1">Preview</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{preview}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Parameters */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Model Hint</Label>
                    <Input
                        value={modelHint}
                        onChange={(e) => setModelHint(e.target.value)}
                        className="h-8 text-sm"
                        placeholder="e.g. gpt-4o"
                    />
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Max Tokens</Label>
                    <Input
                        type="number"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-muted-foreground">Temperature</Label>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">{temperature.toFixed(1)}</span>
                </div>
                <Slider
                    value={temperature * 10}
                    min={0}
                    max={20}
                    step={1}
                    showValue={false}
                    onChange={(v) => setTemperature(v / 10)}
                />
            </div>

            {/* Change message + save */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="h-8 text-sm flex-1"
                    placeholder="What changed? (optional)"
                />
                <Button
                    size="sm"
                    className="h-8 text-xs"
                    disabled={!content.trim() || saving}
                    onClick={() => onSave({
                        content: content.trim(),
                        model_hint: modelHint.trim() || null,
                        temperature,
                        max_tokens: maxTokens || null,
                        change_message: message.trim() || 'Updated prompt',
                    })}
                >
                    {saving ? 'Saving...' : saveLabel}
                </Button>
            </div>
        </div>
    );
}
