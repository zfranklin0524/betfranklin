import { useMemo } from "react";
import { usePots, useTeamPoints, useSkinsDayResult, useFundPots, useFinalizeTeamPot, useFinalizeSkins } from "@/lib/api";
import { formatMoney, type PotSummary } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { Trophy, Target, Layers, AlertTriangle, Check, DollarSign } from "lucide-react";

const dayLabels = ["", "Day 1 (Thu)", "Day 2 (Fri)", "Day 3 (Sat)"];

export default function Pots() {
  const { data: pots, isLoading } = usePots();
  const { data: teamPoints } = useTeamPoints();
  const { isAdmin } = useApp();
  const fundPots = useFundPots();
  const finalizeTeam = useFinalizeTeamPot();
  const finalizeSkins = useFinalizeSkins();

  const teamPot = pots?.find((p) => p.type === "team_pot");
  const ctpPot = pots?.find((p) => p.type === "ctp");
  const skinsPot = pots?.find((p) => p.type === "skins");

  const tommyPoints = useMemo(() => {
    const pts = teamPoints ?? [];
    return pts.filter((t) => t.team === "Team Tommy").reduce((s, t) => s + t.points, 0);
  }, [teamPoints]);
  const goonPoints = useMemo(() => {
    const pts = teamPoints ?? [];
    return pts.filter((t) => t.team === "Goon Squad").reduce((s, t) => s + t.points, 0);
  }, [teamPoints]);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  const funded = teamPot?.funded ?? false;
  const totalPot = 24000;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl flex items-center gap-2">
            <span className="text-accent">★</span> Structured Pots
          </h1>
          <p className="text-sm text-muted-foreground">
            $100 buy-in per player. $2,400 total across 3 pots.
          </p>
        </div>
        {isAdmin && !funded && (
          <Button size="sm" onClick={() => fundPots.mutate()} data-testid="button-fund-pots">
            <DollarSign className="w-4 h-4 mr-1" /> Fund Pots
          </Button>
        )}
      </div>

      {funded && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
          <Check className="w-4 h-4 text-win" />
          Pots funded — $2,400 collected ($100 x 24 players)
        </div>
      )}

      {/* Team Pot */}
      {teamPot && <TeamPotCard pot={teamPot} tommyPoints={tommyPoints} goonPoints={goonPoints} isAdmin={isAdmin} onFinalize={() => finalizeTeam.mutate()} />}

      {/* CTP Pot */}
      {ctpPot && <CTPPotCard pot={ctpPot} />}

      {/* Skins Pot */}
      {skinsPot && <SkinsPotCard pot={skinsPot} isAdmin={isAdmin} onFinalize={() => finalizeSkins.mutate()} />}

      {/* Total summary */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-label text-[11px] text-muted-foreground">Total Pot Value</p>
            <p className="font-display text-2xl tabular">{formatMoney(totalPot / 100)}</p>
          </div>
          <div className="text-right">
            <p className="font-label text-[11px] text-muted-foreground">Buy-in per Player</p>
            <p className="font-display text-lg tabular">{formatMoney(100)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: PotSummary["status"] }) {
  const styles: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    scoring: "bg-accent/15 text-accent",
    finalized: "bg-win/15 text-win",
    tie_unresolved: "bg-warning/15 text-warning",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    scoring: "Live Scoring",
    finalized: "Finalized",
    tie_unresolved: "Tie — Unresolved",
  };
  return (
    <span className={`text-[11px] font-label px-2 py-0.5 rounded-full ${styles[status]}`} data-testid={`text-pot-status-${status}`}>
      {labels[status]}
    </span>
  );
}

