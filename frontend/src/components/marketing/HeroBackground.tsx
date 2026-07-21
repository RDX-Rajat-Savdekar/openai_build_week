import { ParticleField } from "./ParticleField";

export function HeroBackground({
  className = "",
  tone = "default",
  motion = true,
}: {
  className?: string;
  tone?: "default" | "invert";
  motion?: boolean;
}) {
  const float = motion ? "animate-float-slow" : "";
  const floatAlt = motion ? "animate-float-slower" : "";

  if (tone === "invert") {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        <div className={`absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-[90px] ${float}`} />
        <div className={`absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-white/10 blur-[90px] ${floatAlt}`} />
        {motion && <ParticleField className="absolute inset-0 h-full w-full" colorVar="#ffffff" />}
      </div>
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className={`absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/25 blur-[90px] ${float}`} />
      <div className={`absolute -right-16 top-10 h-64 w-64 rounded-full bg-blue/20 blur-[90px] ${floatAlt}`} />
      <div className={`absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-accent-2/20 blur-[80px] ${float}`} />
      {motion && <ParticleField className="absolute inset-0 h-full w-full" />}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg" />
    </div>
  );
}
