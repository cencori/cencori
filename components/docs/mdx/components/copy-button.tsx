"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const CopyButton = ({
  code,
  withBlurBg,
  className,
}: {
  code: string;
  withBlurBg?: boolean;
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <Button
      className={cn(
        "h-6 w-6 rounded active:scale-90 dark:hover:bg-[#232323]!",
        withBlurBg && "bg-background",
        className,
      )}
      variant="ghost"
      size="icon"
      onClick={() => copy(code)}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
};

export default CopyButton;
