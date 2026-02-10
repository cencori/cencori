export function Logo({ variant = "full", className = "" }: { variant?: "mark" | "full"; className?: string }) {
  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* light-mode image (visible when NOT dark) */}
      <img src="/wordmark black.svg" alt="Cencori logo" className="h-6 w-auto block dark:hidden" />

      {/* dark-mode image (visible when dark) */}
      <img src="/wordmark white.svg" alt="Cencori logo" className="h-6 w-auto hidden dark:block" />

      {variant === "full" && (
        <span className="sr-only">Cencori</span>
      )}
    </div>
  );
}
