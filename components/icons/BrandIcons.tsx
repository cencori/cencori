import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

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

// AI Editor Logos - Re-exported from @lobehub/icons
export { Windsurf as WindsurfLogo } from "@lobehub/icons";
export { Claude as ClaudeLogo } from "@lobehub/icons";
export { CrewAI as CrewAILogo } from "@lobehub/icons";
export { N8n as N8nLogo } from "@lobehub/icons";

// Framework Logos (custom SVGs - not available in @lobehub/icons)
interface FrameworkIconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function NextjsLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 180 180" fill="currentColor" className={className} {...props}>
            <mask id="nextjs-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="180">
                <circle cx="90" cy="90" r="90" fill="white" />
            </mask>
            <g mask="url(#nextjs-mask)">
                <circle cx="90" cy="90" r="90" fill="black" />
                <path d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z" fill="url(#nextjs-gradient-1)" />
                <rect x="115" y="54" width="12" height="72" fill="url(#nextjs-gradient-2)" />
            </g>
            <defs>
                <linearGradient id="nextjs-gradient-1" x1="109" y1="116.5" x2="144.5" y2="160.5" gradientUnits="userSpaceOnUse">
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="nextjs-gradient-2" x1="121" y1="54" x2="120.799" y2="106.875" gradientUnits="userSpaceOnUse">
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                </linearGradient>
            </defs>
        </svg>
    );
}

export function ViteLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 410 404" fill="none" className={className} {...props}>
            <path d="M399.641 59.5246L215.643 388.545C211.844 395.338 202.084 395.378 198.228 388.618L10.5817 59.5563C6.38087 52.1896 12.6802 43.2665 21.0281 44.7586L205.223 77.6824C206.398 77.8924 207.601 77.8904 208.776 77.6763L389.119 44.8058C397.439 43.2894 403.768 52.1434 399.641 59.5246Z" fill="url(#vite-gradient-1)" />
            <path d="M292.965 1.5744L156.801 28.2552C154.563 28.6937 152.906 30.5903 152.771 32.8664L144.395 174.33C144.198 177.662 147.258 180.248 150.51 179.498L188.42 170.749C191.967 169.931 195.172 173.055 194.443 176.622L183.18 231.775C182.422 235.487 185.907 238.661 189.532 237.56L212.947 230.446C216.577 229.344 220.065 232.527 219.297 236.242L201.398 322.875C200.278 328.294 207.486 331.249 210.492 326.603L212.5 323.5L323.454 102.072C325.312 98.3645 322.108 94.137 318.036 94.9228L279.014 102.454C275.347 103.161 272.227 99.746 273.262 96.1583L298.731 7.86689C299.767 4.27314 296.636 0.855181 292.965 1.5744Z" fill="url(#vite-gradient-2)" />
            <defs>
                <linearGradient id="vite-gradient-1" x1="6.00017" y1="32.9999" x2="235" y2="344" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#41D1FF" />
                    <stop offset="1" stopColor="#BD34FE" />
                </linearGradient>
                <linearGradient id="vite-gradient-2" x1="194.651" y1="8.81818" x2="236.076" y2="292.989" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFBD4F" />
                    <stop offset="1" stopColor="#FF980E" />
                </linearGradient>
            </defs>
        </svg>
    );
}

export function PythonLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <linearGradient id="python-gradient-1" x1="70.252" x2="170.659" y1="1237.476" y2="1151.089" gradientTransform="matrix(.563 0 0 -.568 -29.215 707.817)" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#5A9FD4" />
                <stop offset="1" stopColor="#306998" />
            </linearGradient>
            <path d="M63.391 1.988c-4.222.02-8.252.379-11.8 1.007-10.45 1.846-12.346 5.71-12.346 12.837v9.411h24.693v3.137H29.977c-7.176 0-13.46 4.313-15.426 12.521-2.268 9.405-2.368 15.275 0 25.096 1.755 7.311 5.947 12.519 13.124 12.519h8.491V67.234c0-8.151 7.051-15.34 15.426-15.34h24.665c6.866 0 12.346-5.654 12.346-12.548V15.833c0-6.693-5.646-11.72-12.346-12.837-4.244-.706-8.645-1.027-12.866-1.008zM50.037 9.557c2.55 0 4.634 2.117 4.634 4.721 0 2.593-2.083 4.69-4.634 4.69-2.56 0-4.633-2.097-4.633-4.69-.001-2.604 2.073-4.721 4.633-4.721z" fill="url(#python-gradient-1)" />
            <linearGradient id="python-gradient-2" x1="209.474" x2="173.62" y1="1098.811" y2="1149.537" gradientTransform="matrix(.563 0 0 -.568 -29.215 707.817)" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#FFD43B" />
                <stop offset="1" stopColor="#FFE873" />
            </linearGradient>
            <path d="M91.682 28.38v10.966c0 8.5-7.208 15.655-15.426 15.655H51.591c-6.756 0-12.346 5.783-12.346 12.549v23.515c0 6.691 5.818 10.628 12.346 12.547 7.816 2.297 15.312 2.713 24.665 0 6.216-1.801 12.346-5.423 12.346-12.547v-9.412H63.938v-3.138h37.012c7.176 0 9.852-5.005 12.348-12.519 2.578-7.735 2.467-15.174 0-25.096-1.774-7.145-5.161-12.521-12.348-12.521h-9.268zM77.809 87.927c2.561 0 4.634 2.097 4.634 4.692 0 2.602-2.074 4.719-4.634 4.719-2.55 0-4.633-2.117-4.633-4.719 0-2.595 2.083-4.692 4.633-4.692z" fill="url(#python-gradient-2)" />
        </svg>
    );
}

