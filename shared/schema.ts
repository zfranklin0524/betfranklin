import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------- Players ---------- */
export const players = sqliteTable("players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  team: text("team"), // optional grouping (e.g. "Team Blue")
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const insertPlayerSchema = createInsertSchema(players).omit({ id: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

/* ---------- Markets ---------- */
// status: open | closed | graded
export const markets = sqliteTable("markets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull(), // e.g. "Tournament", "Round 1", "Props", "Skins"
  status: text("status").notNull().default("open"),
  closesAt: text("closes_at"), // optional ISO timestamp / freeform note
  // JSON text column storing the graded winner option ids (supports ties /
  // multi-winner markets). Parsed to number[] by the storage layer.
  winnerOptionIds: text("winner_option_ids"),
  // ISO timestamp (with timezone) before which a player may cash out (refund)
  // an open bet. After it, bets are locked to settlement. Admin-editable.
  cashOutLockAt: text("cash_out_lock_at"),
  createdAt: integer("created_at").notNull().default(Date.now()),
});

export const insertMarketSchema = createInsertSchema(markets).omit({
  id: true,
  createdAt: true,
  status: true,
  winnerOptionIds: true,
  cashOutLockAt: true,
});
export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof markets.$inferSelect;

/* ---------- Market Options (outcomes + American odds) ---------- */
export const marketOptions = sqliteTable("market_options", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  marketId: integer("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  odds: integer("odds").notNull().default(-100), // American odds, e.g. +250, -110
});

export const insertMarketOptionSchema = createInsertSchema(marketOptions).omit({
  id: true,
});
export type InsertMarketOption = z.infer<typeof insertMarketOptionSchema>;
export type MarketOption = typeof marketOptions.$inferSelect;

/* ---------- Bets ---------- */
// status: open | won | lost | void
export const bets = sqliteTable("bets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  marketId: integer("market_id")
    .notNull()
    .references(() => markets.id, { onDelete: "cascade" }),
  optionId: integer("option_id")
    .notNull()
    .references(() => marketOptions.id, { onDelete: "cascade" }),
  stake: real("stake").notNull(), // dollars risked
  payout: real("payout").notNull().default(0), // total return if win (stake + profit)
  status: text("status").notNull().default("open"),
  // True for synthetic "book fill" bets injected by the commish at grade time
  // so a solo winner can be paid at even money. Always a loser; excluded from
  // winning totals but included in the pool. Omitted from insertBetSchema so
  // normal bet creation cannot spoof book bets.
  isBook: integer("is_book", { mode: "boolean" }).notNull().default(false),
  // Distinguishes what kind of book bet this is, so different book-bet
  // features don't clobber each other's rows (e.g. bookFillMarket's
  // pre-grade balancing shouldn't delete a free-bet's cover bet). Null for
  // normal (non-book) bets.
  bookTag: text("book_tag"),
  createdAt: integer("created_at").notNull().default(Date.now()),
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
  status: true,
  payout: true,
  isBook: true,
  bookTag: true,
}).extend({
  stake: z.number().positive(),
});
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof bets.$inferSelect;

/* ---------- Round Scores ---------- */
// Team-level net stroke totals per round (3 rounds = the 3 tournament days,
// Aug 13-15). Lower score wins (stroke play net). Stored at the team level by
// design — the commish enters one cumulative net per team per round.
export const roundScores = sqliteTable("round_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  round: integer("round").notNull(), // 1, 2, 3
  team: text("team").notNull(), // "Team Tommy" | "Goon Squad"
  score: integer("score").notNull(), // net strokes (lower is better)
  updatedAt: integer("updated_at").notNull().default(Date.now()),
});

export const insertRoundScoreSchema = createInsertSchema(roundScores).omit({
  id: true,
  updatedAt: true,
});
export type InsertRoundScore = z.infer<typeof insertRoundScoreSchema>;
export type RoundScore = typeof roundScores.$inferSelect;

/* ---------- Helpers ---------- */
// Compute net profit for a settled bet
export function betNet(bet: Bet): number {
  if (bet.status === "void") return 0; // stake refunded
  if (bet.status === "won") return bet.payout - bet.stake;
  if (bet.status === "lost") return bet.payout - bet.stake; // payout = partial refund (excess over matched)
  return 0; // open bets: unrealized
}

// Profit for a stake at American odds (used to compute potential payout)
export function profitForStake(stake: number, odds: number): number {
  if (odds > 0) return (stake * odds) / 100;
  if (odds < 0) return (stake * 100) / Math.abs(odds);
  return 0; // odds 0 => even, treat as push
}

