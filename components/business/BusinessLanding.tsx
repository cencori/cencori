"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, CreditCard, Globe, Mail, MessageCircle, Mic, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BusinessPricing } from "@/components/landing/BusinessPricing";
import { getConsoleUrl } from "@/lib/auth-redirect";

const SIGNUP = "/signup?for=business";

const STEPS = [
    { title: "Tell us about your business", body: "Describe what you do, where you are and what customers ask. Copilot builds your agent: your menu or price list, your hours, how you take bookings and payments." },
    { title: "Connect WhatsApp", body: "Log in with Facebook and confirm your number. About two minutes. Keep using the WhatsApp Business app on your phone if you like." },
    { title: "Customers get answers", body: "Day and night, your agent answers questions, takes bookings and orders, sends payment links, and tells you what happened." },
];

const FEATURES = [
    { icon: MessageCircle, title: "Answers on WhatsApp", body: "Replies to your customers in seconds, in plain language, from what you've told it." },
    { icon: Mic, title: "Understands voice notes", body: "Customers can send a voice note. Your agent listens and replies." },
    { icon: CalendarCheck, title: "Takes bookings", body: "Checks your calendar, books the table or appointment, and adds it to Google Calendar." },
    { icon: ShoppingBag, title: "Sells your products", body: "Knows your prices and stock, takes orders, and holds stock until they're paid." },
    { icon: CreditCard, title: "Collects payments", body: "Sends a Paystack, Flutterwave or Stripe link. Money goes straight to your account." },
    { icon: Mail, title: "Keeps you in the loop", body: "An email for every booking, order and payment, and a summary every morning." },
    { icon: Globe, title: "On your website too", body: "The same agent as a chat on your website, or a link you share on Instagram." },
];

const FOR = ["Restaurants and lounges", "Fashion and beauty shops", "Salons and spas", "Clinics", "Hotels and short lets", "Online sellers"];

const FAQ = [
    { q: "Do I need to know anything technical?", a: "No. You describe your business in your own words and Copilot sets up the agent. If you can use WhatsApp, you can use this." },
    { q: "Can I keep using WhatsApp on my phone?", a: "Yes. If your number is on the WhatsApp Business app, you keep using it, and the agent answers alongside you." },
    { q: "What counts as a conversation?", a: "One customer's chat with your agent: up to 40 messages, or until a day of quiet. Trying your agent yourself doesn't count." },
    { q: "How do I pay?", a: "In naira, by card or bank transfer, 30 days at a time. Start with a free trial: 14 days or 50 conversations, no card needed." },
    { q: "Where does the money from my customers go?", a: "Straight into your own Paystack, Flutterwave or Stripe account. We never hold it." },
    { q: "What happens when I run out of conversations?", a: "Chats already going carry on. New ones get a short message asking customers to call or visit you, until you renew or upgrade." },
];

export function BusinessLanding() {
    const signup = getConsoleUrl(SIGNUP);
    return (
        <main>
            <section className="relative flex min-h-[88svh] items-center justify-center overflow-hidden px-4 pt-28 pb-20">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[620px]" style={{ background: "radial-gradient(ellipse 60% 65% at 50% -8%, rgba(167, 243, 208, 0.75) 0%, rgba(52, 211, 153, 0.35) 32%, rgba(6, 95, 70, 0.15) 55%, transparent 75%)" }} />
                <div className="relative z-10 mx-auto max-w-4xl text-center">
                    <p className="mb-6 text-sm text-muted-foreground">Cencori for business</p>
                    <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Every customer answered. Even at 2am.</h1>
                    <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                        An AI agent that answers your customers on WhatsApp and your website, takes bookings and orders, and collects payments. Set it up by describing your business.
                    </p>
                    <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        <Button asChild size="lg" className="h-11 rounded-full px-6">
                            <Link href={signup}>Start free trial <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                        </Button>
                        <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6">
                            <Link href="#pricing">See pricing</Link>
                        </Button>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground">14 days or 50 conversations free. No card needed.</p>
                </div>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-20">
                <h2 className="text-center text-2xl font-semibold tracking-tight md:text-4xl">Live in an afternoon</h2>
                <ol className="mt-12 grid gap-6 md:grid-cols-3">
                    {STEPS.map((step, index) => (
                        <li key={step.title} className="rounded-2xl border border-border/50 bg-muted/20 p-6">
                            <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                            <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="mx-auto max-w-6xl px-4 py-20">
                <h2 className="text-center text-2xl font-semibold tracking-tight md:text-4xl">Does the work of a front desk</h2>
                <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border/50 bg-border/50 sm:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map((feature) => (
                        <div key={feature.title} className="bg-background p-6">
                            <feature.icon className="h-5 w-5 text-emerald-500" />
                            <h3 className="mt-4 text-sm font-medium">{feature.title}</h3>
                            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feature.body}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-10 flex flex-wrap justify-center gap-2">
                    {FOR.map((who) => <span key={who} className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">{who}</span>)}
                </div>
            </section>

            <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20">
                <BusinessPricing signupHref={signup} />
            </section>

            <section className="mx-auto max-w-3xl px-4 py-20">
                <h2 className="text-center text-2xl font-semibold tracking-tight md:text-4xl">Questions</h2>
                <Accordion type="single" collapsible className="mt-10">
                    {FAQ.map((item) => (
                        <AccordionItem key={item.q} value={item.q}>
                            <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
                            <AccordionContent className="text-sm leading-6 text-muted-foreground">{item.a}</AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </section>

            <section className="px-4 pb-28 pt-10 text-center">
                <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">Let your agent take the next message.</h2>
                <Button asChild size="lg" className="mt-8 h-11 rounded-full px-6">
                    <Link href={signup}>Start free trial <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">Building with our API instead? <a className="underline underline-offset-2" href="https://developers.cencori.com">Cencori for developers</a></p>
            </section>
        </main>
    );
}
