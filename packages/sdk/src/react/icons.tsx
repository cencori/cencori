import type { SVGProps } from 'react';

/**
 * The few icons cencori/react's components use, inline: so the package needs
 * nothing but React. Same shapes and props as the lucide-react icons they
 * replace (24×24, stroke = currentColor, size via className).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function icon(children: React.ReactNode, name: string) {
    const Icon = ({ className, size = 24, ...props }: IconProps) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
            {children}
        </svg>
    );
    Icon.displayName = name;
    return Icon;
}

export const AlertCircle = icon(<><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></>, 'AlertCircle');
export const Loader2 = icon(<path d="M21 12a9 9 0 1 1-6.219-8.56" />, 'Loader2');
export const Pause = icon(<><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></>, 'Pause');
export const Volume2 = icon(<><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.364 18.364a9 9 0 0 0 0-12.728" /></>, 'Volume2');
export const Brain = icon(<><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M12 5v13" /></>, 'Brain');
export const Send = icon(<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>, 'Send');
export const Upload = icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></>, 'Upload');
export const X = icon(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>, 'X');
export const Mic = icon(<><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></>, 'Mic');
export const Square = icon(<rect width="18" height="18" x="3" y="3" rx="2" />, 'Square');
export const ImageIcon = icon(<><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></>, 'ImageIcon');
export const Info = icon(<><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>, 'Info');
