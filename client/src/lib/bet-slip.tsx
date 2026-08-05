import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "./app-context";
import { useCreateBet, useMarketPools, useFreeBetGrantsForPlayer, useRedeemFreeBet } from "./api";
import {
  parimutuelEstPayout,
  parimutuelMultiple,
  multipleToAmerican,
  formatOdds,
  formatMoney,
  isEvenMoneyMarket,
  EVEN_MONEY_LABEL,
} from "@shared/schema";
import type { MarketWithOptions } from "@shared/schema";

type Pending = {
  market: MarketWithOptions;
  optionId: number;
  label: string;
};

type Ctx = {
  open: (p: Pending) => void;
};

const SlipCtx = createContext<Ctx>(null as unknown as Ctx);

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [stake, setStake] = useState<string>("10");
  const [useFreeBet, setUseFreeBet] = useState(false);
  const { player } = useApp();
  const { toast } = useToast();
  const createBet = useCreateBet();
  const redeemFreeBet = useRedeemFreeBet();
  const pools = useMarketPools();
  const { data: freeBetGrants } = useFreeBetGrantsForPlayer(player?.id ?? null);
  const pendingFreeBet = freeBetGrants?.find((g) => g.status === "pending");

  const open = (p: Pending) => {
    if (!player) {
      toast({
        title: "Pick your name first",
        description: "Select your name from the dropdown at the top to place bets.",
        variant: "destructive",
      });
      return;
    }
    setPending(p);
    setUseFreeBet(false);
    if (!stake) setStake("10");
  };

  const applyingFreeBet = useFreeBet && !!pendingFreeBet;
  const stakeNum = applyingFreeBet
    ? (pendingFreeBet!.amountCents / 100)
    : Number(stake) || 0;
  const evenMoney = pending ? isEvenMoneyMarket(pending.market) : false;
  const mp = pending ? pools.get(pending.market.id) : undefined;
  const pool = mp?.pool ?? 0;
  const moneyOnOption =
    (pending ? mp?.perOption.get(pending.optionId) ?? 0 : 0);
  // 2-option markets always settle at even money (see gradeMarket); only
  // genuinely multi-way markets use the shifting parimutuel estimate.
  const estPayout = pending
    ? evenMoney
      ? stakeNum * 2
      : parimutuelEstPayout(stakeNum, pool, moneyOnOption)
    : 0;
  const estProfit = estPayout - stakeNum;
  // Live implied odds for the option right now (before this bet).
  const liveMultiple = parimutuelMultiple(pool, moneyOnOption);

  const submit = () => {
    if (!pending) return;
    if (!player) {
      toast({ title: "Pick your name first", variant: "destructive" });
      return;
    }
    if (stakeNum <= 0) {
      toast({ title: "Enter a stake greater than $0", variant: "destructive" });
      return;
    }

    if (applyingFreeBet) {
      redeemFreeBet.mutate(
        {
          id: pendingFreeBet!.id,
          playerId: player.id,
          marketId: pending.market.id,
          optionId: pending.optionId,
        },
        {
          onSuccess: () => {
            toast({
              title: "Free bet placed",
              description: `$${stakeNum} on ${pending.label} — covered by the book`,
            });
            setPending(null);
            setUseFreeBet(false);
            setStake("10");
          },
          onError: (e: Error) =>
            toast({ title: "Couldn't place free bet", description: e.message, variant: "destructive" }),
        }
      );
      return;
    }

    createBet.mutate(
      {
        playerId: player.id,
        marketId: pending.market.id,
        optionId: pending.optionId,
        stake: stakeNum,
      },
      {
        onSuccess: () => {
          toast({
            title: "Bet placed",
            description: `$${stakeNum} on ${pending.label} — est. payout ${formatMoney(
              estPayout
            )}`,
          });
          setPending(null);
          setStake("10");
        },
        onError: (e: Error) =>
          toast({ title: "Couldn't place bet", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <SlipCtx.Provider value={{ open }}>
      {children}
      <Sheet open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <SheetContent className="w-full sm:max-w-sm flex flex-col gap-4">
          <div className="h-[3px] fairway-stripes -mx-6 mt-0" />
          <SheetHeader>
            <p className="font-label text-[11px] text-muted-foreground">
              Wager Ticket · Parimutuel
            </p>
            <SheetTitle className="font-display">Bet Slip</SheetTitle>
            <SheetDescription>
              {pending?.market.title}
            </SheetDescription>
          </SheetHeader>

          {pending && (
            <>
              <div className="ticket p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{pending.label}</p>
                  <p className="font-label text-[11px] text-muted-foreground">
                    {pending.market.category}
                  </p>
                </div>
                <span
                  className="stamp text-primary text-[10px] shrink-0"
                  data-testid="text-slip-odds"
                >
                  {evenMoney
                    ? EVEN_MONEY_LABEL
                    : liveMultiple
                      ? `${formatOdds(multipleToAmerican(liveMultiple))} live`
                      : "first in"}
                </span>
              </div>

              {pendingFreeBet && (
                <div className="flex items-start gap-2.5 border border-accent/40 bg-accent/5 rounded-lg p-3">
                  <Checkbox
                    id="use-free-bet"
                    checked={useFreeBet}
                    onCheckedChange={(v) => setUseFreeBet(v === true)}
                    data-testid="checkbox-use-free-bet"
                  />
                  <Label htmlFor="use-free-bet" className="text-sm leading-snug cursor-pointer">
                    Use your free ${(pendingFreeBet.amountCents / 100).toFixed(0)} bet — comped, covered by betFranklin the player's book.
                  </Label>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="stake" className="font-label text-[11px] text-muted-foreground">
                  Stake ($)
                </Label>
                <Input
                  id="stake"
                  type="number"
                  min={1}
                  step={1}
                  value={applyingFreeBet ? stakeNum : stake}
                  onChange={(e) => setStake(e.target.value)}
                  disabled={applyingFreeBet}
                  data-testid="input-stake"
                />
              </div>

              <div className="border border-dashed border-border bg-muted/40 p-3 space-y-1 text-sm">
                <Row label="Stake" value={formatMoney(stakeNum)} />
                <Row label="Est. profit" value={formatMoney(estProfit)} />
                <div className="h-[2px] pinstripes opacity-50 my-1.5" />
                <Row
                  label="Est. payout if it hits"
                  value={formatMoney(estPayout)}
                  bold
                />
                <p className="text-[11px] leading-snug text-muted-foreground pt-1">
                  {evenMoney
                    ? "Even money: doubles your stake if it hits. If the two sides aren't balanced when betting closes, the book covers the gap or the excess is refunded."
                    : "Parimutuel: final payout depends on the pool when betting closes. Shown number is a live estimate."}
                </p>
              </div>

              <Button
                onClick={submit}
                disabled={createBet.isPending || redeemFreeBet.isPending || !player}
                className="w-full font-label tracking-wide"
                data-testid="button-place-bet"
              >
                {createBet.isPending || redeemFreeBet.isPending
                  ? "Placing..."
                  : player
                    ? applyingFreeBet
                      ? `Place free bet as ${player.name}`
                      : `Place bet as ${player.name}`
                    : "Pick your name first"}
              </Button>
              {!player && (
                <p className="text-xs text-muted-foreground text-center">
                  Choose your name from the top bar to place bets.
                </p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </SlipCtx.Provider>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-label text-[11px] text-muted-foreground">{label}</span>
      <span className={`tabular ${bold ? "font-display" : ""}`}>{value}</span>
    </div>
  );
}

export function useBetSlip() {
  return useContext(SlipCtx);
}