export function formatMoney(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/* ---------- Parimutuel helpers ---------- */
// Total-return multiple if this option wins, given the current pool and the
// money staked on that option. Returns null when nothing is on the option yet.
export function parimutuelMultiple(
  pool: number,
  moneyOnOption: number
): number | null {
  if (moneyOnOption <= 0) return null;
  return pool / moneyOnOption;
}

// Convert a total-return decimal multiple (e.g. 3.5) to American odds (+250).
export function multipleToAmerican(d: number): number {
  const profit = d - 1;
  if (profit <= 0) return 0;
  if (d >= 2) return Math.round(profit * 100);
  return -Math.round(100 / profit);
}

// Live estimated payout (total return) for a stake on an option, given the
// current pool and money on that option. This is an estimate only — the real
// payout is determined at settlement from the final pool.
export function parimutuelEstPayout(
  stake: number,
  pool: number,
  moneyOnOption: number
): number {
  const newPool = pool + stake;
  const newMoney = moneyOnOption + stake;
  if (newMoney <= 0) return stake;
  return (stake / newMoney) * newPool;
}

/* ---------- Admin PIN (soft server-side gate) ---------- */
// Shared by client + server. Lives in the client bundle by design (this is
// a private group app with no real accounts) — the point is to stop casual
// unauthenticated curl requests against mutation endpoints on the public URL.
export const ADMIN_PIN = "2424";

/* ---------- Book (house) ---------- */
// The commissioner acts as the book. When grading a market where a winner has
// no opposing bets, the commish can "fill" the bet at even money: the book
// (this player) injects a losing stake equal to the winning stakes, so each
// winner doubles up and the book's ledger absorbs the offset.
export const BOOK_PLAYER_NAME = "Zach Franklin";

export interface MarketWithOptions extends Omit<Market, "winnerOptionIds"> {
  winnerOptionIds: number[];
  options: MarketOption[];
}

export interface BetWithContext extends Bet {
  player: { id: number; name: string };
  market: { id: number; title: string; category: string; status: string; cashOutLockAt: string | null };
  option: { id: number; label: string; odds: number };
}

export interface PlayerStanding {
  player: Player;
  staked: number;
  wonReturn: number;
  lostStake: number;
  net: number;
  openRisk: number;
  betsCount: number;
  wins: number;
  losses: number;
  refunded: number;
  potNet: number;
  teamPotNet: number;
  ctpNet: number;
  skinsNet: number;
  sideBetNet: number;
  totalNet: number;
}

/* ---------- Structured Pots ---------- */
export const BUY_IN_CENTS = 10000;
export const TEAM_POT_PER_PLAYER = 6000;
export const CTP_POT_PER_PLAYER = 1000;
export const SKINS_POT_PER_PLAYER = 3000;
export const SKINS_DAILY_POT = 24000;
export const CTP_PAYOUT_PER_HOLE = 6000;
export const TEAM_POT_PAYOUT = 144000;
export const TEAM_POT_PER_WINNER = 12000;

export const buyIns = sqliteTable("buy_ins", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull().default(BUY_IN_CENTS),
  paid: integer("paid", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(Date.now()),
});
export type BuyIn = typeof buyIns.$inferSelect;

export const ledgerEntries = sqliteTable("ledger_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: integer("source_id"),
  amountCents: integer("amount_cents").notNull(),
  description: text("description"),
  createdAt: integer("created_at").notNull().default(Date.now()),
});
export type LedgerEntry = typeof ledgerEntries.$inferSelect;

export const scrambleUnits = sqliteTable("scramble_units", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: integer("day").notNull(),
  unitType: text("unit_type").notNull(),
  team: text("team").notNull(),
  label: text("label").notNull(),
});
export type ScrambleUnit = typeof scrambleUnits.$inferSelect;

export const scrambleUnitMembers = sqliteTable("scramble_unit_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => scrambleUnits.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
});
export type ScrambleUnitMember = typeof scrambleUnitMembers.$inferSelect;

export const holeScores = sqliteTable("hole_scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  unitId: integer("unit_id").notNull().references(() => scrambleUnits.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
  holeNumber: integer("hole_number").notNull(),
  grossScore: integer("gross_score").notNull(),
});
export type HoleScore = typeof holeScores.$inferSelect;

export const ctpHoles = sqliteTable("ctp_holes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  holeNumber: integer("hole_number"),
  label: text("label").notNull().default("CTP Hole 1"),
  payoutCents: integer("payout_cents").notNull().default(CTP_PAYOUT_PER_HOLE),
  finalized: integer("finalized", { mode: "boolean" }).notNull().default(false),
});
export type CTPHole = typeof ctpHoles.$inferSelect;

export const ctpEntries = sqliteTable("ctp_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  holeId: integer("hole_id").notNull().references(() => ctpHoles.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  distance: text("distance"),
  isWinner: integer("is_winner", { mode: "boolean" }).notNull().default(false),
});
export type CTPEntry = typeof ctpEntries.$inferSelect;

