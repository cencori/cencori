import React from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";

export const Footer = () => {
    return (
        <footer className="bg-background border-t border-border/30 pt-8 pb-4">
            <div className="max-w-screen-xl mx-auto px-4 md:px-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6">

                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link href="/" className="flex items-center gap-1.5 mb-3">
                            <Logo variant="mark" className="h-4 w-4" />
                            <span className="text-xs font-semibold tracking-tight">cencori</span>
                        </Link>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                            The security layer for AI development.
                        </p>
                        <div className="text-[10px] text-muted-foreground/60 font-mono">
                            © 2025 FohnAI
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Product</h4>
                        <ul className="space-y-1.5">
                            <li><Link href="/ai-gateway" className="text-xs text-muted-foreground hover:text-foreground transition-colors">AI Gateway</Link></li>
                            <li><Link href="/compute" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Compute</Link></li>
                            <li><Link href="/workflow" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Workflow</Link></li>
                            <li><Link href="/integration" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Integration</Link></li>
                            <li><Link href="/storage" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Data Storage</Link></li>
                            <li><Link href="/edge" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Edge</Link></li>
                            <li><Link href="/scan" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Scan</Link></li>
                            <li><Link href="/enterprise" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Enterprise</Link></li>
                        </ul>
                    </div>

                    {/* Resources Links */}
                    <div>
                        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Resources</h4>
                        <ul className="space-y-1.5">
                            <li><Link href="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Documentation</Link></li>
                            <li><Link href="/docs/api" className="text-xs text-muted-foreground hover:text-foreground transition-colors">API Reference</Link></li>
                            <li><Link href="/academy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Academy</Link></li>
                            <li><Link href="/llm.txt" className="text-xs text-muted-foreground hover:text-foreground transition-colors">llm.txt</Link></li>
                            <li><Link href="/examples" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Examples</Link></li>
                            <li><Link href="/design" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Design System</Link></li>
                            <li><Link href="/blog" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Blog</Link></li>
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Company</h4>
                        <ul className="space-y-1.5">
                            <li>
                                <a
                                    href="https://fohn-ai.vercel.app"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                                >
                                    FohnAI
                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </li>
                            <li><Link href="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors">About</Link></li>
                            <li><Link href="/careers" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Careers</Link></li>
                            <li><Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
                            <li><Link href="/partners" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Partners</Link></li>
                        </ul>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 className="text-[10px] font-medium uppercase tracking-wider mb-3">Legal</h4>
                        <ul className="space-y-1.5">
                            <li><Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</Link></li>
                            <li><Link href="/terms-of-service" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom bar with social links */}
                <div className="border-t border-border/20 pt-4 flex flex-col sm:flex-row items-center justify-between mb-6 gap-3">
                    <div className="text-[10px] text-muted-foreground/50">
                        Built for AI developers who care about infrastructure.
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href={siteConfig.links.github} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                        </Link>
                        <Link href={siteConfig.links.x} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};
