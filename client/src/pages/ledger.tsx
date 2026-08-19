import { useMemo } from "react";
import { useStandings } from "@/lib/api";
import { formatMoney, type PlayerStanding } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Crown, ArrowRight } from "lucide-react";
import { TeamDot } from "@/components/team-badge";

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export default function Ledger() {
  const { data: standings, isLoading } = useStandings();

  const settlements = useMemo(() => computeSettlements(standings ?? []), [standings]);

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  const list = standings ?? [];
  const totalPot = list.reduce((s, p) => s + Math.max(0, p.staked), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl flex items-center gap-2">
            <span className="text-accent">★</span> Weekend Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Net positions across all graded bets. Settle in person.
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Buy-In credits back the $100 for anyone who paid it, on top of their pool winnings — $2,400 once all 24 have paid.
          </p>
        </div>
        <div className="text-right">
          <p className="font-label text-[11px] text-muted-foreground">Total Wagered</p>
          <p className="font-display text-xl tabular">{formatMoney(totalPot)}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-[1fr_4fr_2fr_2fr_2fr_1fr_2fr] gap-2 px-4 py-2 font-label text-[11px] text-muted-foreground border-b-2 border-border">
            <div>#</div>
            <div>Player</div>
            <div className="text-right">Bets Net</div>
            <div className="text-right">Pool Net</div>
            <div className="text-right">Buy-In</div>
            <div className="text-right">Stk</div>
            <div className="text-right">Total</div>
          </div>
          <ol className="divide-y divide-border">
            {list.map((s, i) => (
              <li
                key={s.player.id}
                className="grid grid-cols-[1fr_4fr_2fr_2fr_2fr_1fr_2fr] gap-2 px-4 py-2.5 items-center text-sm"
              >
                <div className="tabular text-muted-foreground flex items-center gap-1">
                  {i + 1}
                </div>
                <div className="font-medium flex items-center gap-1.5 min-w-0">
                  <TeamDot team={s.player.team} />
                  {s.player.id === 14 && (
                    <Crown className="w-3.5 h-3.5 text-accent shrink-0" data-testid="icon-king" title="Reigning King of the West" />
                  )}
                  {(s.player.id === 1 || s.player.id === 13) && (
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-accent/15 text-accent text-[9px] font-bold shrink-0" title="Captain">C</span>
                  )}
                  <div className="min-w-0 overflow-hidden">
                    <span className="leading-tight block text-xs">{shortName(s.player.name)}</span>
                    {(s.wins > 0 || s.losses > 0 || s.refunded > 0) && (
                      <span className="font-label text-[10px] text-muted-foreground">
                        {s.wins}W–{s.losses}L
                        {s.refunded > 0 ? ` · ${s.refunded} refunded` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`text-right tabular ${s.net > 0 ? "text-win" : s.net < 0 ? "text-loss" : "text-muted-foreground"}`}>
                  {s.net > 0 ? "+" : ""}{formatMoney(s.net)}
                </div>
                <div className={`text-right tabular ${s.potNet > 0 ? "text-win" : s.potNet < 0 ? "text-loss" : "text-muted-foreground"}`}>
                  {s.potNet > 0 ? "+" : ""}{formatMoney(s.potNet)}
                </div>
                <div className={`text-right tabular ${s.buyInPaid > 0 ? "text-win" : "text-muted-foreground"}`}>
                  {s.buyInPaid > 0 ? "+" : ""}{formatMoney(s.buyInPaid)}
                </div>
                <div className={`text-right tabular text-muted-foreground`}>
                  {formatMoney(s.staked)}
                </div>
                <div className={`text-right tabular font-semibold ${s.totalNet > 0 ? "text-win" : s.totalNet < 0 ? "text-loss" : ""}`}>
                  {s.totalNet > 0 ? "+" : ""}{formatMoney(s.totalNet)}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {settlements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg flex items-center gap-2">
                <span className="text-accent">★</span> Settle Up
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="font-label"
                onClick={() => {
                  const text = settlements
                    .map((t) => `${t.from} pays ${t.to} ${formatMoney(t.amount)}`)
                    .join("\n");
                  copyText(text);
                }}
              >
                Copy list
              </Button>
            </div>
            <p className="font-label text-[11px] text-muted-foreground mb-3">
              Minimal transfers so everyone ends even. Open bets aren't included.
            </p>
            <ul className="space-y-2">
              {settlements.map((t, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm border border-dashed border-border bg-muted/40 px-3 py-2"
                >
                  <span className="font-medium">{t.from}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{t.to}</span>
                  <span className="ml-auto tabular font-display">{formatMoney(t.amount)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function copyText(t: string) {
  try {
    navigator.clipboard?.writeText(t);
  } catch {
    /* ignore */
  }
}

interface Transfer {
  from: string;
  to: string;
  amount: number;
}

// Greedy settle: debtors pay creditors until everyone nets to zero.
function computeSettlements(standings: PlayerStanding[]): Transfer[] {
  const debtors = standings
    .filter((s) => s.totalNet < 0)
    .map((s) => ({ name: s.player.name, amount: -s.totalNet }));
  const creditors = standings
    .filter((s) => s.totalNet > 0)
    .map((s) => ({ name: s.player.name, amount: s.totalNet }));

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0.005) {
      transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: pay });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.005) i++;
    if (creditors[j].amount < 0.005) j++;
  }
  return transfers;
}