export function TypeScriptLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <path fill="#3178c6" d="M2 63.91v62.5h125v-125H2zm100.73-5a15.56 15.56 0 017.82 4.5 20.58 20.58 0 013 4c0 .16-5.4 3.81-8.69 5.85-.12.08-.6-.44-1.13-1.23a7.09 7.09 0 00-5.87-3.53c-3.79-.26-6.23 1.73-6.21 5a4.58 4.58 0 00.54 2.34c.83 1.73 2.38 2.76 7.24 4.86 8.95 3.85 12.78 6.39 15.16 10 2.66 4 3.25 10.46 1.45 15.24-2 5.2-6.9 8.73-13.83 9.9a38.32 38.32 0 01-9.52-.1A23 23 0 0180 109.19c-1.15-1.27-3.39-4.58-3.25-4.82a9.34 9.34 0 011.15-.73l4.6-2.64 3.59-2.08.75 1.11a16.78 16.78 0 004.74 4.54c4 2.1 9.46 1.81 12.16-.62a5.43 5.43 0 00.69-6.92c-1-1.39-3-2.56-8.59-5-6.45-2.78-9.23-4.5-11.77-7.24a16.48 16.48 0 01-3.43-6.25 25 25 0 01-.22-8c1.33-6.23 6-10.58 12.82-11.87a31.66 31.66 0 019.49.26zm-29.34 5.24v5.12H57.16v46.23H45.65V69.26H29.38v-5a49.19 49.19 0 01.14-5.16c.06-.08 10-.12 22-.1h21.81z" />
        </svg>
    );
}

export function GoLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <g fill="#00acd7" fillRule="evenodd">
                <path d="M11.156 54.829c-.243 0-.303-.122-.182-.303l1.273-1.637c.12-.182.424-.303.666-.303H34.55c.243 0 .303.182.182.364l-1.03 1.576c-.121.181-.424.363-.606.363zM2.004 60.404c-.242 0-.303-.12-.182-.303l1.273-1.636c.121-.182.424-.303.667-.303h27.636c.242 0 .364.182.303.364l-.485 1.454c-.06.243-.303.364-.545.364zM16.67 65.98c-.242 0-.302-.182-.181-.364l.848-1.515c.122-.182.364-.363.607-.363h12.12c.243 0 .364.181.364.424l-.12 1.454c0 .243-.243.425-.425.425zM79.58 53.738c-3.819.97-6.425 1.697-10.182 2.666-.91.243-.97.303-1.758-.606-.909-1.03-1.576-1.697-2.848-2.303-3.819-1.878-7.516-1.333-10.97.91-4.121 2.666-6.242 6.605-6.182 11.514.06 4.849 3.394 8.849 8.182 9.516 4.121.545 7.576-.91 10.303-4 .545-.667 1.03-1.394 1.636-2.243H56.064c-1.272 0-1.575-.788-1.151-1.818.788-1.879 2.242-5.03 3.09-6.606.183-.364.607-.97 1.516-.97h22.06c-.12 1.637-.12 3.273-.363 4.91-.667 4.363-2.303 8.363-4.97 11.878-4.364 5.758-10.06 9.333-17.273 10.303-5.939.788-11.454-.364-16.302-4-4.485-3.394-7.03-7.879-7.697-13.454-.788-6.606 1.151-12.546 5.151-17.758 4.303-5.636 10-9.212 16.97-10.485 5.697-1.03 11.151-.363 16.06 2.97 3.212 2.121 5.515 5.03 7.03 8.545.364.546.122.849-.606 1.03z" />
                <path d="M99.64 87.253c-5.515-.122-10.546-1.697-14.788-5.334-3.576-3.09-5.818-7.03-6.545-11.697-1.091-6.848.787-12.909 4.909-18.302 4.424-5.819 9.757-8.849 16.97-10.122 6.181-1.09 12-.484 17.272 3.091 4.788 3.273 7.757 7.697 8.545 13.515 1.03 8.182-1.333 14.849-6.97 20.546-4 4.06-8.909 6.606-14.545 7.757-1.636.303-3.273.364-4.848.546zm14.424-24.485c-.06-.788-.06-1.394-.182-2-1.09-6-6.606-9.394-12.363-8.06-5.637 1.272-9.273 4.848-10.606 10.545-1.091 4.727 1.212 9.515 5.575 11.454 3.334 1.455 6.667 1.273 9.879-.363 4.788-2.485 7.394-6.364 7.697-11.576z" fillRule="nonzero" />
            </g>
        </svg>
    );
}

