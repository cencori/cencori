import React from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/config/site";

export const Footer = () => {
    return (
        <footer className="bg-background border-t border-border/40 pt-16 pb-8">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">

                    {/* Brand */}
                    <div className="col-span-1 md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-6">
                            <Logo variant="mark" className="h-6 w-6" />
                            <span className="font-bold text-xl tracking-tight">cencori</span>
                        </Link>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                            The security layer for AI development. Build with confidence, deploy with peace of mind.
                        </p>
                        <div className="text-xs text-muted-foreground font-mono">
                            © 2025 FohnAI. All rights reserved.
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="font-bold mb-6 tracking-tight">Product</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/product-ai" className="hover:text-foreground transition-colors">AI Gateway</Link></li>
                            <li><Link href="/product-audit" className="hover:text-foreground transition-colors">Audit Logs</Link></li>
                            <li><Link href="/product-insights" className="hover:text-foreground transition-colors">Analytics</Link></li>
                            <li><Link href="/product-enterprise" className="hover:text-foreground transition-colors">Enterprise</Link></li>
                            <li><Link href="/docs" className="hover:text-foreground transition-colors">Documentation</Link></li>
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div>
                        <h4 className="font-bold mb-6 tracking-tight">Company</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/about" className="hover:text-foreground transition-colors">About</Link></li>
                            <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                            <li><Link href="/careers" className="hover:text-foreground transition-colors">Careers</Link></li>
                            <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                            <li><Link href="/partners" className="hover:text-foreground transition-colors">Partners</Link></li>
                        </ul>
                    </div>

                    {/* Legal / Social */}
                    <div>
                        <h4 className="font-bold mb-6 tracking-tight">Legal</h4>
                        <ul className="space-y-4 text-sm text-muted-foreground">
                            <li><Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                            <li className="pt-4">
                                <Link href={siteConfig.links.github} className="hover:text-foreground transition-colors flex items-center gap-2">
                                    GitHub
                                </Link>
                            </li>
                            <li>
                                <Link href={siteConfig.links.x} className="hover:text-foreground transition-colors flex items-center gap-2">
                                    X (Twitter)
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </footer>
    );
};
