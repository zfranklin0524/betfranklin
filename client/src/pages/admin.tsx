import { useState, useEffect } from "react";
import { useApp } from "@/lib/app-context";
import {
  usePlayers,
  useMarkets,
  useBets,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  useCreateMarket,
  useUpdateMarket,
  useDeleteMarket,
  useGradeMarket,
  useBookFill,
  useRemoveBookFill,
  useVoidBet,
  useVoidMarket,
  useReseedPlayers,
  useMarketPools,
  useScores,
  useSetScore,
  usePots,
  useFundPots,
  useFinalizeTeamPot,
  useFinalizeSkins,
  useManualSkinsPayout,
  useScrambleUnits,
  useCreateScrambleUnit,
  useDeleteScrambleUnit,
  useHoleScores,
  useUpsertHoleScore,
  useCTPHoles,
  useCreateCTPHole,
  useAddCTPEntry,
  useDeleteCTPEntry,
  useSetCTPWinners,
  useFinalizeCTPHole,
  useTeamPoints,
  useUpsertTeamPoints,
  useMatchSummaries,
  useScoreTokens,
  useGenerateToken,
  useGrantFreeBet,
  type MarketPool,
} from "@/lib/api";
import {
  formatMoney,
  parimutuelMultiple,
  multipleToAmerican,
  formatOdds,
  BOOK_PLAYER_NAME,
  type MarketWithOptions,
  type BetWithContext,
  type RoundScore,
  type PotSummary,
  type ScrambleUnitWithMembers,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/team-badge";
import { BettorBreakdown } from "@/components/bettor-breakdown";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Lock, Unlock, CheckCircle2, Clock, DollarSign, Trophy, Target, Layers, Users, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts[parts.length - 1]}`;
}

export default function Admin() {
  const { isAdmin } = useApp();
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-display">Admin only</p>
          <p className="text-sm text-muted-foreground">
            Tap the shield in the top bar and enter the PIN.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl flex items-center gap-2">
          <span className="text-accent">★</span> Commissioner
        </h1>
        <p className="text-sm text-muted-foreground">Manage roster, markets, and settlements.</p>
      </div>
      <Tabs defaultValue="markets">
        <TabsList className="flex flex-wrap gap-1 w-full h-auto">
          <TabsTrigger value="markets" className="font-label">Markets</TabsTrigger>
          <TabsTrigger value="bets" className="font-label">Bets</TabsTrigger>
          <TabsTrigger value="roster" className="font-label">Roster</TabsTrigger>
          <TabsTrigger value="settle" className="font-label">Settle</TabsTrigger>
          <TabsTrigger value="scores" className="font-label">Scores</TabsTrigger>
          <TabsTrigger value="pots" className="font-label">Pots</TabsTrigger>
          <TabsTrigger value="units" className="font-label">Units</TabsTrigger>
          <TabsTrigger value="ctp" className="font-label">CTP</TabsTrigger>
          <TabsTrigger value="results" className="font-label">Results</TabsTrigger>
          <TabsTrigger value="matches" className="font-label">Matches</TabsTrigger>
        </TabsList>
        <TabsContent value="markets" className="mt-4 space-y-4">
          <CreateMarket />
          <MarketAdminList />
        </TabsContent>
        <TabsContent value="bets" className="mt-4 space-y-4">
          <GrantFreeBet />
          <BetsAdmin />
        </TabsContent>
        <TabsContent value="roster" className="mt-4 space-y-4">
          <RosterAdmin />
        </TabsContent>
        <TabsContent value="settle" className="mt-4 space-y-4">
          <SettleList />
        </TabsContent>
        <TabsContent value="scores" className="mt-4 space-y-4">
          <ScoresAdmin />
        </TabsContent>
        <TabsContent value="pots" className="mt-4 space-y-4">
          <PotsAdmin />
        </TabsContent>
        <TabsContent value="units" className="mt-4 space-y-4">
          <UnitsAdmin />
        </TabsContent>
        <TabsContent value="ctp" className="mt-4 space-y-4">
          <CTPAdmin />
        </TabsContent>
        <TabsContent value="results" className="mt-4 space-y-4">
          <ResultsAdmin />
        </TabsContent>
        <TabsContent value="matches" className="mt-4 space-y-4">
          <MatchesAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Create market ---------- */
function CreateMarket() {
  const create = useCreateMarket();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Props");
  const [options, setOptions] = useState([{ label: "" }, { label: "" }]);

  const update = (i: number, patch: Partial<{ label: string }>) =>
    setOptions((arr) => arr.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const submit = () => {
    if (!title.trim() || options.some((o) => !o.label.trim())) {
      toast({ title: "Add a title and all option labels", variant: "destructive" });
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        category: category.trim() || "Props",
        options: options.map((o) => ({ label: o.label.trim() })),
      },
      {
        onSuccess: () => {
          toast({ title: "Market created" });
          setTitle("");
          setOptions([{ label: "" }, { label: "" }]);
        },
        onError: (e: Error) =>
          toast({ title: "Failed", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className="font-display">New Market</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Closest to the Pin — 14th" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Props" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Outcomes (parimutuel — odds set by the pool, no line needed)</Label>
          {options.map((o, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={o.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder={`Outcome ${i + 1}`}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOptions((arr) => arr.filter((_, idx) => idx !== i))}
                disabled={options.length <= 2}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setOptions((arr) => [...arr, { label: "" }])}
          >
            <Plus className="w-4 h-4" /> Add outcome
          </Button>
        </div>
        <Button onClick={submit} disabled={create.isPending} className="w-full">
          Create market
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------- Market admin list ---------- */
function MarketAdminList() {
  const { data: markets } = useMarkets();
  const pools = useMarketPools();
  return (
    <div className="space-y-3">
      {(markets ?? []).map((m) => (
        <MarketAdminCard key={m.id} market={m} pool={pools.get(m.id)} />
      ))}
    </div>
  );
}

function MarketAdminCard({
  market,
  pool,
}: {
  market: MarketWithOptions;
  pool?: MarketPool;
}) {
  const update = useUpdateMarket();
  const del = useDeleteMarket();
  const voidMarket = useVoidMarket();
  const { toast } = useToast();
  const totalPool = pool?.pool ?? 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-label text-[11px] text-muted-foreground">
                {market.category}
              </span>
              <Badge variant="secondary" className="border-0">{market.status}</Badge>
            </div>
            <h3 className="font-display text-sm">{market.title}</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              voidMarket.mutate(market.id);
              toast({ title: "Market voided — all open bets refunded" });
            }}
            disabled={market.status !== "open"}
            aria-label="Void market"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              del.mutate(market.id);
              toast({ title: "Market deleted" });
            }}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        {market.status !== "graded" && (
          <div className="flex flex-wrap gap-2">
            {market.status === "open" ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => update.mutate({ id: market.id, data: { status: "closed" } })}
              >
                <Lock className="w-3.5 h-3.5" /> Close betting
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => update.mutate({ id: market.id, data: { status: "open" } })}
              >
                <Unlock className="w-3.5 h-3.5" /> Reopen
              </Button>
            )}
          </div>
        )}

        {market.status !== "graded" && (
          <div className="rounded-lg border border-border divide-y divide-border">
            {market.options.map((o) => {
              const money = pool?.perOption.get(o.id) ?? 0;
              const multiple = parimutuelMultiple(totalPool, money);
              const liveOdds = multiple
                ? formatOdds(multipleToAmerican(multiple))
                : "—";
              return (
                <div key={o.id} className="flex items-center justify-between gap-2 p-2">
                  <span className="text-sm truncate">{o.label}</span>
                  <span className="font-label text-[11px] text-muted-foreground text-right">
                    {formatMoney(money)} · {liveOdds}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {market.status !== "graded" && (
          <CashOutLockEditor market={market} />
        )}

        {market.status !== "graded" && (
          <p className="text-xs text-muted-foreground">
            To grade: close betting, then pick the winner in the Settle tab.
          </p>
        )}
        {market.status === "graded" && market.winnerOptionIds.length > 0 && (
          <p className="text-xs text-win flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Winners:{" "}
            {market.winnerOptionIds
              .map((id) => market.options.find((o) => o.id === id)?.label)
              .filter(Boolean)
              .join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Cash-out lock editor ---------- */
function CashOutLockEditor({ market }: { market: MarketWithOptions }) {
  const update = useUpdateMarket();
  const { toast } = useToast();
  // Render the lock time in the user's local timezone inside datetime-local.
  const toLocal = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [value, setValue] = useState(toLocal(market.cashOutLockAt));
  useEffect(() => {
    setValue(toLocal(market.cashOutLockAt));
  }, [market.cashOutLockAt]);
  const dirty = value !== toLocal(market.cashOutLockAt);
  const lockMs = value ? new Date(value).getTime() : NaN;
  const past = Number.isFinite(lockMs) && lockMs <= Date.now();
  const save = () => {
    const iso = value ? new Date(value).toISOString() : null;
    update.mutate(
      { id: market.id, data: { cashOutLockAt: iso } },
      { onSuccess: () => toast({ title: "Cash-out lock updated" }) }
    );
  };
  return (
    <div className="rounded-lg border border-border p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-label text-[11px] text-muted-foreground">
          Cash-out lock (refunds allowed until)
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 min-w-0 h-8 rounded-md border border-input bg-background px-2 text-sm"
          data-testid={`input-cashout-lock-${market.id}`}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 font-label"
          disabled={!dirty || update.isPending}
          onClick={save}
          data-testid={`button-save-lock-${market.id}`}
        >
          Save
        </Button>
      </div>
      {past && value && (
        <p className="text-[11px] text-warning">
          This lock time has already passed — cash-out is closed.
        </p>
      )}
    </div>
  );
}

/* ---------- Roster ---------- */
function RosterAdmin() {
  const { data: players } = usePlayers();
  const create = useCreatePlayer();
  const update = useUpdatePlayer();
  const del = useDeletePlayer();
  const reseed = useReseedPlayers();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-display">Add player</h2>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  create.mutate({ name: name.trim(), active: true });
                  setName("");
                }
              }}
            />
            <Button
              onClick={() => {
                if (!name.trim()) return;
                create.mutate({ name: name.trim(), active: true });
                setName("");
              }}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-display">Roster ({players?.length ?? 0})</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {players?.map((p) => (
              <li key={p.id} className="flex items-center gap-2 p-2">
                <Input
                  defaultValue={p.name}
                  className="h-8"
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== p.name)
                      update.mutate({ id: p.id, data: { name: e.target.value.trim() } });
                  }}
                />
                <Input
                  defaultValue={p.team ?? ""}
                  placeholder="Team"
                  className="h-8 w-32"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (p.team ?? ""))
                      update.mutate({ id: p.id, data: { team: v || null } });
                  }}
                />
                <TeamBadge team={p.team} className="hidden sm:inline-flex" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => update.mutate({ id: p.id, data: { active: !p.active } })}
                >
                  {p.active ? "Active" : "Inactive"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8"
                  onClick={() => del.mutate(p.id)}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-display">Replace roster from list</h2>
          <p className="text-xs text-muted-foreground">
            One per line as <code>Name, Team</code> (team optional). This wipes players,
            markets, and bets, then rebuilds starter markets from the new names.
          </p>
          <textarea
            className="w-full rounded-md border border-border bg-background p-2 text-sm h-32 font-mono"
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Chad Pavlecic, Team Tommy\nZach Franklin, Goon Squad\n..."}
          />
          <Button
            variant="destructive"
            onClick={() => {
              const rows = bulk
                .split("\n")
                .map((l) => l.split(",").map((s) => s.trim()))
                .map((parts) => ({
                  name: parts[0],
                  team: parts[1] || undefined,
                }))
                .filter((r) => r.name);
              if (rows.length === 0) return;
              reseed.mutate(rows, {
                onSuccess: () => {
                  toast({ title: `Roster replaced with ${rows.length} players` });
                  setBulk("");
                },
              });
            }}
          >
            Replace roster ({bulk.split("\n").filter((n) => n.trim()).length} entries)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Bets (admin cancel) ---------- */
/* ---------- Grant free bet (book-covered comp) ---------- */
function GrantFreeBet() {
  const { data: players } = usePlayers();
  const { data: markets } = useMarkets();
  const grant = useGrantFreeBet();
  const { toast } = useToast();
  const [playerId, setPlayerId] = useState<string>("");
  const [marketId, setMarketId] = useState<string>("");
  const [optionId, setOptionId] = useState<string>("");
  const [stake, setStake] = useState("10");

  const openMarkets = (markets ?? []).filter((m) => m.status === "open");
  const market = openMarkets.find((m) => m.id === Number(marketId));

  const submit = () => {
    const stakeDollars = Number(stake);
    if (!playerId || !marketId || !optionId || !(stakeDollars > 0)) return;
    grant.mutate(
      { playerId: Number(playerId), marketId: Number(marketId), optionId: Number(optionId), stakeDollars },
      {
        onSuccess: () => {
          const p = players?.find((p) => p.id === Number(playerId));
          toast({ title: `Free $${stakeDollars} bet granted to ${p?.name ?? "player"} — book covered the other side` });
          setPlayerId("");
          setMarketId("");
          setOptionId("");
          setStake("10");
        },
        onError: (err: any) => toast({ title: "Failed to grant free bet", description: err?.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h2 className="font-display text-sm">Grant Free Bet</h2>
          <p className="text-xs text-muted-foreground">
            Comps a bet — the stake doesn't touch the player's own ledger, and the book instantly takes the other side so it's a real matched wager.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="font-label text-[11px]">Player</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
              <SelectContent>
                {(players ?? []).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-label text-[11px]">Market</Label>
            <Select value={marketId} onValueChange={(v) => { setMarketId(v); setOptionId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select market" /></SelectTrigger>
              <SelectContent>
                {openMarkets.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-label text-[11px]">Option (their pick)</Label>
            <Select value={optionId} onValueChange={setOptionId} disabled={!market}>
              <SelectTrigger><SelectValue placeholder="Select option" /></SelectTrigger>
              <SelectContent>
                {(market?.options ?? []).map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-label text-[11px]">Stake ($)</Label>
            <Input type="number" min="1" value={stake} onChange={(e) => setStake(e.target.value)} />
          </div>
        </div>
        <Button
          size="sm"
          className="font-label"
          disabled={grant.isPending || !playerId || !marketId || !optionId}
          onClick={submit}
          data-testid="button-grant-free-bet"
        >
          Grant Free Bet
        </Button>
      </CardContent>
    </Card>
  );
}

function BetsAdmin() {
  const { data: bets, isLoading } = useBets();
  const voidBet = useVoidBet();
  const { toast } = useToast();

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  const list = bets ?? [];
  if (list.length === 0)
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No bets yet.
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-2 border-b-2 border-border flex items-center justify-between">
          <h2 className="font-display text-sm">All Bets ({list.length})</h2>
          <span className="font-label text-[11px] text-muted-foreground">
            Cancel refunds the stake and pulls it from the pool.
          </span>
        </div>
        <ol className="divide-y divide-border">
          {list.map((b) => (
            <li
              key={b.id}
              className="px-4 py-2.5 flex items-center gap-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{b.player.name}</span>
                  <Badge
                    variant="secondary"
                    className="border-0 capitalize"
                  >
                    {b.status}
                  </Badge>
                  {b.isBook && (
                    <Badge variant="outline" className="border-accent text-accent">
                      Book
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {b.market.title} ·{" "}
                  {b.isBook ? "Book fill" : b.option.label}
                </p>
              </div>
              <span className="tabular text-muted-foreground shrink-0">
                {formatMoney(b.stake)}
              </span>
              {b.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 font-label"
                  disabled={voidBet.isPending}
                  onClick={() => {
                    voidBet.mutate(b.id, {
                      onSuccess: () =>
                        toast({ title: "Bet cancelled — stake refunded" }),
                    });
                  }}
                  data-testid={`button-cancel-bet-${b.id}`}
                >
                  Cancel
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ---------- Settle ---------- */
function SettleList() {
  const { data: markets } = useMarkets();
  const { data: players } = usePlayers();
  const { data: bets } = useBets();
  const pools = useMarketPools();
  const grade = useGradeMarket();
  const fillMutation = useBookFill();
  const removeFillMutation = useRemoveBookFill();
  const { toast } = useToast();
  const closable = (markets ?? []).filter((m) => m.status !== "graded");
  // Per-market selected winner option ids (supports ties / multi-winner).
  const [selected, setSelected] = useState<Record<number, Set<number>>>({});

  const bookPlayer = (players ?? []).find((p) => p.name === BOOK_PLAYER_NAME);

  const toggle = (marketId: number, optionId: number) =>
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[marketId] ?? []);
      if (set.has(optionId)) set.delete(optionId);
      else set.add(optionId);
      next[marketId] = set;
      return next;
    });

  const handleGrade = (m: { id: number; title: string }) => {
    const ids = Array.from(selected[m.id] ?? []);
    if (ids.length === 0) return;
    grade.mutate(
      { id: m.id, winnerOptionIds: ids },
      {
        onSuccess: () =>
          toast({
            title: "Graded",
            description:
              ids.length === 1
                ? "Market graded"
                : `Pool split across ${ids.length} winners`,
          }),
      }
    );
  };

  const handleFill = (m: { id: number }) => {
    fillMutation.mutate(m.id, {
      onSuccess: () =>
        toast({ title: "Book fill applied", description: "Both sides now match at even money" }),
    });
  };

  const handleRemoveFill = (m: { id: number }) => {
    removeFillMutation.mutate(m.id, {
      onSuccess: () =>
        toast({ title: "Book fill removed", description: "Pool is right-sized again" }),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Use "Book fills gap" before grading to match both sides at even money.
        The book can win or lose. Then pick winner(s) and grade.
      </p>
      {closable.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No markets left to grade.
          </CardContent>
        </Card>
      )}
      {closable.map((m) => {
        const pool = pools.get(m.id);
        const totalPool = pool?.pool ?? 0;
        const chosen = selected[m.id] ?? new Set<number>();
        const count = chosen.size;
        const isTwoOption = m.options.length === 2;

        // Per-option totals
        const optionTotals = m.options.map(
          (o) => pool?.perOption.get(o.id) ?? 0
        );
        const gap =
          isTwoOption && optionTotals.length === 2
            ? Math.abs(optionTotals[0] - optionTotals[1])
            : 0;
        const hasBookFill = (bets ?? []).some(
          (b) => b.marketId === m.id && b.isBook && b.status === "open"
        );
        const bookFillAmount = (bets ?? [])
          .filter((b) => b.marketId === m.id && b.isBook && b.status === "open")
          .reduce((s, b) => s + b.stake, 0);
        const bookIsBettor =
          !!bookPlayer &&
          (bets ?? []).some(
            (b) =>
              b.marketId === m.id &&
              b.playerId === bookPlayer.id &&
              !b.isBook &&
              b.status === "open"
          );

        return (
        <Card key={m.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="border-0">{m.status}</Badge>
              <span className="text-xs text-muted-foreground">{m.category}</span>
              <span className="font-label text-[11px] text-muted-foreground ml-auto">
                Pool {formatMoney(totalPool)}
              </span>
            </div>
            <h3 className="font-display text-sm">{m.title}</h3>
            <div className="rounded-lg border border-border divide-y divide-border">
              {m.options.map((o, i) => {
                const money = optionTotals[i];
                const picked = chosen.has(o.id);
                return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(m.id, o.id)}
                  className={`w-full flex items-center justify-between p-2 text-left transition-colors ${
                    picked ? "bg-primary/10" : "hover:bg-muted/50"
                  }`}
                  data-testid={`button-pick-${o.id}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex items-center justify-center w-4 h-4 rounded border ${
                        picked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {picked && <CheckCircle2 className="w-3 h-3" />}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm">{o.label}</span>
                      <span className="font-label text-[11px] text-muted-foreground">
                        {formatMoney(money)} in
                      </span>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>

            {/* Bettor breakdown per side (collapsible) */}
            <BettorBreakdown market={m} />

            {/* Book fill controls (2-option markets only) */}
            {isTwoOption && gap > 0.005 && !hasBookFill && (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 p-2 space-y-1.5">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Gap between sides:</span>
                  <span className="font-label text-primary">{formatMoney(gap)}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1"
                  disabled={fillMutation.isPending}
                  onClick={() => handleFill(m)}
                  data-testid={`button-bookfill-${m.id}`}
                >
                  Book fills {formatMoney(gap)} on smaller side
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  {BOOK_PLAYER_NAME} fills the gap so both sides match at even money.
                  Book can win or lose depending on outcome.
                </p>
                {bookIsBettor && (
                  <p className="text-[11px] text-warning">
                    {BOOK_PLAYER_NAME} is also a bettor on this market —
                    credit/debit offsets on his ledger.
                  </p>
                )}
              </div>
            )}
            {isTwoOption && hasBookFill && (
              <div className="rounded-lg border border-solid border-primary/30 bg-primary/5 p-2 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] text-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="font-medium">Book fill active</span>
                  <span className="text-muted-foreground ml-1">
                    {BOOK_PLAYER_NAME} filled {formatMoney(bookFillAmount)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs h-7"
                  disabled={removeFillMutation.isPending}
                  onClick={() => handleRemoveFill(m)}
                  data-testid={`button-remove-bookfill-${m.id}`}
                >
                  Remove book fill (revert to right-sized)
                </Button>
              </div>
            )}
            {isTwoOption && gap <= 0.005 && !hasBookFill && (
              <p className="text-[11px] text-muted-foreground text-center py-1">
                Both sides match — no fill needed.
              </p>
            )}
            {!isTwoOption && (
              <p className="text-[11px] text-muted-foreground text-center py-1">
                Multi-option market — right-sized pool applies at grading.
              </p>
            )}

            <Button
              size="sm"
              className="w-full gap-1"
              disabled={count === 0 || grade.isPending}
              onClick={() => handleGrade(m)}
              data-testid={`button-grade-${m.id}`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {count === 0
                ? "Pick winner(s) above"
                : count === 1
                  ? "Grade — 1 winner"
                  : `Grade — ${count} winners (split pool)`}
            </Button>
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}

/* ---------- Scores ---------- */
const SCORE_ROUNDS = [1, 2, 3];
const SCORE_TEAMS: { key: string; label: string }[] = [
  { key: "Team Tommy", label: "Team Tommy" },
  { key: "Goon Squad", label: "Goon Squad" },
];

function ScoresAdmin() {
  const { data: scores } = useScores();
  const setScore = useSetScore();
  const { toast } = useToast();
  const [vals, setVals] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!scores) return;
    const next: Record<string, string> = {};
    for (const s of scores) next[`${s.round}:${s.team}`] = String(s.score);
    setVals(next);
  }, [scores]);

  const setVal = (round: number, team: string, v: string) =>
    setVals((prev) => ({ ...prev, [`${round}:${team}`]: v }));

  const saveRound = (round: number) => {
    let saved = 0;
    for (const t of SCORE_TEAMS) {
      const raw = vals[`${round}:${t.key}`];
      if (raw === undefined || raw.trim() === "") continue;
      const n = Number(raw);
      if (Number.isNaN(n)) continue;
      setScore.mutate({ round, team: t.key, score: n });
      saved++;
    }
    if (saved > 0)
      toast({
        title: `Round ${round} saved`,
        description: `${saved} team score(s) updated`,
      });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h2 className="font-display">Team Scores</h2>
        <p className="text-xs text-muted-foreground">
          Enter each team's net strokes per round (lower wins). Saves update the
          lobby scoreboard live.
        </p>
        <div className="rounded-lg border border-border divide-y divide-border">
          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 p-2 font-label text-[11px] text-muted-foreground items-center">
            <span className="w-14">Round</span>
            <span>Team Tommy</span>
            <span>Goon Squad</span>
            <span className="w-14" />
          </div>
          {SCORE_ROUNDS.map((r) => (
            <div
              key={r}
              className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 p-2 items-center"
            >
              <span className="font-label text-sm w-14">Round {r}</span>
              <Input
                type="number"
                inputMode="numeric"
                className="h-8"
                value={vals[`${r}:Team Tommy`] ?? ""}
                onChange={(e) => setVal(r, "Team Tommy", e.target.value)}
                data-testid={`input-score-${r}-tommy`}
              />
              <Input
                type="number"
                inputMode="numeric"
                className="h-8"
                value={vals[`${r}:Goon Squad`] ?? ""}
                onChange={(e) => setVal(r, "Goon Squad", e.target.value)}
                data-testid={`input-score-${r}-goon`}
              />
              <Button
                size="sm"
                className="w-14"
                onClick={() => saveRound(r)}
                disabled={setScore.isPending}
                data-testid={`button-save-score-${r}`}
              >
                Save
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Pots Admin ---------- */
function PotsAdmin() {
  const { data: pots } = usePots();
  const { data: teamPoints } = useTeamPoints();
  const fundPots = useFundPots();
  const finalizeTeam = useFinalizeTeamPot();
  const finalizeSkins = useFinalizeSkins();
  const upsertPoints = useUpsertTeamPoints();
  const { toast } = useToast();

  const teamPot = pots?.find((p) => p.type === "team_pot");
  const skinsPot = pots?.find((p) => p.type === "skins");
  const funded = teamPot?.funded ?? false;

  const pts = teamPoints ?? [];
  const days = [1, 2, 3];
  const teams = ["Team Tommy", "Goon Squad"];
  const totals = teams.map((t) => ({
    team: t,
    total: pts.filter((p) => p.team === t).reduce((s, p) => s + p.points, 0),
  }));

  const savePoints = (day: number, team: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    upsertPoints.mutate({ day, team, points: num });
    toast({ title: `${team} Day ${day}: ${num} pts` });
  };

  return (
    <div className="space-y-4">
      {!funded ? (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-display text-sm">Fund Structured Pots</p>
              <p className="text-xs text-muted-foreground">Collect $100 from all 24 players. Splits into Team Pot ($60), CTP ($10), Skins ($30).</p>
            </div>
            <Button size="sm" onClick={() => fundPots.mutate()} data-testid="button-admin-fund">
              <DollarSign className="w-4 h-4 mr-1" /> Fund
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-win flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Pots funded — $2,400 collected
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            <h3 className="font-display text-sm">Team Points</h3>
          </div>
          <p className="text-xs text-muted-foreground">Match play points per team per day. Team with most total points wins the $1,440 pot.</p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs font-label text-muted-foreground px-1">
              <span>Day</span>
              <span className="w-20 text-right">Team Tommy</span>
              <span className="w-20 text-right">Goon Squad</span>
              <span className="w-12" />
            </div>
            {days.map((day) => {
              const tommy = pts.find((p) => p.day === day && p.team === "Team Tommy")?.points;
              const goon = pts.find((p) => p.day === day && p.team === "Goon Squad")?.points;
              return (
                <TeamPointsRow key={day} day={day} tommyVal={tommy} goonVal={goon} onSave={savePoints} />
              );
            })}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 pt-2 border-t border-border">
              <span className="font-label text-sm">Total</span>
              <span className="w-20 text-right tabular font-display">{totals[0].total.toFixed(1)}</span>
              <span className="w-20 text-right tabular font-display">{totals[1].total.toFixed(1)}</span>
              <span className="w-12" />
            </div>
          </div>
          {teamPot && (
            <div className="flex items-center gap-2 pt-2">
              <StatusPill status={teamPot.status} />
              {teamPot.status === "scoring" && (
                <Button size="sm" variant="outline" onClick={() => finalizeTeam.mutate()} data-testid="button-admin-finalize-team">
                  Finalize Team Pot
                </Button>
              )}
              {teamPot.status === "tie_unresolved" && (
                <span className="text-xs text-warning">Tied — define a tiebreak rule first.</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {skinsPot && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" />
                <h3 className="font-display text-sm">Skins</h3>
                <StatusPill status={skinsPot.status} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{formatMoney(skinsPot.totalCents / 100)} total · $240/day</p>
            </div>
            {skinsPot.status === "scoring" && (
              <Button size="sm" variant="outline" onClick={() => finalizeSkins.mutate()} data-testid="button-admin-finalize-skins">
                Finalize Skins
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamPointsRow({ day, tommyVal, goonVal, onSave }: {
  day: number;
  tommyVal: number | undefined;
  goonVal: number | undefined;
  onSave: (day: number, team: string, value: string) => void;
}) {
  const [t, setT] = useState(tommyVal?.toString() ?? "");
  const [g, setG] = useState(goonVal?.toString() ?? "");
  useEffect(() => {
    setT(tommyVal?.toString() ?? "");
    setG(goonVal?.toString() ?? "");
  }, [tommyVal, goonVal]);
  const dayLabels = ["", "Thu", "Fri", "Sat"];
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-1 items-center">
      <span className="text-sm">Day {day} ({dayLabels[day]})</span>
      <Input type="number" inputMode="decimal" className="h-8 w-20 text-right" value={t} onChange={(e) => setT(e.target.value)} onBlur={() => t && onSave(day, "Team Tommy", t)} data-testid={`input-pts-${day}-tommy`} />
      <Input type="number" inputMode="decimal" className="h-8 w-20 text-right" value={g} onChange={(e) => setG(e.target.value)} onBlur={() => g && onSave(day, "Goon Squad", g)} data-testid={`input-pts-${day}-goon`} />
      <span className="w-12" />
    </div>
  );
}

function StatusPill({ status }: { status: PotSummary["status"] }) {
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
  return <span className={`text-[10px] font-label px-1.5 py-0.5 rounded-full ${styles[status]}`}>{labels[status]}</span>;
}

/* ---------- Scramble Units Admin ---------- */
function UnitsAdmin() {
  const { data: units } = useScrambleUnits();
  const { data: players } = usePlayers();
  const createUnit = useCreateScrambleUnit();
  const deleteUnit = useDeleteScrambleUnit();
  const { data: holeScores } = useHoleScores();
  const upsertScore = useUpsertHoleScore();
  const { toast } = useToast();
  const [day, setDay] = useState(1);
  const [team, setTeam] = useState("Team Tommy");
  const [label, setLabel] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  const dayUnits = (units ?? []).filter((u) => u.day === day);
  const unitType = day === 1 ? "four_man" : "two_man";
  const teamPlayers = (players ?? []).filter((p) => p.team === team);
  const maxPlayers = day === 1 ? 4 : 2;

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < maxPlayers ? [...prev, id] : prev
    );
  };

  const submit = () => {
    if (!label.trim() || selectedPlayers.length !== maxPlayers) {
      toast({ title: `Add a label and select ${maxPlayers} players`, variant: "destructive" });
      return;
    }
    createUnit.mutate({
      day,
      unitType,
      team,
      label: label.trim(),
      playerIds: selectedPlayers.map(Number),
    });
    setLabel("");
    setSelectedPlayers([]);
  };

  const holes = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="font-display text-sm">Create Scramble Unit</h3>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((d) => (
              <Button key={d} size="sm" variant={day === d ? "default" : "outline"} onClick={() => { setDay(d); setSelectedPlayers([]); }}>
                Day {d}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={team} onValueChange={(v) => { setTeam(v); setSelectedPlayers([]); }}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Team Tommy">Team Tommy</SelectItem>
                <SelectItem value="Goon Squad">Goon Squad</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Label (e.g. Group 1)" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8" />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Select {maxPlayers} players ({selectedPlayers.length}/{maxPlayers}):</p>
            <div className="grid grid-cols-2 gap-1">
              {teamPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(String(p.id))}
                  className={`text-left text-sm px-2 py-1.5 rounded transition-colors ${
                    selectedPlayers.includes(String(p.id))
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted/40 hover:bg-muted/60"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={submit} disabled={createUnit.isPending}>Create Unit</Button>
        </CardContent>
      </Card>

      {dayUnits.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-label text-[11px] text-muted-foreground uppercase tracking-wider">Day {day} Units</h3>
            {dayUnits.map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-2 border border-border rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{u.label} <span className="text-xs text-muted-foreground">({u.team})</span></p>
                  <p className="text-xs text-muted-foreground truncate">{u.members.map((m) => m.name).join(", ")}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteUnit.mutate(u.id)} data-testid={`button-delete-unit-${u.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {dayUnits.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="font-label text-[11px] text-muted-foreground uppercase tracking-wider">Hole Scores — Day {day}</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="text-left p-1 sticky left-0 bg-card">Unit</th>
                    {holes.map((h) => <th key={h} className="p-1 text-center w-10">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {dayUnits.map((u) => (
                    <tr key={u.id}>
                      <td className="p-1 sticky left-0 bg-card truncate max-w-[100px]">{u.label}</td>
                      {holes.map((h) => {
                        const score = holeScores?.find((s) => s.unitId === u.id && s.holeNumber === h && s.day === day);
                        return (
                          <td key={h} className="p-0.5">
                            <input
                              type="number"
                              inputMode="numeric"
                              className="w-9 h-7 text-center bg-muted/40 rounded border-0 focus:ring-1 focus:ring-accent"
                              defaultValue={score?.grossScore ?? ""}
                              key={`${u.id}-${h}-${score?.grossScore ?? ""}`}
                              onBlur={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val > 0) upsertScore.mutate({ unitId: u.id, day, holeNumber: h, grossScore: val });
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---------- CTP Admin ---------- */
function CTPAdmin() {
  const { data: holes } = useCTPHoles();
  const { data: players } = usePlayers();
  const createHole = useCreateCTPHole();
  const addEntry = useAddCTPEntry();
  const deleteEntry = useDeleteCTPEntry();
  const setWinners = useSetCTPWinners();
  const finalizeHole = useFinalizeCTPHole();
  const { toast } = useToast();
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [distance, setDistance] = useState("");
  const [activeHole, setActiveHole] = useState<number | null>(null);

  const ctpHoles = holes ?? [];

  return (
    <div className="space-y-4">
      {ctpHoles.length === 0 && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">No CTP holes yet. Create the 4 par-3 holes for Day 1.</p>
            <Button size="sm" onClick={() => createHole.mutate({})} data-testid="button-create-ctp-hole">
              <Plus className="w-4 h-4 mr-1" /> Add Hole
            </Button>
          </CardContent>
        </Card>
      )}

      {ctpHoles.map((hole) => (
        <Card key={hole.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" />
                <h3 className="font-display text-sm">{hole.label}</h3>
                <StatusPill status={hole.finalized ? "finalized" : "scoring"} />
              </div>
              <div className="flex gap-1">
                {!hole.finalized && (
                  <Button size="sm" variant="outline" onClick={() => finalizeHole.mutate(hole.id)} disabled={!hole.entries.some((e) => e.isWinner)}>
                    Finalize
                  </Button>
                )}
              </div>
            </div>

            {hole.entries.length > 0 && (
              <div className="space-y-1">
                {hole.entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => {
                        if (hole.finalized) return;
                        const currentWinners = hole.entries.filter((x) => x.isWinner).map((x) => x.playerId);
                        const newWinners = currentWinners.includes(e.playerId)
                          ? currentWinners.filter((x) => x !== e.playerId)
                          : [...currentWinners, e.playerId];
                        setWinners.mutate({ holeId: hole.id, winnerIds: newWinners });
                      }}
                      disabled={hole.finalized}
                      className={`flex items-center gap-2 flex-1 text-left px-2 py-1 rounded ${
                        e.isWinner ? "bg-win/15 text-win" : "bg-muted/40"
                      } ${hole.finalized ? "cursor-default" : "cursor-pointer"}`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        e.isWinner ? "border-win bg-win" : "border-border"
                      }`}>
                        {e.isWinner && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </span>
                      <span className="font-medium">{e.playerName}</span>
                      {e.distance && <span className="text-xs text-muted-foreground">{e.distance}</span>}
                    </button>
                    {!hole.finalized && (
                      <Button size="sm" variant="ghost" onClick={() => deleteEntry.mutate(e.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!hole.finalized && (
              <div className="flex gap-2">
                <Select value={activeHole === hole.id ? selectedPlayer : ""} onValueChange={(v) => { setSelectedPlayer(v); setActiveHole(hole.id); }}>
                  <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Add player..." /></SelectTrigger>
                  <SelectContent>
                    {(players ?? []).filter((p) => !hole.entries.some((e) => e.playerId === p.id)).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Distance" value={activeHole === hole.id ? distance : ""} onChange={(e) => { setDistance(e.target.value); setActiveHole(hole.id); }} className="h-8 w-24" />
                <Button size="sm" onClick={() => {
                  if (!selectedPlayer) { toast({ title: "Pick a player", variant: "destructive" }); return; }
                  addEntry.mutate({ holeId: hole.id, playerId: Number(selectedPlayer), distance });
                  setSelectedPlayer("");
                  setDistance("");
                  setActiveHole(null);
                }}>Add</Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {ctpHoles.length > 0 && ctpHoles.length < 4 && (
        <Button size="sm" variant="outline" onClick={() => createHole.mutate({})}>
          <Plus className="w-4 h-4 mr-1" /> Add Another Hole
        </Button>
      )}
    </div>
  );
}
/* ---------- Results Admin (Skins + CTP winners) ---------- */
const RESULT_CTP_HOLES = [
  { hole: 3, yards: 108 },
  { hole: 6, yards: 133 },
  { hole: 11, yards: 190 },
  { hole: 15, yards: 143 },
];

function ResultsAdmin() {
  const { data: players } = usePlayers();
  const { data: units } = useScrambleUnits();
  const { data: ctpHoles } = useCTPHoles();
  const skinsPayout = useManualSkinsPayout();
  const addEntry = useAddCTPEntry();
  const setWinners = useSetCTPWinners();
  const createHole = useCreateCTPHole();
  const { toast } = useToast();

  const [skinsWinners, setSkinsWinners] = useState<Record<number, { playerId: string; amount: string }>>({
    1: { playerId: "", amount: "" },
    2: { playerId: "", amount: "" },
    3: { playerId: "", amount: "" },
  });
  const [ctpWinners, setCtpWinners] = useState<Record<number, string>>({});

  useEffect(() => {
    if (ctpHoles && ctpHoles.length < 4) {
      const existing = new Set(ctpHoles.map((h) => h.holeNumber));
      for (const ch of RESULT_CTP_HOLES) {
        if (!existing.has(ch.hole)) {
          createHole.mutate({ label: `Hole ${ch.hole} (${ch.yards}y)`, holeNumber: ch.hole });
        }
      }
    }
  }, [ctpHoles]);

  const playerList = players ?? [];
  const unitList = units ?? [];

  return (
    <div className="space-y-6">
      {/* Skins Winners */}
      <div>
        <h2 className="font-display text-base flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-accent" />
          Skins Winners & Payouts
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Select the winning player and enter the payout amount (in dollars). Each day's pot is $240.
        </p>
        <div className="space-y-3">
          {[1, 2, 3].map((day) => {
            const dayUnits = unitList.filter((u) => u.day === day);
            const dayPlayers = dayUnits.length > 0
              ? dayUnits.flatMap((u) => u.members)
              : playerList;
            return (
              <Card key={day}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-label text-xs">Day {day}</Badge>
                    <span className="text-xs text-muted-foreground">Pot: $240</span>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-[11px] text-muted-foreground">Winner</Label>
                      <Select
                        value={skinsWinners[day]?.playerId ?? ""}
                        onValueChange={(v) => setSkinsWinners((p) => ({ ...p, [day]: { ...p[day], playerId: v } }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Pick player..." /></SelectTrigger>
                        <SelectContent>
                          {dayPlayers.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24">
                      <Label className="text-[11px] text-muted-foreground">Payout $</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={skinsWinners[day]?.amount ?? ""}
                        onChange={(e) => setSkinsWinners((p) => ({ ...p, [day]: { ...p[day], amount: e.target.value } }))}
                        className="h-9"
                        data-testid={`input-skins-amount-day${day}`}
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!skinsWinners[day]?.playerId || !skinsWinners[day]?.amount || skinsPayout.isPending}
                      onClick={() => {
                        const { playerId, amount } = skinsWinners[day];
                        skinsPayout.mutate({
                          day,
                          playerId: Number(playerId),
                          amountCents: Math.round(Number(amount) * 100),
                          description: `Day ${day} skins winner`,
                        });
                        toast({ title: `Day ${day} skins payout saved` });
                      }}
                      data-testid={`button-save-skins-day${day}`}
                    >
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* CTP Winners */}
      <div>
        <h2 className="font-display text-base flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-accent" />
          Closest to Pin Winners
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Day 1 at Highlands Golf Club. 4 par-3s x $60 = $240 pot.
        </p>
        <div className="space-y-3">
          {RESULT_CTP_HOLES.map((ch) => {
            const holeData = ctpHoles?.find((h) => h.holeNumber === ch.hole);
            const currentWinner = holeData?.entries.find((e) => e.isWinner);
            return (
              <Card key={ch.hole}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-label text-xs">Hole {ch.hole}</Badge>
                      <span className="text-xs text-muted-foreground">{ch.yards} yards</span>
                    </div>
                    {currentWinner && (
                      <span className="text-xs text-win font-medium">Winner: {currentWinner.playerName}</span>
                    )}
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-[11px] text-muted-foreground">Winner</Label>
                      <Select
                        value={ctpWinners[ch.hole] ?? ""}
                        onValueChange={(v) => setCtpWinners((p) => ({ ...p, [ch.hole]: v }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Pick player..." /></SelectTrigger>
                        <SelectContent>
                          {playerList.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      disabled={!ctpWinners[ch.hole] || !holeData}
                      onClick={() => {
                        const playerId = Number(ctpWinners[ch.hole]);
                        addEntry.mutate(
                          { holeId: holeData!.id, playerId, distance: "" },
                          {
                            onSuccess: () => {
                              setTimeout(() => {
                                setWinners.mutate({ holeId: holeData!.id, winnerIds: [playerId] });
                              }, 500);
                              toast({ title: `Hole ${ch.hole} CTP winner saved` });
                            },
                          }
                        );
                        setWinners.mutate({ holeId: holeData!.id, winnerIds: [playerId] });
                      }}
                      data-testid={`button-save-ctp-hole${ch.hole}`}
                    >
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Matches Admin (Score Links) ---------- */
function MatchesAdmin() {
  const [day, setDay] = useState(2);
  const { data: summaries } = useMatchSummaries(day);
  const { data: tokens } = useScoreTokens();
  const generateToken = useGenerateToken();
  const [copied, setCopied] = useState<string | null>(null);

  const tokenMap = new Map<number, string>();
  (tokens ?? []).forEach((t) => {
    if (t.day === day) tokenMap.set(t.matchIndex, t.token);
  });

  const handleGenerate = (matchId: number) => {
    generateToken.mutate(matchId);
  };

  const handleCopy = (token: string) => {
    const url = `${window.location.origin}/#/score/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const dayTotals = (summaries ?? []).reduce(
    (acc, m) => ({
      tommy: acc.tommy + m.tommyWins,
      goon: acc.goon + m.goonWins,
      halved: acc.halved + m.halved,
    }),
    { tommy: 0, goon: 0, halved: 0 }
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm">Match Play Score Links</h3>
            <div className="flex gap-1">
              <button
                onClick={() => setDay(2)}
                className={`px-3 py-1 rounded-md text-xs font-medium ${day === 2 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
              >Day 2</button>
              <button
                onClick={() => setDay(3)}
                className={`px-3 py-1 rounded-md text-xs font-medium ${day === 3 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}
              >Day 3</button>
            </div>
          </div>

          {/* Day totals */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-xs font-medium">Team Tommy</span>
            <div className="flex items-center gap-2 text-center">
              <span className="font-display text-lg tabular text-team-tommy">{dayTotals.tommy}</span>
              <span className="text-muted-foreground text-xs">-</span>
              <span className="font-display text-lg tabular text-team-goon">{dayTotals.goon}</span>
            </div>
            <span className="text-xs font-medium text-right">Goon Squad</span>
          </div>

          {/* Match rows with score links */}
          <div className="space-y-2">
            {(summaries ?? []).map((m) => {
              const token = tokenMap.get(m.match.matchIndex);
              const tommyNames = m.tommyPlayers.length > 0
                ? m.tommyPlayers.map(p => shortName(p.name)).join(", ")
                : "TBD";
              const goonNames = m.goonPlayers.length > 0
                ? m.goonPlayers.map(p => shortName(p.name)).join(", ")
                : "TBD";
              return (
                <div key={m.match.id} className="bg-muted/20 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[10px] text-muted-foreground">Match {m.match.matchIndex}</span>
                    <span className="text-[10px] text-muted-foreground">{m.thruHole || 0}/18 holes</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{tommyNames}</p>
                      <p className="font-display text-lg tabular text-team-tommy">{m.tommyWins}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">vs</span>
                    <div className="min-w-0 text-right">
                      <p className="text-xs font-medium truncate">{goonNames}</p>
                      <p className="font-display text-lg tabular text-team-goon">{m.goonWins}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {token ? (
                      <>
                        <button
                          onClick={() => handleCopy(token)}
                          className="flex-1 px-3 py-1.5 rounded-md bg-accent/15 text-accent text-xs font-medium"
                        >
                          {copied === token ? "Copied!" : "Copy Score Link"}
                        </button>
                        <a
                          href={`/#/score/${token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-xs font-medium"
                        >Open</a>
                      </>
                    ) : (
                      <button
                        onClick={() => handleGenerate(m.match.id)}
                        disabled={generateToken.isPending}
                        className="flex-1 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium"
                      >
                        Generate Score Link
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {(summaries ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No matches yet. They auto-create when you visit the lobby.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