export function FlutterLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <g fill="#3FB6D3">
                <path d="M12.3 64.2L76.3 0h39.4L32.1 83.6zM76.3 128h39.4L81.6 93.9l34.1-34.8H76.3L42.2 93.5z" />
            </g>
            <path fill="#27AACD" d="M81.6 93.9l-20-20-19.4 19.6 19.4 19.6z" />
            <path fill="#19599A" d="M115.7 128L81.6 93.9l-19.4 19.6L76.3 128z" />
            <linearGradient id="flutter-gradient" x1="59.365" x2="86.825" y1="116.36" y2="99.399" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1b4e94" />
                <stop offset=".63" stopColor="#1a5497" />
                <stop offset="1" stopColor="#195a9b" />
            </linearGradient>
            <path fill="url(#flutter-gradient)" d="M81.6 93.9l-20-20-19.4 19.6 19.4 19.6z" />
        </svg>
    );
}

// React Logo (custom SVG)
interface IconProps extends React.SVGProps<SVGSVGElement> {
    className?: string;
}

export function ReactLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="-11.5 -10.23174 23 20.46348" fill="currentColor" className={className} {...props}>
            <circle cx="0" cy="0" r="2.05" fill="#61DAFB" />
            <g stroke="#61DAFB" strokeWidth="1" fill="none">
                <ellipse rx="11" ry="4.2" />
                <ellipse rx="11" ry="4.2" transform="rotate(60)" />
                <ellipse rx="11" ry="4.2" transform="rotate(120)" />
            </g>
        </svg>
    );
}

// Svelte Logo (custom SVG)
export function SvelteLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="0 0 98.1 118" className={className} {...props}>
            <path
                d="M91.8 15.6C80.9-.1 59.2-4.7 43.6 5.2L16.1 22.8C8.6 27.5 3.4 35.2 1.9 43.9c-1.3 7.3-.2 14.8 3.3 21.3-2.4 3.6-4 7.6-4.7 11.8-1.6 8.9.5 18.1 5.7 25.4 11 15.7 32.6 20.3 48.2 10.4l27.5-17.5c7.5-4.7 12.7-12.4 14.2-21.1 1.3-7.3.2-14.8-3.3-21.3 2.4-3.6 4-7.6 4.7-11.8 1.7-9-.4-18.2-5.7-25.5"
                fill="#ff3e00"
            />
            <path
                d="M40.9 103.9c-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.2-.9.4-1.7.6-2.6l.5-1.6 1.4 1c3.3 2.4 6.9 4.2 10.8 5.4l1 .3-.1 1c-.1 1.4.3 2.9 1.1 4.1 1.6 2.3 4.4 3.4 7.1 2.7.6-.2 1.2-.4 1.7-.7l27.4-17.5c1.4-.9 2.3-2.2 2.6-3.8.3-1.6-.1-3.3-1-4.6-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7l-10.5 6.7c-1.7 1.1-3.6 1.9-5.6 2.4-8.9 2.3-18.2-1.2-23.4-8.7-3.2-4.4-4.4-9.9-3.5-15.3.9-5.2 4.1-9.9 8.6-12.7l27.5-17.5c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.2.9-.4 1.7-.7 2.6l-.5 1.6-1.4-1c-3.3-2.4-6.9-4.2-10.8-5.4l-1-.3.1-1c.1-1.4-.3-2.9-1.1-4.1-1.6-2.3-4.4-3.3-7.1-2.6-.6.2-1.2.4-1.7.7L32.4 46.1c-1.4.9-2.3 2.2-2.6 3.8s.1 3.3 1 4.6c1.6 2.3 4.4 3.3 7.1 2.6.6-.2 1.2-.4 1.7-.7l10.5-6.7c1.7-1.1 3.6-1.9 5.6-2.5 8.9-2.3 18.2 1.2 23.4 8.7 3.2 4.4 4.4 9.9 3.5 15.3-.9 5.2-4.1 9.9-8.6 12.7l-27.5 17.5c-1.7 1.1-3.6 1.9-5.6 2.5"
                fill="#fff"
            />
        </svg>
    );
}

