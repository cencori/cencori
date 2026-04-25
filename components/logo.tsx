export function Logo({ variant = "full", className = "" }: { variant?: "mark" | "full" | "wordmark"; className?: string }) {
  // Use new logos only for "wordmark" variant
  const isWordmark = variant === "wordmark";
  
  const lightSrc = isWordmark ? "/logos/bw.png" : "/clight.png";
  const darkSrc = isWordmark ? "/logos/ww.png" : "/cdark.png";

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* light-mode image (visible when NOT dark) */}
      <img src={lightSrc} alt="Cencori logo" className="h-4 w-auto block dark:hidden" />

      {/* dark-mode image (visible when dark) */}
      <img src={darkSrc} alt="Cencori logo" className="h-4 w-auto hidden dark:block" />

      {/* Only show text span for the old "full" variant, 
          since the new "wordmark" already has the text in the image */}
      {variant === "full" && (
        <span className="ml-3 text-lg font-medium text-slate-900 dark:text-white">Cencori</span>
      )}
    </div>
  );
}
