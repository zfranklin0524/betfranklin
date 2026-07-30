/**
 * ThirtyWest team badge.
 * Poster: Team Tommy (dark green), Goon Squad (orange).
 * Uses explicit class mappings (no dynamic Tailwind class names) so the
 * production CSS build always includes both colors.
 */
export function teamOf(team?: string | null): {
  label: string;
  dot: string;
  chip: string;
  text: string;
} | null {
  if (!team) return null;
  const t = team.toLowerCase();
  if (t.includes("goon")) {
  return {
    label: "Goon Squad",
    dot: "bg-team-goon",
    chip: "bg-team-goon/15 text-team-goon border-team-goon/30",
    text: "text-team-goon",
  };
  }
  if (t.includes("tommy") || t.includes("tom")) {
  return {
    label: "Team Tommy",
    dot: "bg-team-tommy",
    chip: "bg-team-tommy/15 text-team-tommy border-team-tommy/30",
    text: "text-team-tommy",
  };
  }
  // Unknown — no badge (null so callers can fall back to a player lookup).
  return null;
}

export function TeamBadge({
  team,
  className = "",
  variant = "chip",
}: {
  team?: string | null;
  className?: string;
  variant?: "chip" | "dot";
}) {
  const t = teamOf(team);
  if (!t) return null;
  if (variant === "dot") {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${t.text} ${className}`}
      >
    <span className={`w-2 h-2 rounded-full ${t.dot}`} />
    {t.label}
    </span>
  );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${t.chip} ${className}`}
    >
    <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
    {t.label}
    </span>
  );
}

/** Bare color dot — for compact lists like the name selector. */
export function TeamDot({ team }: { team?: string | null }) {
  const t = teamOf(team);
  if (!t) return <span className="w-2 h-2 rounded-full bg-border" />;
  return <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />;
}
