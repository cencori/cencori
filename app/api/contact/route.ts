import { NextRequest, NextResponse } from 'next/server';
import { EmailService, parseReplyTo } from '@/lib/email';

const CONTACT_FROM_EMAIL = process.env.RESEND_CONTACT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '';

const emailRouting: Record<string, string> = {
    general: 'hello@cencori.com',
    support: 'support@cencori.com',
    enterprise: 'enterprise@cencori.com',
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, email, company, type, subject, message } = body;

        if (!name || !email || !subject || !message) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        let emailService: EmailService;
        try {
            emailService = new EmailService();
        } catch {
            return NextResponse.json(
                { error: 'Email not configured' },
                { status: 500 }
            );
        }

        if (!CONTACT_FROM_EMAIL) {
            return NextResponse.json(
                { error: 'Contact from email not configured' },
                { status: 500 }
            );
        }

        const targetEmail = emailRouting[type] || emailRouting.general;

        const result = await emailService.send({
            from: CONTACT_FROM_EMAIL,
            to: [targetEmail],
            replyTo: email,
            subject: `[Contact Form] ${subject}`,
            html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Type:</strong> ${type?.charAt(0).toUpperCase() + type?.slice(1) || 'General'}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company || 'Not provided'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
        });

        return NextResponse.json({ success: true, id: result.id });
    } catch (error) {
        console.error('Contact form error:', error);
        return NextResponse.json(
            { error: 'Failed to send email' },
            { status: 500 }
        );
    }
}
