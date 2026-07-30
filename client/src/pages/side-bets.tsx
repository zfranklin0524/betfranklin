import { useState } from "react";
import { useSideBets, useCreateSideBet, useAcceptSideBet, useSettleSideBet, useVoidSideBet, usePlayers } from "@/lib/api";
import { formatMoney, type SideBetWithContext } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/lib/app-context";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Handshake, Plus, Check, X, Trophy } from "lucide-react";

const statusStyles: Record<string, string> = {
  proposed: "bg-muted text-muted-foreground",
  accepted: "bg-accent/15 text-accent",
  settled: "bg-win/15 text-win",
  void: "bg-loss/15 text-loss",
};

const statusLabels: Record<string, string> = {
  proposed: "Proposed",
  accepted: "Accepted",
  settled: "Settled",
  void: "Void",
};

export default function SideBetsPage() {
  const { data: sideBets, isLoading } = useSideBets();
  const { player, isAdmin } = useApp();
  const createBet = useCreateSideBet();
  const acceptBet = useAcceptSideBet();
  const settleBet = useSettleSideBet();
  const voidBet = useVoidSideBet();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [settleTarget, setSettleTarget] = useState<SideBetWithContext | null>(null);

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;

  const bets = sideBets ?? [];
  const active = bets.filter((b) => b.status === "proposed" || b.status === "accepted");
  const settled = bets.filter((b) => b.status === "settled" || b.status === "void");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-xl flex items-center gap-2">
            <span className="text-accent">★</span> Side Bets
          </h1>
          <p className="text-sm text-muted-foreground">
            Freeform prop bets between players. Settle in cash or add to ledger.
          </p>
        </div>
        {player && (
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-new-side-bet">
            <Plus className="w-4 h-4 mr-1" /> New Bet
          </Button>
        )}
      </div>

      {!player && (
        <div className="text-sm text-muted-foreground bg-muted/40 px-3 py-2 rounded-lg">
          Pick your name in the header to create or accept side bets.
        </div>
      )}

      {/* Active bets */}
      {active.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-label text-[11px] text-muted-foreground uppercase tracking-wider">Active</h2>
          {active.map((bet) => (
            <SideBetCard
              key={bet.id}
              bet={bet}
              currentPlayerId={player?.id ?? null}
              isAdmin={isAdmin}
              onAccept={() => acceptBet.mutate(bet.id)}
              onSettle={() => setSettleTarget(bet)}
              onVoid={() => voidBet.mutate(bet.id)}
            />
          ))}
        </div>
      )}

      {/* Settled/voided */}
      {settled.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-label text-[11px] text-muted-foreground uppercase tracking-wider">History</h2>
          {settled.map((bet) => (
            <SideBetCard
              key={bet.id}
              bet={bet}
              currentPlayerId={player?.id ?? null}
              isAdmin={isAdmin}
              onAccept={() => {}}
              onSettle={() => {}}
              onVoid={() => {}}
            />
          ))}
        </div>
      )}

      {bets.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Handshake className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No side bets yet. Create one to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <CreateSideBetDialog open={showCreate} onOpenChange={setShowCreate} />

      {/* Settle dialog */}
      {settleTarget && (
        <SettleDialog
          bet={settleTarget}
          onClose={() => setSettleTarget(null)}
          onSettle={(winnerId) => {
            settleBet.mutate({ id: settleTarget.id, winnerId });
            setSettleTarget(null);
          }}
        />
      )}
    </div>
  );
}

