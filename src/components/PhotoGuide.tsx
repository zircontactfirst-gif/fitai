import { Camera, CheckCircle2, AlertTriangle } from "lucide-react";
import { PHOTO_GUIDE, PHOTO_RULES } from "@/lib/measure";

export function PhotoGuide() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PHOTO_GUIDE.map((p) => (
          <div key={p.pose} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex h-24 items-center justify-center rounded-md bg-muted">
              <PoseIcon pose={p.pose} />
            </div>
            <p className="text-sm font-medium">{p.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.tip}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
          <Camera className="h-4 w-4" /> Photo rules for accurate AI measurement
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {PHOTO_RULES.map((r, i) => (
            <li key={i} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {r}
            </li>
          ))}
          <li className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            Photos are stored only on your device — never uploaded to any server except for the temporary AI call.
          </li>
        </ul>
      </div>
    </div>
  );
}

function PoseIcon({ pose }: { pose: string }) {
  // Simple SVG silhouettes
  const common = "stroke-foreground/70 fill-foreground/10";
  if (pose === "side") {
    return (
      <svg viewBox="0 0 60 100" className="h-20">
        <circle cx="32" cy="12" r="6" className={common} strokeWidth="2" />
        <path d="M32 18 L30 50 L34 80 L32 95" className={common} strokeWidth="3" fill="none" />
        <path d="M30 50 L24 70" className={common} strokeWidth="3" fill="none" />
      </svg>
    );
  }
  if (pose === "back") {
    return (
      <svg viewBox="0 0 60 100" className="h-20">
        <circle cx="30" cy="12" r="6" className={common} strokeWidth="2" />
        <path d="M18 22 L42 22 L40 60 L36 95 M40 60 L24 95 M18 22 L12 50 M42 22 L48 50" className={common} strokeWidth="2.5" fill="none" />
      </svg>
    );
  }
  if (pose === "apose") {
    return (
      <svg viewBox="0 0 60 100" className="h-20">
        <circle cx="30" cy="12" r="6" className={common} strokeWidth="2" />
        <path d="M22 22 L38 22 L36 60 L32 95 M36 60 L26 95 M22 22 L8 60 M38 22 L52 60" className={common} strokeWidth="2.5" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 100" className="h-20">
      <circle cx="30" cy="12" r="6" className={common} strokeWidth="2" />
      <path d="M20 22 L40 22 L38 60 L34 95 M38 60 L26 95 M20 22 L14 55 M40 22 L46 55" className={common} strokeWidth="2.5" fill="none" />
    </svg>
  );
}
