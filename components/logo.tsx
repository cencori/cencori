export function Logo({ variant = "full", className = "" }: { variant?: "mark" | "full" | "wordmark"; className?: string }) {
  const isWordmark = variant === "wordmark";
  const isMark = variant === "mark";
  
  // Standalone sensory logos (mark only)
  // Wordmark logos (icon + text)
  // Legacy logos (clight/cdark)
  
  let lightSrc = "/clight.png";
  let darkSrc = "/cdark.png";

  if (isWordmark) {
    lightSrc = "/logos/bw.png";
    darkSrc = "/logos/ww.png";
  } else if (isMark) {
    lightSrc = "/black.png";
    darkSrc = "/white.png";
  }

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* light-mode image (visible when NOT dark) */}
      <img src={lightSrc} alt="Cencori logo" className="h-full w-auto block dark:hidden" />

      {/* dark-mode image (visible when dark) */}
      <img src={darkSrc} alt="Cencori logo" className="h-full w-auto hidden dark:block" />

      {/* Only show text span for the old "full" variant, 
          since the new "wordmark" already has the text in the image */}
      {variant === "full" && (
        <span className="ml-3 text-lg font-medium text-slate-900 dark:text-white">Cencori</span>
      )}
    </div>
  );
}
