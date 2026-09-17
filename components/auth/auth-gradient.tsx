/**
 * Shared purple glow for the sign-in / sign-up pages.
 * Same gradient as the developers hero top glow.
 */
export function AuthGradient() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 hidden h-[620px] sm:block"
        style={{
          background:
            "radial-gradient(ellipse 55% 65% at 50% -8%, rgba(216, 205, 255, 0.95) 0%, rgba(150, 124, 255, 0.5) 32%, rgba(88, 62, 190, 0.18) 55%, transparent 75%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] sm:hidden"
        style={{
          background:
            "radial-gradient(ellipse 95% 60% at 50% -8%, rgba(216, 205, 255, 0.95) 0%, rgba(150, 124, 255, 0.5) 35%, rgba(88, 62, 190, 0.18) 60%, transparent 78%)",
        }}
      />
    </>
  );
}
