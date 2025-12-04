import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, Lightbulb, AlertTriangle } from "lucide-react";
import { ReactNode } from "react";

const icons = {
    info: Info,
    warn: AlertTriangle,
    warning: AlertTriangle,
    error: AlertCircle,
    success: CheckCircle,
    idea: Lightbulb,
} as const;

const styles = {
    info: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300 [&>svg]:text-blue-500",
    warn: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 [&>svg]:text-yellow-500",
    warning: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 [&>svg]:text-yellow-500",
    error: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 [&>svg]:text-red-500",
    success: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300 [&>svg]:text-green-500",
    idea: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300 [&>svg]:text-purple-500",
} as const;

type CalloutType = keyof typeof icons;

interface CalloutProps {
    type?: CalloutType;
    title?: string;
    children: ReactNode;
    className?: string;
}

export function Callout({
    type = "info",
    title,
    children,
    className
}: CalloutProps) {
    const Icon = icons[type];

    return (
        <div
            className={cn(
                "my-6 flex gap-3 rounded-lg border-l-4 p-4",
                styles[type],
                className
            )}
        >
            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
                {title && (
                    <div className="font-semibold">{title}</div>
                )}
                <div className="text-sm [&>p]:my-2">
                    {children}
                </div>
            </div>
        </div>
    );
}