// Vue Logo (custom SVG)
export function VueLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <path d="M78.8 10L64 35.4 49.2 10H0l64 110 64-110H78.8z" fill="#42b883" />
            <path d="M78.8 10L64 35.4 49.2 10H25.6L64 75l38.4-65H78.8z" fill="#35495e" />
        </svg>
    );
}

// Microsoft Logo (4 squares)
export function MicrosoftLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="0 0 23 23" className={className} {...props}>
            <path fill="#f35325" d="M1 1h10v10H1z" />
            <path fill="#81bc06" d="M12 1h10v10H12z" />
            <path fill="#05a6f0" d="M1 12h10v10H1z" />
            <path fill="#ffba08" d="M12 12h10v10H12z" />
        </svg>
    );
}

// Node.js Logo
export function NodeLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <path d="M64 5.901l57.142 32.991v65.982L64 137.865 6.858 104.874V38.892L64 5.901z" fill="#333" />
            <path d="M64 12.046L113.82 40.81v57.544L64 127.118 14.18 98.354V40.81L64 12.046z" fill="#68a063" />
            <path d="M96.085 53.056c0-2.43 1.353-3.644 3.914-3.644 2.83 0 4.183 1.215 4.183 3.644 0 2.428-1.353 3.642-4.183 3.642-2.56 0-3.914-1.215-3.914-3.642zM48.17 99.827c1.782 1.378 2.59 2.915 2.59 5.8 0 3.023-1.078 5.617-2.914 7.236-1.782 1.62-4.883 2.186-8.252 2.186-3.83 0-6.852-1.053-8.847-2.673-1.996-1.565-3.048-4.02-3.048-7.613l-1.026.16c0 4.588 1.484 7.612 4.047 9.878 2.645 2.213 6.096 3.102 10.95 3.102 4.156 0 7.82-1.16 10.14-3.1 2.428-1.995 3.966-5.83 3.966-10.414 0-4.64-1.62-7.85-4.4-9.576-2.264-1.458-5.312-2.59-8.495-3.238-3.372-.647-5.53-1.402-6.53-2.16-1.08-1.023-1.67-2.24-1.67-3.99 0-1.89.863-3.076 2.373-3.94 1.51-1.295 4.29-1.375 7.094-1.375 1.537 0 3.237.16 4.773.376.647.11 1.053.407 1.053 1.08 0 .54-.27.81-.97.945l-4.506.593v.81c0 .242.08.378.27.378h13.298c.19 0 .27-.134.27-.377v-.81l-4.155-.595c-1.187-.216-2.022-1.24-2.022-2.535 0-1.295 1.08-2.51 2.914-3.832 2.05-1.457 5.152-2.078 8.685-2.078 3.56 0 6.663.784 8.71 1.942 2.158 1.16 3.425 3.508 3.425 6.745 0 .296-.027.674-.08 1.052l-.432 2.132c-.108.43-.324.73-.594.73h-.78c-.244 0-.352-.108-.433-.35l-.89-2.51c-.62-2.51-2.994-3.562-6.662-3.562-3.155 0-5.366.62-6.85.918-3.02.73-3.774 2.805-3.774 4.504 0 1.537.647 2.724 2.158 3.643 1.132.81 3.56 1.646 6.877 2.32 3.884.81 6.502 1.62 8.362 2.536 2.617 1.295 4.29 2.51 5.366 4.398 1.106 1.835 1.646 4.45 1.646 8.36v1.35h.054a3.836 3.836 0 0 1 3.91-2.833c1.942 0 3.103.567 4.1 1.645 1.052 1.052 1.645 2.51 1.645 4.53 0 2.214-.62 4.1-1.968 5.613-1.052 1.214-2.832 2.13-4.962 2.86l.674 1.7.35 1.024.162.728.324 1.86c.323 1.916.647 3.318.997 4.316.594 1.7 1.565 2.75 2.75 3.504 1.348.863 3.183 1.186 5.23 1.186l2.186-.054v1.025l-2.428.163c-3.237 0-5.88-.378-7.795-1.537-1.94-1.134-3.18-2.778-4.045-5.26-.647-1.78-1.294-4.828-1.644-8.736-.3-3.345-.756-5.8-1.376-7.5-.783-2.078-2.05-3.48-3.696-4.505-1.645.458-3.774.27-5.903.27-1.807 0-3.37-.19-4.827-.458l-.647-.136c-1.67-.324-2.427-.92-2.427-1.51 0-.62-.27-1.026.054-1.24 1.727-1.187 2.968-3.05 3.32-5.42.35-2.05-.136-4.047-1.348-5.746-.783-1.107-1.943-1.97-3.453-2.51-1.348-.54-3.37-.89-5.418-.89-1.915 0-3.696.647-5.018 1.726z" fill="#333" />
        </svg>
    );
}

