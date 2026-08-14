import {
  players,
  markets,
  marketOptions,
  bets,
  roundScores,
  betNet,
  BOOK_PLAYER_NAME,
  buyIns,
  ledgerEntries,
  scrambleUnits,
  scrambleUnitMembers,
  holeScores,
  ctpHoles,
  ctpEntries,
  teamPoints,
  matches,
  matchHoleResults,
  scoreTokens,
  sideBets,
  freeBetGrants,
  BUY_IN_CENTS,
  TEAM_POT_PER_PLAYER,
  CTP_POT_PER_PLAYER,
  SKINS_POT_PER_PLAYER,
  SKINS_DAILY_POT,
  CTP_PAYOUT_PER_HOLE,
  TEAM_POT_PAYOUT,
  TEAM_POT_PER_WINNER,
  type Player,
  type Market,
  type MarketOption,
  type InsertPlayer,
  type InsertMarket,
  type InsertMarketOption,
  type InsertBet,
  type Bet,
  type RoundScore,
  type BuyIn,
  type LedgerEntry,
  type ScrambleUnit,
  type ScrambleUnitMember,
  type HoleScore,
  type CTPHole,
  type CTPEntry,
  type TeamPoints,
  type SideBet,
  type InsertSideBet,
  type SideBetWithContext,
  type ScrambleUnitWithMembers,
  type PotSummary,
  type SkinsDayResult,
  type PlayerStanding,
  type PotPayout,
  type FreeBetGrant,
  type FreeBetGrantWithContext,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, sql } from "drizzle-orm";
import { dirname } from "path";
import { mkdirSync, unlinkSync } from "fs";

let sqlite: Database.Database;
const DB_PATH = process.env.DATABASE_PATH || "golf.db";
// Ensure the parent directory exists (Railway volumes may need this)
const dbDir = dirname(DB_PATH);
if (dbDir !== ".") {
  try { mkdirSync(dbDir, { recursive: true }); } catch {}
}
try {
  // Clean up any stale WAL/SHM files from previous WAL mode deployments
  try { unlinkSync(DB_PATH + "-wal"); } catch {}
  try { unlinkSync(DB_PATH + "-shm"); } catch {}
  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = DELETE");
  sqlite.pragma("foreign_keys = ON");
  // Test the database is readable
  sqlite.prepare("SELECT count(*) as c FROM players").get();
} catch (err) {
  console.error("[storage] Database issue, recreating:", err);
  try { unlinkSync(DB_PATH); } catch {}
  try { unlinkSync(DB_PATH + "-wal"); } catch {}
  try { unlinkSync(DB_PATH + "-shm"); } catch {}
  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = DELETE");
  sqlite.pragma("foreign_keys = ON");
}

