import { useState } from "react";
import { useParams } from "wouter";
import { useScoreEntry, useSubmitHoleResult, useClearHoleResult } from "@/lib/api";
import { TeamDot } from "@/components/team-badge";

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

const TOTAL_HOLES = 18;

export default function ScoreEntryPage() {
  const { token } = useParams<{ token: string }>();
  const { data: entry, isLoading } = useScoreEntry(token);
  const submit = useSubmitHoleResult(token);
  const clear = useClearHoleResult(token);
  const [editingHole, setEditingHole] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading scorecard...</p>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-lg font-display text-foreground">Invalid link</p>
          <p className="text-sm text-muted-foreground mt-1">
            Check that you copied the full link.
          </p>
        </div>
      </div>
    );
  }

  const resultMap = new Map<number, string>();
  entry.holeResults.forEach((h) => resultMap.set(h.holeNumber, h.result));

  const currentHole = entry.holeResults.length > 0
    ? Math.min(entry.holeResults.length + 1, TOTAL_HOLES)
    : 1;

  const handleSelect = (hole: number, result: string) => {
    submit.mutate({ holeNumber: hole, result });
    if (editingHole === hole) setEditingHole(null);
  };

  const handleClear = (hole: number) => {
    clear.mutate(hole);
    setEditingHole(null);
  };

  const dayLabel = entry.day === 2 ? "Day 2 — Fri" : "Day 3 — Sat";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-label text-[10px] text-muted-foreground tracking-wide">
              {dayLabel} · MATCH {entry.matchIndex}
            </p>
            <p className="font-display text-sm mt-0.5">Live Score Entry</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 text-sm tabular">
              <span className="text-team-tommy font-semibold">{entry.tommyWins}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-team-goon font-semibold">{entry.goonWins}</span>
            </div>
            <p className="font-label text-[9px] text-muted-foreground mt-0.5">
              {entry.halved > 0 && `${entry.halved} halved · `}
              {entry.holeResults.length}/{TOTAL_HOLES} holes
            </p>
          </div>
        </div>
      </div>

      {/* Players */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <TeamDot team="Team Tommy" />
          <div className="min-w-0">
            <p className="font-label text-[9px] text-muted-foreground">TEAM TOMMY</p>
            <p className="text-xs font-medium truncate">
              {entry.tommyPlayers.length > 0
                ? entry.tommyPlayers.map((p) => shortName(p.name)).join(", ")
                : "TBD"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end text-right">
          <div className="min-w-0">
            <p className="font-label text-[9px] text-muted-foreground">GOON SQUAD</p>
            <p className="text-xs font-medium truncate">
              {entry.goonPlayers.length > 0
                ? entry.goonPlayers.map((p) => shortName(p.name)).join(", ")
                : "TBD"}
            </p>
          </div>
          <TeamDot team="Goon Squad" />
        </div>
      </div>

      {/* Hole-by-hole list */}
      <div className="px-4 pb-8 space-y-1.5">
        {Array.from({ length: TOTAL_HOLES }).map((_, i) => {
          const hole = i + 1;
          const result = resultMap.get(hole);
          const isCurrent = hole === currentHole && !result;
          const isEditing = editingHole === hole;

          return (
            <div
              key={hole}
              className={`rounded-lg overflow-hidden ${
                isCurrent ? "ring-2 ring-accent" : ""
              } ${result ? "bg-muted/40" : isCurrent ? "bg-accent/5" : "bg-muted/20"}`}
            >
              <div className="flex items-center px-3 py-2.5">
                <span className="font-label text-xs text-muted-foreground w-6 tabular">
                  {hole}
                </span>

                {/* Result display or buttons */}
                {result && !isEditing ? (
                  <>
                    <button
                      onClick={() => setEditingHole(hole)}
                      className={`flex-1 text-left ml-1 ${
                        result === "tommy" ? "text-team-tommy" : result === "goon" ? "text-team-goon" : "text-muted-foreground"
                      }`}
                    >
                      {result === "tommy" ? "✓ Tommy won" : result === "goon" ? "✓ Goon won" : "✓ Halved"}
                    </button>
                    <span className="text-[10px] text-muted-foreground">tap to edit</span>
                  </>
                ) : (
                  <div className="flex-1 grid grid-cols-3 gap-1.5 ml-1">
                    <button
                      onClick={() => handleSelect(hole, "tommy")}
                      disabled={submit.isPending}
                      data-testid={`button-tommy-${hole}`}
                      className={`py-2 rounded-md text-xs font-medium transition-colors ${
                        result === "tommy"
                          ? "bg-team-tommy text-team-tommy-fg"
                          : "bg-team-tommy/15 text-team-tommy active:bg-team-tommy/25"
                      }`}
                    >
                      Tommy
                    </button>
                    <button
                      onClick={() => handleSelect(hole, "halve")}
                      disabled={submit.isPending}
                      data-testid={`button-halve-${hole}`}
                      className={`py-2 rounded-md text-xs font-medium transition-colors ${
                        result === "halve"
                          ? "bg-muted-foreground text-background"
                          : "bg-muted/40 text-muted-foreground active:bg-muted/60"
                      }`}
                    >
                      Halve
                    </button>
                    <button
                      onClick={() => handleSelect(hole, "goon")}
                      disabled={submit.isPending}
                      data-testid={`button-goon-${hole}`}
                      className={`py-2 rounded-md text-xs font-medium transition-colors ${
                        result === "goon"
                          ? "bg-team-goon text-team-goon-fg"
                          : "bg-team-goon/15 text-team-goon active:bg-team-goon/25"
                      }`}
                    >
                      Goon
                    </button>
                  </div>
                )}

                {result && isEditing && (
                  <button
                    onClick={() => handleClear(hole)}
                    className="ml-2 text-[10px] text-loss font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