// Rust Logo
export function RustLogo({ className, ...props }: FrameworkIconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <path d="M116.67 63.14l-11.45-5.32 3.12-12.23-12.42-2.31-2.92-12.28-12.59 1.54-6.84-10.46L63.95 24.8 54.33 22l-6.75 10.49-12.63-1.45-3 12.26-12.38 2.39 3.03 12.25L11.2 63.29l11.4 5.37-3.11 12.22 12.4 2.29 2.9 12.3 12.61-1.53 6.84 10.46 9.68-2.72 9.61 2.8 6.77-10.49 12.61 1.45 2.99-12.23 12.4-2.43-3.02-12.2 11.4-5.42zm-53 43.68c-23.71 0-43-19.16-43-42.69s19.29-42.69 43-42.69 43 19.16 43 42.69-19.29 42.69-43 42.69z" fill="#000" />
        </svg>
    );
}

// Google Cloud Logo
export function GoogleCloudLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" className={className} {...props}>
            <path fill="#EA4335" d="M12.19 5.599c.531 0 1.049.094 1.525.266l1.262-1.262A6.604 6.604 0 0 0 12.19 4c-2.382 0-4.478 1.25-5.656 3.127l1.469 1.14a4.99 4.99 0 0 1 4.187-2.668z" />
            <path fill="#4285F4" d="M15.715 8.267l1.469-1.14A6.607 6.607 0 0 1 18.79 12c0 .751-.125 1.472-.354 2.145l-1.469-1.14a4.984 4.984 0 0 0-.252-2.738z" />
            <path fill="#FBBC05" d="M6.534 13.867l-1.469 1.14A6.608 6.608 0 0 1 5.59 12c0-1.124.28-2.182.776-3.107l1.469 1.14a4.984 4.984 0 0 0-.301 3.834z" />
            <path fill="#34A853" d="M12.19 18.401a4.99 4.99 0 0 1-4.187-2.268l-1.469 1.14A6.603 6.603 0 0 0 12.19 20c.951 0 1.858-.201 2.674-.563l-1.262-1.262a5.003 5.003 0 0 1-1.412.226z" />
            <circle fill="#4285F4" cx="12.19" cy="12" r="2.5" />
        </svg>
    );
}



// Zapier Logo
export function ZapierLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <path fill="#FF4F00" d="M30.4,64 L67.2,64 L67.2,27.2 L97.6,64 L60.8,64 L60.8,100.8 L30.4,64 Z" />
        </svg>
    );
}

// Make (Integromat) Logo
export function MakeLogo({ className, ...props }: IconProps) {
    return (
        <svg viewBox="0 0 128 128" className={className} {...props}>
            <circle cx="64" cy="64" r="64" fill="#6f00e6" />
            <path fill="#fff" d="M35.5 45.5h16.2v37H35.5zM76.3 45.5h16.2v37H76.3zM55.9 82.5V59.4l8.1 11.2 8.1-11.2v23.1h13.2V45.5h-10.8L64 59.9 53.5 45.5H42.7v37h13.2z" />
        </svg>
    );
}

// OpenClaw Logo (Custom Placeholder)
export function OpenClawLogo({ className, ...props }: any) {
    return (
        <div className={cn("relative overflow-hidden rounded-md", className)} {...props}>
            <Image
                src="/oc.JPG"
                alt="OpenClaw"
                fill
                className="object-cover"
                sizes="64px"
            />
        </div>
    );
}

// AutoGPT Logo (Custom Placeholder)
export function AutoGPTLogo({ className, ...props }: any) {
    return (
        <div className={cn("relative overflow-hidden rounded-md", className)} {...props}>
            <Image
                src="/autogpt.png"
                alt="AutoGPT"
                fill
                className="object-cover"
                sizes="64px"
            />
        </div>
    );
}
// Custom Agent Logo (User Provided)
export function CustomAgentLogo({ className, ...props }: IconProps) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className} {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
    );
}
