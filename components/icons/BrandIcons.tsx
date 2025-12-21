import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

// Official Vercel Logo
export function VercelLogo({ className, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 0 76 65"
            fill="currentColor"
            className={className}
            {...props}
        >
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
        </svg>
    );
}

// Official Supabase Logo
export function SupabaseLogo({ className, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 0 109 113"
            fill="none"
            className={className}
            {...props}
        >
            <path
                d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
                fill="url(#supabase-gradient-1)"
            />
            <path
                d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z"
                fill="url(#supabase-gradient-2)"
                fillOpacity="0.2"
            />
            <path
                d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1661 56.4175L45.317 2.07103Z"
                fill="#3ECF8E"
            />
            <defs>
                <linearGradient
                    id="supabase-gradient-1"
                    x1="53.9738"
                    y1="54.974"
                    x2="94.1635"
                    y2="71.8295"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#249361" />
                    <stop offset="1" stopColor="#3ECF8E" />
                </linearGradient>
                <linearGradient
                    id="supabase-gradient-2"
                    x1="36.1558"
                    y1="30.578"
                    x2="54.4844"
                    y2="65.0806"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop />
                    <stop offset="1" stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// VS Code Logo
export function VSCodeLogo({ className, ...props }: IconProps) {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            className={className}
            {...props}
        >
            <path
                d="M74.7612 99.2637L100 82.4977V17.6302L74.7612 0.736328L74.7612 0.736328L35.3159 32.8044L12.7324 15.8882L0 20.1535V79.8465L12.7324 84.1118L35.3159 67.1956L74.7612 99.2637ZM74.7612 26.4326V73.5674L49.5224 50L74.7612 26.4326ZM12.7324 33.2302L25.4648 50L12.7324 66.7698V33.2302Z"
                fill="#007ACC"
            />
        </svg>
    );
}

// Cursor AI Official Logo - Re-exported from @lobehub/icons
export { Cursor as CursorLogo } from "@lobehub/icons";
