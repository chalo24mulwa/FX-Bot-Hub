import Image from "next/image";
import { cn } from "@/lib/utils";

interface ImageProps {
  id: string;
  name: string;
  version?: Date | null;
}

const SIZES = { sm: 40, md: 56, lg: 72 } as const;

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

const versioned = (id: string, kind: "logo" | "cover", version?: Date | null) => `/api/vps/${id}/${kind}${version ? `?v=${version.getTime()}` : ""}`;

/** The uploaded logo (served by /api/vps/[id]/logo), or a neutral monogram when there isn't one. */
export function VpsLogo({ id, name, hasLogo, version, size = "md", className }: ImageProps & { hasLogo: boolean; size?: keyof typeof SIZES; className?: string }) {
  const px = SIZES[size];
  const frame = cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white", className);
  if (hasLogo) {
    return (
      <span className={frame} style={{ width: px, height: px }}>
        {/* Served from our own database route; the image optimiser adds nothing for a small, already-compressed logo. */}
        <Image src={versioned(id, "logo", version)} alt={`${name} logo`} width={px} height={px} unoptimized className="h-full w-full object-contain p-1.5" />
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

/**
 * The cover banner. Lazy-loaded (it sits below the fold on the list page) at a fixed aspect ratio so nothing
 * shifts as it arrives; the browser already downsized it to at most 1280px wide before upload. With no cover,
 * a neutral decorative banner stands in so every card keeps the same shape.
 */
export function VpsCover({ id, name, hasCover, version, className }: ImageProps & { hasCover: boolean; className?: string }) {
  const frame = cn("relative block aspect-[16/5] max-h-56 w-full overflow-hidden bg-slate-900", className);
  if (hasCover) {
    return (
      <span className={frame}>
        <Image
          src={versioned(id, "cover", version)}
          alt={`${name} — VPS hosting for forex trading`}
          width={1280}
          height={400}
          sizes="(min-width: 1152px) 1100px, 100vw"
          loading="lazy"
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className={frame} aria-hidden="true" style={{ backgroundImage: "radial-gradient(60% 120% at 15% 0%, rgba(139,92,246,0.35), transparent 70%), linear-gradient(135deg, #0b1230 0%, #131c45 100%)" }}>
      <svg viewBox="0 0 320 100" className="absolute inset-0 h-full w-full opacity-60" preserveAspectRatio="xMidYMid slice" focusable="false">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${190 + i * 38} 18)`}>
            <rect width="30" height="64" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(167,139,250,0.55)" />
            <rect x="5" y="8" width="20" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
            <rect x="5" y="18" width="20" height="4" rx="2" fill="rgba(255,255,255,0.25)" />
            <circle cx="8" cy="52" r="2.2" fill="#34d399" />
            <circle cx="15" cy="52" r="2.2" fill="#fbbf24" />
          </g>
        ))}
      </svg>
    </span>
  );
}
