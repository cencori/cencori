import { ReactNode } from "react";

export interface PartnerConfig {
    slug: string;
    name: string;
    category?: string;
    logo: any;
    websiteUrl: string;
    docsUrl: string;
    screenshots?: string[];
    overview: {
        title: string;
        content: ReactNode;
    };
    hero: {
        title: ReactNode;
        subtitle: string;
        cta: { text: string; href: string };
        secondaryCta?: { text: string; href: string };
    };
    integrations: {
        editors: { name: string; logo: any }[];
        platforms: { name: string; logo: any }[];
        frameworks: { name: string; logo: any }[];
    };
    features: {
        title: string;
        subtitle: string;
        items: { title: string; desc: string }[];
    };
    codeSection: {
        title: string;
        subtitle: ReactNode;
        code: string;
        fileName: string;
    };
    promptsSection: {
        title: string;
        subtitle: string;
        items: { title: string; prompt: string }[];
    };
    pricingCallout: {
        title: ReactNode;
        subtitle: string;
        cta: { text: string; href: string };
    };
    bottomCta: {
        title: string;
        subtitle: string;
        primaryCta: { text: string; href: string };
        secondaryCta: { text: string; href: string };
    };
}
