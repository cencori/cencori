'use client';

import React, { useState, useCallback, useEffect, useDeferredValue, useMemo } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {
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
    Plus,
    Trash2,
    CheckCircle,
    XCircle,
    ChevronDown,
    Users,
    Megaphone,
    History,
    PenLine,
    Eye,
    UserCircle,
    Camera,
    Check,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { renderTemplate } from '@/lib/email-templates';
import { StatCard } from '@/internal/analytics/components/StatCard';

// —— Types ——————————————————————————————————————————
interface SenderProfile {
    id: string;
    user_id: string;
    display_name: string;
    email_handle: string;
    is_default: boolean;
    avatar_url: string | null;
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

// The editor's text styles, each shown in its own size in the menu.
const TEXT_STYLES = [
    { value: 'p', label: 'Paragraph', className: 'text-[13px]' },
    { value: 'h1', label: 'Heading 1', className: 'text-lg font-semibold' },
    { value: 'h2', label: 'Heading 2', className: 'text-base font-semibold' },
    { value: 'h3', label: 'Heading 3', className: 'text-sm font-semibold' },
] as const;

const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'send.cencori.com';

// —— TipTap Toolbar ——————————————————————————————————
type EditorInstance = NonNullable<ReturnType<typeof useEditor>>;

/** What's switched on at the cursor, so the toolbar can show it. */
function readFormatting(current: EditorInstance) {
    return {
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        bulletList: current.isActive('bulletList'),
        orderedList: current.isActive('orderedList'),
        alignLeft: current.isActive({ textAlign: 'left' }),
        alignCenter: current.isActive({ textAlign: 'center' }),
        link: current.isActive('link'),
        style: current.isActive('heading', { level: 1 }) ? 'h1'
            : current.isActive('heading', { level: 2 }) ? 'h2'
                : current.isActive('heading', { level: 3 }) ? 'h3'
                    : 'p',
    };
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
    const [linkUrl, setLinkUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isLinkOpen, setIsLinkOpen] = useState(false);
    const [isImageOpen, setIsImageOpen] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Tiptap 3 doesn't re-render on every transaction; subscribe to just the
    // formatting at the cursor so the buttons show what's on, and only the
    // toolbar re-renders when it changes.
    const active = useEditorState({
        editor,
        selector: ({ editor: current }) => (current ? readFormatting(current) : null),
    });

    if (!editor) return null;
    // The subscription only fills in after the editor's first transaction;
    // read it directly until then so the toolbar shows from the start.
    const formatting = active ?? readFormatting(editor);

    const currentStyle = formatting.style;

    const addLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (linkUrl) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
            setLinkUrl('');
            setIsLinkOpen(false);
        }
    };

    const addImage = (e: React.FormEvent) => {
        e.preventDefault();
        if (imageUrl) {
            editor.chain().focus().setImage({ src: imageUrl }).run();
            setImageUrl('');
            setIsImageOpen(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingImage(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch('/api/internal/emails/upload-image', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                editor.chain().focus().setImage({ src: data.url }).run();
                setIsImageOpen(false);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to upload image');
            }
        } catch (err) {
            console.error('Image upload failed:', err);
            alert('Failed to upload image');
        } finally {
            setIsUploadingImage(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const toolbarButtons = [
        { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: formatting.bold, title: 'Bold' },
        { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: formatting.italic, title: 'Italic' },
        { icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run(), active: formatting.underline, title: 'Underline' },
        { separator: true },
        { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: formatting.bulletList, title: 'Bullet List' },
        { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: formatting.orderedList, title: 'Ordered List' },
        { separator: true },
        { icon: AlignLeft, action: () => editor.chain().focus().setTextAlign('left').run(), active: formatting.alignLeft, title: 'Align Left' },
        { icon: AlignCenter, action: () => editor.chain().focus().setTextAlign('center').run(), active: formatting.alignCenter, title: 'Align Center' },
        { separator: true },
    ];

    return (
        <div className="flex w-max flex-nowrap items-center gap-0.5 rounded-full bg-muted/60 px-2 py-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="mr-1 flex h-7 items-center gap-1 rounded-full px-2.5 text-xs text-foreground hover:bg-muted focus:outline-none"
                        aria-label="Text style"
                    >
                        {TEXT_STYLES.find((style) => style.value === currentStyle)?.label ?? 'Paragraph'}
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="top"
                    align="start"
                    sideOffset={6}
                    className="w-48 rounded-xl !border-0 !bg-[#f3f3f1] p-1 shadow-[0_18px_48px_rgba(0,0,0,0.35)] dark:!bg-[#181818]"
                >
                    {TEXT_STYLES.map((style) => (
                        <DropdownMenuItem
                            key={style.value}
                            className="min-h-8 cursor-pointer rounded-lg px-3 py-1"
                            onSelect={() => {
                                if (style.value === 'p') editor.chain().focus().setParagraph().run();
                                else editor.chain().focus().setHeading({ level: Number(style.value.slice(1)) as 1 | 2 | 3 }).run();
                            }}
                        >
                            <span className={cn('min-w-0 flex-1 truncate', style.className)}>{style.label}</span>
                            {currentStyle === style.value && <Check className="ml-auto size-3.5 shrink-0" />}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
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
                            "rounded-full p-1.5 transition-colors",
                            btn.active
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={btn.title}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </button>
                );
            })}

            <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "rounded-full p-1.5 transition-colors",
                            formatting.link
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title="Add Link"
                    >
                        <LinkIcon className="h-3.5 w-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="start">
                    <form onSubmit={addLink} className="flex gap-2">
                        <Input
                            placeholder="https://example.com"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                        />
                        <Button type="submit" size="sm" className="h-8 py-0 px-3 text-xs font-medium">Add Link</Button>
                    </form>
                </PopoverContent>
            </Popover>

            <Popover open={isImageOpen} onOpenChange={setIsImageOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "rounded-full p-1.5 transition-colors",
                            isImageOpen
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title="Add Image"
                    >
                        <ImageIcon className="h-3.5 w-3.5" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 space-y-4" align="start">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground">Upload from computer</label>
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full text-xs font-medium gap-2"
                            disabled={isUploadingImage}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {isUploadingImage ? <Spinner className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                            {isUploadingImage ? 'Uploading...' : 'Choose Image File'}
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-border/40" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">or URL</span>
                        <div className="h-px flex-1 bg-border/40" />
                    </div>

                    <form onSubmit={addImage} className="flex gap-2">
                        <Input
                            placeholder="https://example.com/image.png"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="h-8 text-xs"
                        />
                        <Button type="submit" size="sm" className="h-8 py-0 px-3 text-xs font-medium">Add</Button>
                    </form>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// —— Main Page ——————————————————————————————————————
export default function InternalEmailsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('compose');

    // Compose state
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('announcement');
    const [audienceType, setAudienceType] = useState<'bulk' | 'single' | 'newsletter'>('single');
    const [singleRecipient, setSingleRecipient] = useState('');
    const [selectedProfileId, setSelectedProfileId] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [audienceCount, setAudienceCount] = useState<number | null>(null);
    const [newsletterCount, setNewsletterCount] = useState<number | null>(null);
    const [confirmSend, setConfirmSend] = useState<{
        audienceType: 'bulk' | 'newsletter';
        count: number | null;
    } | null>(null);

    // Profiles state
    const [profiles, setProfiles] = useState<SenderProfile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileHandle, setNewProfileHandle] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    // History state
    const [sends, setSends] = useState<EmailSend[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // The preview follows the draft as you type; deferred so typing never waits on it.
    const [bodyHtml, setBodyHtml] = useState('');
    const deferredBody = useDeferredValue(bodyHtml);

    // TipTap editor
    const editor = useEditor({
        // Tiptap 3 creates the editor after the first render and doesn't
        // re-render on its own; setting state here shows the toolbar right
        // away instead of after the first keystroke.
        onCreate: ({ editor: current }) => setBodyHtml(current.getHTML()),
        onUpdate: ({ editor: current }) => setBodyHtml(current.getHTML()),
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Link.configure({ openOnClick: false }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Image,
        ],
        content: '<p></p>',
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-full px-4 py-4 sm:px-6',
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
        fetchAudienceCount();
    }, [fetchAudienceCount]);

    // Fetch newsletter subscriber count
    const fetchNewsletterCount = useCallback(async () => {
        try {
            const res = await fetch('/api/internal/newsletter/count');
            if (res.ok) {
                const data = await res.json();
                setNewsletterCount(data.confirmed);
            }
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchNewsletterCount();
    }, [fetchNewsletterCount]);

    // Escape closes the preview pane.
    useEffect(() => {
        if (!showPreview) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowPreview(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showPreview]);

    // Close confirm dialog on Escape
    useEffect(() => {
        if (!confirmSend) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setConfirmSend(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirmSend]);

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

    // Upload avatar for a profile
    const handleAvatarUpload = async (profileId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('profileId', profileId);

        try {
            const res = await fetch('/api/internal/emails/sender-profiles/avatar', {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                fetchProfiles();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to upload avatar');
            }
        } catch {
            alert('Failed to upload avatar');
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

    // Actual send implementation — called after any confirmation gate.
    const performSend = async (testMode: boolean) => {
        const effectiveAudienceType = testMode ? 'single' : audienceType;
        const effectiveRecipient = testMode
            ? singleRecipient
            : audienceType === 'single'
                ? singleRecipient
                : undefined;

        setIsSending(true);
        setSendResult(null);

        try {
            const res = await fetch('/api/internal/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: subject.trim(),
                    htmlBody: editor?.getHTML() ?? '',
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

    // Send email — validates then either opens confirm dialog or sends directly.
    const handleSend = (testMode: boolean = false) => {
        if (!subject.trim() || !editor?.getHTML()) {
            setSendResult({ success: false, message: 'Subject and body are required' });
            return;
        }

        const effectiveAudienceType = testMode ? 'single' : audienceType;
        const effectiveRecipient = testMode
            ? singleRecipient
            : audienceType === 'single'
                ? singleRecipient
                : undefined;

        if (effectiveAudienceType === 'single' && !effectiveRecipient?.trim()) {
            setSendResult({ success: false, message: 'Recipient email is required for single/test send' });
            return;
        }

        if (!testMode && audienceType === 'bulk') {
            setConfirmSend({ audienceType: 'bulk', count: audienceCount });
            return;
        }

        if (!testMode && audienceType === 'newsletter') {
            setConfirmSend({ audienceType: 'newsletter', count: newsletterCount });
            return;
        }

        void performSend(testMode);
    };

    const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
    const fromDisplay = selectedProfile
        ? `${selectedProfile.display_name} <${selectedProfile.email_handle}@${EMAIL_DOMAIN}>`
        : 'Default sender';
    const fromName = selectedProfile?.display_name ?? 'Cencori';
    const fromEmail = selectedProfile
        ? `${selectedProfile.email_handle}@${EMAIL_DOMAIN}`
        : `hello@${EMAIL_DOMAIN}`;
    const fromInitial = (fromName.trim()[0] || 'C').toUpperCase();

    const deferredSubject = useDeferredValue(subject);
    const previewHtml = useMemo(() => renderTemplate(category, {
        subject: deferredSubject || '(no subject)',
        body: deferredBody && deferredBody !== '<p></p>' ? deferredBody : '<p style="color:#9ca3af">(empty)</p>',
    }), [category, deferredSubject, deferredBody]);

    const audienceToLabel =
        audienceType === 'single'
            ? (singleRecipient || 'recipient@example.com')
            : audienceType === 'bulk'
                ? `All Cencori users${audienceCount !== null ? ` (${audienceCount})` : ''}`
                : `Newsletter subscribers${newsletterCount !== null ? ` (${newsletterCount})` : ''}`;

    const previewDate = new Date().toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

    const categoryLabel = category.replace(/_/g, ' ');

    const totalReached = sends
        .filter((send) => send.audience_type !== 'single')
        .reduce((sum, send) => sum + (send.success_count || 0), 0);
    const lastBulk = sends.find((send) => send.audience_type !== 'single' && send.sent_at);
    const failedSends = sends.filter((send) => send.status === 'failed').length;

    const cardClass = 'overflow-hidden rounded-lg border border-border/40 bg-muted/30';
    const cardHeaderClass = 'flex items-center justify-between gap-4 border-b border-border/40 px-5 py-3.5';
    const fieldClass = 'h-8 rounded-md border border-border/45 bg-background/60 px-3 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-zinc-500/20';

    const rowClass = 'flex min-w-0 items-center gap-3 border-b border-border/40 px-4 py-2.5 text-sm sm:px-6';

    return (
        <div className="flex h-[calc(100svh-3rem)] w-full min-w-0 flex-col overflow-hidden bg-background text-foreground md:h-svh">
            {/* Top strip: tabs left, compose controls right */}
            <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/40 px-2 sm:px-4">
                <div className="flex items-center gap-1">
                    {([
                        { id: 'compose' as Tab, label: 'Compose', icon: PenLine },
                        { id: 'history' as Tab, label: 'History', icon: History },
                        { id: 'profiles' as Tab, label: 'Senders', icon: UserCircle },
                    ]).map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors',
                                activeTab === tab.id
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
                {activeTab === 'compose' && (
                    <div className="flex items-center gap-1">
                        <span className="relative">
                            <select
                                className="h-8 max-w-[9rem] appearance-none truncate rounded-md bg-transparent pl-2.5 pr-7 text-[13px] text-muted-foreground hover:bg-muted focus:outline-none sm:max-w-none"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                aria-label="Email type"
                            >
                                {EMAIL_CATEGORIES.map((cat) => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowPreview((open) => !open)}
                            aria-pressed={showPreview}
                            className={cn(
                                'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors',
                                showPreview ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Preview</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ═══════ COMPOSE TAB ═══════ */}
            {activeTab === 'compose' && (
                <div className="flex min-h-0 flex-1">
                    {/* Draft (on phones the preview takes its place) */}
                    <div className={cn('min-w-0 flex-1 flex-col', showPreview ? 'hidden md:flex' : 'flex')}>
                        {sendResult && (
                            <div className={cn(
                                'flex items-center gap-2 border-b px-6 py-2 text-[12px]',
                                sendResult.success
                                    ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-400'
                                    : 'border-red-500/20 bg-red-500/[0.06] text-red-600 dark:text-red-400'
                            )}>
                                {sendResult.success ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                                <span className="flex-1">{sendResult.message}</span>
                                <button onClick={() => setSendResult(null)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">✕</button>
                            </div>
                        )}

                        {/* From */}
                        <div className={rowClass}>
                            <span className="w-10 shrink-0 text-muted-foreground sm:w-14">From</span>
                            <span className="relative min-w-0 flex-1">
                                <select
                                    className="w-full appearance-none truncate bg-transparent pr-6 text-sm text-foreground focus:outline-none"
                                    value={selectedProfileId}
                                    onChange={(e) => setSelectedProfileId(e.target.value)}
                                >
                                    <option value="">Default sender (hello@{EMAIL_DOMAIN})</option>
                                    {profiles.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.display_name} &lt;{p.email_handle}@{EMAIL_DOMAIN}&gt;
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            </span>
                        </div>

                        {/* To */}
                        <div className={rowClass}>
                            <span className="w-10 shrink-0 text-muted-foreground sm:w-14">To</span>
                            <div className="min-w-0 flex-1">
                                {audienceType === 'single' ? (
                                    <input
                                        type="email"
                                        value={singleRecipient}
                                        onChange={(e) => setSingleRecipient(e.target.value)}
                                        placeholder="name@example.com"
                                        className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                                    />
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/50 py-0.5 pl-2.5 pr-1 text-[13px]">
                                        {audienceType === 'bulk' ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />}
                                        {audienceType === 'bulk' ? 'All users' : 'Newsletter subscribers'}
                                        <span className="font-mono text-[11px] text-muted-foreground">
                                            {(audienceType === 'bulk' ? audienceCount : newsletterCount)?.toLocaleString() ?? '…'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setAudienceType('single')}
                                            className="ml-0.5 flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label="Send to one address instead"
                                        >
                                            ✕
                                        </button>
                                    </span>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground sm:gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAudienceType('bulk')}
                                    className={cn('underline-offset-4 hover:text-foreground hover:underline', audienceType === 'bulk' && 'text-foreground')}
                                >
                                    All users
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAudienceType('newsletter')}
                                    className={cn('underline-offset-4 hover:text-foreground hover:underline', audienceType === 'newsletter' && 'text-foreground')}
                                >
                                    Newsletter
                                </button>
                            </div>
                        </div>

                        {/* Subject */}
                        <div className="border-b border-border/40 px-4 py-2.5 sm:px-6">
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Subject"
                                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                            />
                        </div>

                        {/* Body */}
                        <div className="min-h-0 flex-1 cursor-text overflow-y-auto" onClick={() => editor?.commands.focus()}>
                            <EditorContent editor={editor} />
                        </div>

                        {/* Formatting, then actions */}
                        <div className="border-t border-border/40 px-3 py-2.5 sm:px-6">
                            <div className="flex min-w-0 flex-nowrap items-center gap-1">
                                <div className="mr-1 flex shrink-0 items-center sm:mr-2">
                                    <Button
                                        className="h-9 gap-1.5 rounded-l-full rounded-r-none px-5 text-sm"
                                        onClick={() => handleSend(false)}
                                        disabled={
                                            isSending || !subject.trim()
                                            || (audienceType === 'single' && !singleRecipient.trim())
                                            || (audienceType === 'newsletter' && !newsletterCount)
                                        }
                                    >
                                        {isSending && <Spinner className="h-3.5 w-3.5 animate-spin" />}
                                        Send
                                    </Button>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                className="h-9 rounded-l-none rounded-r-full border-l border-background/25 px-2"
                                                aria-label="Send a test"
                                                disabled={isSending}
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-3" align="start" side="top">
                                            <p className="mb-2 text-xs font-medium">Send a test</p>
                                            <p className="mb-3 text-[11px] text-muted-foreground">Sends this email to one address only, with the merge tags filled in.</p>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="email"
                                                    placeholder="you@cencori.com"
                                                    value={singleRecipient}
                                                    onChange={(e) => setSingleRecipient(e.target.value)}
                                                    className="h-8 text-xs"
                                                />
                                                <Button
                                                    size="sm"
                                                    className="h-8 gap-1.5 px-3 text-xs"
                                                    onClick={() => handleSend(true)}
                                                    disabled={isSending || !subject.trim() || !singleRecipient.trim()}
                                                >
                                                    <TestTube className="h-3.5 w-3.5" />
                                                    Send test
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="flex h-8 shrink-0 items-center rounded-md px-2 font-mono text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                            title="Personalize"
                                        >
                                            {'{ }'}
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-56 p-1.5" align="start" side="top">
                                        {[
                                            { tag: '{first_name}', label: 'First name' },
                                            { tag: '{full_name}', label: 'Full name' },
                                            { tag: '{email}', label: 'Email' },
                                        ].map((item) => (
                                            <button
                                                key={item.tag}
                                                type="button"
                                                onClick={() => editor?.chain().focus().insertContent(item.tag).run()}
                                                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted"
                                            >
                                                {item.label}
                                                <span className="font-mono text-[10px] text-muted-foreground">{item.tag}</span>
                                            </button>
                                        ))}
                                    </PopoverContent>
                                </Popover>

                                <div className="ml-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <EditorToolbar editor={editor} />
                                </div>

                                <span className="ml-auto shrink-0" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!confirm('Discard this draft?')) return;
                                        setSubject('');
                                        editor?.commands.setContent('<p></p>');
                                        setBodyHtml('');
                                        setSendResult(null);
                                    }}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    title="Discard draft"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Live preview: shares the page with the draft */}
                    {showPreview && (
                        <aside className="flex w-full min-w-0 flex-col md:w-1/2 md:border-l md:border-border/40" aria-label="Email preview">
                            <div className="shrink-0 border-b border-border/40 px-4 py-4 sm:px-6">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-muted/40 text-sm font-semibold">
                                        {selectedProfile?.avatar_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={selectedProfile.avatar_url} alt={fromName} className="h-full w-full object-cover" />
                                        ) : (
                                            fromInitial
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div className="truncate text-sm font-medium">{fromName}</div>
                                            <div className="shrink-0 text-[11px] text-muted-foreground">{previewDate}</div>
                                        </div>
                                        <div className="truncate text-[12px] text-muted-foreground">&lt;{fromEmail}&gt;</div>
                                        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                                            to <span className="text-foreground/80">{audienceToLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 pl-[52px]">
                                    <div className="break-words text-sm font-semibold leading-snug">
                                        {subject || <span className="italic text-muted-foreground">(no subject)</span>}
                                    </div>
                                    <span className="mt-1.5 inline-flex rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
                                        {categoryLabel}
                                    </span>
                                </div>
                            </div>
                            <div className="min-h-0 flex-1 bg-white">
                                <iframe
                                    srcDoc={previewHtml}
                                    className="block h-full w-full border-0"
                                    title="Email preview"
                                    sandbox="allow-same-origin"
                                />
                            </div>
                        </aside>
                    )}
                </div>
            )}

            {activeTab !== 'compose' && (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <section className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
    {/* ═══════ HISTORY TAB ═══════ */}
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <StatCard
                                title="Sends"
                                detail={lastBulk?.sent_at ? `last broadcast ${new Date(lastBulk.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'no broadcasts yet'}
                                stats={[
                                    { label: 'Emails sent', value: sends.length.toLocaleString(), color: '#3b82f6' },
                                    { label: 'Broadcasts', value: sends.filter((send) => send.audience_type !== 'single').length.toLocaleString(), color: '#8b5cf6' },
                                    { label: 'People reached', value: totalReached.toLocaleString(), color: '#22c55e', hint: 'delivered, all broadcasts' },
                                    { label: 'Failed', value: failedSends.toLocaleString(), color: '#ef4444' },
                                ]}
                            />

                            <article className={cardClass}>
                                <header className={cardHeaderClass}>
                                    <p className="text-sm font-medium tracking-[-0.01em]">History</p>
                                    <button
                                        onClick={fetchHistory}
                                        className="flex h-7 items-center gap-1.5 rounded-md border border-border/45 bg-muted/20 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                                    >
                                        <History className="h-3 w-3" />
                                        Refresh
                                    </button>
                                </header>
                                {loadingHistory ? (
                                    <div className="flex h-40 items-center justify-center text-[11px] text-muted-foreground">Loading history…</div>
                                ) : sends.length === 0 ? (
                                    <div className="flex h-40 items-center justify-center">
                                        <span className="rounded-md bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">No emails sent yet</span>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-[11px] text-muted-foreground">
                                                    <th className="px-5 py-3 text-left font-normal">Subject</th>
                                                    <th className="px-3 py-3 text-left font-normal">Type</th>
                                                    <th className="px-3 py-3 text-left font-normal">Audience</th>
                                                    <th className="px-3 py-3 text-left font-normal">Sender</th>
                                                    <th className="px-3 py-3 text-left font-normal">Status</th>
                                                    <th className="px-5 py-3 text-right font-normal">Sent</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sends.map((send) => (
                                                    <tr key={send.id} className="border-t border-border/40 transition-colors hover:bg-muted/40">
                                                        <td className="max-w-[280px] truncate px-5 py-2.5 font-medium">{send.subject}</td>
                                                        <td className="px-3 py-2.5 capitalize text-muted-foreground">{send.category.replace(/_/g, ' ')}</td>
                                                        <td className="px-3 py-2.5 font-mono tabular-nums text-muted-foreground">
                                                            {send.audience_type === 'single'
                                                                ? <span className="font-sans">{send.single_recipient}</span>
                                                                : `${send.success_count.toLocaleString()} / ${send.recipient_count.toLocaleString()}`}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-muted-foreground">
                                                            {send.email_sender_profiles ? send.email_sender_profiles.display_name : 'Default'}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <span className="flex items-center gap-1.5 capitalize">
                                                                <span className={cn(
                                                                    'size-2 rounded-[1px]',
                                                                    send.status === 'sent' && 'bg-emerald-500',
                                                                    send.status === 'sending' && 'bg-amber-500',
                                                                    send.status === 'failed' && 'bg-red-500',
                                                                    send.status === 'draft' && 'bg-muted-foreground/50',
                                                                )} />
                                                                {send.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-2.5 text-right text-muted-foreground">
                                                            {send.sent_at
                                                                ? new Date(send.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </article>
                        </div>
                    )}

                    {/* ═══════ PROFILES TAB ═══════ */}
                    {activeTab === 'profiles' && (
                        <div className="space-y-4">
                            <article className={cardClass}>
                                <header className={cardHeaderClass}>
                                    <p className="text-sm font-medium tracking-[-0.01em]">New sender</p>
                                    <span className="text-xs text-muted-foreground">sends from handle@{EMAIL_DOMAIN}</span>
                                </header>
                                <div className="grid grid-cols-1 items-end gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto]">
                                    <div>
                                        <label className="mb-1.5 block text-[11px] text-muted-foreground">Display name</label>
                                        <input
                                            type="text"
                                            value={newProfileName}
                                            onChange={(e) => setNewProfileName(e.target.value)}
                                            placeholder="Samuel from Cencori"
                                            className={cn(fieldClass, 'w-full')}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[11px] text-muted-foreground">Email handle</label>
                                        <div className="flex items-center">
                                            <input
                                                type="text"
                                                value={newProfileHandle}
                                                onChange={(e) => setNewProfileHandle(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                                                placeholder="samuel"
                                                className={cn(fieldClass, 'flex-1 rounded-r-none')}
                                            />
                                            <span className="inline-flex h-8 items-center rounded-r-md border border-l-0 border-border/45 bg-muted/30 px-2.5 text-[11px] text-muted-foreground">
                                                @{EMAIL_DOMAIN}
                                            </span>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleSaveProfile}
                                        disabled={savingProfile || !newProfileName.trim() || !newProfileHandle.trim()}
                                        className="h-8 gap-1.5 px-3 text-xs"
                                    >
                                        {savingProfile ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                        Add sender
                                    </Button>
                                </div>
                            </article>

                            <article className={cardClass}>
                                <header className={cardHeaderClass}>
                                    <p className="text-sm font-medium tracking-[-0.01em]">Senders</p>
                                    <span className="text-xs text-muted-foreground">
                                        {profiles.length} {profiles.length === 1 ? 'sender' : 'senders'}
                                    </span>
                                </header>
                                {loadingProfiles ? (
                                    <div className="flex h-28 items-center justify-center text-[11px] text-muted-foreground">Loading senders…</div>
                                ) : profiles.length === 0 ? (
                                    <div className="flex h-28 items-center justify-center">
                                        <span className="rounded-md bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">No senders yet</span>
                                    </div>
                                ) : (
                                    <ul>
                                        {profiles.map((profile, index) => (
                                            <li
                                                key={profile.id}
                                                className={cn('flex items-center justify-between gap-4 px-5 py-3', index > 0 && 'border-t border-border/40')}
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <label className="group relative h-9 w-9 shrink-0 cursor-pointer rounded-full" title="Change photo">
                                                        {profile.avatar_url ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img src={profile.avatar_url} alt={profile.display_name} className="h-9 w-9 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border/45 bg-muted/40 text-xs font-medium">
                                                                {profile.display_name.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                                                            <Camera className="h-3.5 w-3.5 text-white" />
                                                        </div>
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                                            className="hidden"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleAvatarUpload(profile.id, file);
                                                                e.target.value = '';
                                                            }}
                                                        />
                                                    </label>
                                                    <div className="min-w-0">
                                                        <p className="flex items-center gap-2 text-sm font-medium">
                                                            <span className="truncate">{profile.display_name}</span>
                                                            {profile.is_default && (
                                                                <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                                                                    <span className="size-2 rounded-[1px] bg-emerald-500" />
                                                                    Default
                                                                </span>
                                                            )}
                                                        </p>
                                                        <p className="truncate font-mono text-[11px] text-muted-foreground">{profile.email_handle}@{EMAIL_DOMAIN}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteProfile(profile.id)}
                                                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                                    aria-label={`Delete ${profile.display_name}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </article>
                        </div>
                    )}
                    </section>
                </div>
            )}

            {/* ═══════ SEND CONFIRMATION DIALOG ═══════ */}
            {confirmSend && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                        onClick={() => !isSending && setConfirmSend(null)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirm send"
                        className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-border/40 bg-background shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                    >
                        {/* Header */}
                        <div className="px-5 pt-5 pb-4">
                            <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                                    {confirmSend.audienceType === 'newsletter' ? (
                                        <Megaphone className="h-4 w-4 text-amber-400" />
                                    ) : (
                                        <Users className="h-4 w-4 text-amber-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                                        {confirmSend.audienceType === 'newsletter'
                                            ? 'Send to newsletter subscribers?'
                                            : 'Send to all users?'}
                                    </h3>
                                    <p className="text-[11px] text-muted-foreground/70 mt-1 leading-snug">
                                        You&apos;re about to email{' '}
                                        <span className="text-foreground font-medium">
                                            {confirmSend.count ?? '…'}
                                        </span>{' '}
                                        {confirmSend.audienceType === 'newsletter'
                                            ? `confirmed subscriber${confirmSend.count === 1 ? '' : 's'}`
                                            : `confirmed user${confirmSend.count === 1 ? '' : 's'}`}
                                        . This can&apos;t be undone.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Email summary */}
                        <div className="mx-5 mb-4 rounded-lg border border-border/30 bg-muted/20 divide-y divide-border/20">
                            <div className="flex gap-3 px-3 py-2 text-[11px]">
                                <span className="text-muted-foreground/60 w-14 shrink-0">From</span>
                                <span className="text-foreground/90 truncate">{fromDisplay}</span>
                            </div>
                            <div className="flex gap-3 px-3 py-2 text-[11px]">
                                <span className="text-muted-foreground/60 w-14 shrink-0">Subject</span>
                                <span className="text-foreground font-medium truncate">{subject}</span>
                            </div>
                            <div className="flex gap-3 px-3 py-2 text-[11px]">
                                <span className="text-muted-foreground/60 w-14 shrink-0">Type</span>
                                <span className="text-foreground/90 capitalize">
                                    {category.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/30 bg-muted/10">
                            <button
                                onClick={() => setConfirmSend(null)}
                                disabled={isSending}
                                className="h-8 px-3 rounded-lg border border-border/40 bg-card/50 text-xs text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setConfirmSend(null);
                                    void performSend(false);
                                }}
                                disabled={isSending}
                                className="h-8 px-3.5 rounded-lg bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isSending ? (
                                    <Spinner className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Send className="h-3 w-3" />
                                )}
                                Send{confirmSend.count !== null ? ` (${confirmSend.count})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

