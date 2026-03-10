'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {
    ArrowLeft,
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    AlignLeft,
    AlignCenter,
    Link as LinkIcon,
    ImageIcon,
    Send,
    TestTube,
    Loader2,
    Plus,
    Trash2,
    Clock,
    CheckCircle,
    XCircle,
    ChevronDown,
    Users,
    Mail,
    History,
    PenLine,
    Eye,
    UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// —— Types ——————————————————————————————————————————
interface SenderProfile {
    id: string;
    user_id: string;
    display_name: string;
    email_handle: string;
    is_default: boolean;
    created_at: string;
}

interface EmailSend {
    id: string;
    category: string;
    subject: string;
    audience_type: string;
    single_recipient: string | null;
    recipient_count: number;
    success_count: number;
    failure_count: number;
    status: string;
    sent_at: string | null;
    created_at: string;
    sender_profile_id: string | null;
    email_sender_profiles: {
        display_name: string;
        email_handle: string;
    } | null;
}

type Tab = 'compose' | 'history' | 'profiles';

const EMAIL_CATEGORIES = [
    { value: 'newsletter', label: 'Newsletter' },
    { value: 'product_update', label: 'Product Update' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'security_advisory', label: 'Security Advisory' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'transactional', label: 'Transactional' },
];

const EMAIL_DOMAIN = 'cencori.com';