function TeamPotCard({ pot, tommyPoints, goonPoints, isAdmin, onFinalize }: {
  pot: PotSummary;
  tommyPoints: number;
  goonPoints: number;
  isAdmin: boolean;
  onFinalize: () => void;
}) {
  return (
    <Card data-testid="card-team-pot">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-display text-lg leading-tight">{pot.name}</h2>
              <p className="text-xs text-muted-foreground">{formatMoney(pot.totalCents / 100)} · $120/player to winning team</p>
            </div>
          </div>
          <StatusBadge status={pot.status} />
        </div>
        <p className="text-sm text-muted-foreground">{pot.description}</p>

        {/* Points comparison */}
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-lg px-3 py-2 ${tommyPoints > goonPoints && pot.status !== "finalized" ? "bg-win/10 border border-win/30" : "bg-muted/40"}`}>
            <p className="font-label text-[11px] text-muted-foreground">Team Tommy</p>
            <p className="font-display text-xl tabular">{tommyPoints.toFixed(1)}</p>
          </div>
          <div className={`rounded-lg px-3 py-2 ${goonPoints > tommyPoints && pot.status !== "finalized" ? "bg-win/10 border border-win/30" : "bg-muted/40"}`}>
            <p className="font-label text-[11px] text-muted-foreground">Goon Squad</p>
            <p className="font-display text-xl tabular">{goonPoints.toFixed(1)}</p>
          </div>
        </div>

        {pot.status === "tie_unresolved" && (
          <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 px-3 py-2 rounded-lg" data-testid="text-team-tie">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Teams are tied. A tiebreak rule needs to be defined (e.g. playoff hole or split 24 ways).</span>
          </div>
        )}

        {pot.payouts.length > 0 && (
          <div>
            <p className="font-label text-[11px] text-muted-foreground mb-1">
              {pot.status === "finalized" ? "Finalized Payouts" : "Projected Payouts"}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {pot.payouts.map((p) => (
                <div key={p.playerId} className="flex justify-between text-sm px-2 py-1 bg-muted/30 rounded">
                  <span className="truncate">{p.playerName}</span>
                  <span className="tabular font-semibold text-win">{formatMoney(p.amountCents / 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && pot.status === "scoring" && (
          <Button size="sm" variant="outline" onClick={onFinalize} data-testid="button-finalize-team">
            Finalize Team Pot
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CTPPotCard({ pot }: { pot: PotSummary }) {
  return (
    <Card data-testid="card-ctp-pot">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-display text-lg leading-tight">{pot.name}</h2>
              <p className="text-xs text-muted-foreground">{formatMoney(pot.totalCents / 100)} · 4 holes x $60</p>
            </div>
          </div>
          <StatusBadge status={pot.status} />
        </div>
        <p className="text-sm text-muted-foreground">{pot.description}</p>

        {pot.payouts.length > 0 && (
          <div>
            <p className="font-label text-[11px] text-muted-foreground mb-1">
              {pot.status === "finalized" ? "Finalized Payouts" : "Projected Payouts"}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {pot.payouts.map((p) => (
                <div key={p.playerId} className="flex justify-between text-sm px-2 py-1 bg-muted/30 rounded">
                  <span className="truncate">{p.playerName}</span>
                  <span className="tabular font-semibold text-win">{formatMoney(p.amountCents / 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkinsPotCard({ pot, isAdmin, onFinalize }: {
  pot: PotSummary;
  isAdmin: boolean;
  onFinalize: () => void;
}) {
  return (
    <Card data-testid="card-skins-pot">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-display text-lg leading-tight">{pot.name}</h2>
              <p className="text-xs text-muted-foreground">{formatMoney(pot.totalCents / 100)} · $240/day x 3 days</p>
            </div>
          </div>
          <StatusBadge status={pot.status} />
        </div>
        <p className="text-sm text-muted-foreground">{pot.description}</p>

        <SkinsDayBreakdown />

        {pot.status === "tie_unresolved" && (
          <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Day 3 produced zero skins with no next day to roll into. A rule needs to be defined for this edge case.</span>
          </div>
        )}

        {pot.payouts.length > 0 && (
          <div>
            <p className="font-label text-[11px] text-muted-foreground mb-1">
              {pot.status === "finalized" ? "Finalized Payouts" : "Projected Payouts"}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {pot.payouts.map((p) => (
                <div key={p.playerId} className="flex justify-between text-sm px-2 py-1 bg-muted/30 rounded">
                  <span className="truncate">{p.playerName}</span>
                  <span className="tabular font-semibold text-win">{formatMoney(p.amountCents / 100)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {isAdmin && pot.status === "scoring" && (
          <Button size="sm" variant="outline" onClick={onFinalize} data-testid="button-finalize-skins">
            Finalize Skins
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function SkinsDayBreakdown() {
  const day1 = useSkinsDayResult(1);
  const day2 = useSkinsDayResult(2);
  const day3 = useSkinsDayResult(3);
  const results = [day1, day2, day3];

  const hasData = results.some((r) => r.data && (r.data.skins.length > 0 || r.data.zeroSkins));

  if (!hasData) return null;

  return (
    <div className="space-y-2">
      {results.map((r, i) => {
        const day = i + 1;
        const data = r.data;
        if (!data || (data.skins.length === 0 && !data.zeroSkins)) return null;
        return (
          <div key={day} className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="font-label text-[11px] text-muted-foreground">{dayLabels[day]}</span>
              <span className="font-label text-[11px] text-muted-foreground">
                Pot: {formatMoney(data.potCents / 100)}
                {data.rolledOver && " (rolled over)"}
              </span>
            </div>
            {data.zeroSkins ? (
              <p className="text-sm text-warning">No outright skins — pot rolls to next day</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-1">
                  {data.skins.length} skin{data.skins.length !== 1 ? "s" : ""} · {formatMoney(data.skinValue / 100)}/skin
                </p>
                <div className="space-y-1">
                  {data.skins.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="truncate">
                        <span className="text-muted-foreground">H{s.holeNumber}</span> · {s.label} ({s.team})
                      </span>
                      <span className="text-muted-foreground text-xs truncate ml-2">{s.members.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
