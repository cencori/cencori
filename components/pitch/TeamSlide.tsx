import React from "react";
import Image from "next/image";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

// LinkedIn icon from devicon
function LinkedInIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 128 128"
            className={className}
            fill="currentColor"
        >
            <path d="M116 3H12a8.91 8.91 0 00-9 8.8v104.42a8.91 8.91 0 009 8.78h104a8.93 8.93 0 009-8.81V11.77A8.93 8.93 0 00116 3zM39.17 107H21.06V48.73h18.11zm-9-66.21a10.5 10.5 0 1110.49-10.5 10.5 10.5 0 01-10.54 10.48zM107 107H88.89V78.65c0-6.75-.12-15.44-9.41-15.44s-10.87 7.36-10.87 15V107H50.53V48.73h17.36v8h.24c2.42-4.58 8.32-9.41 17.13-9.41C103.6 47.28 107 59.35 107 75z" />
        </svg>
    );
}

// X (Twitter) icon from devicon
function XIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 128 128"
            className={className}
            fill="currentColor"
        >
            <path d="M75.916 54.2L122.542 0h-11.05L71.008 47.06L38.672 0H1.376l48.898 71.164L1.376 128h11.05L55.18 78.303L89.328 128h37.296L75.913 54.2ZM60.782 71.79l-4.955-7.086l-39.42-56.386h16.972l31.801 45.477l4.954 7.085l41.353 59.15h-16.97L60.782 71.793Z" />
        </svg>
    );
}

const team = [
    {
        name: "Bola Banjo",
        role: "Co-Founder & CEO",
        bio: "Technical founder with deep expertise in AI/ML infrastructure. Passionate about developer experience and building tools that scale.",
        avatar: "/roy.png",
        links: {
            linkedin: "https://linkedin.com/in/bolaabanjo",
            twitter: "https://twitter.com/bolaabanjo",
        },
    },
    {
        name: "Daniel Oreofe",
        role: "Co-Founder & COO",
        bio: "Operations leader scaling startups from 0 to 1. Expert in go-to-market strategy and building high-performing teams.",
        avatar: "/daniel.png",
        links: {
            linkedin: "https://linkedin.com/in/TheDanielOreofe",
            twitter: "https://twitter.com/TheDanielOreofe",
        },
    },
];

const highlights = [
    "Technical founders with 8+ years building developer tools",
    "Deep expertise in AI/ML infrastructure and security",
    "Previously scaled products to millions of users",
    "Strong network in AI and developer communities",
];

export function TeamSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    The Team
                </span>
                <h2 className="text-2xl md:text-4xl font-bold mt-2">
                    Built by developers,{" "}
                    <span className="text-muted-foreground">for developers.</span>
                </h2>
            </div>

            {/* Team Grid */}
            <div className="flex-1 grid grid-cols-2 gap-6">
                {/* Founders Section */}
                <div className="space-y-4">
                    {team.map((member, index) => (
                        <div
                            key={index}
                            className="p-5 rounded-xl border border-border/50 bg-card"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 rounded-xl overflow-hidden border border-border/50 shrink-0">
                                    <Image
                                        src={member.avatar}
                                        alt={member.name}
                                        width={64}
                                        height={64}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg">{member.name}</h3>
                                    <p className="text-sm text-emerald-500">{member.role}</p>
                                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                        {member.bio}
                                    </p>
                                    <div className="flex items-center gap-2 mt-3">
                                        {member.links.linkedin && (
                                            <a
                                                href={member.links.linkedin}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                                            >
                                                <LinkedInIcon className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                        {member.links.twitter && (
                                            <a
                                                href={member.links.twitter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                                            >
                                                <XIcon className="h-3.5 w-3.5" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    {/* Highlights */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card">
                        <h3 className="text-sm font-medium mb-3">Team Highlights</h3>
                        <ul className="space-y-2">
                            {highlights.map((highlight, index) => (
                                <li
                                    key={index}
                                    className="flex items-start gap-2 text-xs text-muted-foreground"
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                    {highlight}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Company Info */}
                    <div className="p-4 rounded-xl border border-border/50 bg-card">
                        <h3 className="text-sm font-medium mb-3">Company</h3>
                        <div className="space-y-2 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <GlobeAltIcon className="h-3 w-3" />
                                <span>FohnAI Inc. • Delaware C-Corp</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground/50">📍</span>
                                <span>Remote-first • Global team</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
