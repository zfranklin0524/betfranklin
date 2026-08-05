import { useApp } from "@/lib/app-context";
import { usePlayerBets, useVoidBet, useCashOut, useMarketPools, useFreeBetGrantsForPlayer, useMarkets } from "@/lib/api";
import {
  formatMoney,
  formatOdds,
  betNet,
  parimutuelMultiple,
  multipleToAmerican,
  parimutuelEstPayout,
  isEvenMoneyMarket,
  EVEN_MONEY_LABEL,
  type BetWithContext,
} from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { HandCoins } from "lucide-react";

const statusMeta: Record<
  string,
  { label: string; className: string }
> = {
  open: { label: "Open", className: "text-primary" },
  won: { label: "Won", className: "text-win" },
  lost: { label: "Lost", className: "text-loss" },
  void: { label: "Void", className: "text-muted-foreground" },
};

export default function MyBets() {
  const { player } = useApp();
  const { data: bets, isLoading } = usePlayerBets(player?.id ?? null);
  const { data: freeBetGrants } = useFreeBetGrantsForPlayer(player?.id ?? null);
  const { data: markets } = useMarkets();
  const freeBetIds = new Set(
    (freeBetGrants ?? [])
      .filter((g) => g.status === "used" && g.betId != null)
      .map((g) => g.betId as number)
  );
  const evenMoneyMarketIds = new Set(
    (markets ?? []).filter((m) => isEvenMoneyMarket(m)).map((m) => m.id)
  );

  if (!player) {
    return (
      <Empty
        title="Pick your name"
        body="Choose your name from the top bar to see your bets."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const mine = bets ?? [];
  const grouped = {
    open: mine.filter((b) => b.status === "open"),
    settled: mine.filter((b) => b.status !== "open"),
  };
  const realized = mine.reduce((sum, b) => sum + betNet(b), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl flex items-center gap-2">
            <span className="text-accent">★</span> {player.name}'s Bets
          </h1>
          <p className="text-sm text-muted-foreground">
            {mine.length} bet{mine.length === 1 ? "" : "s"} placed
          </p>
        </div>
        <div className="text-right">
          <p className="font-label text-[11px] text-muted-foreground">Realized P/L</p>
          <p
            className={`font-display text-xl tabular ${
              realized > 0 ? "text-win" : realized < 0 ? "text-loss" : ""
            }`}
          >
            {realized > 0 ? "+" : ""}
            {formatMoney(realized)}
          </p>
        </div>
      </div>

      <section>
        <h2 className="font-label text-xs text-muted-foreground mb-2 flex items-center gap-2">
          <span className="h-[2px] w-4 pinstripes opacity-60" /> Open
        </h2>
        {grouped.open.length === 0 ? (
          <Empty title="No open bets" body="Head to the markets to place one." small />
        ) : (
          <div className="space-y-2">
            {grouped.open.map((b) => (
              <BetRow key={b.id} bet={b} isFreeBet={freeBetIds.has(b.id)} evenMoney={evenMoneyMarketIds.has(b.marketId)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-label text-xs text-muted-foreground mb-2 flex items-center gap-2">
          <span className="h-[2px] w-4 pinstripes opacity-60" /> Settled
        </h2>
        {grouped.settled.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing settled yet.</p>
        ) : (
          <div className="space-y-2">
            {grouped.settled.map((b) => (
              <BetRow key={b.id} bet={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BetRow({ bet, isFreeBet, evenMoney }: { bet: BetWithContext; isFreeBet?: boolean; evenMoney?: boolean }) {
  const voidBet = useVoidBet();
  const cashOut = useCashOut();
  const { isAdmin, player } = useApp();
  const pools = useMarketPools();
  const meta = statusMeta[bet.status] ?? statusMeta.open;
  const net = betNet(bet);
  const won = bet.status === "won";
  const lost = bet.status === "lost";
  const isOpen = bet.status === "open";
  const isBook = !!bet.isBook;
  // A win that nets $0 means the bettor was the only winner (no losing pool to
  // fund profit) — still a win, just stake returned. Show "Won", not "Push".
  const evenWin = won && Math.abs(net) < 0.005;

  // Cash-out (refund) is available on the player's own open, non-book bets
  // before the market's cash-out lock time. Free bets are excluded — they're
  // a comp, not the player's own money, and cashing out would leave the
  // book's matching cover bet dangling with no counterpart.
  const lockMs = bet.market.cashOutLockAt
    ? new Date(bet.market.cashOutLockAt).getTime()
    : NaN;
  const lockFuture = Number.isFinite(lockMs) && Date.now() < lockMs;
  const canCashOut =
    isOpen && !isBook && !isFreeBet && !!player && player.id === bet.playerId && lockFuture;

  // Live parimutuel estimate for open bets.
  const pool = isOpen ? pools.get(bet.marketId) : undefined;
  const totalPool = pool?.pool ?? 0;
  const moneyOnOption = pool?.perOption.get(bet.optionId) ?? 0;
  const estPayout = isOpen
    ? evenMoney
      ? bet.stake * 2
      : parimutuelEstPayout(bet.stake, totalPool, moneyOnOption)
    : bet.payout;
  const liveMultiple = parimutuelMultiple(totalPool, moneyOnOption);
  const liveOdds = evenMoney
    ? EVEN_MONEY_LABEL
    : liveMultiple
      ? formatOdds(multipleToAmerican(liveMultiple))
      : null;

  return (
    <div className="ticket p-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`stamp text-[10px] ${meta.className}`}>
            {meta.label}
          </span>
          {isFreeBet && (
            <span className="stamp text-[10px] text-accent">Free bet</span>
          )}
          <span className="font-label text-[11px] text-muted-foreground truncate">
            {bet.market.category}
          </span>
        </div>
        <p className="text-sm font-medium leading-tight truncate">
          {bet.market.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Pick: <span className="text-foreground font-medium">{isBook ? "Book fill (even money)" : bet.option.label}</span>{" "}
          {isOpen && liveOdds && (
            <span className="font-label">({evenMoney ? liveOdds : `${liveOdds} live`})</span>
          )}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="font-label text-[11px] text-muted-foreground">Risk {formatMoney(bet.stake)}</p>
        {isOpen && (
          <p className="font-label text-[11px] text-muted-foreground">
            Est. to win {formatMoney(estPayout - bet.stake)}
          </p>
        )}
        {(won || lost) && (
          <p
            className={`font-display tabular text-sm ${
              evenWin ? "text-muted-foreground" : won ? "text-win" : "text-loss"
            }`}
          >
            {evenWin ? "Stake returned" : `${net > 0 ? "+" : ""}${formatMoney(net)}`}
          </p>
        )}
        {bet.status === "void" && (
          <p className="font-label text-[11px] text-muted-foreground">Refunded</p>
        )}
      </div>

      {canCashOut && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 font-label"
          onClick={() =>
            cashOut.mutate({ id: bet.id, playerId: bet.playerId })
          }
          disabled={cashOut.isPending}
          data-testid={`button-cashout-${bet.id}`}
        >
          Cash out
        </Button>
      )}

      {isAdmin && isOpen && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-8 font-label"
          onClick={() => voidBet.mutate(bet.id)}
          data-testid={`button-void-${bet.id}`}
        >
          Void
        </Button>
      )}
    </div>
  );
}

function Empty({
  title,
  body,
  small,
}: {
  title: string;
  body: string;
  small?: boolean;
}) {
  return (
    <Card>
      <CardContent className={small ? "py-6 text-center" : "py-12 text-center"}>
        {!small && <HandCoins className="w-8 h-8 mx-auto text-muted-foreground mb-2" />}
        <p className="font-display">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
