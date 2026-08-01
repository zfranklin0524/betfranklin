import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiRequest, queryClient } from "./queryClient";
import type {
  Player,
  MarketWithOptions,
  BetWithContext,
  PlayerStanding,
  InsertPlayer,
  RoundScore,
  PotSummary,
  SkinsDayResult,
  LedgerEntry,
  ScrambleUnitWithMembers,
  HoleScore,
  CTPHole,
  TeamPoints,
  SideBetWithContext,
  InsertSideBet,
  MatchSummary,
  MatchScoreEntry,
  FreeBetGrantWithContext,
} from "@shared/schema";
import { ADMIN_PIN } from "@shared/schema";

const PIN_HEADERS = { "x-admin-pin": ADMIN_PIN };

// Live scoring data (scoreboard, match play, score entry) polls so results
// entered via a unique scoring link show up for other viewers without a
// manual reload. refetchIntervalInBackground keeps it polling even on a
// screen (e.g. a shared TV) that isn't the OS-focused window.
const LIVE_QUERY_OPTS = { refetchInterval: 5000, refetchIntervalInBackground: true } as const;

export const QK = {
  players: ["/api/players"],
  markets: ["/api/markets"],
  bets: ["/api/bets"],
  standings: ["/api/standings"],
  scores: ["/api/scores"],
  playerBets: (id: number) => ["/api/bets/player", id],
  marketBets: (id: number) => ["/api/bets/market", id],
  pots: ["/api/pots"],
  ledger: ["/api/ledger"],
  units: ["/api/units"],
  holeScores: ["/api/hole-scores"],
  holeScoresByDay: (day: number) => ["/api/hole-scores/day", day],
  skinsDay: (day: number) => ["/api/skins/day", day],
  ctp: ["/api/ctp"],
  teamPoints: ["/api/team-points"],
  sideBets: ["/api/side-bets"],
  matchSummaries: (day: number) => ["/api/matches/summaries", day],
  matchTotals: (day: number) => ["/api/matches/totals", day],
  scoreTokens: ["/api/score-tokens"],
  freeBetGrants: ["/api/free-bets"],
  freeBetGrantsForPlayer: (id: number) => ["/api/free-bets/player", id],
};

export function usePlayers() {
  return useQuery<Player[]>({ queryKey: QK.players });
}
export function useMarkets() {
  return useQuery<MarketWithOptions[]>({ queryKey: QK.markets });
}
export function useBets() {
  return useQuery<BetWithContext[]>({ queryKey: QK.bets });
}
export function useStandings() {
  return useQuery<PlayerStanding[]>({ queryKey: QK.standings });
}
export function useScores() {
  return useQuery<RoundScore[]>({ queryKey: QK.scores, ...LIVE_QUERY_OPTS });
}
export function usePlayerBets(playerId: number | null) {
  return useQuery<BetWithContext[]>({
    queryKey: ["/api/bets/player", playerId],
    enabled: playerId != null,
  });
}

export type MarketPool = {
  pool: number;
  perOption: Map<number, number>;
};

// Aggregate all live action into a per-market pool (and money per option).
// Used everywhere to show live parimutuel odds. Voided bets are excluded
// (they were refunded and are no longer in the pool).
export function useMarketPools() {
  const { data: bets } = useBets();
  return useMemo(() => {
    const map = new Map<number, MarketPool>();
    for (const b of bets ?? []) {
      if (b.status === "void") continue;
      let m = map.get(b.marketId);
      if (!m) {
        m = { pool: 0, perOption: new Map() };
        map.set(b.marketId, m);
      }
      m.pool += b.stake;
      m.perOption.set(b.optionId, (m.perOption.get(b.optionId) ?? 0) + b.stake);
    }
    return map;
  }, [bets]);
}

function invalidateAll() {
  queryClient.invalidateQueries({ queryKey: QK.bets });
  queryClient.invalidateQueries({ queryKey: QK.standings });
  queryClient.invalidateQueries({ queryKey: QK.markets });
  queryClient.invalidateQueries({ queryKey: QK.players });
  queryClient.invalidateQueries({ queryKey: QK.scores });
  queryClient.invalidateQueries({ queryKey: QK.pots });
  queryClient.invalidateQueries({ queryKey: QK.ledger });
  queryClient.invalidateQueries({ queryKey: QK.units });
  queryClient.invalidateQueries({ queryKey: QK.holeScores });
  queryClient.invalidateQueries({ queryKey: QK.ctp });
  queryClient.invalidateQueries({ queryKey: QK.teamPoints });
  queryClient.invalidateQueries({ queryKey: QK.sideBets });
  queryClient.invalidateQueries({ queryKey: QK.freeBetGrants });
  queryClient.invalidateQueries({ queryKey: ["/api/free-bets/player"] });
}