// —— TipTap Toolbar ——————————————————————————————————
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
    if (!editor) return null;

    const addLink = () => {
        const url = window.prompt('Enter URL:');
        if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
    };

    const addImage = () => {
        const url = window.prompt('Enter image URL:');
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const toolbarButtons = [
        { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Bold' },
        { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italic' },
        { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline'), title: 'Underline' },
        { separator: true },
        { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Bullet List' },
        { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Ordered List' },
        { separator: true },
        { icon: AlignLeft, action: () => editor.chain().focus().setTextAlign('left').run(), active: editor.isActive({ textAlign: 'left' }), title: 'Align Left' },
        { icon: AlignCenter, action: () => editor.chain().focus().setTextAlign('center').run(), active: editor.isActive({ textAlign: 'center' }), title: 'Align Center' },
        { separator: true },
        { icon: LinkIcon, action: addLink, active: editor.isActive('link'), title: 'Add Link' },
        { icon: ImageIcon, action: addImage, active: false, title: 'Add Image' },
    ];

    return (
        <div className="flex items-center gap-0.5 border-b border-border/40 px-3 py-1.5">
            <select
                className="h-7 rounded bg-secondary/50 border border-border/30 text-xs text-foreground px-2 mr-2 focus:outline-none"
                value={
                    editor.isActive('heading', { level: 1 }) ? 'h1'
                        : editor.isActive('heading', { level: 2 }) ? 'h2'
                            : editor.isActive('heading', { level: 3 }) ? 'h3'
                                : 'p'
                }
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'p') editor.chain().focus().setParagraph().run();
                    else editor.chain().focus().toggleHeading({ level: Number(val.replace('h', '')) as 1 | 2 | 3 }).run();
                }}
            >
                <option value="p">Paragraph</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
            </select>
            {toolbarButtons.map((btn, idx) => {
                if ('separator' in btn) {
                    return <div key={idx} className="w-px h-5 bg-border/30 mx-1" />;
                }
                const Icon = btn.icon!;
                return (
                    <button
                        key={idx}
                        type="button"
                        onClick={btn.action}
                        className={cn(
                            "p-1.5 rounded hover:bg-secondary/60 transition-colors",
                            btn.active && "bg-secondary text-foreground"
                        )}
                        title={btn.title}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </button>
                );
            })}
        </div>
    );
}

// —— Main Page ——————————————————————————————————————
export default function InternalEmailsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<Tab>('compose');

    // Compose state
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('announcement');
    const [audienceType, setAudienceType] = useState<'bulk' | 'single'>('single');
    const [singleRecipient, setSingleRecipient] = useState('');
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [audienceCount, setAudienceCount] = useState<number | null>(null);

    // Profiles state
    const [profiles, setProfiles] = useState<SenderProfile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileHandle, setNewProfileHandle] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // History state
    const [sends, setSends] = useState<EmailSend[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // TipTap editor
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({ openOnClick: false }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Image,
        ],
        content: '<p>Write your email content here...</p>',
        editorProps: {
            attributes: {
                class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3',
            },
        },
    });

    // Fetch profiles
    const fetchProfiles = useCallback(async () => {
        setLoadingProfiles(true);
        try {
            const res = await fetch('/api/internal/emails/sender-profiles');
            if (res.ok) {
                const data = await res.json();
                setProfiles(data.profiles || []);
                // Auto-select default
                const defaultProfile = (data.profiles || []).find((p: SenderProfile) => p.is_default);
                if (defaultProfile && !selectedProfileId) {
                    setSelectedProfileId(defaultProfile.id);
                }
            }
        } catch (err) {
            console.error('Failed to fetch profiles:', err);
        } finally {
            setLoadingProfiles(false);
        }
    }, [selectedProfileId]);

    // Fetch history
    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch('/api/internal/emails/history');
            if (res.ok) {
                const data = await res.json();
                setSends(data.sends || []);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        fetchProfiles();
        fetchHistory();
    }, [fetchProfiles, fetchHistory]);

    // Fetch audience count
    const fetchAudienceCount = useCallback(async () => {
        try {
            const res = await fetch('/api/internal/emails/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxRecipients: 2000 }),
            });
            if (res.ok) {
                const data = await res.json();
                setAudienceCount(data.eligibleRecipients);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (audienceType === 'bulk') fetchAudienceCount();
    }, [audienceType, fetchAudienceCount]);

    // Save sender profile
    const handleSaveProfile = async () => {
        if (!newProfileName.trim() || !newProfileHandle.trim()) return;
        setSavingProfile(true);
        try {
            const res = await fetch('/api/internal/emails/sender-profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: newProfileName.trim(),
                    emailHandle: newProfileHandle.trim().toLowerCase(),
                    isDefault: profiles.length === 0,
                }),
            });
            if (res.ok) {
                setNewProfileName('');
                setNewProfileHandle('');
                fetchProfiles();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save profile');
            }
        } catch {
            alert('Failed to save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    // Delete sender profile
    const handleDeleteProfile = async (id: string) => {
        if (!confirm('Delete this sender profile?')) return;
        try {
            const res = await fetch(`/api/internal/emails/sender-profiles?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchProfiles();
        } catch {
            alert('Failed to delete profile');
        }
    };

    // Send email
    const handleSend = async (testMode: boolean = false) => {
        if (!subject.trim() || !editor?.getHTML()) {
            alert('Subject and body are required');
            return;
        }

        const effectiveAudienceType = testMode ? 'single' : audienceType;
        const effectiveRecipient = testMode ? singleRecipient : (audienceType === 'single' ? singleRecipient : undefined);

        if (effectiveAudienceType === 'single' && !effectiveRecipient?.trim()) {
            alert('Recipient email is required for single/test send');
            return;
        }

        if (!testMode && audienceType === 'bulk') {
            const confirmed = confirm(`Send this email to ${audienceCount ?? 'all'} users?\n\nSubject: ${subject}\n\nThis action cannot be undone.`);
            if (!confirmed) return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            const res = await fetch('/api/internal/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject.trim(),
                    htmlBody: editor.getHTML(),
                    category,
                    senderProfileId: selectedProfileId || undefined,
                    audienceType: effectiveAudienceType,
                    singleRecipient: effectiveRecipient?.trim(),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setSendResult({
                    success: true,
                    message: data.mode === 'single'
                        ? `Test email sent to ${data.recipient}`
                        : `Sent to ${data.sent}/${data.recipientCount} recipients${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
                });
                fetchHistory();
            } else {
                setSendResult({ success: false, message: data.error || 'Send failed' });
            }
        } catch {
            setSendResult({ success: false, message: 'Network error' });
        } finally {
            setIsSending(false);
        }
    };

    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
    const fromDisplay = selectedProfile
        ? `${selectedProfile.display_name} <${selectedProfile.email_handle}@${EMAIL_DOMAIN}>`
        : 'Default sender';

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <div className="border-b border-border/40 bg-card/30">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/internal/settings')}
                            className="p-1.5 rounded hover:bg-secondary/60 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold">Email Center</h1>
                            <p className="text-xs text-muted-foreground">Internal email management</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-0.5">
                        {([
                            { id: 'compose' as Tab, label: 'Compose', icon: PenLine },
                            { id: 'history' as Tab, label: 'History', icon: History },
                            { id: 'profiles' as Tab, label: 'Senders', icon: UserCircle },
                        ]).map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                    activeTab === tab.id
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <tab.icon className="h-3.5 w-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6">
                {/* ═══════ COMPOSE TAB ═══════ */}
                {activeTab === 'compose' && (
                    <div className="space-y-5">
                        {/* Result banner */}
                        {sendResult && (
                            <div className={cn(
                                "rounded-lg border px-4 py-3 text-sm flex items-center gap-2",
                                sendResult.success
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : "border-red-500/30 bg-red-500/10 text-red-300"
                            )}>
                                {sendResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                {sendResult.message}
                                <button onClick={() => setSendResult(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
                            {/* Left — Editor */}
                            <div className="space-y-4">
                                {/* Meta fields */}
                                <div className="rounded-lg border border-border/40 bg-card/30 divide-y divide-border/30">
                                    {/* From */}
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="text-xs text-muted-foreground w-16 shrink-0">From</span>
                                        <select
                                            className="flex-1 bg-transparent text-sm focus:outline-none text-foreground appearance-none cursor-pointer"
                                            value={selectedProfileId}
                                            onChange={(e) => setSelectedProfileId(e.target.value)}
                                        >
                                            <option value="">Default sender</option>
                                            {profiles.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.display_name} — {p.email_handle}@{EMAIL_DOMAIN}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>

                                    {/* Subject */}
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="text-xs text-muted-foreground w-16 shrink-0">Subject</span>
                                        <input
                                            type="text"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="Enter email subject..."
                                            className="flex-1 bg-transparent text-sm focus:outline-none text-foreground placeholder:text-muted-foreground/50"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div className="flex items-center gap-3 px-4 py-2.5">
                                        <span className="text-xs text-muted-foreground w-16 shrink-0">Type</span>
                                        <select
                                            className="flex-1 bg-transparent text-sm focus:outline-none text-foreground appearance-none cursor-pointer"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                        >
                                            {EMAIL_CATEGORIES.map((cat) => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                </div>

                                {/* Editor */}
                                <div className="rounded-lg border border-border/40 bg-card/30 overflow-hidden">
                                    <EditorToolbar editor={editor} />
                                    <EditorContent editor={editor} />
                                </div>
                            </div>

                            {/* Right — Preview + Send */}
                            <div className="space-y-4">
                                {/* Audience */}
                                <div className="rounded-lg border border-border/40 bg-card/30 p-4 space-y-3">
                                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Audience</h3>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setAudienceType('single')}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors border",
                                                audienceType === 'single'
                                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                                    : "border-border/30 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Mail className="h-3.5 w-3.5" />
                                            Single
                                        </button>
                                        <button
                                            onClick={() => setAudienceType('bulk')}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors border",
                                                audienceType === 'bulk'
                                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                                    : "border-border/30 text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <Users className="h-3.5 w-3.5" />
                                            Bulk
                                        </button>
                                    </div>

                                    {audienceType === 'single' && (
                                        <input
                                            type="email"
                                            value={singleRecipient}
                                            onChange={(e) => setSingleRecipient(e.target.value)}
                                            placeholder="recipient@example.com"
                                            className="w-full bg-secondary/30 border border-border/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-muted-foreground/50"
                                        />
                                    )}

                                    {audienceType === 'bulk' && (
                                        <div className="text-xs text-muted-foreground">
                                            {audienceCount !== null
                                                ? <span>Sending to <strong className="text-foreground">{audienceCount}</strong> confirmed users</span>
                                                : <span>Counting recipients...</span>
                                            }
                                        </div>
                                    )}
                                </div>

                                {/* Preview */}
                                <div className="rounded-lg border border-border/40 bg-card/30 overflow-hidden">
                                    <button
                                        onClick={() => setShowPreview(!showPreview)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Eye className="h-3.5 w-3.5" />
                                            Preview
                                        </span>
                                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showPreview && "rotate-180")} />
                                    </button>
                                    {showPreview && (
                                        <div className="border-t border-border/30 p-4">
                                            <div className="text-[10px] text-muted-foreground mb-2 space-y-0.5">
                                                <p><strong>From:</strong> {fromDisplay}</p>
                                                <p><strong>Subject:</strong> {subject || '(no subject)'}</p>
                                                <p><strong>Type:</strong> {EMAIL_CATEGORIES.find((c) => c.value === category)?.label}</p>
                                            </div>
                                            <div
                                                className="prose prose-invert prose-sm max-w-none text-xs rounded bg-black/30 p-3 max-h-52 overflow-y-auto"
                                                dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Send actions */}
                                <div className="space-y-2">
                                    {audienceType === 'single' && (
                                        <Button
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                            onClick={() => handleSend(false)}
                                            disabled={isSending || !subject.trim()}
                                        >
                                            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                            Send Email
                                        </Button>
                                    )}

                                    {audienceType === 'bulk' && (
                                        <>
                                            <Button
                                                variant="outline"
                                                className="w-full gap-2"
                                                onClick={() => handleSend(true)}
                                                disabled={isSending || !subject.trim() || !singleRecipient.trim()}
                                            >
                                                <TestTube className="h-4 w-4" />
                                                Send Test First
                                            </Button>
                                            <input
                                                type="email"
                                                value={singleRecipient}
                                                onChange={(e) => setSingleRecipient(e.target.value)}
                                                placeholder="your test email..."
                                                className="w-full bg-secondary/30 border border-border/30 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 placeholder:text-muted-foreground/50"
                                            />
                                            <Button
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                                                onClick={() => handleSend(false)}
                                                disabled={isSending || !subject.trim()}
                                            >
                                                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                Send to All ({audienceCount ?? '...'})
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════ HISTORY TAB ═══════ */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-medium">Send History</h2>
                            <Button variant="outline" size="sm" onClick={fetchHistory} className="text-xs gap-1.5">
                                <History className="h-3.5 w-3.5" />
                                Refresh
                            </Button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : sends.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                No emails sent yet.
                            </div>
                        ) : (
                            <div className="rounded-lg border border-border/40 overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border/30 bg-secondary/20">
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5">Subject</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5">Type</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5">Audience</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5">Sender</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5">Status</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-4 py-2.5">Sent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {sends.map((send) => (
                                            <tr key={send.id} className="hover:bg-secondary/10 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium truncate max-w-[200px]">{send.subject}</td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">
                                                        {send.category.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {send.audience_type === 'single'
                                                        ? send.single_recipient
                                                        : `${send.success_count}/${send.recipient_count}`
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {send.email_sender_profiles
                                                        ? send.email_sender_profiles.display_name
                                                        : 'Default'
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                                        send.status === 'sent' && "bg-emerald-500/20 text-emerald-400",
                                                        send.status === 'sending' && "bg-yellow-500/20 text-yellow-400",
                                                        send.status === 'failed' && "bg-red-500/20 text-red-400",
                                                        send.status === 'draft' && "bg-secondary/50 text-muted-foreground",
                                                    )}>
                                                        {send.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                                    {send.sent_at
                                                        ? new Date(send.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                        : '—'
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ PROFILES TAB ═══════ */}
                {activeTab === 'profiles' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-sm font-medium mb-1">Sender Profiles</h2>
                            <p className="text-xs text-muted-foreground">
                                Configure how your name and email appear when sending emails.
                                Emails are sent from <strong>handle@{EMAIL_DOMAIN}</strong>.
                            </p>
                        </div>

                        {/* Add new */}
                        <div className="rounded-lg border border-border/40 bg-card/30 p-4 space-y-3">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Profile</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={newProfileName}
                                        onChange={(e) => setNewProfileName(e.target.value)}
                                        placeholder="Samuel from Cencori"
                                        className="w-full bg-secondary/30 border border-border/30 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-muted-foreground/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Email Handle</label>
                                    <div className="flex items-center gap-0">
                                        <input
                                            type="text"
                                            value={newProfileHandle}
                                            onChange={(e) => setNewProfileHandle(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                                            placeholder="samuel"
                                            className="flex-1 bg-secondary/30 border border-border/30 rounded-l-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 placeholder:text-muted-foreground/50"
                                        />
                                        <span className="bg-secondary/50 border border-l-0 border-border/30 rounded-r-md px-2 py-2 text-xs text-muted-foreground">
                                            @{EMAIL_DOMAIN}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile || !newProfileName.trim() || !newProfileHandle.trim()}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                                >
                                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Add
                                </Button>
                            </div>
                        </div>

                        {/* Existing profiles */}
                        {loadingProfiles ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </div>
                        ) : profiles.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                                No sender profiles yet. Create one above.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {profiles.map((profile) => (
                                    <div
                                        key={profile.id}
                                        className="rounded-lg border border-border/40 bg-card/30 px-4 py-3 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-medium">
                                                {profile.display_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{profile.display_name}</p>
                                                <p className="text-xs text-muted-foreground">{profile.email_handle}@{EMAIL_DOMAIN}</p>
                                            </div>
                                            {profile.is_default && (
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Default</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteProfile(profile.id)}
                                            className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
