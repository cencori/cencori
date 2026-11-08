"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
    text: string;
}

export function CopyButton({ text }: CopyButtonProps) {
    const [hasCopied, setHasCopied] = React.useState(false);

    React.useEffect(() => {
        if (hasCopied) {
            const timeout = setTimeout(() => {
                setHasCopied(false);
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [hasCopied]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(text);
        setHasCopied(true);
    };

    return (
        <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={copyToClipboard}
        >
            {hasCopied ? (
                <Check className="h-3 w-3" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
            <span className="sr-only">Copy code</span>
        </Button>
    );
}
