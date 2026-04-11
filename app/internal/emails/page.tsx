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
    Megaphone,
    History,
    PenLine,
    Eye,
    UserCircle,
    Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { renderTemplate } from '@/lib/email-templates';

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

const EMAIL_DOMAIN = process.env.NEXT_PUBLIC_EMAIL_DOMAIN || 'send.cencori.com';

// —— TipTap Toolbar ——————————————————————————————————
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
    const [linkUrl, setLinkUrl] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isLinkOpen, setIsLinkOpen] = useState(false);
    const [isImageOpen, setIsImageOpen] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    if (!editor) return null;

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
    ];

    return (
        <div className="flex items-center gap-0.5 border-b border-border/40 px-3 py-1.5 flex-wrap">
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

            <Popover open={isLinkOpen} onOpenChange={setIsLinkOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "p-1.5 rounded hover:bg-secondary/60 transition-colors",
                            editor.isActive('link') && "bg-secondary text-foreground"
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
                            "p-1.5 rounded hover:bg-secondary/60 transition-colors",
                            isImageOpen && "bg-secondary text-foreground"
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
                            {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
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
    const router = useRouter();
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

    // TipTap editor
    const editor = useEditor({
        immediatelyRender: false,
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
                class: 'prose prose-invert prose-sm max-w-none focus:outline-none min-h-[60vh] px-6 py-5',
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
        if (audienceType === 'newsletter') fetchNewsletterCount();
    }, [audienceType, fetchNewsletterCount]);

    // Close preview drawer on Escape, lock body scroll while open
    useEffect(() => {
        if (!showPreview) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setShowPreview(false);
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
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

    const previewHtml = renderTemplate(category, {
        subject: subject || '(no subject)',
        body: editor?.getHTML() || '<p style="color:#9ca3af">(empty)</p>',
    });

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

    return (
        <div className="min-h-screen bg-background text-foreground">
            <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Email Center</h1>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Compose newsletters, product updates, and announcements
                        </p>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/30">
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

                {/* ═══════ COMPOSE TAB ═══════ */}
                {activeTab === 'compose' && (
                    <div className="space-y-4">
                        {/* Result banner */}
                        {sendResult && (
                            <div className={cn(
                                "rounded-lg border px-4 py-2.5 text-xs flex items-center gap-2",
                                sendResult.success
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                    : "border-red-500/30 bg-red-500/10 text-red-300"
                            )}>
                                {sendResult.success ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
                                <span className="flex-1">{sendResult.message}</span>
                                <button onClick={() => setSendResult(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                            </div>
                        )}

                        {/* Editor card — full width */}
                        <div className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
                            {/* Metadata bar */}
                            <div className="flex items-center gap-4 px-5 py-3 border-b border-border/30 text-xs flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">From</span>
                                    <div className="relative flex items-center">
                                        <select
                                            className="bg-transparent text-foreground appearance-none cursor-pointer focus:outline-none pr-5 text-xs"
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
                                        <ChevronDown className="h-3 w-3 text-muted-foreground/60 absolute right-0 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="h-3 w-px bg-border/40" />
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Type</span>
                                    <div className="relative flex items-center">
                                        <select
                                            className="bg-transparent text-foreground appearance-none cursor-pointer focus:outline-none pr-5 text-xs"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                        >
                                            {EMAIL_CATEGORIES.map((cat) => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="h-3 w-3 text-muted-foreground/60 absolute right-0 pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Subject */}
                            <div className="px-6 py-4 border-b border-border/30">
                                <input
                                    type="text"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Subject"
                                    className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                                />
                            </div>

                            {/* Toolbar */}
                            <EditorToolbar editor={editor} />

                            {/* Body */}
                            <EditorContent editor={editor} />

                            {/* Merge tags + preview toggle */}
                            <div className="flex items-center justify-between gap-2 flex-wrap px-5 py-3 border-t border-border/30">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Personalize</span>
                                    {[
                                        { tag: '{first_name}', label: 'First Name' },
                                        { tag: '{full_name}', label: 'Full Name' },
                                        { tag: '{email}', label: 'Email' },
                                    ].map((item) => (
                                        <button
                                            key={item.tag}
                                            type="button"
                                            onClick={() => editor?.chain().focus().insertContent(item.tag).run()}
                                            className="text-[10px] px-2 py-0.5 rounded-full border border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                                        >
                                            {item.tag}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="text-[10px] px-2.5 py-1 rounded-md border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors flex items-center gap-1.5"
                                >
                                    <Eye className="h-3 w-3" />
                                    {showPreview ? 'Hide preview' : 'Preview'}
                                </button>
                            </div>
                        </div>

                        {/* Audience + Send card */}
                        <div className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
                            {/* Audience selector */}
                            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Audience</span>
                                <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/30">
                                    {[
                                        { value: 'single' as const, label: 'Single', icon: Mail },
                                        { value: 'bulk' as const, label: 'All Users', icon: Users },
                                        { value: 'newsletter' as const, label: 'Newsletter', icon: Megaphone },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setAudienceType(opt.value)}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                                                audienceType === opt.value
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <opt.icon className="h-3.5 w-3.5" />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="ml-auto text-[11px] text-muted-foreground">
                                    {audienceType === 'bulk' && (
                                        audienceCount !== null
                                            ? <span><strong className="text-foreground">{audienceCount}</strong> confirmed user{audienceCount === 1 ? '' : 's'}</span>
                                            : <span>Counting…</span>
                                    )}
                                    {audienceType === 'newsletter' && (
                                        newsletterCount !== null
                                            ? <span><strong className="text-foreground">{newsletterCount}</strong> confirmed subscriber{newsletterCount === 1 ? '' : 's'}</span>
                                            : <span>Counting…</span>
                                    )}
                                </div>
                            </div>

                            {/* Send row */}
                            <div className="px-5 py-4 flex items-center gap-3 flex-wrap">
                                {audienceType === 'single' ? (
                                    <>
                                        <input
                                            type="email"
                                            value={singleRecipient}
                                            onChange={(e) => setSingleRecipient(e.target.value)}
                                            placeholder="recipient@example.com"
                                            className="flex-1 min-w-[220px] h-8 px-3 rounded-lg border border-border/40 bg-card/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <Button
                                            className="bg-foreground text-background hover:opacity-90 h-8 px-4 text-xs gap-1.5"
                                            onClick={() => handleSend(false)}
                                            disabled={isSending || !subject.trim() || !singleRecipient.trim()}
                                        >
                                            Send
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <input
                                            type="email"
                                            value={singleRecipient}
                                            onChange={(e) => setSingleRecipient(e.target.value)}
                                            placeholder="test@example.com"
                                            className="flex-1 min-w-[220px] h-8 px-3 rounded-lg border border-border/40 bg-card/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <Button
                                            variant="outline"
                                            className="h-8 px-3 text-xs gap-1.5 border-border/40"
                                            onClick={() => handleSend(true)}
                                            disabled={isSending || !subject.trim() || !singleRecipient.trim()}
                                        >
                                            <TestTube className="h-3.5 w-3.5" />
                                            Send Test
                                        </Button>
                                        <Button
                                            className="bg-foreground text-background hover:opacity-90 h-8 px-4 text-xs gap-1.5"
                                            onClick={() => handleSend(false)}
                                            disabled={isSending || !subject.trim() || (audienceType === 'newsletter' && !newsletterCount)}
                                        >
                                            {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : audienceType === 'newsletter' ? <Megaphone className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                                            {audienceType === 'newsletter'
                                                ? `Send to Newsletter (${newsletterCount ?? '…'})`
                                                : `Send to All (${audienceCount ?? '…'})`}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════ HISTORY TAB ═══════ */}
                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Send History</span>
                                <span className="text-[10px] text-muted-foreground/40">{sends.length}</span>
                            </div>
                            <button
                                onClick={fetchHistory}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/40 bg-card/50 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <History className="h-3.5 w-3.5" />
                                Refresh
                            </button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
                                Loading history…
                            </div>
                        ) : sends.length === 0 ? (
                            <div className="text-center py-16 text-xs text-muted-foreground/50">
                                No emails sent yet.
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border/30 bg-card/60 overflow-hidden">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border/30">
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 py-3">Subject</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 py-3">Type</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 py-3">Audience</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 py-3">Sender</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 py-3">Status</th>
                                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-4 py-3">Sent</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {sends.map((send) => (
                                            <tr key={send.id} className="hover:bg-card/80 transition-colors">
                                                <td className="px-4 py-3 text-xs font-medium truncate max-w-[260px]">{send.subject}</td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border/30 bg-muted/30 text-muted-foreground">
                                                        {send.category.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                                                    {send.audience_type === 'single'
                                                        ? send.single_recipient
                                                        : `${send.success_count}/${send.recipient_count}`
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                                                    {send.email_sender_profiles
                                                        ? send.email_sender_profiles.display_name
                                                        : 'Default'
                                                    }
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        "text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider",
                                                        send.status === 'sent' && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                                                        send.status === 'sending' && "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
                                                        send.status === 'failed' && "bg-red-500/10 text-red-400 border border-red-500/20",
                                                        send.status === 'draft' && "bg-muted/30 text-muted-foreground border border-border/30",
                                                    )}>
                                                        {send.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] text-muted-foreground">
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
                    <div className="space-y-4">
                        <div>
                            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Sender Profiles</span>
                            <p className="text-[11px] text-muted-foreground/60 mt-1">
                                Configure how your name and email appear when sending. Emails are sent from <strong className="text-foreground">handle@{EMAIL_DOMAIN}</strong>.
                            </p>
                        </div>

                        {/* Add new */}
                        <div className="rounded-xl border border-border/30 bg-card/60 p-5">
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                                <div>
                                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Display Name</label>
                                    <input
                                        type="text"
                                        value={newProfileName}
                                        onChange={(e) => setNewProfileName(e.target.value)}
                                        placeholder="Samuel from Cencori"
                                        className="w-full h-8 px-3 rounded-lg border border-border/40 bg-card/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1.5">Email Handle</label>
                                    <div className="flex items-center">
                                        <input
                                            type="text"
                                            value={newProfileHandle}
                                            onChange={(e) => setNewProfileHandle(e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase())}
                                            placeholder="samuel"
                                            className="flex-1 h-8 px-3 rounded-l-lg border border-border/40 bg-card/50 text-xs placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <span className="h-8 inline-flex items-center bg-muted/30 border border-l-0 border-border/40 rounded-r-lg px-2.5 text-[11px] text-muted-foreground">
                                            @{EMAIL_DOMAIN}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile || !newProfileName.trim() || !newProfileHandle.trim()}
                                    className="h-8 px-3 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                    Add Profile
                                </button>
                            </div>
                        </div>

                        {/* Existing profiles */}
                        {loadingProfiles ? (
                            <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                                Loading profiles…
                            </div>
                        ) : profiles.length === 0 ? (
                            <div className="text-center py-12 text-xs text-muted-foreground/50">
                                No sender profiles yet. Create one above.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {profiles.map((profile) => (
                                    <div
                                        key={profile.id}
                                        className="rounded-xl border border-border/30 bg-card/60 px-4 py-3 flex items-center justify-between hover:border-border/50 hover:bg-card/80 transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Avatar with upload */}
                                            <label className="relative h-9 w-9 rounded-full shrink-0 cursor-pointer group">
                                                {profile.avatar_url ? (
                                                    <img
                                                        src={profile.avatar_url}
                                                        alt={profile.display_name}
                                                        className="h-9 w-9 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-9 w-9 rounded-full bg-muted/30 border border-border/40 flex items-center justify-center text-foreground text-xs font-medium">
                                                        {profile.display_name.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                                            <div>
                                                <p className="text-xs font-medium">{profile.display_name}</p>
                                                <p className="text-[11px] text-muted-foreground">{profile.email_handle}@{EMAIL_DOMAIN}</p>
                                            </div>
                                            {profile.is_default && (
                                                <span className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Default</span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteProfile(profile.id)}
                                            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
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
                        className="relative z-10 w-full max-w-md rounded-xl border border-border/40 bg-card/95 backdrop-blur shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
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
                                        You're about to email{' '}
                                        <span className="text-foreground font-medium">
                                            {confirmSend.count ?? '…'}
                                        </span>{' '}
                                        {confirmSend.audienceType === 'newsletter'
                                            ? `confirmed subscriber${confirmSend.count === 1 ? '' : 's'}`
                                            : `confirmed user${confirmSend.count === 1 ? '' : 's'}`}
                                        . This can't be undone.
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
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Send className="h-3 w-3" />
                                )}
                                Send{confirmSend.count !== null ? ` (${confirmSend.count})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ PREVIEW DRAWER ═══════ */}
            <div
                className={cn(
                    "fixed inset-0 z-50 transition-opacity duration-300",
                    showPreview ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                aria-hidden={!showPreview}
            >
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={() => setShowPreview(false)}
                />

                {/* Drawer panel */}
                <div
                    className={cn(
                        "absolute right-0 top-0 h-full w-full max-w-[680px] bg-background border-l border-border/40 shadow-2xl flex flex-col transition-transform duration-300 ease-out",
                        showPreview ? "translate-x-0" : "translate-x-full"
                    )}
                    role="dialog"
                    aria-label="Email preview"
                >
                    {/* Drawer header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 shrink-0">
                        <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            <div>
                                <h3 className="text-sm font-medium leading-tight">Preview</h3>
                                <p className="text-[10px] text-muted-foreground/60 leading-tight">How recipients will see it</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowPreview(false)}
                            className="p-1.5 rounded-md hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Close preview"
                        >
                            <XCircle className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Email envelope — Gmail-style */}
                    <div className="px-5 py-4 border-b border-border/30 shrink-0 bg-card/30">
                        <div className="flex items-start gap-3">
                            {/* Avatar */}
                            <div className="h-10 w-10 rounded-full bg-muted/40 border border-border/40 flex items-center justify-center text-sm font-semibold text-foreground shrink-0 overflow-hidden">
                                {selectedProfile?.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={selectedProfile.avatar_url} alt={fromName} className="h-full w-full object-cover" />
                                ) : (
                                    fromInitial
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between gap-2">
                                    <div className="text-sm font-medium text-foreground truncate">
                                        {fromName}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground/60 shrink-0">{previewDate}</div>
                                </div>
                                <div className="text-[11px] text-muted-foreground/80 truncate">
                                    &lt;{fromEmail}&gt;
                                </div>
                                <div className="text-[11px] text-muted-foreground/80 truncate mt-0.5">
                                    to <span className="text-foreground/80">{audienceToLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 pl-[52px]">
                            <div className="text-sm font-semibold text-foreground leading-snug break-words">
                                {subject || <span className="text-muted-foreground/60 italic">(no subject)</span>}
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-muted/40 border border-border/30 text-muted-foreground capitalize">
                                    {categoryLabel}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* iframe body */}
                    <div className="flex-1 overflow-hidden bg-white">
                        <iframe
                            srcDoc={previewHtml}
                            className="w-full h-full border-0 block"
                            title="Email preview"
                            sandbox="allow-same-origin"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