function SideBetCard({ bet, currentPlayerId, isAdmin, onAccept, onSettle, onVoid }: {
  bet: SideBetWithContext;
  currentPlayerId: number | null;
  isAdmin: boolean;
  onAccept: () => void;
  onSettle: () => void;
  onVoid: () => void;
}) {
  const canAccept = bet.status === "proposed" && bet.opponent.id === currentPlayerId;
  const canSettle = isAdmin && bet.status === "accepted";
  const canVoid = isAdmin && (bet.status === "proposed" || bet.status === "accepted");

  return (
    <Card data-testid={`card-side-bet-${bet.id}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm leading-tight">{bet.title}</h3>
            {bet.terms && <p className="text-xs text-muted-foreground mt-0.5">{bet.terms}</p>}
          </div>
          <span className={`text-[11px] font-label px-2 py-0.5 rounded-full shrink-0 ${statusStyles[bet.status]}`}>
            {statusLabels[bet.status]}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="font-medium truncate">{bet.creator.name}</span>
            <span className="text-muted-foreground shrink-0">vs</span>
            <span className="font-medium truncate">{bet.opponent.name}</span>
          </div>
          <span className="font-display tabular shrink-0">{formatMoney(bet.stakeCents / 100)}</span>
        </div>
        {bet.winner && (
          <div className="flex items-center gap-1 text-sm text-win mt-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>{bet.winner.name} won</span>
          </div>
        )}
        {(canAccept || canSettle || canVoid) && (
          <div className="flex gap-2 mt-3">
            {canAccept && (
              <Button size="sm" onClick={onAccept} data-testid={`button-accept-${bet.id}`}>
                <Check className="w-3.5 h-3.5 mr-1" /> Accept
              </Button>
            )}
            {canSettle && (
              <Button size="sm" variant="outline" onClick={onSettle} data-testid={`button-settle-${bet.id}`}>
                <Trophy className="w-3.5 h-3.5 mr-1" /> Settle
              </Button>
            )}
            {canVoid && (
              <Button size="sm" variant="ghost" onClick={onVoid} data-testid={`button-void-${bet.id}`}>
                <X className="w-3.5 h-3.5 mr-1" /> Void
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateSideBetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: players } = usePlayers();
  const { player } = useApp();
  const createBet = useCreateSideBet();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [opponentId, setOpponentId] = useState<string>("");
  const [stake, setStake] = useState("");

  const handleSubmit = () => {
    if (!player || !opponentId || !title.trim() || !stake) {
      toast({ title: "Fill in all fields", variant: "destructive" });
      return;
    }
    const stakeNum = parseFloat(stake);
    if (isNaN(stakeNum) || stakeNum <= 0) {
      toast({ title: "Invalid stake amount", variant: "destructive" });
      return;
    }
    createBet.mutate({
      title: title.trim(),
      terms: terms.trim() || undefined,
      creatorId: player.id,
      opponentId: Number(opponentId),
      stakeCents: Math.round(stakeNum * 100),
    });
    setTitle("");
    setTerms("");
    setOpponentId("");
    setStake("");
    onOpenChange(false);
    toast({ title: "Side bet proposed" });
  };

  const opponents = (players ?? []).filter((p) => p.id !== player?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Side Bet</DialogTitle>
          <DialogDescription>Propose a bet against another player.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sb-title">Title</Label>
            <Input id="sb-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Closest drive on Hole 1" data-testid="input-sb-title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-terms">Terms (optional)</Label>
            <Textarea id="sb-terms" value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Any details about the bet..." data-testid="input-sb-terms" />
          </div>
          <div className="space-y-1.5">
            <Label>Opponent</Label>
            <Select value={opponentId} onValueChange={setOpponentId}>
              <SelectTrigger data-testid="select-sb-opponent"><SelectValue placeholder="Pick opponent..." /></SelectTrigger>
              <SelectContent>
                {opponents.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sb-stake">Stake ($)</Label>
            <Input id="sb-stake" type="number" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="20" data-testid="input-sb-stake" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} data-testid="button-submit-sb">Propose Bet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettleDialog({ bet, onClose, onSettle }: {
  bet: SideBetWithContext;
  onClose: () => void;
  onSettle: (winnerId: number) => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settle: {bet.title}</DialogTitle>
          <DialogDescription>
            {bet.creator.name} vs {bet.opponent.name} — {formatMoney(bet.stakeCents / 100)}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" onClick={() => onSettle(bet.creatorId)} data-testid="button-winner-creator">
            <Trophy className="w-4 h-4 mr-1" /> {bet.creator.name}
          </Button>
          <Button variant="outline" onClick={() => onSettle(bet.opponentId)} data-testid="button-winner-opponent">
            <Trophy className="w-4 h-4 mr-1" /> {bet.opponent.name}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
