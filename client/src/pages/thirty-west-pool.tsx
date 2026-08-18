import { useMemo, useState } from "react";
import { usePots, useTeamPoints, useSkinsDayResult, useSideBets, useFundPots, useFinalizeTeamPot, useFinalizeSkins, useCTPHoles, useScrambleUnits, useBuyIns } from "@/lib/api";
import { formatMoney, type PotSummary, type PlayerStanding, type BuyIn } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { useStandings } from "@/lib/api";
import { Trophy, Target, Layers, AlertTriangle, Check, DollarSign, Crown, Handshake, ChevronDown, ChevronRight } from "lucide-react";
import { TeamDot } from "@/components/team-badge";

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

const dayLabels = ["", "Day 1 (Thu)", "Day 2 (Fri)", "Day 3 (Sat)"];

export default function ThirtyWestPool() {
  const { data: pots, isLoading } = usePots();
  const { data: teamPoints } = useTeamPoints();
  const { data: standings } = useStandings();
  const { data: sideBets } = useSideBets();
  const { data: buyIns } = useBuyIns();
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
  const activeSideBets = (sideBets ?? []).filter((b) => b.status === "proposed" || b.status === "accepted");
  const totalCollectedCents = (buyIns ?? []).reduce((s, b) => s + b.amountCents, 0);
  const paidCount = (buyIns ?? []).filter((b) => b.amountCents > 0).length;
  const fullyFunded = totalCollectedCents === 240000;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl flex items-center gap-2">
            <span className="text-accent">★</span> 30W Pool
          </h1>
          <p className="text-sm text-muted-foreground">
            $100 buy-in · $2,400 across 3 pots · Plus side bets
          </p>
        </div>
        {isAdmin && !funded && (
          <Button size="sm" onClick={() => fundPots.mutate()} data-testid="button-fund-pots">
            <DollarSign className="w-4 h-4 mr-1" /> Fund Pots
          </Button>
        )}
      </div>

      {funded && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${fullyFunded ? "text-muted-foreground bg-muted/40" : "text-warning bg-warning/10"}`}>
          {fullyFunded ? <Check className="w-4 h-4 text-win shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {fullyFunded
            ? `Pots funded — $2,400 collected ($100 x 24 players)`
            : `${formatMoney(totalCollectedCents / 100)} collected from ${paidCount}/24 players — $${(240000 - totalCollectedCents) / 100} short of the full $2,400 pot`}
        </div>
      )}

      {/* Pot Leaderboards */}
      {teamPot && (
        <TeamPotLeaderboard
          pot={teamPot}
          tommyPoints={tommyPoints}
          goonPoints={goonPoints}
          isAdmin={isAdmin}
          onFinalize={() => finalizeTeam.mutate()}
        />
      )}

      {ctpPot && <CTPLeaderboard pot={ctpPot} />}

      {skinsPot && (
        <SkinsLeaderboard
          pot={skinsPot}
          isAdmin={isAdmin}
          onFinalize={() => finalizeSkins.mutate()}
        />
      )}

      {/* Active side bets summary */}
      {activeSideBets.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Handshake className="w-4 h-4 text-accent" />
              <h3 className="font-display text-sm">Active Side Bets</h3>
            </div>
            <div className="space-y-1">
              {activeSideBets.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="font-medium">{b.creator.name}</span>
                    <span className="text-muted-foreground"> vs </span>
                    <span className="font-medium">{b.opponent.name}</span>
                  </span>
                  <span className="tabular text-muted-foreground shrink-0 ml-2">{formatMoney(b.stakeCents / 100)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Running Pool Ledger */}
      {standings && (
        <PoolLedger standings={standings} funded={funded} pots={[teamPot, ctpPot, skinsPot]} totalCollectedCents={totalCollectedCents} buyIns={buyIns ?? []} />
      )}
    </div>
  );
}

/* ---------- Team Pot Leaderboard ---------- */
function TeamPotLeaderboard({ pot, tommyPoints, goonPoints, isAdmin, onFinalize }: {
  pot: PotSummary;
  tommyPoints: number;
  goonPoints: number;
  isAdmin: boolean;
  onFinalize: () => void;
}) {
  const leader = tommyPoints > goonPoints ? "Team Tommy" : goonPoints > tommyPoints ? "Goon Squad" : null;
  return (
    <Card data-testid="card-team-pot">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-display text-base leading-tight">Winning Team Pot</h2>
              <p className="text-xs text-muted-foreground">{formatMoney(pot.totalCents / 100)} · $120/player to winning team</p>
            </div>
          </div>
          <StatusBadge status={pot.status} />
        </div>

        {/* Points comparison — leaderboard style */}
        <div className="space-y-2">
          {[
            { name: "Team Tommy", pts: tommyPoints, winning: leader === "Team Tommy" && pot.status !== "finalized" },
            { name: "Goon Squad", pts: goonPoints, winning: leader === "Goon Squad" && pot.status !== "finalized" },
          ].sort((a, b) => b.pts - a.pts).map((t, i) => (
            <div
              key={t.name}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                t.winning ? "bg-win/10 border border-win/30" : "bg-muted/40"
              }`}
            >
              <span className={`font-display text-lg tabular w-6 ${i === 0 ? "text-accent" : "text-muted-foreground"}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{t.name}</p>
              </div>
              <span className="font-display text-xl tabular">{t.pts.toFixed(1)}</span>
              {i === 0 && t.winning && <Crown className="w-4 h-4 text-accent" />}
            </div>
          ))}
        </div>

        {pot.status === "tie_unresolved" && (
          <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Teams are tied. Define a tiebreak rule.</span>
          </div>
        )}

        {pot.payouts.length > 0 && (
          <div>
            <p className="font-label text-[11px] text-muted-foreground mb-1">
              {pot.status === "finalized" ? "Finalized Payouts" : "Projected Payouts"} — $120 each
            </p>
            <div className="grid grid-cols-2 gap-1">
              {pot.payouts.map((p) => (
                <div key={p.playerId} className="flex justify-between text-sm px-2 py-1 bg-muted/30 rounded">
                  <span className="truncate">{p.playerName}</span>
                  <span className="tabular font-semibold text-win shrink-0 ml-1">{formatMoney(p.amountCents / 100)}</span>
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

/* ---------- CTP Leaderboard ---------- */
const ctpHoles = [
  { hole: 3, yards: 108 },
  { hole: 6, yards: 133 },
  { hole: 11, yards: 190 },
  { hole: 15, yards: 143 },
];

function CTPLeaderboard({ pot }: { pot: PotSummary }) {
  const { data: ctpData } = useCTPHoles();

  return (
    <Card data-testid="card-ctp-pot">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-display text-base leading-tight">Closest to Pin</h2>
              <p className="text-xs text-muted-foreground">{formatMoney(pot.totalCents / 100)} · 4 par-3s x $60 · White tees · Day 1 at Highlands Golf Club</p>
            </div>
          </div>
          <StatusBadge status={pot.status} />
        </div>

        <div className="space-y-1.5">
          {ctpHoles.map((h) => {
            const holeData = ctpData?.find((d) => d.holeNumber === h.hole);
            const winners = holeData?.entries.filter((e) => e.isWinner) ?? [];
            const hasWinner = winners.length > 0;
            return (
              <CTPHoleRow
                key={h.hole}
                hole={h.hole}
                yards={h.yards}
                winners={winners}
                entries={holeData?.entries ?? []}
                finalized={holeData?.finalized ?? false}
                hasWinner={hasWinner}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function CTPHoleRow({ hole, yards, winners, entries, finalized, hasWinner }: {
  hole: number;
  yards: number;
  winners: { playerId: number; playerName: string; distance: string | null; isWinner: boolean }[];
  entries: { playerId: number; playerName: string; distance: string | null; isWinner: boolean }[];
  finalized: boolean;
  hasWinner: boolean;
}) {
  const [open, setOpen] = useState(false);
  const totalWon = hasWinner ? 6000 / winners.length : 0;

  return (
    <div className="bg-muted/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        data-testid={`button-ctp-hole-${hole}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="font-label text-sm">Hole {hole}</span>
          <span className="text-xs text-muted-foreground">· Par 3 · {yards} yds</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasWinner ? (
            <>
              {winners.length > 1 && <span className="text-[10px] text-warning font-label">SPLIT</span>}
              <span className="text-xs font-medium truncate max-w-[100px]">{winners.map((w) => w.playerName).join(", ")}</span>
              <span className="text-xs tabular font-medium text-win">+{formatMoney(totalWon / 100)}</span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground font-label">TBD</span>
          )}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">Par 3 · White tees · {yards} yards</span>
            <span className="text-xs text-muted-foreground">{hasWinner ? `${formatMoney(totalWon / 100)} each${winners.length > 1 ? " (split)" : ""}` : "Winner takes $60"}</span>
          </div>

          {hasWinner ? (
            <div className="space-y-1">
              {winners.map((w, i) => (
                <div key={i} className="flex items-center justify-between text-sm rounded px-2 py-1.5 bg-win/10 border border-win/20">
                  <div className="flex items-center gap-2">
                    <Crown className="w-3 h-3 text-accent shrink-0" />
                    <span className="font-medium">{w.playerName}</span>
                  </div>
                  <span className="tabular font-semibold text-win">+{formatMoney(totalWon / 100)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-1">
              Winner TBD
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Skins Leaderboard ---------- */
function SkinsLeaderboard({ pot, isAdmin, onFinalize }: {
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
              <h2 className="font-display text-base leading-tight">Skins</h2>
              <p className="text-xs text-muted-foreground">{formatMoney(pot.totalCents / 100)} · $360/day, Fri-Sat</p>
            </div>
          </div>
          <StatusBadge status={pot.status} />
        </div>

        <SkinsDayBreakdown pot={pot} />

        {pot.status === "tie_unresolved" && (
          <div className="flex items-start gap-2 text-sm text-warning bg-warning/10 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Day 3 had zero skins with no roll-forward day. Define a rule.</span>
          </div>
        )}

        {pot.payouts.length > 0 && (
          <div>
            <p className="font-label text-[11px] text-muted-foreground mb-1">
              {pot.status === "finalized" ? "Finalized Payouts" : "Projected Payouts"}
            </p>
            <div className="space-y-1">
              {pot.payouts.slice(0, 8).map((p) => (
                <div key={p.playerId} className="flex items-center gap-3 rounded-lg px-3 py-1.5 bg-muted/30">
                  <span className="font-medium text-sm flex-1 truncate">{p.playerName}</span>
                  <span className="tabular font-semibold text-win">{formatMoney(p.amountCents / 100)}</span>
                </div>
              ))}
              {pot.payouts.length > 8 && (
                <p className="text-xs text-muted-foreground text-center pt-1">+ {pot.payouts.length - 8} more</p>
              )}
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

function SkinsDayBreakdown({ pot }: { pot: PotSummary }) {
  // Skins runs Friday + Saturday only — Thursday's 4-man scramble isn't a
  // skins day.
  const day2 = useSkinsDayResult(2);
  const day3 = useSkinsDayResult(3);
  const unitsQuery = useScrambleUnits();
  const results = [day2, day3];
  const dayMeta = [
    { day: 2, label: "Day 2 (Fri)", format: "12 two-man teams", potCents: 36000 },
    { day: 3, label: "Day 3 (Sat)", format: "12 two-man teams", potCents: 36000 },
  ];

  return (
    <div className="space-y-1.5">
      {dayMeta.map((meta, i) => {
        const data = results[i].data;
        const hasData = data && (data.skins.length > 0 || data.zeroSkins);
        const isFinalized = pot.status === "finalized";
        const dayUnits = unitsQuery.data?.filter((u) => u.day === meta.day) ?? [];
        return (
          <SkinsDayRow
            key={meta.day}
            label={meta.label}
            format={meta.format}
            potCents={meta.potCents}
            data={data}
            hasData={!!hasData}
            isFinalized={isFinalized}
            units={dayUnits}
          />
        );
      })}
    </div>
  );
}

function SkinsDayRow({ label, format, potCents, data, hasData, isFinalized, units }: {
  label: string;
  format: string;
  potCents: number;
  data: any;
  hasData: boolean;
  isFinalized: boolean;
  units: { id: number; label: string; team: string; members: { id: number; name: string; team: string }[] }[];
}) {
  const [open, setOpen] = useState(false);

  const skinCount = data?.skins?.length ?? 0;
  const skinValue = data?.skinValue ?? 0;
  const rolledOver = data?.rolledOver ?? false;
  const zeroSkins = data?.zeroSkins ?? false;
  const totalWon = data?.skins?.reduce((s: number, sk: any) => s + (sk.payoutCents ?? 0), 0) ?? 0;

  return (
    <div className="bg-muted/30 rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        data-testid={`button-skins-day-${label}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="font-label text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasData ? (
            <>
              {rolledOver && <span className="text-[10px] text-warning font-label">ROLLOVER</span>}
              {zeroSkins ? (
                <span className="text-[10px] text-muted-foreground font-label">0 skins</span>
              ) : (
                <span className="text-[10px] text-accent font-label">{skinCount} skin{skinCount !== 1 ? "s" : ""}</span>
              )}
              <span className="text-xs tabular font-medium text-win">{formatMoney(totalWon / 100)}</span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground font-label">TBD</span>
          )}
        </div>
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/50">
          {/* Day info */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">{format}</span>
            <span className="text-xs text-muted-foreground">Pot: {formatMoney(potCents / 100)}{rolledOver ? " (rolled over)" : ""}</span>
          </div>

          {hasData ? (
            zeroSkins ? (
              <div className="text-sm text-warning py-2">
                No outright skins — pot rolls to next day
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {skinCount} skin{skinCount !== 1 ? "s" : ""} · {formatMoney(skinValue / 100)}/skin
                </p>
                <div className="space-y-1">
                  {data.skins.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm bg-card/60 rounded px-2 py-1.5">
                      <div className="min-w-0">
                        <span className="text-muted-foreground text-xs">H{s.holeNumber}</span>
                        <span className="font-medium ml-1">{s.label}</span>
                        <span className={`text-[10px] ml-1 ${s.team === "Team Tommy" ? "text-accent" : "text-warning"}`}>({s.team})</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-xs text-muted-foreground truncate max-w-[120px]">{s.members?.join(", ")}</div>
                        <div className="tabular text-win text-xs font-medium">+{formatMoney((s.payoutCents ?? skinValue) / 100)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            <div className="space-y-1.5">
              {units.length > 0 ? (
                <>
                  {units.map((u) => (
                    <div key={u.id} className="text-xs bg-card/60 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <TeamDot team={u.team} />
                        <span className="font-medium">{u.label}</span>
                      </div>
                      <div className="text-muted-foreground mt-0.5">{u.members.map(m => m.name).join(", ")}</div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground py-1">
                    {units.length} team{units.length !== 1 ? "s" : ""} set · {format.includes("four") ? 6 - units.length : 12 - units.length} TBD
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  Teams will populate once scramble units are set up in Admin.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Running Pool Ledger ---------- */
function PoolLedger({ standings, funded, pots, totalCollectedCents, buyIns }: { standings: PlayerStanding[]; funded: boolean; pots: (PotSummary | undefined)[]; totalCollectedCents: number; buyIns: BuyIn[] }) {
  const paidById = new Map(buyIns.map((b) => [b.playerId, b.paid && b.amountCents > 0]));
  const poolData = standings
    .map((s) => ({
      player: s.player,
      teamPotNet: s.teamPotNet,
      ctpNet: s.ctpNet,
      skinsNet: s.skinsNet,
      total: s.potNet,
      paid: paidById.get(s.player.id) ?? false,
    }))
    .sort((a, b) => b.total - a.total);

  const totalPool = poolData.reduce((s, p) => s + p.total, 0);
  const totalTeam = poolData.reduce((s, p) => s + p.teamPotNet, 0);
  const totalCTP = poolData.reduce((s, p) => s + p.ctpNet, 0);
  const totalSkins = poolData.reduce((s, p) => s + p.skinsNet, 0);
  // Money still sitting in the $2,400 full pot that hasn't been through a
  // real finalization yet — each pot's full fixed amount only counts once
  // its status is actually "finalized" (not just a live projection).
  const finalizedCents = pots
    .filter((p): p is PotSummary => !!p && p.status === "finalized")
    .reduce((s, p) => s + p.totalCents, 0);
  const unallocated = funded ? 2400 - finalizedCents / 100 : 0;
  // If less than $2,400 was actually collected, finalized pots still pay
  // out their full fixed amount — the gap is a real shortfall, not a bug.
  // This is exactly why the Totals row below won't sum to $0 in that case.
  const shortfall = (finalizedCents - totalCollectedCents) / 100;

  const fmt = (n: number) =>
    `${n > 0 ? "+" : ""}${formatMoney(n)}`;
  const cellClass = (n: number) =>
    `text-right tabular ${n > 0 ? "text-win" : n < 0 ? "text-loss" : "text-muted-foreground"}`;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-display text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-accent" />
            Running 30W Pool Ledger
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            30W pool positions only. Excludes betFranklin props.
          </p>
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-win/15 text-win shrink-0">
              <Check className="w-2 h-2" />
            </span>
            = paid the $100 buy-in — tracked for reference only, not netted into the Net total below
          </p>
        </div>

        <div className="grid grid-cols-12 gap-1 px-2 py-2 font-label text-[9px] text-muted-foreground border-b border-border">
          <div className="col-span-1">#</div>
          <div className="col-span-3">Player</div>
          <div className="col-span-2 text-right">Team</div>
          <div className="col-span-2 text-right">CTP</div>
          <div className="col-span-2 text-right">Skins</div>
          <div className="col-span-2 text-right">Net</div>
        </div>

        <ol className="divide-y divide-border">
          {poolData.map((s, i) => (
            <li key={s.player.id} className="grid grid-cols-12 gap-1 px-2 py-1.5 items-center text-[11px]">
              <div className="col-span-1 tabular text-muted-foreground">
                {i + 1}
              </div>
              <div className="col-span-3 font-medium flex items-center gap-1 min-w-0">
                <TeamDot team={s.player.team} />
                {s.player.id === 14 && (
                  <Crown className="w-3 h-3 text-accent shrink-0" title="Reigning King of the West" />
                )}
                {(s.player.id === 1 || s.player.id === 13) && (
                  <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent/15 text-accent text-[8px] font-bold shrink-0" title="Captain">C</span>
                )}
                <span className="overflow-hidden truncate">{shortName(s.player.name)}</span>
              </div>
              <div className={`col-span-2 ${cellClass(s.teamPotNet)}`}>
                {fmt(s.teamPotNet)}
              </div>
              <div className={`col-span-2 ${cellClass(s.ctpNet)}`}>
                {fmt(s.ctpNet)}
              </div>
              <div className={`col-span-2 ${cellClass(s.skinsNet)}`}>
                {fmt(s.skinsNet)}
              </div>
              <div className={`col-span-2 text-right tabular font-semibold flex items-center justify-end gap-1 ${s.total > 0 ? "text-win" : s.total < 0 ? "text-loss" : ""}`}>
                {s.paid && (
                  <span
                    className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-win/15 text-win shrink-0"
                    title="Paid $100 buy-in — not netted into this total"
                  >
                    <Check className="w-2 h-2" />
                  </span>
                )}
                {fmt(s.total)}
              </div>
            </li>
          ))}
        </ol>

        {/* Summary footer */}
        <div className="px-3 py-2 border-t-2 border-border space-y-1 text-[11px]">
          <div className="grid grid-cols-12 gap-1">
            <span className="col-span-4 text-muted-foreground">Totals</span>
            <span className={`col-span-2 text-right tabular ${cellClass(totalTeam)}`}>{fmt(totalTeam)}</span>
            <span className={`col-span-2 text-right tabular ${cellClass(totalCTP)}`}>{fmt(totalCTP)}</span>
            <span className={`col-span-2 text-right tabular ${cellClass(totalSkins)}`}>{fmt(totalSkins)}</span>
            <span className={`col-span-2 text-right tabular font-semibold ${totalPool > 0 ? "text-win" : totalPool < 0 ? "text-loss" : ""}`}>{fmt(totalPool)}</span>
          </div>
          {funded && unallocated !== 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unallocated (pending finals)</span>
              <span className="tabular text-warning">{formatMoney(unallocated)}</span>
            </div>
          )}
          {shortfall > 0.01 && (
            <div className="flex justify-between">
              <span className="text-warning">Pool shortfall (paid out more than collected)</span>
              <span className="tabular text-warning font-semibold">{formatMoney(shortfall)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
    scoring: "Live",
    finalized: "Finalized",
    tie_unresolved: "Tie",
  };
  return (
    <span className={`text-[10px] font-label px-1.5 py-0.5 rounded-full ${styles[status]}`} data-testid={`text-pot-status-${status}`}>
      {labels[status]}
    </span>
  );
}
