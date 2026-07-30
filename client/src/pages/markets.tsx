import { useState } from "react";
import { ChevronDown, ChevronUp, Lock, CheckCircle2 } from "lucide-react";
import { useBetSlip } from "@/lib/bet-slip";
import { useMarketPools, usePlayers, useMarkets } from "@/lib/api";
import {
  parimutuelMultiple,
  multipleToAmerican,
  formatOdds,
  formatMoney,
} from "@shared/schema";
import type { MarketWithOptions } from "@shared/schema";
import { TeamDot } from "@/components/team-badge";
import { BettorBreakdown } from "@/components/bettor-breakdown";

export default function MarketsPage() {
  const { data: markets } = useMarkets();
  const pools = useMarketPools();

  return (
    <div className="px-3 sm:px-4 py-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg">★ Open Markets</h2>
      </div>
      <p className="text-[12px] text-muted-foreground -mt-1 mb-2">
        Tap an outcome to place a bet. Odds are live parimutuel prices — they
        shift as the pool fills.
      </p>
      {(markets ?? []).map((m: MarketWithOptions) => (
        <MarketCard key={m.id} market={m} pool={pools.get(m.id)} />
      ))}
    </div>
  );
}

function MarketCard({
  market,
  pool,
}: {
  market: MarketWithOptions;
  pool?: { pool: number; perOption: Map<number, number> };
}) {
  const [expanded, setExpanded] = useState(market.status === "open");
  const { open } = useBetSlip();
  const { data: players } = usePlayers();

  const totalPool = pool?.pool ?? 0;

  const teamOf = (label: string) => {
    if (label === "Team Tommy") return "Team Tommy";
    if (label === "Goon Squad") return "Goon Squad";
    if (label === "Tie") return null;
    return null;
  };

  const teamForLabel = (label: string) => {
    if (teamOf(label)) return label;
    return players?.find((p) => p.name === label)?.team ?? null;
  };

  const statusBadge =
    market.status === "open" ? (
      <span className="stamp text-win text-[10px]">Open</span>
    ) : market.status === "graded" ? (
      <span className="stamp text-win text-[10px] gap-1">
        <CheckCircle2 className="w-3 h-3" /> Graded
      </span>
    ) : (
      <span className="stamp text-muted-foreground text-[10px] gap-1">
        <Lock className="w-3 h-3" /> Closed
      </span>
    );

  return (
    <div className="ticket overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
        data-testid={`button-toggle-market-${market.id}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-label text-[11px] text-muted-foreground">
              {market.category}
            </span>
            {statusBadge}
            <span className="stamp text-primary text-[10px]">
              Pool {formatMoney(totalPool)}
            </span>
          </div>
          <h3 className="font-display leading-tight">{market.title}</h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="divide-y divide-dashed divide-border border-t-2 border-dashed border-border">
          {market.options.map((o) => {
            const isWinner = market.winnerOptionIds.includes(o.id);
            const canBet = market.status === "open";
            const moneyOnOption = pool?.perOption.get(o.id) ?? 0;
            const multiple = parimutuelMultiple(totalPool, moneyOnOption);
            const liveOdds = multiple ? formatOdds(multipleToAmerican(multiple)) : "—";
            return canBet ? (
              <button
                key={o.id}
                className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/40 transition-colors"
                onClick={() =>
                  open({
                    market,
                    optionId: o.id,
                    label: o.label,
                  })
                }
                data-testid={`button-bet-${o.id}`}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <TeamDot team={teamForLabel(o.label)} />
                    <span className="truncate text-sm">{o.label}</span>
                  </div>
                  <span className="font-label text-[11px] text-muted-foreground mt-0.5">
                    {moneyOnOption > 0
                      ? `${formatMoney(moneyOnOption)} in`
                      : "no action yet"}
                  </span>
                </div>
                <span className="font-label text-sm shrink-0 tabular border border-border rounded-md px-2.5 py-1.5 bg-card">
                  {liveOdds}
                </span>
              </button>
            ) : (
              <div
                key={o.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    {isWinner && <CheckCircle2 className="w-4 h-4 text-win shrink-0" />}
                    <TeamDot team={teamForLabel(o.label)} />
                    <span
                      className={`truncate text-sm ${
                        isWinner ? "font-semibold text-win" : ""
                      }`}
                    >
                      {o.label}
                    </span>
                  </div>
                  <span className="font-label text-[11px] text-muted-foreground mt-0.5">
                    {moneyOnOption > 0
                      ? `${formatMoney(moneyOnOption)} in`
                      : "no action yet"}
                  </span>
                </div>
                <span
                  className={`font-label text-sm shrink-0 tabular ${
                    isWinner ? "text-win font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {isWinner ? "WINNER" : liveOdds}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {expanded && (
        <div className="px-3 pb-3">
          <BettorBreakdown market={market} />
        </div>
      )}
    </div>
  );
}