export const teamPoints = sqliteTable("team_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: integer("day").notNull(),
  team: text("team").notNull(),
  points: real("points").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(Date.now()),
});
export type TeamPoints = typeof teamPoints.$inferSelect;

/* ---------- Match Play (Days 2-3) ---------- */
export const matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  day: integer("day").notNull(), // 2 or 3
  matchIndex: integer("match_index").notNull(), // 1-6
  tommyUnitId: integer("tommy_unit_id"), // nullable until teams announced
  goonUnitId: integer("goon_unit_id"),
  status: text("status").notNull().default("open"), // open | in_progress | final
});
export type Match = typeof matches.$inferSelect;

export const matchHoleResults = sqliteTable("match_hole_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  holeNumber: integer("hole_number").notNull(), // 1-18
  result: text("result").notNull(), // "tommy" | "goon" | "halve"
  updatedAt: integer("updated_at").notNull().default(Date.now()),
});
export type MatchHoleResult = typeof matchHoleResults.$inferSelect;

/* ---------- Free Bet Grants (comped bets, book-covered) ---------- */
// status: pending (not yet spent) | used (placed on a market) | revoked
// A grant is an entitlement, not a bet — the player redeems it themselves on
// whatever open market they choose (any market, not the 30W pool). Redeeming
// stakes the amount on their pick and instantly covers the other side with a
// matching Book bet. Re-redeeming (picking a different market) reverses the
// prior placement first, so a grant can be repointed if someone changes
// their mind.
export const freeBetGrants = sqliteTable("free_bet_grants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull().default(1000),
  status: text("status").notNull().default("pending"),
  marketId: integer("market_id"),
  optionId: integer("option_id"),
  betId: integer("bet_id"),
  bookBetId: integer("book_bet_id"),
  ledgerEntryId: integer("ledger_entry_id"),
  createdAt: integer("created_at").notNull().default(Date.now()),
  usedAt: integer("used_at"),
});
export type FreeBetGrant = typeof freeBetGrants.$inferSelect;

export interface FreeBetGrantWithContext extends FreeBetGrant {
  player: { id: number; name: string };
  market: { id: number; title: string } | null;
  option: { id: number; label: string } | null;
}

export const scoreTokens = sqliteTable("score_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  matchId: integer("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  createdAt: integer("created_at").notNull().default(Date.now()),
});
export type ScoreToken = typeof scoreTokens.$inferSelect;

export const sideBets = sqliteTable("side_bets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  terms: text("terms"),
  creatorId: integer("creator_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  opponentId: integer("opponent_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  stakeCents: integer("stake_cents").notNull(),
  status: text("status").notNull().default("proposed"),
  winnerId: integer("winner_id").references(() => players.id),
  createdAt: integer("created_at").notNull().default(Date.now()),
  settledAt: integer("settled_at"),
});
export const insertSideBetSchema = createInsertSchema(sideBets).omit({
  id: true, createdAt: true, settledAt: true, status: true, winnerId: true,
}).extend({ stakeCents: z.number().positive() });
export type InsertSideBet = z.infer<typeof insertSideBetSchema>;
export type SideBet = typeof sideBets.$inferSelect;

export interface SideBetWithContext extends SideBet {
  creator: { id: number; name: string; team: string | null };
  opponent: { id: number; name: string; team: string | null };
  winner: { id: number; name: string } | null;
}

export interface ScrambleUnitWithMembers extends ScrambleUnit {
  members: { id: number; name: string; team: string | null }[];
}

export interface PotPayout {
  playerId: number;
  playerName: string;
  amountCents: number;
}

export interface PotSummary {
  type: 'team_pot' | 'ctp' | 'skins';
  name: string;
  totalCents: number;
  funded: boolean;
  status: 'pending' | 'scoring' | 'finalized' | 'tie_unresolved';
  description: string;
  payouts: PotPayout[];
}

export interface SkinsDayResult {
  day: number;
  potCents: number;
  rolledOver: boolean;
  skinValue: number;
  skins: { unitId: number; label: string; team: string; holeNumber: number; members: string[] }[];
  zeroSkins: boolean;
}

export interface MatchSummary {
  match: Match;
  tommyPlayers: { id: number; name: string }[];
  goonPlayers: { id: number; name: string }[];
  holeResults: MatchHoleResult[];
  tommyWins: number;
  goonWins: number;
  halved: number;
  thruHole: number; // last hole with a result
}

export interface MatchScoreEntry {
  matchId: number;
  day: number;
  matchIndex: number;
  tommyPlayers: { id: number; name: string }[];
  goonPlayers: { id: number; name: string }[];
  holeResults: { holeNumber: number; result: string }[];
  tommyWins: number;
  goonWins: number;
  halved: number;
}
