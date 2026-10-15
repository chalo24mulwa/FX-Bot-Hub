import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrokerLogoProps {
  id: string;
  name: string;
  hasLogo: boolean;
  version?: Date | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { sm: 40, md: 56, lg: 72 } as const;

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/** The uploaded logo (served by /api/brokers/[id]/logo), or a neutral monogram when there isn't one. */
export function BrokerLogo({ id, name, hasLogo, version, size = "md", className }: BrokerLogoProps) {
  const px = SIZES[size];
  const frame = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white", className);
  if (hasLogo) {
    const src = `/api/brokers/${id}/logo${version ? `?v=${version.getTime()}` : ""}`;
    return (
      <span className={frame} style={{ width: px, height: px }}>
        {/* Served from our own database route; the image optimiser adds nothing for a small, already-sized logo. */}
        <Image src={src} alt={`${name} logo`} width={px} height={px} unoptimized className="h-full w-full object-contain p-1.5" />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={`${name} (no logo uploaded)`}
      className={cn(frame, "border-transparent bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold tracking-wide text-slate-100")}
      style={{ width: px, height: px }}
    >
      {initials(name)}
    </span>
  );
}
