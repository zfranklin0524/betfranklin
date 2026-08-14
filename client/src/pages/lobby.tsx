import { Link } from "wouter";
import { useBetSlip } from "@/lib/bet-slip";
import { useApp } from "@/lib/app-context";
import { useMarkets, useStandings, usePlayerBets, useMarketPools, usePlayers, useScrambleUnits, useHoleScoresByDay, useTeamPoints, useMatchSummaries, useMatchTotals, type MarketPool } from "@/lib/api";
import {
  formatMoney,
  parimutuelMultiple,
  multipleToAmerican,
  formatOdds,
  isEvenMoneyMarket,
  EVEN_MONEY_LABEL,
  type MarketWithOptions,
  type TeamPoints,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, TrendingUp, TrendingDown, Wallet, Lock } from "lucide-react";
import { TeamDot, teamOf, TeamBadge } from "@/components/team-badge";
import { BettorBreakdown } from "@/components/bettor-breakdown";
import { useState } from "react";

const TOMMY_CAPTAIN = "Chad Pavlecic";
const GOON_CAPTAIN = "Adam Henger";

function formatLockTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} ${time}`;
}

export default function Lobby() {
  const { player } = useApp();
  const { data: markets } = useMarkets();
  const { data: standings } = useStandings();
  const { data: myBets } = usePlayerBets(player?.id ?? null);
  const pools = useMarketPools();
  const { data: players } = usePlayers();
  const { data: teamPoints } = useTeamPoints();
  const [selectedDay, setSelectedDay] = useState<number | null>(() => {
    const now = new Date();
    const m = now.getMonth() + 1; // 0-indexed
    const d = now.getDate();
    if (m === 8 && d === 13) return 1;
    if (m === 8 && d === 14) return 2;
    if (m === 8 && d === 15) return 3;
    return null;
  });

  const tommyCount = (players ?? []).filter((p) => p.team === "Team Tommy").length;
  const goonCount = (players ?? []).filter((p) => p.team === "Goon Squad").length;

  const openMarkets = (markets ?? []).filter((m) => m.status === "open");
  const myStanding = (standings ?? []).find((s) => s.player.id === player?.id);
  const openBets = (myBets ?? []).filter((b) => b.status === "open");

  return (
    <div className="space-y-6">
      {/* Live tournament scoreboard (team vs team) */}
      <Scoreboard teamPoints={teamPoints ?? []} selectedDay={selectedDay} onSelectDay={(d) => setSelectedDay((prev) => (prev === d ? null : d))} />

      {/* Day matchups (only when a day is selected) */}
      {selectedDay !== null && <DayMatchups day={selectedDay} />}

      {/* Welcome line */}
      <div className="text-center -mt-1">
        <h2 className="font-display text-lg sm:text-xl leading-tight">
          {player ? `Welcome back, ${player.name}.` : "Pick your name to play."}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Work really really hard and pour yourself a boat drink at Heng Time's Transfusion Lounge
        </p>
      </div>

      {/* Your position */}
      {player && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Net P/L"
            value={formatMoney(myStanding?.net ?? 0)}
            tone={myStanding && myStanding.net >= 0 ? "win" : "loss"}
            icon={myStanding && myStanding.net >= 0 ? TrendingUp : TrendingDown}
          />
          <StatCard
            label="At Risk"
            value={formatMoney(myStanding?.openRisk ?? 0)}
            icon={Wallet}
          />
          <StatCard
            label="Total Staked"
            value={formatMoney(myStanding?.staked ?? 0)}
          />
          <StatCard
            label="Open Bets"
            value={String(openBets.length)}
          />
        </div>
      )}

      {/* Active markets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <span className="text-accent">★</span> Live Action
          </h2>
          <Link href="/markets">
            <Button variant="ghost" size="sm" className="gap-1 font-label">
              All markets <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        {!markets ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : openMarkets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No open markets. Check back soon.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {openMarkets.map((m) => (
              <QuickMarket key={m.id} market={m} pool={pools.get(m.id)} />
            ))}
          </div>
        )}
      </section>

      {/* Mini ledger */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg flex items-center gap-2">
            <span className="text-accent">★</span> Ledger
          </h2>
          <Link href="/ledger">
            <Button variant="ghost" size="sm" className="gap-1 font-label">
              Full ledger <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {!standings ? (
              <div className="p-4"><Skeleton className="h-6 w-full" /></div>
            ) : (
              <ol className="divide-y divide-border max-h-[280px] overflow-y-auto">
                {standings.map((s, i) => (
                  <li
                    key={s.player.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-sm text-muted-foreground tabular">
                        {i + 1}
                      </span>
                      <TeamDot team={s.player.team} />
                      <span className="text-sm font-medium truncate">{s.player.name}</span>
                      {s.player.id === player?.id && (
                        <span className="text-xs text-primary">you</span>
                      )}
                    </div>
                    <span
                      className={`tabular text-sm font-semibold ${
                        s.net > 0
                          ? "text-win"
                          : s.net < 0
                            ? "text-loss"
                            : "text-muted-foreground"
                      }`}
                    >
                      {s.net > 0 ? "+" : ""}
                      {formatMoney(s.net)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="ticket p-4">
      <div className="flex items-center gap-1.5 font-label text-[11px] text-muted-foreground mb-1">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <p
        className={`font-display text-xl tabular ${
          tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function QuickMarket({
  market,
  pool,
}: {
  market: MarketWithOptions;
  pool?: MarketPool;
}) {
  const { open } = useBetSlip();
  const { data: players } = usePlayers();
  const totalPool = pool?.pool ?? 0;
  const teamForLabel = (label: string) => {
    if (teamOf(label)) return label;
    return players?.find((p) => p.name === label)?.team ?? null;
  };
  // Sort by money (favorites first) only for multi-option markets.
  // For 2-option markets (Team Tommy vs Goon Squad, captain vs captain),
  // keep the original API order so Team Tommy always shows first.
  const sorted = market.options.length > 4
    ? [...market.options]
        .map((o) => ({ o, money: pool?.perOption.get(o.id) ?? 0 }))
        .sort((a, b) => b.money - a.money)
    : market.options.map((o) => ({ o, money: pool?.perOption.get(o.id) ?? 0 }));
  const needsScroll = sorted.length > 4;
  const evenMoney = isEvenMoneyMarket(market);
  return (
    <div className="ticket p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-label text-[11px] text-muted-foreground">
          {market.category}
        </span>
        <span className="stamp text-primary text-[10px]">
          Pool {formatMoney(totalPool)}
        </span>
      </div>
      <h3 className="font-display text-sm leading-tight mb-1">
        {market.title}
      </h3>
      {market.cashOutLockAt && (
        <p className="font-label text-[10px] text-muted-foreground flex items-center gap-1 mb-2">
          <Lock className="w-3 h-3" />
          Locks {formatLockTime(market.cashOutLockAt)}
        </p>
      )}
      {!market.cashOutLockAt && <div className="mb-2" />}
      <div className={`space-y-1 ${needsScroll ? "max-h-[200px] overflow-y-auto" : ""}`}>
        {sorted.map(({ o, money }) => {
          const multiple = parimutuelMultiple(totalPool, money);
          const liveOdds = evenMoney
            ? EVEN_MONEY_LABEL
            : multiple
              ? formatOdds(multipleToAmerican(multiple))
              : "0";
          return (
            <button
              key={o.id}
              onClick={() => open({ market, optionId: o.id, label: o.label })}
              className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted/60 transition-colors border-b border-dashed border-border/60 last:border-0"
              data-testid={`button-quickbet-${o.id}`}
            >
              <span className="truncate flex items-center gap-2">
                <TeamDot team={teamForLabel(o.label)} />
                <span className="truncate">{o.label}</span>
              </span>
              <span className="font-label tabular text-primary">{liveOdds}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2">
        <BettorBreakdown market={market} />
      </div>
    </div>
  );
}

const ROUNDS = [1, 2, 3];

function Scoreboard({ teamPoints, selectedDay, onSelectDay }: { teamPoints: TeamPoints[]; selectedDay: number | null; onSelectDay: (d: number) => void }) {
  // Cumulative Ryder Cup-style points across all 3 days — higher wins (unlike
  // stroke play). Per-day points are entered via the admin Units/Results tabs
  // (Day 1 scramble groups, Day 2-3 match play).
  const total = (team: string) =>
    teamPoints.filter((t) => t.team === team).reduce((sum, t) => sum + t.points, 0);
  const dayPoints = (day: number, team: string) =>
    teamPoints.find((t) => t.day === day && t.team === team)?.points;

  const tommyTotal = total("Team Tommy");
  const goonTotal = total("Goon Squad");
  const tommyDays = teamPoints.filter((t) => t.team === "Team Tommy").length;
  const goonDays = teamPoints.filter((t) => t.team === "Goon Squad").length;
  const bothPlayed = tommyDays > 0 && goonDays > 0;

  let leader: string;
  if (!bothPlayed) leader = "Scores pending";
  else if (tommyTotal === goonTotal) leader = "All square";
  else if (tommyTotal > goonTotal)
    leader = `Team Tommy leads by ${tommyTotal - goonTotal}`;
  else leader = `Goon Squad leads by ${goonTotal - tommyTotal}`;

  return (
    <section
      className="relative overflow-hidden border-2 border-primary/30 bg-card"
      data-testid="scoreboard-hero"
    >
      <div className="h-[3px] fairway-stripes" />
      <div className="px-3 sm:px-5 py-4 sm:py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-label text-[11px] tracking-wide text-muted-foreground">
            TOURNAMENT SCOREBOARD
          </p>
          <p className="font-label text-[11px] text-accent">{leader}</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
          <ScoreTeam
            name="Team Tommy"
            captain={TOMMY_CAPTAIN}
            total={tommyTotal}
            tone="tommy"
          />
          <div className="flex flex-col items-center justify-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-background border-2 border-foreground/25 flex items-center justify-center font-display text-xs sm:text-sm shadow-sm">
              VS
            </div>
          </div>
          <ScoreTeam
            name="Goon Squad"
            captain={GOON_CAPTAIN}
            total={goonTotal}
            tone="goon"
            alignRight
          />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          {ROUNDS.map((r) => (
            <button
              key={r}
              onClick={() => onSelectDay(r)}
              className={`ticket p-2 text-center transition-colors ${selectedDay === r ? "ring-2 ring-accent bg-accent/5" : ""}`}
              data-testid={`button-day-${r}`}
            >
              <p className="font-label text-[10px] text-muted-foreground">
                Day {r}
              </p>
              <p className="font-display text-sm sm:text-base tabular leading-tight">
                <span className="text-team-tommy">
                  {dayPoints(r, "Team Tommy") ?? "0"}
                </span>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="text-team-goon">
                  {dayPoints(r, "Goon Squad") ?? "0"}
                </span>
              </p>
              <p className="font-label text-[9px] text-accent mt-0.5">
                {selectedDay === r ? "Selected" : "View scores →"}
              </p>
            </button>
          ))}
        </div>
      </div>
      <div className="h-[3px] fairway-stripes" />
    </section>
  );
}

function ScoreTeam({
  name,
  captain,
  total,
  tone,
  alignRight,
}: {
  name: string;
  captain: string;
  total: number;
  tone: "tommy" | "goon";
  alignRight?: boolean;
}) {
  const bg = tone === "tommy" ? "bg-team-tommy text-team-tommy-fg" : "bg-team-goon text-team-goon-fg";
  return (
    <div
      className={`${bg} p-3 sm:p-4 flex flex-col justify-center ${
        alignRight ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <p className="font-label text-[10px] opacity-80">{name}</p>
      <p className="font-display text-3xl sm:text-5xl tabular leading-none my-1">
        {total || "0"}
      </p>
      <p className="font-label text-[10px] opacity-70">{captain}, Capt.</p>
    </div>
  );
}

/* ---------- Day Matchups Card ---------- */
const DAY_LABELS = ["", "Day 1 — Thu", "Day 2 — Fri", "Day 3 — Sat"];

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const first = parts[0];
  const last = parts[parts.length - 1];
  return `${first[0]}. ${last}`;
}

function DayMatchups({ day }: { day: number }) {
  const { data: units } = useScrambleUnits();
  const { data: holeScores } = useHoleScoresByDay(day);
  const { data: teamPoints } = useTeamPoints();
  // Hooks must run unconditionally on every render (Rules of Hooks) — these
  // were previously called after the Day 1 early return below, so switching
  // from Day 2/3 to Day 1 changed the hook count mid-render and crashed the
  // page (React error #300). Day 1 just doesn't use the results.
  const { data: matchSummaries } = useMatchSummaries(day);
  const { data: dayTotals } = useMatchTotals(day);
  const dayUnits = (units ?? []).filter((u) => u.day === day);
  const isDay1 = day === 1;

  // Team points for this day
  const tommyPts = teamPoints?.find((t) => t.day === day && t.team === "Team Tommy")?.points ?? 0;
  const goonPts = teamPoints?.find((t) => t.day === day && t.team === "Goon Squad")?.points ?? 0;

  // Compute a scramble unit's total gross score from hole scores
  const unitScore = (unitId: number | undefined) => {
    if (!unitId || !holeScores) return null;
    const scores = holeScores.filter((h) => h.unitId === unitId);
    if (scores.length === 0) return null;
    return scores.reduce((s, h) => s + h.grossScore, 0);
  };

  if (isDay1) {
    // Day 1: 6 groups of 4 (3 from each team), no vs matchups
    const tommyUnits = dayUnits.filter((u) => u.team === "Team Tommy");
    const goonUnits = dayUnits.filter((u) => u.team === "Goon Squad");
    const allGroups = [
      ...tommyUnits.map(u => ({ ...u, sort: 0 })),
      ...goonUnits.map(u => ({ ...u, sort: 1 })),
    ];
    const groupCount = 6;

    return (
      <Card data-testid="card-day-matchups">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm">{DAY_LABELS[day]} Groups</h3>
            <span className="text-[10px] text-muted-foreground font-label">
              6 four-man groups
            </span>
          </div>
          <div className="space-y-1.5">
            {/* Day 1 header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2.5 pb-1 font-label text-[9px] text-muted-foreground">
              <span>Group</span>
              <span className="text-right w-10">Score</span>
              <span className="text-right w-8">Pts</span>
            </div>
            {Array.from({ length: groupCount }).map((_, i) => {
              const group = allGroups[i];
              const score = unitScore(group?.id);
              const pts = group?.team === "Team Tommy" ? tommyPts : goonPts;
              return (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center bg-muted/30 rounded-lg px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamDot team={group ? group.team : (i < 3 ? "Team Tommy" : "Goon Squad")} />
                    <span className="text-xs font-medium shrink-0">
                      {group ? group.label : "TBD"}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate flex-1 text-right">
                      {group ? group.members.map(m => shortName(m.name)).join(", ") : ""}
                    </span>
                  </div>
                  <span className="text-right tabular text-xs w-10 text-muted-foreground">
                    {score ?? "—"}
                  </span>
                  <span className="text-right tabular text-xs w-8 font-medium">
                    {pts || ""}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Days 2-3: 6 two-man matches with live match play scoring
  const summaries = matchSummaries ?? [];
  const totals = dayTotals ?? { tommy: 0, goon: 0, halved: 0 };
  const totalHoles = summaries.reduce((s, m) => s + m.holeResults.length, 0);
  const totalPossible = summaries.length * 18;

  return (
    <Card data-testid="card-day-matchups">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm">{DAY_LABELS[day]} Matches</h3>
          <span className="text-[10px] text-muted-foreground font-label">
            {totalHoles}/{totalPossible} holes in
          </span>
        </div>

        {/* Day total banner */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center bg-muted/40 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <TeamDot team="Team Tommy" />
            <span className="text-xs font-medium">Team Tommy</span>
          </div>
          <div className="flex items-center gap-2 text-center">
            <span className="font-display text-lg tabular text-team-tommy">{totals.tommy}</span>
            <span className="text-muted-foreground text-xs">-</span>
            <span className="font-display text-lg tabular text-team-goon">{totals.goon}</span>
          </div>
          <div className="flex items-center gap-2 justify-end text-right">
            <span className="text-xs font-medium">Goon Squad</span>
            <TeamDot team="Goon Squad" />
          </div>
        </div>

        {/* Match list */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_auto_auto_auto_1fr] gap-2 px-2 pb-1 font-label text-[9px] text-muted-foreground">
            <span>Team Tommy</span>
            <span className="text-center w-7">Holes</span>
            <span className="text-center w-6">Thru</span>
            <span className="text-center w-7">Holes</span>
            <span className="text-right">Goon Squad</span>
          </div>
          {summaries.length === 0 && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_1fr] gap-2 items-center bg-muted/20 rounded-lg p-2">
              <div className="flex items-center gap-1.5">
                <TeamDot team="Team Tommy" />
                <span className="text-xs text-muted-foreground">TBD</span>
              </div>
              <span className="text-center tabular text-xs w-7 text-muted-foreground">-</span>
              <span className="text-center text-[10px] w-6 text-muted-foreground">-</span>
              <span className="text-center tabular text-xs w-7 text-muted-foreground">-</span>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-xs text-muted-foreground">TBD</span>
                <TeamDot team="Goon Squad" />
              </div>
            </div>
          ))}
          {summaries.map((m, i) => {
            const tommyNames = m.tommyPlayers.length > 0
              ? m.tommyPlayers.map(p => shortName(p.name)).join(", ")
              : "TBD";
            const goonNames = m.goonPlayers.length > 0
              ? m.goonPlayers.map(p => shortName(p.name)).join(", ")
              : "TBD";
            return (
              <div key={m.match.id} className="grid grid-cols-[1fr_auto_auto_auto_1fr] gap-2 items-center bg-muted/30 rounded-lg p-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <TeamDot team="Team Tommy" />
                    <span className="text-[11px] text-muted-foreground truncate">{tommyNames}</span>
                  </div>
                </div>
                <span className="text-center tabular text-sm font-semibold w-7 text-team-tommy">
                  {m.tommyWins || ""}
                </span>
                <span className="text-center text-[10px] font-label text-muted-foreground w-6">
                  {m.thruHole || "-"}
                </span>
                <span className="text-center tabular text-sm font-semibold w-7 text-team-goon">
                  {m.goonWins || ""}
                </span>
                <div className="min-w-0 text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-[11px] text-muted-foreground truncate">{goonNames}</span>
                    <TeamDot team="Goon Squad" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
