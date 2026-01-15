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

// AI Editor Logos - Re-exported from @lobehub/icons
export { Windsurf as WindsurfLogo } from "@lobehub/icons";
export { Claude as ClaudeLogo } from "@lobehub/icons";

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