export function useCreatePlayer() {
  return useMutation({
    mutationFn: (data: InsertPlayer) =>
      apiRequest("POST", "/api/players", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useUpdatePlayer() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InsertPlayer> }) =>
      apiRequest("PATCH", `/api/players/${id}`, data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useDeletePlayer() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/players/${id}`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useCreateMarket() {
  return useMutation({
    mutationFn: (data: {
      title: string;
      category: string;
      closesAt?: string;
      options: { label: string; odds?: number }[];
    }) => apiRequest("POST", "/api/markets", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useUpdateMarket() {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { status?: string; closesAt?: string; title?: string; cashOutLockAt?: string | null };
    }) => apiRequest("PATCH", `/api/markets/${id}`, data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useDeleteMarket() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/markets/${id}`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useUpdateOptionOdds() {
  return useMutation({
    mutationFn: ({ id, odds }: { id: number; odds: number }) =>
      apiRequest("PATCH", `/api/options/${id}`, { odds }, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useCreateBet() {
  return useMutation({
    mutationFn: (data: {
      playerId: number;
      marketId: number;
      optionId: number;
      stake: number;
    }) => apiRequest("POST", "/api/bets", data).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useVoidBet() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/bets/${id}/void`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

// Player cash-out: refund your own open bet before the market's cash-out lock.
export function useCashOut() {
  return useMutation({
    mutationFn: ({ id, playerId }: { id: number; playerId: number }) =>
      apiRequest("POST", `/api/bets/${id}/cashout`, { playerId }).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useGradeMarket() {
  return useMutation({
    mutationFn: ({
      id,
      winnerOptionIds,
    }: {
      id: number;
      winnerOptionIds: number[];
    }) =>
      apiRequest("POST", `/api/markets/${id}/grade`, { winnerOptionIds }, PIN_HEADERS).then((r) =>
        r.json()
      ),
    onSuccess: () => invalidateAll(),
  });
}

export function useBookFill() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/markets/${id}/book-fill`, undefined, PIN_HEADERS).then((r) =>
        r.json()
      ),
    onSuccess: () => invalidateAll(),
  });
}

export function useRemoveBookFill() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/markets/${id}/book-fill`, undefined, PIN_HEADERS).then((r) =>
        r.json()
      ),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Free Bet Grants (comped bets, redeemed by the player) ---------- */
export function useFreeBetGrants() {
  return useQuery<FreeBetGrantWithContext[]>({
    queryKey: QK.freeBetGrants,
    queryFn: () => apiRequest("GET", "/api/free-bets", undefined, PIN_HEADERS).then((r) => r.json()),
  });
}
export function useFreeBetGrantsForPlayer(playerId: number | null) {
  return useQuery<FreeBetGrantWithContext[]>({
    queryKey: QK.freeBetGrantsForPlayer(playerId ?? -1),
    enabled: playerId != null,
    ...LIVE_QUERY_OPTS,
  });
}
// Admin: grant a player eligibility for a free bet (no market chosen yet).
export function useGrantFreeBetEligibility() {
  return useMutation({
    mutationFn: (data: { playerId: number; amountCents?: number }) =>
      apiRequest("POST", "/api/free-bets", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
// Player redeems their own grant on a market/option they picked — the book
// instantly covers the other side. Re-redeeming re-points an already-used grant.
export function useRedeemFreeBet() {
  return useMutation({
    mutationFn: ({ id, playerId, marketId, optionId }: { id: number; playerId: number; marketId: number; optionId: number }) =>
      apiRequest("POST", `/api/free-bets/${id}/redeem`, { playerId, marketId, optionId }).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useRevokeFreeBetGrant() {
  return useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/free-bets/${id}`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useResetAll() {
  return useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/reset", undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useSetScore() {
  return useMutation({
    mutationFn: (data: { round: number; team: string; score: number }) =>
      apiRequest("POST", "/api/scores", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

export function useReseedPlayers() {
  return useMutation({
    mutationFn: (roster: { name: string; team?: string }[]) =>
      apiRequest("POST", "/api/admin/reseed-players", roster, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Pots ---------- */
export function usePots() {
  return useQuery<PotSummary[]>({ queryKey: QK.pots });
}
export function useFundPots() {
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/pots/fund", undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useFinalizeTeamPot() {
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/pots/finalize-team", undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useFinalizeSkins() {
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/pots/finalize-skins", undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Ledger ---------- */
export function useLedger() {
  return useQuery<LedgerEntry[]>({ queryKey: QK.ledger });
}

/* ---------- Manual Skins Payout ---------- */
export function useManualSkinsPayout() {
  return useMutation({
    mutationFn: (data: { day: number; playerId: number; amountCents: number; description?: string }) =>
      apiRequest("POST", "/api/skins/manual-payout", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Scramble Units ---------- */
export function useScrambleUnits() {
  return useQuery<ScrambleUnitWithMembers[]>({ queryKey: QK.units, ...LIVE_QUERY_OPTS });
}
export function useCreateScrambleUnit() {
  return useMutation({
    mutationFn: (data: { day: number; unitType: string; team: string; label: string; playerIds: number[] }) =>
      apiRequest("POST", "/api/units", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useDeleteScrambleUnit() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/units/${id}`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Hole Scores ---------- */
export function useHoleScores() {
  return useQuery<HoleScore[]>({ queryKey: QK.holeScores });
}
export function useHoleScoresByDay(day: number) {
  return useQuery<HoleScore[]>({ queryKey: QK.holeScoresByDay(day), ...LIVE_QUERY_OPTS });
}
export function useUpsertHoleScore() {
  return useMutation({
    mutationFn: (data: { unitId: number; day: number; holeNumber: number; grossScore: number }) =>
      apiRequest("POST", "/api/hole-scores", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useDeleteHoleScoresByDay() {
  return useMutation({
    mutationFn: (day: number) => apiRequest("DELETE", `/api/hole-scores/day/${day}`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Skins ---------- */
export function useSkinsDayResult(day: number) {
  return useQuery<SkinsDayResult>({ queryKey: QK.skinsDay(day) });
}

/* ---------- CTP ---------- */
export function useCTPHoles() {
  return useQuery<(CTPHole & { entries: ({ id: number; holeId: number; playerId: number; distance: string | null; isWinner: boolean; playerName: string })[] })[]>({ queryKey: QK.ctp });
}
export function useCreateCTPHole() {
  return useMutation({
    mutationFn: (data: { label?: string; holeNumber?: number }) =>
      apiRequest("POST", "/api/ctp/holes", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useUpdateCTPHole() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { label?: string; holeNumber?: number } }) =>
      apiRequest("PATCH", `/api/ctp/holes/${id}`, data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useAddCTPEntry() {
  return useMutation({
    mutationFn: (data: { holeId: number; playerId: number; distance: string }) =>
      apiRequest("POST", "/api/ctp/entries", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useDeleteCTPEntry() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ctp/entries/${id}`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useSetCTPWinners() {
  return useMutation({
    mutationFn: ({ holeId, winnerIds }: { holeId: number; winnerIds: number[] }) =>
      apiRequest("POST", `/api/ctp/holes/${holeId}/winners`, { winnerIds }, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useFinalizeCTPHole() {
  return useMutation({
    mutationFn: (holeId: number) => apiRequest("POST", `/api/ctp/holes/${holeId}/finalize`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Team Points ---------- */
export function useTeamPoints() {
  return useQuery<TeamPoints[]>({ queryKey: QK.teamPoints, ...LIVE_QUERY_OPTS });
}
export function useUpsertTeamPoints() {
  return useMutation({
    mutationFn: (data: { day: number; team: string; points: number }) =>
      apiRequest("POST", "/api/team-points", data, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Side Bets ---------- */
export function useSideBets() {
  return useQuery<SideBetWithContext[]>({ queryKey: QK.sideBets });
}
export function useCreateSideBet() {
  return useMutation({
    mutationFn: (data: InsertSideBet) =>
      apiRequest("POST", "/api/side-bets", data).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useAcceptSideBet() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/side-bets/${id}/accept`).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useSettleSideBet() {
  return useMutation({
    mutationFn: ({ id, winnerId }: { id: number; winnerId: number }) =>
      apiRequest("POST", `/api/side-bets/${id}/settle`, { winnerId }, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}
export function useVoidSideBet() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/side-bets/${id}/void`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Market Void ---------- */
export function useVoidMarket() {
  return useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/markets/${id}/void`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => invalidateAll(),
  });
}

/* ---------- Match Play ---------- */
export function useMatchSummaries(day: number) {
  return useQuery<MatchSummary[]>({ queryKey: QK.matchSummaries(day), ...LIVE_QUERY_OPTS });
}
export function useMatchTotals(day: number) {
  return useQuery<{ tommy: number; goon: number; halved: number }>({ queryKey: QK.matchTotals(day), ...LIVE_QUERY_OPTS });
}
export function useScoreEntry(token: string) {
  return useQuery<MatchScoreEntry>({ queryKey: ["/api/score", token], enabled: !!token, ...LIVE_QUERY_OPTS });
}
export function useSubmitHoleResult(token: string) {
  return useMutation({
    mutationFn: ({ holeNumber, result }: { holeNumber: number; result: string }) =>
      apiRequest("POST", `/api/score/${token}/hole`, { holeNumber, result }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/score", token] });
      // Also invalidate summaries so live boards update
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
  });
}
export function useClearHoleResult(token: string) {
  return useMutation({
    mutationFn: (holeNumber: number) =>
      apiRequest("DELETE", `/api/score/${token}/hole/${holeNumber}`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/score", token] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
    },
  });
}
export function useGenerateToken() {
  return useMutation({
    mutationFn: (matchId: number) =>
      apiRequest("POST", `/api/matches/${matchId}/token`, undefined, PIN_HEADERS).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.scoreTokens });
    },
  });
}
export function useScoreTokens() {
  return useQuery<{ token: string; matchId: number; day: number; matchIndex: number }[]>({ queryKey: QK.scoreTokens });
}
