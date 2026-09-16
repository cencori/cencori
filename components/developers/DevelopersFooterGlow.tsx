export function DevelopersFooterGlow() {
  return (
    <div aria-hidden="true" className="relative h-[560px] w-full overflow-hidden">
      <div
        className="absolute inset-0 hidden sm:block"
        style={{
          background:
            "radial-gradient(ellipse 70% 85% at 50% 108%, rgba(196, 181, 253, 0.9) 0%, rgba(139, 124, 246, 0.55) 22%, rgba(76, 53, 171, 0.32) 45%, rgba(10, 6, 24, 0.12) 65%, transparent 78%)",
        }}
      />
      <div
        className="absolute inset-0 sm:hidden"
        style={{
          background:
            "radial-gradient(ellipse 110% 70% at 50% 108%, rgba(196, 181, 253, 0.9) 0%, rgba(139, 124, 246, 0.55) 28%, rgba(76, 53, 171, 0.32) 52%, rgba(10, 6, 24, 0.12) 70%, transparent 82%)",
        }}
      />
    </div>
  );
}
