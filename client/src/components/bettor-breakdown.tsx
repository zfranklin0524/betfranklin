import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useBets } from "@/lib/api";
import { formatMoney, type MarketWithOptions } from "@shared/schema";

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export function BettorBreakdown({ market }: { market: MarketWithOptions }) {
  const { data: bets } = useBets();
  const [expanded, setExpanded] = useState(false);
  const marketBets = (bets ?? []).filter(
    (b) => b.marketId === market.id && b.status === "open"
  );
  if (marketBets.length === 0) return null;

  const totalStake = marketBets.reduce((s, b) => s + b.stake, 0);
  const bettorCount = new Set(marketBets.map((b) => b.player.id)).size;

  return (
    <div className="rounded-md border border-border/60 bg-muted/20">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-left"
        data-testid={`button-toggle-action-${market.id}`}
      >
        <span className="flex items-center gap-1 font-label text-[9px] text-muted-foreground uppercase tracking-wide">
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          Action
        </span>
        <span className="font-label text-[10px] text-muted-foreground">
          {bettorCount} {bettorCount === 1 ? "bettor" : "bettors"} ·{" "}
          {formatMoney(totalStake)}
        </span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5">
          {market.options.map((o) => {
            const sideBets = marketBets.filter((b) => b.optionId === o.id);
            if (sideBets.length === 0) return null;
            const sideTotal = sideBets.reduce((s, b) => s + b.stake, 0);
            return (
              <div key={o.id} className="space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-medium truncate">
                    {o.label}
                  </span>
                  <span className="font-label text-[10px] text-muted-foreground">
                    {formatMoney(sideTotal)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-1.5">
                  {sideBets.map((b) => (
                    <span
                      key={b.id}
                      className={`text-[10px] ${
                        b.isBook
                          ? "text-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {b.isBook ? "Book" : shortName(b.player.name)}{" "}
                      <span className="font-label">
                        {formatMoney(b.stake)}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
