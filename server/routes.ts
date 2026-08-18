import type { Express } from "express";
import { storage, rawDb } from "./storage";
import { requirePin } from "./auth";
import {
  insertPlayerSchema,
  insertMarketSchema,
  insertBetSchema,
  insertRoundScoreSchema,
  insertSideBetSchema,
  type InsertPlayer,
  type InsertMarket,
  type InsertBet,
} from "@shared/schema";
import { z } from "zod";

export function registerRoutes(_httpServer: any, app: Express) {
  /* ---------- Players ---------- */
  app.get("/api/players", (_req, res) => {
    res.json(storage.listPlayers());
  });

  app.post("/api/players", requirePin, (req, res) => {
    const parsed = insertPlayerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid player" });
    res.json(storage.createPlayer(parsed.data as InsertPlayer));
  });

  app.patch("/api/players/:id", requirePin, (req, res) => {
    const id = Number(req.params.id);
    const parsed = insertPlayerSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid player" });
    res.json(storage.updatePlayer(id, parsed.data));
  });

  app.delete("/api/players/:id", requirePin, (req, res) => {
    storage.deletePlayer(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Markets ---------- */
  app.get("/api/markets", (_req, res) => {
    res.json(storage.listMarkets());
  });

  app.get("/api/markets/:id", (req, res) => {
    const m = storage.getMarket(Number(req.params.id));
    if (!m) return res.status(404).json({ message: "Not found" });
    res.json(m);
  });

  const createMarketSchema = z.object({
    title: z.string().min(1),
    category: z.string().min(1),
    closesAt: z.string().optional(),
    options: z
      .array(z.object({ label: z.string().min(1), odds: z.number().optional() }))
      .min(2),
  });

  app.post("/api/markets", requirePin, (req, res) => {
    const parsed = createMarketSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid market" });
    const { title, category, closesAt, options } = parsed.data;
    res.json(
      storage.createMarket(
        { title, category, closesAt } as InsertMarket,
        options
      )
    );
  });

  app.patch("/api/markets/:id", requirePin, (req, res) => {
    const id = Number(req.params.id);
    const patch = req.body as {
      status?: string;
      closesAt?: string;
      title?: string;
      cashOutLockAt?: string | null;
    };
    res.json(storage.updateMarket(id, patch));
  });

  app.delete("/api/markets/:id", requirePin, (req, res) => {
    storage.deleteMarket(Number(req.params.id));
    res.json({ ok: true });
  });

  // Void an entire market — voids all open bets and marks the market void/closed
  app.post("/api/markets/:id/void", requirePin, (req, res) => {
    const id = Number(req.params.id);
    const market = storage.getMarket(id);
    if (!market) return res.status(404).json({ message: "Market not found" });
    const marketBets = storage.listBets().filter((b) => b.marketId === id && b.status === "open");
    for (const b of marketBets) {
      storage.voidBet(b.id);
    }
    storage.updateMarket(id, { status: "closed", winnerOptionIds: null });
    res.json({ ok: true, voidedBets: marketBets.length });
  });

  // update a single option's odds
  app.patch("/api/options/:id", requirePin, (req, res) => {
    const id = Number(req.params.id);
    const { odds } = req.body as { odds?: number };
    if (typeof odds !== "number")
      return res.status(400).json({ message: "odds required" });
    storage.updateOption(id, { odds });
    res.json({ ok: true });
  });

  /* ---------- Bets ---------- */
  app.get("/api/bets", (_req, res) => {
    res.json(storage.listBets());
  });

  app.get("/api/bets/player/:playerId", (req, res) => {
    res.json(storage.listBetsForPlayer(Number(req.params.playerId)));
  });

  app.get("/api/bets/market/:marketId", (req, res) => {
    res.json(storage.listBetsForMarket(Number(req.params.marketId)));
  });

  app.post("/api/bets", (req, res) => {
    const parsed = insertBetSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid bet" });
    // Don't allow betting on closed/graded markets
    const market = storage.getMarket(parsed.data.marketId);
    if (!market) return res.status(404).json({ message: "Market not found" });
    if (market.status !== "open")
      return res.status(400).json({ message: "Market is not open for betting" });
    res.json(storage.createBet(parsed.data as InsertBet));
  });

  app.post("/api/bets/:id/void", requirePin, (req, res) => {
    const id = Number(req.params.id);
    const bet = storage.listBets().find((b) => b.id === id);
    if (!bet) return res.status(404).json({ message: "Bet not found" });
    if (bet.status !== "open")
      return res
        .status(400)
        .json({ message: "Only open bets can be cancelled" });
    res.json(storage.voidBet(id));
  });

  // Player cash-out = refund an open bet before the market's cash-out lock
  // time. Not PIN-gated (it's a player action, like placing a bet) but the
  // server validates ownership (soft), status, and the lock time.
  app.post("/api/bets/:id/cashout", (req, res) => {
    const id = Number(req.params.id);
    const { playerId } = req.body as { playerId?: number };
    const bet = storage.listBets().find((b) => b.id === id);
    if (!bet) return res.status(404).json({ message: "Bet not found" });
    if (typeof playerId !== "number" || playerId !== bet.playerId)
      return res.status(403).json({ message: "Not your bet" });
    if (bet.status !== "open")
      return res.status(400).json({ message: "Bet is not open" });
    if (storage.findFreeBetGrantByBetId(id))
      return res.status(400).json({ message: "Free bets can't be cashed out" });
    const market = storage.getMarket(bet.marketId);
    if (!market) return res.status(404).json({ message: "Market not found" });
    const lockAt = market.cashOutLockAt
      ? new Date(market.cashOutLockAt).getTime()
      : NaN;
    if (!Number.isFinite(lockAt))
      return res.status(400).json({ message: "No cash-out lock set" });
    if (Date.now() >= lockAt)
      return res.status(400).json({ message: "Cash-out window has closed" });
    res.json(storage.voidBet(id));
  });

  /* ---------- Settlement ---------- */
  app.post("/api/markets/:id/grade", requirePin, (req, res) => {
    const id = Number(req.params.id);
    const { winnerOptionIds } = req.body as {
      winnerOptionIds: number[];
    };
    if (
      !Array.isArray(winnerOptionIds) ||
      winnerOptionIds.length === 0 ||
      !winnerOptionIds.every((v) => typeof v === "number")
    )
      return res
        .status(400)
        .json({ message: "winnerOptionIds must be a non-empty array" });
    storage.gradeMarket(id, winnerOptionIds);
    res.json({ ok: true });
  });

  /* ---------- Book fill (pre-grade) ---------- */
  app.post("/api/markets/:id/book-fill", requirePin, (req, res) => {
    storage.bookFillMarket(Number(req.params.id));
    res.json({ ok: true });
  });
  app.delete("/api/markets/:id/book-fill", requirePin, (req, res) => {
    storage.removeBookFill(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Free Bet Grants (comped bets, redeemed by the player) ---------- */
  // Admin: grant a player eligibility for a free bet (no market chosen yet).
  const grantFreeBetSchema = z.object({
    playerId: z.number(),
    amountCents: z.number().positive().optional(),
  });
  app.post("/api/free-bets", requirePin, (req, res) => {
    const parsed = grantFreeBetSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid free bet grant" });
    const { playerId, amountCents } = parsed.data;
    try {
      res.json(storage.grantFreeBetEligibility(playerId, amountCents ?? 1000));
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to grant free bet" });
    }
  });

  // Admin: list every grant (any status).
  app.get("/api/free-bets", requirePin, (_req, res) => {
    res.json(storage.listFreeBetGrants());
  });

  // Public: a player's own grants, so the UI can show "you have a free bet".
  app.get("/api/free-bets/player/:playerId", (req, res) => {
    res.json(storage.listFreeBetGrantsForPlayer(Number(req.params.playerId)));
  });

  // Player redeems their own grant on a market/option they picked. Soft
  // ownership check via playerId in the body, like /api/bets/:id/cashout —
  // this is a player action (placing their own bet), not an admin action.
  const redeemFreeBetSchema = z.object({
    playerId: z.number(),
    marketId: z.number(),
    optionId: z.number(),
  });
  app.post("/api/free-bets/:id/redeem", (req, res) => {
    const parsed = redeemFreeBetSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid redemption request" });
    const id = Number(req.params.id);
    const grants = storage.listFreeBetGrants();
    const grant = grants.find((g) => g.id === id);
    if (!grant) return res.status(404).json({ message: "Free bet grant not found" });
    if (grant.playerId !== parsed.data.playerId)
      return res.status(403).json({ message: "Not your free bet" });
    try {
      res.json(storage.redeemFreeBet(id, parsed.data.marketId, parsed.data.optionId));
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to redeem free bet" });
    }
  });

  // Admin: revoke a grant (undoes any placement and removes it).
  app.delete("/api/free-bets/:id", requirePin, (req, res) => {
    storage.revokeFreeBetGrant(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Standings ---------- */
  app.get("/api/standings", (_req, res) => {
    res.json(storage.standings());
  });

  /* ---------- Round Scores (team scoreboard) ---------- */
  app.get("/api/scores", (_req, res) => {
    res.json(storage.listRoundScores());
  });
  app.post("/api/scores", requirePin, (req, res) => {
    const parsed = insertRoundScoreSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid score" });
    res.json(
      storage.upsertRoundScore(
        parsed.data.round,
        parsed.data.team,
        parsed.data.score
      )
    );
  });

  /* ---------- Admin / reset ---------- */
  app.post("/api/admin/reset", requirePin, (_req, res) => {
    storage.resetAll();
    res.json({ ok: true });
  });

  const reseedSchema = z.array(
    z.object({ name: z.string().min(1), team: z.string().optional() })
  );
  app.post("/api/admin/reseed-players", requirePin, (req, res) => {
    const parsed = reseedSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid roster" });
    storage.resetAll();
    for (const p of parsed.data) {
      storage.createPlayer({ name: p.name, team: p.team, active: true });
    }
    storage.seedMarkets(parsed.data.map((p) => p.name));
    res.json({ ok: true, count: parsed.data.length });
  });

  /* ---------- Pots ---------- */
  app.get("/api/pots", (_req, res) => {
    res.json(storage.getAllPots());
  });

  app.post("/api/pots/fund", requirePin, (_req, res) => {
    storage.fundPots();
    res.json({ ok: true });
  });

  app.get("/api/buy-ins", (_req, res) => {
    res.json(storage.listBuyIns());
  });

  // Correct one player's actual buy-in (partial or $0 payments happen).
  app.patch("/api/buy-ins/:playerId", requirePin, (req, res) => {
    const { amountCents } = req.body as { amountCents?: number };
    if (typeof amountCents !== "number" || amountCents < 0) {
      return res.status(400).json({ message: "amountCents must be a non-negative number" });
    }
    storage.updateBuyIn(Number(req.params.playerId), amountCents);
    res.json({ ok: true });
  });

  app.post("/api/pots/finalize-team", requirePin, (_req, res) => {
    storage.finalizeTeamPot();
    res.json({ ok: true });
  });

  app.post("/api/pots/finalize-skins", requirePin, (_req, res) => {
    storage.finalizeSkins();
    res.json({ ok: true });
  });

  /* ---------- Ledger ---------- */
  app.get("/api/ledger", (_req, res) => {
    res.json(storage.listLedgerEntries());
  });

  // Admin correction: remove a single mistaken ledger entry.
  app.delete("/api/ledger/:id", requirePin, (req, res) => {
    storage.deleteLedgerEntry(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Scramble Units ---------- */
  app.get("/api/units", (_req, res) => {
    res.json(storage.listScrambleUnits());
  });

  app.post("/api/units", requirePin, (req, res) => {
    const { day, unitType, team, label, playerIds } = req.body;
    if (!day || !unitType || !team || !label || !Array.isArray(playerIds)) {
      return res.status(400).json({ message: "Missing fields" });
    }
    const unit = storage.createScrambleUnit(day, unitType, team, label, playerIds);
    res.json(unit);
  });

  app.delete("/api/units/:id", requirePin, (req, res) => {
    storage.deleteScrambleUnit(Number(req.params.id));
    res.json({ ok: true });
  });

  // Set a Day 1 group's final gross score / points earned.
  app.patch("/api/units/:id", requirePin, (req, res) => {
    const { totalScore, points } = req.body as { totalScore?: number | null; points?: number | null };
    const unit = storage.updateScrambleUnit(Number(req.params.id), { totalScore, points });
    if (!unit) return res.status(404).json({ message: "Unit not found" });
    res.json(unit);
  });

  /* ---------- Hole Scores ---------- */
  app.get("/api/hole-scores", (_req, res) => {
    res.json(storage.listHoleScores());
  });

  app.get("/api/hole-scores/day/:day", (req, res) => {
    res.json(storage.listHoleScoresByDay(Number(req.params.day)));
  });

  app.post("/api/hole-scores", requirePin, (req, res) => {
    const { unitId, day, holeNumber, grossScore } = req.body;
    storage.upsertHoleScore(unitId, day, holeNumber, grossScore);
    res.json({ ok: true });
  });

  app.delete("/api/hole-scores/day/:day", requirePin, (req, res) => {
    storage.deleteHoleScoresByDay(Number(req.params.day));
    res.json({ ok: true });
  });

  /* ---------- Skins ---------- */
  app.get("/api/skins/day/:day", (req, res) => {
    const day = Number(req.params.day);
    // Check for rollover from previous skins days (Fri-Sat only — Thursday
    // isn't a skins day).
    let rollover = 0;
    for (let d = 2; d < day; d++) {
      const result = storage.getSkinsDayResult(d, rollover);
      if (result.zeroSkins) {
        rollover = result.potCents;
      } else {
        rollover = 0;
      }
    }
    res.json(storage.getSkinsDayResult(day, rollover));
  });

  // Manual skins entry — admin records who won a given hole's skin (1-2
  // players splitting the payout) for a day. Re-callable per hole: replaces
  // any prior entry for that exact day+hole without touching other holes.
  const skinsHoleWinSchema = z.object({
    day: z.number(),
    holeNumber: z.number(),
    winners: z.array(z.object({ playerId: z.number(), amountCents: z.number().positive() })).min(1),
  });
  app.post("/api/skins/hole-win", requirePin, (req, res) => {
    const parsed = skinsHoleWinSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid skins entry" });
    storage.recordSkinsHoleWin(parsed.data.day, parsed.data.holeNumber, parsed.data.winners);
    res.json({ ok: true });
  });

  app.get("/api/skins/hole-wins/:day", (req, res) => {
    res.json(storage.listSkinsHoleWins(Number(req.params.day)));
  });

  app.delete("/api/skins/hole-win/:day/:hole", requirePin, (req, res) => {
    storage.removeSkinsHoleWin(Number(req.params.day), Number(req.params.hole));
    res.json({ ok: true });
  });

  /* ---------- CTP ---------- */
  app.get("/api/ctp", (_req, res) => {
    res.json(storage.listCTPHoles());
  });

  app.post("/api/ctp/holes", requirePin, (req, res) => {
    const { label, holeNumber } = req.body;
    const hole = storage.createCTPHole(label || `CTP Hole ${storage.listCTPHoles().length + 1}`, holeNumber);
    res.json(hole);
  });

  app.patch("/api/ctp/holes/:id", requirePin, (req, res) => {
    const { label, holeNumber } = req.body;
    storage.updateCTPHole(Number(req.params.id), { label, holeNumber });
    res.json({ ok: true });
  });

  app.post("/api/ctp/entries", requirePin, (req, res) => {
    const { holeId, playerId, distance } = req.body;
    if (!holeId || !playerId) {
      return res.status(400).json({ message: "Missing fields" });
    }
    storage.addCTPEntry(holeId, playerId, distance || "");
    res.json({ ok: true });
  });

  app.delete("/api/ctp/entries/:id", requirePin, (req, res) => {
    storage.deleteCTPEntry(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/ctp/holes/:id/winners", requirePin, (req, res) => {
    const { winnerIds } = req.body;
    if (!Array.isArray(winnerIds)) {
      return res.status(400).json({ message: "winnerIds must be an array" });
    }
    storage.setCTPWinners(Number(req.params.id), winnerIds);
    res.json({ ok: true });
  });

  app.post("/api/ctp/holes/:id/finalize", requirePin, (req, res) => {
    storage.finalizeCTPHole(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Team Points ---------- */
  app.get("/api/team-points", (_req, res) => {
    res.json(storage.listTeamPoints());
  });

  app.post("/api/team-points", requirePin, (req, res) => {
    const { day, team, points } = req.body;
    if (!day || !team || typeof points !== "number") {
      return res.status(400).json({ message: "Missing fields" });
    }
    const result = storage.upsertTeamPoints(day, team, points);
    res.json(result);
  });

  /* ---------- Side Bets ---------- */
  app.get("/api/side-bets", (_req, res) => {
    res.json(storage.listSideBets());
  });

  app.post("/api/side-bets", (req, res) => {
    const parsed = insertSideBetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid side bet", errors: parsed.error.errors });
    }
    const bet = storage.createSideBet(parsed.data);
    res.json(bet);
  });

  app.post("/api/side-bets/:id/accept", (req, res) => {
    storage.acceptSideBet(Number(req.params.id));
    res.json({ ok: true });
  });

  app.post("/api/side-bets/:id/settle", requirePin, (req, res) => {
    const { winnerId } = req.body;
    if (!winnerId) {
      return res.status(400).json({ message: "winnerId required" });
    }
    storage.settleSideBet(Number(req.params.id), winnerId);
    res.json({ ok: true });
  });

  app.post("/api/side-bets/:id/void", requirePin, (req, res) => {
    storage.voidSideBet(Number(req.params.id));
    res.json({ ok: true });
  });

  /* ---------- Backup / Restore ---------- */
  // Export all data as a JSON snapshot (admin only)
  app.get("/api/admin/export", requirePin, (_req, res) => {
    const tables = [
      "players", "markets", "market_options", "bets", "round_scores",
      "buy_ins", "ledger_entries", "scramble_units", "scramble_unit_members",
      "hole_scores", "ctp_holes", "ctp_entries", "team_points", "side_bets",
    ];
    const snapshot: Record<string, unknown[]> = {};
    for (const t of tables) {
      try {
        snapshot[t] = rawDb.prepare(`SELECT * FROM ${t}`).all();
      } catch {
        snapshot[t] = [];
      }
    }
    res.setHeader("Content-Type", "application/json");
    res.json({ exportedAt: new Date().toISOString(), tables: snapshot });
  });

  // Import a JSON snapshot (admin only) — wipes all existing data first
  app.post("/api/admin/import", requirePin, (req, res) => {
    const snapshot = req.body?.tables;
    if (!snapshot || typeof snapshot !== "object") {
      return res.status(400).json({ message: "Invalid snapshot format" });
    }
    const tables = Object.keys(snapshot);
    // Disable FK checks during restore so order doesn't matter
    rawDb.pragma("foreign_keys = OFF");
    for (const t of tables) {
      const rows = snapshot[t];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      // Wipe existing
      rawDb.exec(`DELETE FROM ${t}`);
      // Get column names from first row
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => "?").join(", ");
      const colList = cols.join(", ");
      const stmt = rawDb.prepare(`INSERT INTO ${t} (${colList}) VALUES (${placeholders})`);
      for (const row of rows) {
        stmt.run(...cols.map((c) => row[c]));
      }
      // Reset autoincrement so next insert gets the right ID
      const maxId = rows.reduce((max, r) => {
        const v = r["id"];
        return typeof v === "number" && v > max ? v : max;
      }, 0);
      if (maxId > 0) {
        try { rawDb.exec(`UPDATE sqlite_sequence SET seq = ${maxId} WHERE name = '${t}'`); } catch {}
      }
    }
    rawDb.pragma("foreign_keys = ON");
    res.json({ ok: true, tables: tables.map((t) => ({ name: t, rows: snapshot[t].length })) });
  });

  /* ---------- Match Play (Days 2-3) ---------- */
  // Ensure matches exist
  app.get("/api/matches/ensure", (req, res) => {
    storage.ensureMatches();
    res.json({ ok: true });
  });

  // List matches for a day (or all)
  app.get("/api/matches", (req, res) => {
    const day = req.query.day ? parseInt(req.query.day as string) : undefined;
    res.json(storage.listMatches(day));
  });

  // Get match summaries for a day (with hole results, player names, counts)
  app.get("/api/matches/summaries/:day", (req, res) => {
    const day = parseInt(req.params.day);
    storage.ensureMatches();
    res.json(storage.getMatchSummaries(day));
  });

  // Get day hole totals
  app.get("/api/matches/totals/:day", (req, res) => {
    const day = parseInt(req.params.day);
    res.json(storage.getDayHoleTotals(day));
  });

  // Admin: link match to scramble units
  app.post("/api/matches/:id/link", requirePin, (req, res) => {
    const { tommyUnitId, goonUnitId } = req.body;
    const updated = storage.linkMatchUnits(
      parseInt(req.params.id),
      tommyUnitId ?? null,
      goonUnitId ?? null
    );
    res.json(updated);
  });

  // Admin: upsert hole result directly
  app.post("/api/matches/:id/hole", requirePin, (req, res) => {
    const { holeNumber, result } = req.body;
    if (!holeNumber || !result) return res.status(400).json({ error: "Missing holeNumber or result" });
    const r = storage.upsertMatchHoleResult(parseInt(req.params.id), holeNumber, result);
    res.json(r);
  });

  // Admin: clear hole result
  app.delete("/api/matches/:id/hole/:hole", requirePin, (req, res) => {
    storage.clearMatchHoleResult(parseInt(req.params.id), parseInt(req.params.hole));
    res.json({ ok: true });
  });

  // Admin: generate score token for a match
  app.post("/api/matches/:id/token", requirePin, (req, res) => {
    const token = storage.generateScoreToken(parseInt(req.params.id));
    res.json(token);
  });

  // Admin: list all score tokens
  app.get("/api/score-tokens", requirePin, (req, res) => {
    res.json(storage.listScoreTokens());
  });

  // Public: get match score entry by token (no auth)
  app.get("/api/score/:token", (req, res) => {
    const entry = storage.getMatchScoreEntry(req.params.token);
    if (!entry) return res.status(404).json({ error: "Invalid token" });
    res.json(entry);
  });

  // Public: submit hole result by token (no auth)
  app.post("/api/score/:token/hole", (req, res) => {
    const { holeNumber, result } = req.body;
    if (!holeNumber || !result) return res.status(400).json({ error: "Missing holeNumber or result" });
    const entry = storage.getMatchScoreEntry(req.params.token);
    if (!entry) return res.status(404).json({ error: "Invalid token" });
    const valid = ["tommy", "goon", "halve"];
    if (!valid.includes(result)) return res.status(400).json({ error: "Invalid result" });
    const r = storage.upsertMatchHoleResult(entry.matchId, holeNumber, result);
    res.json(r);
  });

  // Public: clear hole result by token (correction)
  app.delete("/api/score/:token/hole/:hole", (req, res) => {
    const entry = storage.getMatchScoreEntry(req.params.token);
    if (!entry) return res.status(404).json({ error: "Invalid token" });
    storage.clearMatchHoleResult(entry.matchId, parseInt(req.params.hole));
    res.json({ ok: true });
  });
}