// Create tables on boot so a fresh data.db (e.g. in the published sandbox,
// where there's no migration step) is ready before any query runs.
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    team TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS markets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    closes_at TEXT,
    winner_option_ids TEXT,
    cash_out_lock_at TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS market_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    odds INTEGER NOT NULL DEFAULT -100
  );
  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES market_options(id) ON DELETE CASCADE,
    stake REAL NOT NULL,
    payout REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    is_book INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS round_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round INTEGER NOT NULL,
    team TEXT NOT NULL,
    score INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS round_scores_round_team ON round_scores(round, team);
  
  CREATE TABLE IF NOT EXISTS buy_ins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL DEFAULT 10000,
    paid INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL,
    source_id INTEGER,
    amount_cents INTEGER NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scramble_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL,
    unit_type TEXT NOT NULL,
    team TEXT NOT NULL,
    label TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS scramble_unit_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES scramble_units(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS hole_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    unit_id INTEGER NOT NULL REFERENCES scramble_units(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    hole_number INTEGER NOT NULL,
    gross_score INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ctp_holes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hole_number INTEGER,
    label TEXT NOT NULL DEFAULT 'CTP Hole 1',
    payout_cents INTEGER NOT NULL DEFAULT 6000,
    finalized INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS ctp_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hole_id INTEGER NOT NULL REFERENCES ctp_holes(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    distance TEXT,
    is_winner INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS team_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL,
    team TEXT NOT NULL,
    points REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS team_points_day_team ON team_points(day, team);
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL,
    match_index INTEGER NOT NULL,
    tommy_unit_id INTEGER,
    goon_unit_id INTEGER,
    status TEXT NOT NULL DEFAULT 'open'
  );
  CREATE UNIQUE INDEX IF NOT EXISTS matches_day_idx ON matches(day, match_index);
  CREATE TABLE IF NOT EXISTS match_hole_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    hole_number INTEGER NOT NULL,
    result TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS mhr_match_hole ON match_hole_results(match_id, hole_number);
  CREATE TABLE IF NOT EXISTS score_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS side_bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    terms TEXT,
    creator_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    opponent_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    stake_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'proposed',
    winner_id INTEGER REFERENCES players(id),
    created_at INTEGER NOT NULL,
    settled_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS free_bet_grants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL DEFAULT 1000,
    status TEXT NOT NULL DEFAULT 'pending',
    market_id INTEGER,
    option_id INTEGER,
    bet_id INTEGER,
    book_bet_id INTEGER,
    ledger_entry_id INTEGER,
    created_at INTEGER NOT NULL,
    used_at INTEGER
  );
`);

// Migrate older DBs (e.g. a preserved production data.db) that stored a single
// winner_option_id integer. Add the new winner_option_ids text column and
// backfill any graded markets so their winners survive the schema change.
{
  const cols = sqlite.pragma("table_info(markets)") as { name: string }[];
  const hasNew = cols.some((c) => c.name === "winner_option_ids");
  const hasOld = cols.some((c) => c.name === "winner_option_id");
  if (!hasNew) {
    sqlite.exec("ALTER TABLE markets ADD COLUMN winner_option_ids TEXT");
    if (hasOld) {
      sqlite.exec(
        "UPDATE markets SET winner_option_ids = '[' || winner_option_id || ']' WHERE winner_option_id IS NOT NULL"
      );
    }
  }
};

// Migrate: add bets.is_book (synthetic book-fill bets) and markets.cash_out_lock_at
// (cash-out lock time), then backfill default lock times for existing markets.
{
  const betCols = sqlite.pragma("table_info(bets)") as { name: string }[];
  if (!betCols.some((c) => c.name === "is_book")) {
    sqlite.exec("ALTER TABLE bets ADD COLUMN is_book INTEGER NOT NULL DEFAULT 0");
  }
  const mktCols = sqlite.pragma("table_info(markets)") as { name: string }[];
  if (!mktCols.some((c) => c.name === "cash_out_lock_at")) {
    sqlite.exec("ALTER TABLE markets ADD COLUMN cash_out_lock_at TEXT");
  }
  // Backfill lock times for markets that don't have one yet.
  const needs = sqlite
    .prepare("SELECT id, category FROM markets WHERE cash_out_lock_at IS NULL")
    .all() as { id: number; category: string }[];
  const upd = sqlite.prepare("UPDATE markets SET cash_out_lock_at = ? WHERE id = ?");
  for (const m of needs) upd.run(defaultLockForCategory(m.category), m.id);
};

// Migrate: add bets.book_tag, distinguishing book bets created by different
// features (e.g. "balance" from bookFillMarket vs "free_bet" from
// grantFreeBet) so one feature's cleanup doesn't delete another's rows.
{
  const betCols = sqlite.pragma("table_info(bets)") as { name: string }[];
  if (!betCols.some((c) => c.name === "book_tag")) {
    sqlite.exec("ALTER TABLE bets ADD COLUMN book_tag TEXT");
  }
};

// Migrate: add scramble_units.total_score / points — a Day 1 four-man
// group's final gross score and the points it earned, entered as a whole
// from the tee sheet (distinct from the hole-by-hole hole_scores table).
{
  const unitCols = sqlite.pragma("table_info(scramble_units)") as { name: string }[];
  if (!unitCols.some((c) => c.name === "total_score")) {
    sqlite.exec("ALTER TABLE scramble_units ADD COLUMN total_score INTEGER");
  }
  if (!unitCols.some((c) => c.name === "points")) {
    sqlite.exec("ALTER TABLE scramble_units ADD COLUMN points REAL");
  }
};

export const db = drizzle(sqlite);
export { sqlite as rawDb };

// Default cash-out lock time (ISO, EDT) for a market by category. Tournament
// markets lock at the tournament start (Aug 13); round markets lock at that
// day's first tee; everything else defaults to the tournament start. The
// commish can override per market in the admin Markets tab.
function defaultLockForCategory(category: string): string {
  const cat = category.trim().toLowerCase();
  if (cat.startsWith("round 2")) return "2026-08-14T08:00:00-04:00";
  if (cat.startsWith("round 3")) return "2026-08-15T08:00:00-04:00";
  // Tournament, Round 1, Props, Teams, and anything else -> Aug 13 first tee.
  return "2026-08-13T14:28:00-04:00";
}

// Re-export types for convenience
export type { Player, Market, MarketOption, Bet };
export type { Match, MatchHoleResult, ScoreToken, MatchSummary, MatchScoreEntry };

export interface MarketWithOptions extends Market {
  options: MarketOption[];
}

export interface BetWithContext extends Bet {
  player: Pick<Player, "id" | "name">;
  market: Pick<Market, "id" | "title" | "category" | "status" | "cashOutLockAt">;
  option: Pick<MarketOption, "id" | "label" | "odds">;
}

export interface PlayerStanding {
  player: Player;
  staked: number;
  wonReturn: number; // total returned on winning bets
  lostStake: number; // total lost on losing bets
  net: number; // realized net (settled)
  openRisk: number; // total at risk on open bets
  betsCount: number;
  wins: number;
  losses: number;
  refunded: number; // void/cancelled/cashed-out bets
}

class DatabaseStorage {
  /* ----- Players ----- */
  listPlayers(): Player[] {
    return db.select().from(players).all();
  }
  getPlayer(id: number): Player | undefined {
    return db.select().from(players).where(eq(players.id, id)).get();
  }
  createPlayer(p: InsertPlayer): Player {
    return db.insert(players).values(p).returning().get();
  }
  updatePlayer(id: number, p: Partial<InsertPlayer>): Player | undefined {
    return db.update(players).set(p).where(eq(players.id, id)).returning().get();
  }
  deletePlayer(id: number): void {
    db.delete(players).where(eq(players.id, id)).run();
  }

  /* ----- Markets ----- */
  private withOptions(m: Market): MarketWithOptions {
    const { winnerOptionIds: raw, ...rest } = m;
    let winnerOptionIds: number[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        winnerOptionIds = Array.isArray(parsed) ? parsed : [];
      } catch {
        winnerOptionIds = [];
      }
    }
    const opts = db
      .select()
      .from(marketOptions)
      .where(eq(marketOptions.marketId, m.id))
      .all();
    return { ...rest, winnerOptionIds, options: opts };
  }
  listMarkets(): MarketWithOptions[] {
    const all = db.select().from(markets).orderBy(desc(markets.createdAt)).all();
    return all.map((m) => this.withOptions(m));
  }
  getMarket(id: number): MarketWithOptions | undefined {
    const m = db.select().from(markets).where(eq(markets.id, id)).get();
    if (!m) return undefined;
    return this.withOptions(m);
  }
  createMarket(
    m: InsertMarket,
    options: { label: string; odds?: number }[]
  ): MarketWithOptions {
    const created = db
      .insert(markets)
      .values({
        ...m,
        cashOutLockAt: defaultLockForCategory(m.category),
      })
      .returning()
      .get();
    for (const o of options) {
      db.insert(marketOptions)
        .values({ marketId: created.id, label: o.label, odds: o.odds ?? 0 })
        .run();
    }
    return this.getMarket(created.id)!;
  }
  updateMarket(id: number, patch: Partial<Market>): MarketWithOptions | undefined {
    const updated = db
      .update(markets)
      .set(patch)
      .where(eq(markets.id, id))
      .returning()
      .get();
    if (!updated) return undefined;
    return this.getMarket(id);
  }
  updateOption(id: number, patch: Partial<MarketOption>): void {
    db.update(marketOptions).set(patch).where(eq(marketOptions.id, id)).run();
  }
  deleteMarket(id: number): void {
    db.delete(markets).where(eq(markets.id, id)).run();
  }

  /* ----- Bets ----- */
  listBets(): BetWithContext[] {
    const rows = db
      .select({
        bet: bets,
        playerId: players.id,
        playerName: players.name,
        marketId: markets.id,
        marketTitle: markets.title,
        marketCategory: markets.category,
        marketStatus: markets.status,
        marketCashOutLockAt: markets.cashOutLockAt,
        optionId: marketOptions.id,
        optionLabel: marketOptions.label,
        optionOdds: marketOptions.odds,
      })
      .from(bets)
      .leftJoin(players, eq(bets.playerId, players.id))
      .leftJoin(markets, eq(bets.marketId, markets.id))
      .leftJoin(marketOptions, eq(bets.optionId, marketOptions.id))
      .orderBy(desc(bets.createdAt))
      .all();
    return rows.map((r) => ({
      ...r.bet,
      player: { id: r.playerId, name: r.playerName ?? "Unknown" },
      market: {
        id: r.marketId,
        title: r.marketTitle ?? "Unknown",
        category: r.marketCategory ?? "",
        status: r.marketStatus ?? "open",
        cashOutLockAt: r.marketCashOutLockAt ?? null,
      },
      option: { id: r.optionId, label: r.optionLabel ?? "—", odds: r.optionOdds ?? 0 },
    }));
  }
  listBetsForPlayer(playerId: number): BetWithContext[] {
    return this.listBets().filter((b) => b.playerId === playerId);
  }
  listBetsForMarket(marketId: number): BetWithContext[] {
    return this.listBets().filter((b) => b.marketId === marketId);
  }
  createBet(b: InsertBet): Bet {
    // Parimutuel: payout is unknown until settlement (depends on the final
    // pool), so we record only the stake now and compute payout at grade time.
    return db
      .insert(bets)
      .values({ ...b, payout: 0, status: "open" })
      .returning()
      .get();
  }
  voidBet(id: number): Bet | undefined {
    return db
      .update(bets)
      .set({ status: "void", payout: 0 })
      .where(eq(bets.id, id))
      .returning()
      .get();
  }

  /* ----- Book fill (pre-grade) ----- */
  // Inject a book bet on the smaller side so both sides match at even money.
  // Call BEFORE grading — the book bet is treated as a regular bet at grade
  // time and can win or lose. Only works on 2-option markets.
  // Re-calling replaces the prior book bet.
  bookFillMarket(marketId: number): void {
    const market = this.getMarket(marketId);
    if (!market || market.options.length !== 2) return;
    const book = this.getBookPlayer();
    if (!book) return;

    // Remove any existing balance book bet first (leave free-bet cover bets alone).
    sqlite
      .prepare(
        "DELETE FROM bets WHERE market_id = ? AND is_book = 1 AND (book_tag IS NULL OR book_tag = 'balance')"
      )
      .run(marketId);

    const openBets = this.listBetsForMarket(marketId).filter(
      (b) => b.status === "open" && !b.isBook
    );
    const t0 = openBets
      .filter((b) => b.optionId === market.options[0].id)
      .reduce((s, b) => s + b.stake, 0);
    const t1 = openBets
      .filter((b) => b.optionId === market.options[1].id)
      .reduce((s, b) => s + b.stake, 0);
    const gap = Math.abs(t0 - t1);
    if (gap < 0.01) return; // already matched

    const smallerOptionId =
      t0 < t1 ? market.options[0].id : market.options[1].id;
    db.insert(bets)
      .values({
        playerId: book.id,
        marketId,
        optionId: smallerOptionId,
        stake: Math.round(gap * 100) / 100,
        payout: 0,
        status: "open",
        isBook: true,
        bookTag: "balance",
      })
      .run();
  }

  // Remove a pre-grade book fill from a market (leave free-bet cover bets alone).
  removeBookFill(marketId: number): void {
    sqlite
      .prepare(
        "DELETE FROM bets WHERE market_id = ? AND is_book = 1 AND (book_tag IS NULL OR book_tag = 'balance')"
      )
      .run(marketId);
  }

  // Pick which option the book covers opposite a player's free-bet pick:
  // prefer "Field (anyone else)" (a real bet that pays if the player isn't
  // separately listed), else the option currently carrying the least stake.
  private pickOpposingOption(
    market: MarketWithOptions,
    chosenOptionId: number
  ): MarketOption {
    const others = market.options.filter((o) => o.id !== chosenOptionId);
    const field = others.find((o) => o.label.toLowerCase().startsWith("field"));
    if (field) return field;
    const openBets = this.listBetsForMarket(market.id).filter(
      (b) => b.status !== "void"
    );
    const stakeByOption = new Map<number, number>(others.map((o) => [o.id, 0]));
    for (const b of openBets) {
      if (stakeByOption.has(b.optionId)) {
        stakeByOption.set(b.optionId, (stakeByOption.get(b.optionId) ?? 0) + b.stake);
      }
    }
    return others.reduce((min, o) =>
      (stakeByOption.get(o.id) ?? 0) < (stakeByOption.get(min.id) ?? 0) ? o : min
    );
  }

  /* ----- Free Bet Grants (comped bets, redeemed by the player) ----- */
  // Grant a player an eligibility to place one free bet — an entitlement,
  // not a placed bet. The player (or commish, on their behalf) later
  // redeems it on whatever open market they choose via redeemFreeBet().
  grantFreeBetEligibility(playerId: number, amountCents = 1000): FreeBetGrant {
    const player = this.getPlayer(playerId);
    if (!player) throw new Error("Player not found");
    return db
      .insert(freeBetGrants)
      .values({ playerId, amountCents, status: "pending" })
      .returning()
      .get();
  }

  listFreeBetGrants(): FreeBetGrantWithContext[] {
    const grants = db.select().from(freeBetGrants).orderBy(desc(freeBetGrants.createdAt)).all();
    return this.withFreeBetGrantContext(grants);
  }

  listFreeBetGrantsForPlayer(playerId: number): FreeBetGrantWithContext[] {
    const grants = db
      .select()
      .from(freeBetGrants)
      .where(eq(freeBetGrants.playerId, playerId))
      .orderBy(desc(freeBetGrants.createdAt))
      .all();
    return this.withFreeBetGrantContext(grants);
  }

  private withFreeBetGrantContext(grants: FreeBetGrant[]): FreeBetGrantWithContext[] {
    const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
    const marketMap = new Map(this.listMarkets().map((m) => [m.id, m]));
    return grants.map((g) => {
      const market = g.marketId ? marketMap.get(g.marketId) : undefined;
      const option = market?.options.find((o) => o.id === g.optionId);
      return {
        ...g,
        player: { id: g.playerId, name: playerMap.get(g.playerId)?.name ?? "Unknown" },
        market: market ? { id: market.id, title: market.title } : null,
        option: option ? { id: option.id, label: option.label } : null,
      };
    });
  }

  // Undo a grant's current placement (if any): void both bets and remove the
  // ledger credit. Safe to call on a still-pending grant (no-op).
  private reverseFreeBetUsage(grant: FreeBetGrant): void {
    if (grant.betId) this.voidBet(grant.betId);
    if (grant.bookBetId) this.voidBet(grant.bookBetId);
    if (grant.ledgerEntryId) {
      sqlite.prepare("DELETE FROM ledger_entries WHERE id = ?").run(grant.ledgerEntryId);
    }
  }

  // Redeem a free bet grant on a market/option the player picked themselves.
  // Credits their ledger for the stake (doesn't touch their own buy-in),
  // places their bet, and instantly covers the other side with a matching
  // Book bet — a real, fully-matched wager independent of other players.
  // Redeeming an already-used grant re-points it: the prior placement is
  // reversed first, so someone can change their pick.
  redeemFreeBet(grantId: number, marketId: number, optionId: number): { bet: Bet; bookBet: Bet } {
    const grant = db.select().from(freeBetGrants).where(eq(freeBetGrants.id, grantId)).get();
    if (!grant) throw new Error("Free bet grant not found");
    if (grant.status === "revoked") throw new Error("This free bet has been revoked");
    const market = this.getMarket(marketId);
    if (!market) throw new Error("Market not found");
    if (market.status !== "open") throw new Error("Market is not open for betting");
    const option = market.options.find((o) => o.id === optionId);
    if (!option) throw new Error("Option not found on market");
    const book = this.getBookPlayer();
    if (!book) throw new Error("Book player not found");
    if (book.id === grant.playerId)
      throw new Error("Cannot redeem a free bet for the book player");

    if (grant.status === "used") this.reverseFreeBetUsage(grant);

    const stakeDollars = grant.amountCents / 100;
    const ledgerEntry = this.addLedgerEntry(
      grant.playerId,
      "free_bet",
      grant.amountCents,
      `Free $${stakeDollars} bet — ${market.title} (${option.label})`
    );

    const bet = this.createBet({
      playerId: grant.playerId,
      marketId,
      optionId,
      stake: stakeDollars,
    });

    const opposing = this.pickOpposingOption(market, optionId);
    const bookBet = db
      .insert(bets)
      .values({
        playerId: book.id,
        marketId,
        optionId: opposing.id,
        stake: stakeDollars,
        payout: 0,
        status: "open",
        isBook: true,
        bookTag: "free_bet",
      })
      .returning()
      .get();

    db.update(freeBetGrants)
      .set({
        status: "used",
        marketId,
        optionId,
        betId: bet.id,
        bookBetId: bookBet.id,
        ledgerEntryId: ledgerEntry.id,
        usedAt: Date.now(),
      })
      .where(eq(freeBetGrants.id, grantId))
      .run();

    return { bet, bookBet };
  }

  // Revoke a grant entirely: undoes any placement and deletes the grant row.
  revokeFreeBetGrant(grantId: number): void {
    const grant = db.select().from(freeBetGrants).where(eq(freeBetGrants.id, grantId)).get();
    if (!grant) return;
    this.reverseFreeBetUsage(grant);
    db.delete(freeBetGrants).where(eq(freeBetGrants.id, grantId)).run();
  }

  // Find the grant behind a bet, if any — either side (the player's bet or
  // the book's cover bet). Used to block generic actions (e.g. cash-out)
  // that would otherwise void just one side and leave the other dangling.
  findFreeBetGrantByBetId(betId: number): FreeBetGrant | undefined {
    return db
      .select()
      .from(freeBetGrants)
      .where(sql`${freeBetGrants.betId} = ${betId} OR ${freeBetGrants.bookBetId} = ${betId}`)
      .get();
  }

  /* ----- Settlement (right-sized pool) ----- */
  // Grade all open bets on a market using a right-sized pool model.
  //
  // Only the matched amount (min of winning/losing totals) is at risk.
  // The pool is 2 × matched. Winners split the pool proportional to their
  // stake. Any excess (one side bet more than the other) is refunded to
  // that side's bettors proportionally. Losers only lose their matched
  // portion; winners only win the matched portion from the other side.
  //
  // Pre-grade book fill: call bookFillMarket() BEFORE grading to inject a
  // book bet on the smaller side. The book bet is preserved across re-grades
  // and treated as a regular bet — it can win or lose.
  //
  // Re-grade safe: all non-void bets (including book) are reset to open.
  // Void bets (cancelled/cashed-out) stay void and excluded.
  //
  // Penny residuals from rounding are absorbed by the largest winning bet.
  gradeMarket(marketId: number, winnerOptionIds: number[]): void {
    const run = sqlite.transaction(() => {
      const winSet = new Set(winnerOptionIds);

      // 1. Reopen ALL non-void bets (including book) for a clean re-grade.
      sqlite
        .prepare(
          "UPDATE bets SET status = 'open', payout = 0 WHERE market_id = ? AND status != 'void'"
        )
        .run(marketId);

      const openBets = this.listBetsForMarket(marketId).filter(
        (b) => b.status === "open"
      );

      // 2. Split into winning and losing sides (all bets, including book).
      const allWinning = openBets.filter((b) => winSet.has(b.optionId));
      const allLosing = openBets.filter((b) => !winSet.has(b.optionId));
      const winningTotal = allWinning.reduce((s, b) => s + b.stake, 0);
      const losingTotal = allLosing.reduce((s, b) => s + b.stake, 0);

      // 3. Right-size: matched = min(winning, losing).
      const matched = Math.min(winningTotal, losingTotal);

      if (matched <= 0 || winningTotal <= 0) {
        // No matching possible — refund everyone.
        for (const bet of openBets) {
          db.update(bets)
            .set({ status: "void", payout: 0 })
            .where(eq(bets.id, bet.id))
            .run();
        }
      } else {
        // 4. Pool = 2 × matched (each side contributes `matched`).
        const pool = matched * 2;

        // 5. Winners: each winner's matched stake is proportional to their
        //    share of the winning side. Payout = pool share + refund of excess.
        const rounded = allWinning.map((b) => {
          const matchedStake =
            winningTotal > 0 ? (b.stake * matched) / winningTotal : 0;
          const refund = b.stake - matchedStake;
          const payout = matchedStake * 2 + refund;
          return {
            id: b.id,
            payout: Math.round(payout * 100) / 100,
            stake: b.stake,
          };
        });

        // Fix penny residual on the largest winning bet.
        const totalPayout = winningTotal + matched;
        const paidOut = rounded.reduce((s, r) => s + r.payout, 0);
        const residual = Math.round((totalPayout - paidOut) * 100) / 100;
        if (Math.abs(residual) >= 0.01 && rounded.length > 0) {
          const biggest = [...rounded].sort((a, b) => b.stake - a.stake)[0];
          biggest.payout = Math.round((biggest.payout + residual) * 100) / 100;
        }

        for (const r of rounded) {
          db.update(bets)
            .set({ status: "won", payout: r.payout })
            .where(eq(bets.id, r.id))
            .run();
        }

        // 6. Losers: lose their matched portion, refund their excess.
        for (const bet of allLosing) {
          const matchedStake =
            losingTotal > 0 ? (bet.stake * matched) / losingTotal : 0;
          const refund = bet.stake - matchedStake;
          db.update(bets)
            .set({
              status: "lost",
              payout: Math.round(refund * 100) / 100,
            })
            .where(eq(bets.id, bet.id))
            .run();
        }
      }
      db.update(markets)
        .set({
          status: "graded",
          winnerOptionIds: JSON.stringify(winnerOptionIds),
        })
        .where(eq(markets.id, marketId))
        .run();
    });
    run();
  }

  // The book player (commissioner acting as house) — looked up by name so it
  // works on any roster without hardcoding an id.
  getBookPlayer(): Player | undefined {
    return db
      .select()
      .from(players)
      .where(eq(players.name, BOOK_PLAYER_NAME))
      .get();
  }

  /* ----- Standings ----- */
  standings(): PlayerStanding[] {
    const allBets = this.listBets();
    const ps = this.listPlayers();
    const ledger = db.select().from(ledgerEntries).all();
    return ps
      .map((player) => {
        const mine = allBets.filter((b) => b.playerId === player.id);
        let staked = 0;
        let openRisk = 0;
        let net = 0;
        let wonReturn = 0;
        let lostStake = 0;
        let wins = 0;
        let losses = 0;
        let refunded = 0;
        for (const b of mine) {
          if (b.status !== "void") staked += b.stake;
          if (b.status === "open") openRisk += b.stake;
          if (b.status === "void") refunded++;
          if (b.status === "won") {
            wonReturn += b.payout;
            wins++;
          }
          if (b.status === "lost") {
            lostStake += b.stake;
            losses++;
          }
          net += betNet(b);
        }
        const myLedger = ledger.filter((e) => e.playerId === player.id);
        // Split buy_in into component pots: $60 team, $10 CTP, $30 skins
        const teamPotNet = myLedger
          .filter((e) => e.sourceType === "team_pot" || e.sourceType === "buy_in")
          .reduce((s, e) => {
            if (e.sourceType === "buy_in") return s - TEAM_POT_PER_PLAYER;
            return s + e.amountCents;
          }, 0) / 100;
        const ctpNet = myLedger
          .filter((e) => e.sourceType === "ctp" || e.sourceType === "buy_in")
          .reduce((s, e) => {
            if (e.sourceType === "buy_in") return s - CTP_POT_PER_PLAYER;
            return s + e.amountCents;
          }, 0) / 100;
        const skinsNet = myLedger
          .filter((e) => e.sourceType === "skins" || e.sourceType === "buy_in")
          .reduce((s, e) => {
            if (e.sourceType === "buy_in") return s - SKINS_POT_PER_PLAYER;
            return s + e.amountCents;
          }, 0) / 100;
        const potNet = myLedger
          .filter((e) => e.sourceType !== "side_bet")
          .reduce((s, e) => s + e.amountCents, 0) / 100;
        const sideBetNet = myLedger
          .filter((e) => e.sourceType === "side_bet")
          .reduce((s, e) => s + e.amountCents, 0) / 100;
        return {
          player,
          staked,
          wonReturn,
          lostStake,
          net,
          openRisk,
          betsCount: mine.length,
          wins,
          losses,
          refunded,
          potNet,
          teamPotNet,
          ctpNet,
          skinsNet,
          sideBetNet,
          totalNet: net + potNet + sideBetNet,
        };
      })
      .sort((a, b) => b.totalNet - a.totalNet);
  }

  /* ----- Buy-ins ----- */
  listBuyIns(): BuyIn[] {
    return db.select().from(buyIns).all();
  }
  fundPots(): void {
    const ps = this.listPlayers();
    const existing = db.select().from(buyIns).all();
    const existingIds = new Set(existing.map((b) => b.playerId));
    for (const p of ps) {
      if (!existingIds.has(p.id)) {
        db.insert(buyIns).values({ playerId: p.id, amountCents: BUY_IN_CENTS, paid: true }).run();
        // Buy-in debits: $60 team pot, $10 CTP, $30 skins
        db.insert(ledgerEntries).values({ playerId: p.id, sourceType: "buy_in", sourceId: null, amountCents: -(TEAM_POT_PER_PLAYER + CTP_POT_PER_PLAYER + SKINS_POT_PER_PLAYER), description: "$100 buy-in (Team Pot $60 + CTP $10 + Skins $30)" }).run();
      }
    }
  }
  isFunded(): boolean {
    const r = db.select({ c: sql`count(*)` }).from(buyIns).get() as { c: number } | undefined;
    return (r?.c ?? 0) > 0;
  }

  /* ----- Ledger ----- */
  listLedgerEntries(): LedgerEntry[] {
    return db.select().from(ledgerEntries).orderBy(desc(ledgerEntries.createdAt)).all();
  }
  addLedgerEntry(playerId: number, sourceType: string, amountCents: number, description?: string, sourceId?: number): LedgerEntry {
    return db.insert(ledgerEntries).values({ playerId, sourceType, sourceId: sourceId ?? null, amountCents, description: description ?? null }).returning().get();
  }
  // Admin correction: remove a single mistaken ledger entry by id.
  deleteLedgerEntry(id: number): void {
    db.delete(ledgerEntries).where(eq(ledgerEntries.id, id)).run();
  }
  deleteLedgerBySource(sourceType: string, sourceId?: number): void {
    if (sourceId !== undefined) {
      db.delete(ledgerEntries).where(sql`${ledgerEntries.sourceType} = ${sourceType} AND ${ledgerEntries.sourceId} = ${sourceId}`).run();
    } else {
      db.delete(ledgerEntries).where(sql`${ledgerEntries.sourceType} = ${sourceType}`).run();
    }
  }
  hasLedgerEntries(sourceType: string): boolean {
    const r = db.select({ c: sql`count(*)` }).from(ledgerEntries).where(sql`${ledgerEntries.sourceType} = ${sourceType}`).get() as { c: number } | undefined;
    return (r?.c ?? 0) > 0;
  }

  /* ----- Scramble Units ----- */
  listScrambleUnits(): ScrambleUnitWithMembers[] {
    const units = db.select().from(scrambleUnits).orderBy(scrambleUnits.day, scrambleUnits.label).all();
    const members = db.select().from(scrambleUnitMembers).all();
    const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
    return units.map((u) => ({
      ...u,
      members: members
        .filter((m) => m.unitId === u.id)
        .map((m) => {
          const p = playerMap.get(m.playerId);
          return { id: m.playerId, name: p?.name ?? "Unknown", team: p?.team ?? null };
        }),
    }));
  }
  listScrambleUnitsByDay(day: number): ScrambleUnitWithMembers[] {
    return this.listScrambleUnits().filter((u) => u.day === day);
  }
  createScrambleUnit(day: number, unitType: string, team: string, label: string, playerIds: number[]): ScrambleUnit {
    const unit = db.insert(scrambleUnits).values({ day, unitType, team, label }).returning().get();
    for (const pid of playerIds) {
      db.insert(scrambleUnitMembers).values({ unitId: unit.id, playerId: pid }).run();
    }
    return unit;
  }
  deleteScrambleUnit(id: number): void {
    db.delete(scrambleUnits).where(eq(scrambleUnits.id, id)).run();
  }
  // Set a Day 1 group's final gross score / points earned (entered as a
  // whole from the tee sheet, not derived from hole-by-hole hole_scores).
  updateScrambleUnit(id: number, patch: { totalScore?: number | null; points?: number | null }): ScrambleUnit | undefined {
    return db.update(scrambleUnits).set(patch).where(eq(scrambleUnits.id, id)).returning().get();
  }

  /* ----- Hole Scores ----- */
  listHoleScores(): HoleScore[] {
    return db.select().from(holeScores).all();
  }
  listHoleScoresByDay(day: number): HoleScore[] {
    return db.select().from(holeScores).where(sql`${holeScores.day} = ${day}`).all();
  }
  upsertHoleScore(unitId: number, day: number, holeNumber: number, grossScore: number): void {
    const existing = db.select().from(holeScores)
      .where(sql`${holeScores.unitId} = ${unitId} AND ${holeScores.holeNumber} = ${holeNumber} AND ${holeScores.day} = ${day}`)
      .get();
    if (existing) {
      db.update(holeScores).set({ grossScore }).where(eq(holeScores.id, existing.id)).run();
    } else {
      db.insert(holeScores).values({ unitId, day, holeNumber, grossScore }).run();
    }
  }
  deleteHoleScoresByDay(day: number): void {
    db.delete(holeScores).where(sql`${holeScores.day} = ${day}`).run();
  }

  /* ----- CTP ----- */
  listCTPHoles(): (CTPHole & { entries: (CTPEntry & { playerName: string })[] })[] {
    const holes = db.select().from(ctpHoles).orderBy(ctpHoles.id).all();
    const entries = db.select().from(ctpEntries).all();
    const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
    return holes.map((h) => ({
      ...h,
      entries: entries
        .filter((e) => e.holeId === h.id)
        .map((e) => ({
          ...e,
          playerName: playerMap.get(e.playerId)?.name ?? "Unknown",
        })),
    }));
  }
  createCTPHole(label: string, holeNumber?: number): CTPHole {
    return db.insert(ctpHoles).values({ label, holeNumber: holeNumber ?? null, payoutCents: CTP_PAYOUT_PER_HOLE, finalized: false }).returning().get();
  }
  updateCTPHole(id: number, updates: Partial<Pick<CTPHole, "label" | "holeNumber">>): void {
    db.update(ctpHoles).set(updates).where(eq(ctpHoles.id, id)).run();
  }
  addCTPEntry(holeId: number, playerId: number, distance: string): void {
    db.insert(ctpEntries).values({ holeId, playerId, distance }).run();
  }
  deleteCTPEntry(id: number): void {
    db.delete(ctpEntries).where(eq(ctpEntries.id, id)).run();
  }
  setCTPWinners(holeId: number, winnerIds: number[]): void {
    db.update(ctpEntries).set({ isWinner: false }).where(eq(ctpEntries.holeId, holeId)).run();
    for (const pid of winnerIds) {
      db.update(ctpEntries).set({ isWinner: true }).where(sql`${ctpEntries.holeId} = ${holeId} AND ${ctpEntries.playerId} = ${pid}`).run();
    }
  }
  finalizeCTPHole(holeId: number): void {
    const hole = db.select().from(ctpHoles).where(eq(ctpHoles.id, holeId)).get();
    if (!hole) return;
    const winners = db.select().from(ctpEntries).where(sql`${ctpEntries.holeId} = ${holeId} AND ${ctpEntries.isWinner} = 1`).all();
    if (winners.length === 0) return;
    // Delete existing finalized entries for this hole (re-finalization safe)
    this.deleteLedgerBySource("ctp", holeId);
    const perWinner = Math.floor(hole.payoutCents / winners.length);
    for (const w of winners) {
      this.addLedgerEntry(w.playerId, "ctp", perWinner, `CTP winner — ${hole.label}`, holeId);
    }
    db.update(ctpHoles).set({ finalized: true }).where(eq(ctpHoles.id, holeId)).run();
  }

  /* ----- Team Points ----- */
  listTeamPoints(): TeamPoints[] {
    return db.select().from(teamPoints).orderBy(teamPoints.day).all();
  }
  upsertTeamPoints(day: number, team: string, points: number): TeamPoints {
    const existing = db.select().from(teamPoints)
      .where(sql`${teamPoints.day} = ${day} AND ${teamPoints.team} = ${team}`)
      .get();
    if (existing) {
      return db.update(teamPoints).set({ points, updatedAt: Date.now() }).where(eq(teamPoints.id, existing.id)).returning().get();
    }
    return db.insert(teamPoints).values({ day, team, points }).returning().get();
  }
  getTeamTotals(): { team: string; totalPoints: number }[] {
    const all = this.listTeamPoints();
    const teams = ["Team Tommy", "Goon Squad"];
    return teams.map((team) => ({
      team,
      totalPoints: all.filter((t) => t.team === team).reduce((s, t) => s + t.points, 0),
    }));
  }

  /* ----- Side Bets ----- */
  listSideBets(): SideBetWithContext[] {
    const bets = db.select().from(sideBets).orderBy(desc(sideBets.createdAt)).all();
    const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
    return bets.map((b) => ({
      ...b,
      creator: { id: b.creatorId, name: playerMap.get(b.creatorId)?.name ?? "Unknown", team: playerMap.get(b.creatorId)?.team ?? null },
      opponent: { id: b.opponentId, name: playerMap.get(b.opponentId)?.name ?? "Unknown", team: playerMap.get(b.opponentId)?.team ?? null },
      winner: b.winnerId ? { id: b.winnerId, name: playerMap.get(b.winnerId)?.name ?? "Unknown" } : null,
    }));
  }
  createSideBet(data: InsertSideBet): SideBet {
    return db.insert(sideBets).values({
      title: data.title,
      terms: data.terms ?? null,
      creatorId: data.creatorId,
      opponentId: data.opponentId,
      stakeCents: data.stakeCents,
      status: "proposed",
    }).returning().get();
  }
  acceptSideBet(id: number): void {
    db.update(sideBets).set({ status: "accepted" }).where(eq(sideBets.id, id)).run();
  }
  settleSideBet(id: number, winnerId: number): void {
    const bet = db.select().from(sideBets).where(eq(sideBets.id, id)).get();
    if (!bet || bet.status !== "accepted") return;
    // Delete existing ledger entries for re-settlement safety
    this.deleteLedgerBySource("side_bet", id);
    db.update(sideBets).set({ status: "settled", winnerId, settledAt: Date.now() }).where(eq(sideBets.id, id)).run();
    this.addLedgerEntry(winnerId, "side_bet", bet.stakeCents, `Won side bet: ${bet.title}`, id);
    const loserId = bet.creatorId === winnerId ? bet.opponentId : bet.creatorId;
    this.addLedgerEntry(loserId, "side_bet", -bet.stakeCents, `Lost side bet: ${bet.title}`, id);
  }
  voidSideBet(id: number): void {
    const bet = db.select().from(sideBets).where(eq(sideBets.id, id)).get();
    if (!bet) return;
    this.deleteLedgerBySource("side_bet", id);
    db.update(sideBets).set({ status: "void" }).where(eq(sideBets.id, id)).run();
  }

  /* ----- Pot Summaries ----- */
  getTeamPotSummary(): PotSummary {
    const funded = this.isFunded();
    const totals = this.getTeamTotals();
    const tommy = totals.find((t) => t.team === "Team Tommy")?.totalPoints ?? 0;
    const goon = totals.find((t) => t.team === "Goon Squad")?.totalPoints ?? 0;
    const hasPoints = this.listTeamPoints().length > 0;
    const finalized = this.hasLedgerEntries("team_pot");
    let status: PotSummary["status"];
    let payouts: PotPayout[] = [];
    if (finalized) {
      status = "finalized";
      // Read finalized payouts from ledger
      const entries = db.select().from(ledgerEntries).where(sql`${ledgerEntries.sourceType} = 'team_pot'`).all();
      const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
      payouts = entries.filter((e) => e.amountCents > 0).map((e) => ({
        playerId: e.playerId,
        playerName: playerMap.get(e.playerId)?.name ?? "Unknown",
        amountCents: e.amountCents,
      }));
    } else if (!hasPoints) {
      status = funded ? "pending" : "pending";
    } else if (tommy === goon) {
      status = "tie_unresolved";
    } else {
      status = "scoring";
      // Projected payouts
      const winningTeam = tommy > goon ? "Team Tommy" : "Goon Squad";
      const winners = this.listPlayers().filter((p) => p.team === winningTeam);
      payouts = winners.map((p) => ({ playerId: p.id, playerName: p.name, amountCents: TEAM_POT_PER_WINNER }));
    }
    return {
      type: "team_pot",
      name: "Winning Team Pot",
      totalCents: TEAM_POT_PAYOUT,
      funded,
      status,
      description: "Team with most cumulative match play points after 3 rounds. $1,440 split evenly across 12 winners ($120 each).",
      payouts,
    };
  }

  getCTPPotSummary(): PotSummary {
    const funded = this.isFunded();
    const holes = this.listCTPHoles();
    const allFinalized = holes.length > 0 && holes.every((h) => h.finalized);
    let status: PotSummary["status"];
    let payouts: PotPayout[] = [];
    if (allFinalized) {
      status = "finalized";
      const entries = db.select().from(ledgerEntries).where(sql`${ledgerEntries.sourceType} = 'ctp'`).all();
      const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
      // Aggregate by player
      const byPlayer = new Map<number, number>();
      for (const e of entries) {
        byPlayer.set(e.playerId, (byPlayer.get(e.playerId) ?? 0) + e.amountCents);
      }
      payouts = Array.from(byPlayer.entries()).map(([pid, cents]) => ({
        playerId: pid,
        playerName: playerMap.get(pid)?.name ?? "Unknown",
        amountCents: cents,
      }));
    } else {
      status = holes.length > 0 ? "scoring" : "pending";
      // Projected payouts from winners marked so far
      const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
      for (const h of holes) {
        const winners = h.entries.filter((e) => e.isWinner);
        if (winners.length > 0) {
          const perWinner = Math.floor(h.payoutCents / winners.length);
          for (const w of winners) {
            const existing = payouts.find((p) => p.playerId === w.playerId);
            if (existing) existing.amountCents += perWinner;
            else payouts.push({ playerId: w.playerId, playerName: w.playerName, amountCents: perWinner });
          }
        }
      }
    }
    return {
      type: "ctp",
      name: "Closest to Pin",
      totalCents: 24000,
      funded,
      status,
      description: "4 par-3 holes on Day 1. Each hole winner-take-all $60. Ties split evenly.",
      payouts,
    };
  }

  getSkinsDayResult(day: number, rolledOverCents: number): SkinsDayResult {
    const units = this.listScrambleUnitsByDay(day);
    const scores = this.listHoleScoresByDay(day);
    const potCents = SKINS_DAILY_POT + rolledOverCents;
    const holesPlayed = new Set(scores.map((s) => s.holeNumber));
    const skins: SkinsDayResult["skins"] = [];
    for (const holeNum of holesPlayed) {
      const holeScoresForHole = scores.filter((s) => s.holeNumber === holeNum);
      if (holeScoresForHole.length === 0) continue;
      const minScore = Math.min(...holeScoresForHole.map((s) => s.grossScore));
      const minScorers = holeScoresForHole.filter((s) => s.grossScore === minScore);
      // Skin = exactly one unit has the strict lowest
      if (minScorers.length === 1) {
        const unit = units.find((u) => u.id === minScorers[0].unitId);
        if (unit) {
          skins.push({
            unitId: unit.id,
            label: unit.label,
            team: unit.team,
            holeNumber: holeNum,
            members: unit.members.map((m) => m.name),
          });
        }
      }
    }
    const zeroSkins = skins.length === 0 && holesPlayed.size > 0;
    const skinValue = skins.length > 0 ? Math.floor(potCents / skins.length) : 0;
    return {
      day,
      potCents,
      rolledOver: rolledOverCents > 0,
      skinValue,
      skins,
      zeroSkins,
    };
  }

  getSkinsPotSummary(): PotSummary {
    const funded = this.isFunded();
    const finalized = this.hasLedgerEntries("skins");
    let status: PotSummary["status"];
    let payouts: PotPayout[] = [];
    if (finalized) {
      status = "finalized";
      const entries = db.select().from(ledgerEntries).where(sql`${ledgerEntries.sourceType} = 'skins'`).all();
      const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
      const byPlayer = new Map<number, number>();
      for (const e of entries) {
        byPlayer.set(e.playerId, (byPlayer.get(e.playerId) ?? 0) + e.amountCents);
      }
      payouts = Array.from(byPlayer.entries()).map(([pid, cents]) => ({
        playerId: pid,
        playerName: playerMap.get(pid)?.name ?? "Unknown",
        amountCents: cents,
      }));
    } else {
      // Calculate projected skins across Fri-Sat (days 2-3) with rollover.
      // Thursday (day 1) isn't a skins day.
      let rollover = 0;
      let anyScores = false;
      const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
      const byPlayer = new Map<number, number>();
      let day3ZeroSkins = false;
      for (let day = 2; day <= 3; day++) {
        const result = this.getSkinsDayResult(day, rollover);
        if (result.skins.length > 0 || result.zeroSkins) anyScores = true;
        if (result.zeroSkins) {
          rollover = result.potCents; // roll entire pot into next day
          if (day === 3) day3ZeroSkins = true;
        } else {
          rollover = 0;
          // Project payouts: split skinValue among unit members
          for (const skin of result.skins) {
            const unit = this.listScrambleUnitsByDay(day).find((u) => u.id === skin.unitId);
            if (unit) {
              const perMember = Math.floor(result.skinValue / unit.members.length);
              for (const m of unit.members) {
                byPlayer.set(m.id, (byPlayer.get(m.id) ?? 0) + perMember);
              }
            }
          }
        }
      }
      payouts = Array.from(byPlayer.entries()).map(([pid, cents]) => ({
        playerId: pid,
        playerName: playerMap.get(pid)?.name ?? "Unknown",
        amountCents: cents,
      }));
      if (day3ZeroSkins) {
        status = "tie_unresolved"; // Day 3 zero skins — no next day to roll into
      } else {
        status = anyScores ? "scoring" : "pending";
      }
    }
    return {
      type: "skins",
      name: "Skins",
      totalCents: 72000,
      funded,
      status,
      description: "$360/day (Fri-Sat only), field-wide. Skin = exactly one team has strict lowest gross score. Zero-skin day rolls $360 into next day.",
      payouts,
    };
  }

  getAllPots(): PotSummary[] {
    return [
      this.getTeamPotSummary(),
      this.getCTPPotSummary(),
      this.getSkinsPotSummary(),
    ];
  }

  /* ----- Pot Finalization ----- */
  finalizeTeamPot(): void {
    if (this.hasLedgerEntries("team_pot")) return; // already finalized
    const totals = this.getTeamTotals();
    const tommy = totals.find((t) => t.team === "Team Tommy")?.totalPoints ?? 0;
    const goon = totals.find((t) => t.team === "Goon Squad")?.totalPoints ?? 0;
    if (tommy === goon) return; // tie — unresolved
    const winningTeam = tommy > goon ? "Team Tommy" : "Goon Squad";
    const winners = this.listPlayers().filter((p) => p.team === winningTeam);
    for (const w of winners) {
      this.addLedgerEntry(w.id, "team_pot", TEAM_POT_PER_WINNER, `Team Pot winner — ${winningTeam}`);
    }
  }

  finalizeSkins(): void {
    if (this.hasLedgerEntries("skins")) return;
    let rollover = 0;
    for (let day = 2; day <= 3; day++) {
      const result = this.getSkinsDayResult(day, rollover);
      if (result.zeroSkins) {
        rollover = result.potCents;
        continue;
      }
      rollover = 0;
      for (const skin of result.skins) {
        const unit = this.listScrambleUnitsByDay(day).find((u) => u.id === skin.unitId);
        if (unit) {
          const perMember = Math.floor(result.skinValue / unit.members.length);
          for (const m of unit.members) {
            this.addLedgerEntry(m.id, "skins", perMember, `Skins Day ${day} — Hole ${skin.holeNumber} (${unit.label})`);
          }
        }
      }
    }
  }
  resetAll(): void {
    db.delete(bets).run();
    db.delete(marketOptions).run();
    db.delete(markets).run();
    db.delete(players).run();
    db.delete(roundScores).run();
    db.delete(sideBets).run();
    db.delete(ctpEntries).run();
    db.delete(ctpHoles).run();
    db.delete(holeScores).run();
    db.delete(scrambleUnitMembers).run();
    db.delete(scrambleUnits).run();
    db.delete(teamPoints).run();
    db.delete(ledgerEntries).run();
    db.delete(buyIns).run();
  }

  /* ----- Round Scores ----- */
  listRoundScores(): RoundScore[] {
    return db.select().from(roundScores).all();
  }
  upsertRoundScore(
    round: number,
    team: string,
    score: number
  ): RoundScore {
    const existing = db
      .select()
      .from(roundScores)
      .where(
        sql`${roundScores.round} = ${round} AND ${roundScores.team} = ${team}`
      )
      .get();
    if (existing) {
      return db
        .update(roundScores)
        .set({ score, updatedAt: Date.now() })
        .where(eq(roundScores.id, existing.id))
        .returning()
        .get();
    }
    return db
      .insert(roundScores)
      .values({ round, team, score })
      .returning()
      .get();
  }

  /* ----- Match Play (Days 2-3) ----- */
  listMatches(day?: number): Match[] {
    if (day !== undefined) {
      return db.select().from(matches).where(eq(matches.day, day)).orderBy(matches.matchIndex).all();
    }
    return db.select().from(matches).orderBy(matches.day, matches.matchIndex).all();
  }

  ensureMatches(): void {
    // Create 6 matches per day for days 2 and 3 if they don't exist
    for (const day of [2, 3]) {
      for (let i = 1; i <= 6; i++) {
        const existing = db.select().from(matches)
          .where(sql`${matches.day} = ${day} AND ${matches.matchIndex} = ${i}`)
          .get();
        if (!existing) {
          db.insert(matches).values({ day, matchIndex: i, status: "open" }).run();
        }
      }
    }
  }

  linkMatchUnits(matchId: number, tommyUnitId: number | null, goonUnitId: number | null): Match | undefined {
    return db.update(matches)
      .set({ tommyUnitId, goonUnitId })
      .where(eq(matches.id, matchId))
      .returning()
      .get();
  }

  getMatchHoleResults(matchId: number): MatchHoleResult[] {
    return db.select().from(matchHoleResults)
      .where(eq(matchHoleResults.matchId, matchId))
      .orderBy(matchHoleResults.holeNumber)
      .all();
  }

  upsertMatchHoleResult(matchId: number, holeNumber: number, result: string): MatchHoleResult {
    const valid = ["tommy", "goon", "halve"];
    if (!valid.includes(result)) throw new Error(`Invalid result: ${result}`);
    const existing = db.select().from(matchHoleResults)
      .where(sql`${matchHoleResults.matchId} = ${matchId} AND ${matchHoleResults.holeNumber} = ${holeNumber}`)
      .get();
    if (existing) {
      return db.update(matchHoleResults)
        .set({ result, updatedAt: Date.now() })
        .where(eq(matchHoleResults.id, existing.id))
        .returning()
        .get();
    }
    return db.insert(matchHoleResults)
      .values({ matchId, holeNumber, result })
      .returning()
      .get();
  }

  clearMatchHoleResult(matchId: number, holeNumber: number): void {
    db.delete(matchHoleResults)
      .where(sql`${matchHoleResults.matchId} = ${matchId} AND ${matchHoleResults.holeNumber} = ${holeNumber}`)
      .run();
  }

  getMatchSummaries(day: number): MatchSummary[] {
    const dayMatches = this.listMatches(day);
    const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
    const allUnitMembers = db.select().from(scrambleUnitMembers).all();

    return dayMatches.map((m) => {
      const holeResults = this.getMatchHoleResults(m.id);
      const tommyPlayers = m.tommyUnitId
        ? allUnitMembers.filter((um) => um.unitId === m.tommyUnitId)
            .map((um) => ({ id: um.playerId, name: playerMap.get(um.playerId)?.name ?? "?" }))
        : [];
      const goonPlayers = m.goonUnitId
        ? allUnitMembers.filter((um) => um.unitId === m.goonUnitId)
            .map((um) => ({ id: um.playerId, name: playerMap.get(um.playerId)?.name ?? "?" }))
        : [];
      const tommyWins = holeResults.filter((h) => h.result === "tommy").length;
      const goonWins = holeResults.filter((h) => h.result === "goon").length;
      const halved = holeResults.filter((h) => h.result === "halve").length;
      const thruHole = holeResults.length > 0
        ? Math.max(...holeResults.map((h) => h.holeNumber))
        : 0;
      return {
        match: m,
        tommyPlayers,
        goonPlayers,
        holeResults,
        tommyWins,
        goonWins,
        halved,
        thruHole,
      };
    });
  }

  getDayHoleTotals(day: number): { tommy: number; goon: number; halved: number } {
    const summaries = this.getMatchSummaries(day);
    return {
      tommy: summaries.reduce((s, m) => s + m.tommyWins, 0),
      goon: summaries.reduce((s, m) => s + m.goonWins, 0),
      halved: summaries.reduce((s, m) => s + m.halved, 0),
    };
  }

  /* ----- Score Tokens ----- */
  generateScoreToken(matchId: number): ScoreToken {
    // Generate a random 8-char token (alphanumeric, no ambiguous chars)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let token = "";
    for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return db.insert(scoreTokens).values({ token, matchId }).returning().get();
  }

  getScoreToken(token: string): ScoreToken | undefined {
    return db.select().from(scoreTokens).where(eq(scoreTokens.token, token)).get();
  }

  getMatchScoreEntry(token: string): MatchScoreEntry | undefined {
    const st = this.getScoreToken(token);
    if (!st) return undefined;
    const match = db.select().from(matches).where(eq(matches.id, st.matchId)).get();
    if (!match) return undefined;
    const playerMap = new Map(this.listPlayers().map((p) => [p.id, p]));
    const allUnitMembers = db.select().from(scrambleUnitMembers).all();
    const tommyPlayers = match.tommyUnitId
      ? allUnitMembers.filter((um) => um.unitId === match.tommyUnitId)
          .map((um) => ({ id: um.playerId, name: playerMap.get(um.playerId)?.name ?? "?" }))
      : [];
    const goonPlayers = match.goonUnitId
      ? allUnitMembers.filter((um) => um.unitId === match.goonUnitId)
          .map((um) => ({ id: um.playerId, name: playerMap.get(um.playerId)?.name ?? "?" }))
      : [];
    const holeResults = this.getMatchHoleResults(match.id)
      .map((h) => ({ holeNumber: h.holeNumber, result: h.result }));
    const tommyWins = holeResults.filter((h) => h.result === "tommy").length;
    const goonWins = holeResults.filter((h) => h.result === "goon").length;
    const halved = holeResults.filter((h) => h.result === "halve").length;
    return {
      matchId: match.id,
      day: match.day,
      matchIndex: match.matchIndex,
      tommyPlayers,
      goonPlayers,
      holeResults,
      tommyWins,
      goonWins,
      halved,
    };
  }

  listScoreTokens(): { token: string; matchId: number; day: number; matchIndex: number }[] {
    const tokens = db.select().from(scoreTokens).all();
    return tokens.map((t) => {
      const m = db.select().from(matches).where(eq(matches.id, t.matchId)).get();
      return {
        token: t.token,
        matchId: t.matchId,
        day: m?.day ?? 0,
        matchIndex: m?.matchIndex ?? 0,
      };
    });
  }

  /** Build the starter markets from a list of player names (used on first run
   *  and after a roster replace). Options are real player names + a Field. */
  seedMarkets(names: string[]): void {
    const at = (i: number) => (i >= 0 && i < names.length ? names[i] : null);
    const opts = (idxs: number[]) => [
      ...idxs.map(at).filter((n): n is string => !!n),
      "Field (anyone else)",
    ];
    const make = (
      title: string,
      category: string,
      labels: string[]
    ) => {
      const m = db
        .insert(markets)
        .values({
          title,
          category,
          status: "open",
          cashOutLockAt: defaultLockForCategory(category),
        })
        .returning()
        .get();
      for (const label of labels)
        db.insert(marketOptions).values({ marketId: m.id, label, odds: 0 }).run();
    };

    make("Tournament Winner — Overall Low Net", "Tournament", opts([0, 12, 2, 14, 5, 18]));
    make("Dead Last — Highest Gross Score", "Props", opts([11, 23, 7, 19, 9]));
    make("Closest to the Pin — Par 3, 14th Hole", "Props", opts([0, 12, 2, 14, 8]));
    make("Long Drive — Round 2", "Round 2", opts([3, 15, 6, 17, 20]));
    make("Round 1 Low Net Winner", "Round 1", opts([0, 12, 4, 16, 10]));
    make("Team Match — Lowest Team Net", "Teams", [
      "Team Tommy",
      "Goon Squad",
      "Tie",
    ]);
  }
}

export const storage = new DatabaseStorage();

/* ThirtyWest Golf Tournament roster — Aug 13–15, 2026, Seven Springs.
 * Two teams of 12. Captains: Chad Pavlecic (Team Tommy), Adam Henger (Goon Squad).
 * Declared before the seed call so it is initialized at runtime. */
const DEFAULT_ROSTER: { name: string; team: string }[] = [
  // Team Tommy (dark green)
  { name: "Chad Pavlecic", team: "Team Tommy" },
  { name: "Zach Freeman", team: "Team Tommy" },
  { name: "Nick Groat", team: "Team Tommy" },
  { name: "Brett Gwosden", team: "Team Tommy" },
  { name: "Eric Lowry", team: "Team Tommy" },
  { name: "Scott Lowry", team: "Team Tommy" },
  { name: "TJ McAneny", team: "Team Tommy" },
  { name: "Jack Schrey", team: "Team Tommy" },
  { name: "Josh Seidel", team: "Team Tommy" },
  { name: "Matt Shanty", team: "Team Tommy" },
  { name: "Tommie Brunswick", team: "Team Tommy" },
  { name: "Zeke II", team: "Team Tommy" },
  // Goon Squad (orange)
  { name: "Adam Henger", team: "Goon Squad" },
  { name: "Jordan DeFrances", team: "Goon Squad" },
  { name: "Gavin Eash", team: "Goon Squad" },
  { name: "Zach Franklin", team: "Goon Squad" },
  { name: "Matt Ingram", team: "Goon Squad" },
  { name: "Nate Jimenez", team: "Goon Squad" },
  { name: "Liam Moran", team: "Goon Squad" },
  { name: "Matt Onorato", team: "Goon Squad" },
  { name: "Tyler Stout", team: "Goon Squad" },
  { name: "Matt Varga", team: "Goon Squad" },
  { name: 'Bob Scoot Wesner', team: "Goon Squad" },
  { name: "Gino Vitalie", team: "Goon Squad" },
];

/* ---------- Seed on first run ---------- */
const count = db.select({ c: sql`count(*)` }).from(players).get() as
  | { c: number }
  | undefined;
if (!count || count.c === 0) {
  seed();
}

function seed() {
  for (const p of DEFAULT_ROSTER) {
    db.insert(players).values({ name: p.name, team: p.team, active: true }).run();
  }
  storage.seedMarkets(DEFAULT_ROSTER.map((p) => p.name));
}
