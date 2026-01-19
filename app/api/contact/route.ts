import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

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

        const targetEmail = emailRouting[type] || emailRouting.general;

        const { data, error } = await resend.emails.send({
            from: 'Cencori Contact <contact@cencori.com>',
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

        if (error) {
            console.error('Resend error:', error);
            return NextResponse.json(
                { error: 'Failed to send email' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, id: data?.id });
    } catch (error) {
        console.error('Contact form error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
