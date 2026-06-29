
"use strict";

require("dotenv").config();               // loads .env into process.env
const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch");

const app  = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SPORTSDB_API_KEY;

/* ── Validate that a key is actually configured ─────────────── */
if (!API_KEY || API_KEY === "YOUR_PREMIUM_KEY_HERE") {
  console.error("\n❌  SPORTSDB_API_KEY is not set in your .env file.");
  console.error("    Open .env and paste your TheSportsDB premium key.\n");
  process.exit(1);
}

/* ── CORS — only allow requests from your own frontend ──────── */
const allowedOrigin = process.env.ALLOWED_ORIGIN || "http://localhost:5500";
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin) return callback(null, true);
    callback(new Error("CORS: origin not allowed → " + origin));
  }
}));

app.use(express.json());

/* ── TheSportsDB base URLs ──────────────────────────────────── */
const TSDB_V1 = "https://www.thesportsdb.com/api/v1/json";
const TSDB_V2 = "https://www.thesportsdb.com/api/v2/json";

/* ── Helper: forward a V2 request with the API key in header ── */
async function fetchV2(path) {
  const url = TSDB_V2 + path;
  const res = await fetch(url, {
    headers: { "X-API-KEY": API_KEY }
  });
  if (!res.ok) {
    const err = new Error("TheSportsDB responded with " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ── Helper: forward a V1 request (key in URL) ──────────────── */
async function fetchV1(path) {
  const url = TSDB_V1 + "/" + API_KEY + path;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error("TheSportsDB responded with " + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/* ============================================================
   ROUTES — all prefixed /api so they're easy to proxy later
   ============================================================ */

/* ── Health check (test the server is running) ───────────────
   GET /api/health
   Response: { ok: true, timestamp: "..." }
   ─────────────────────────────────────────────────────────── */
app.get("/api/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

/* ── Live scores — all soccer ────────────────────────────────
   GET /api/livescores
   Response: TheSportsDB livescore payload (normalized)
   ─────────────────────────────────────────────────────────── */
app.get("/api/livescores", async (req, res) => {
  try {
    const data = await fetchV2("/livescore/soccer");
    const events = data.livescore || [];

    // Normalize into the shape our frontend already expects
    const normalized = events.map(ev => ({
      id:          "api_" + ev.idEvent,
      externalId:  ev.idEvent,
      competition: ev.strLeague  || "Football",
      homeTeam:    ev.strHomeTeam,
      awayTeam:    ev.strAwayTeam,
      homeAbbr:    (ev.strHomeTeam || "").slice(0, 3).toUpperCase(),
      awayAbbr:    (ev.strAwayTeam || "").slice(0, 3).toUpperCase(),
      homeScore:   ev.intHomeScore != null ? parseInt(ev.intHomeScore, 10) : null,
      awayScore:   ev.intAwayScore != null ? parseInt(ev.intAwayScore, 10) : null,
      status:      resolveStatus(ev),
      minute:      ev.strProgress || null,
      kickoff:     ev.dateEvent && ev.strTime ? ev.dateEvent + "T" + ev.strTime : null,
      source:      "api",
      updatedAt:   Date.now()
    }));

    res.json({ ok: true, matches: normalized });
  } catch (err) {
    console.error("[/api/livescores]", err.message);
    res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

/* ── Live scores for a specific league ───────────────────────
   GET /api/livescores/:leagueId
   Example: GET /api/livescores/4328  (Premier League)
   ─────────────────────────────────────────────────────────── */
app.get("/api/livescores/:leagueId", async (req, res) => {
  const { leagueId } = req.params;
  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({ ok: false, error: "leagueId must be a number" });
  }
  try {
    const data = await fetchV2("/livescore/" + leagueId);
    const events = data.livescore || [];
    const normalized = events.map(ev => ({
      id:          "api_" + ev.idEvent,
      competition: ev.strLeague  || "Football",
      homeTeam:    ev.strHomeTeam,
      awayTeam:    ev.strAwayTeam,
      homeAbbr:    (ev.strHomeTeam || "").slice(0, 3).toUpperCase(),
      awayAbbr:    (ev.strAwayTeam || "").slice(0, 3).toUpperCase(),
      homeScore:   ev.intHomeScore != null ? parseInt(ev.intHomeScore, 10) : null,
      awayScore:   ev.intAwayScore != null ? parseInt(ev.intAwayScore, 10) : null,
      status:      resolveStatus(ev),
      minute:      ev.strProgress || null,
      source:      "api",
      updatedAt:   Date.now()
    }));
    res.json({ ok: true, matches: normalized });
  } catch (err) {
    console.error("[/api/livescores/:leagueId]", err.message);
    res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

/* ── Today's scheduled matches for a league (V1, works free) ─
   GET /api/fixtures/:leagueId
   ─────────────────────────────────────────────────────────── */
app.get("/api/fixtures/:leagueId", async (req, res) => {
  const { leagueId } = req.params;
  if (!/^\d+$/.test(leagueId)) {
    return res.status(400).json({ ok: false, error: "leagueId must be a number" });
  }
  try {
    const data = await fetchV1("/eventsnextleague.php?id=" + leagueId);
    res.json({ ok: true, events: data.events || [] });
  } catch (err) {
    console.error("[/api/fixtures/:leagueId]", err.message);
    res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

/* ── League lookup table / standings ─────────────────────────
   GET /api/standings/:leagueId?season=2024-2025
   ─────────────────────────────────────────────────────────── */
app.get("/api/standings/:leagueId", async (req, res) => {
  const { leagueId } = req.params;
  const season = req.query.season || "2024-2025";
  try {
    const data = await fetchV1("/lookuptable.php?l=" + leagueId + "&s=" + encodeURIComponent(season));
    res.json({ ok: true, table: data.table || [] });
  } catch (err) {
    console.error("[/api/standings]", err.message);
    res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

/* ── Catch-all 404 ───────────────────────────────────────────*/
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Route not found: " + req.path });
});

/* ── Global error handler ────────────────────────────────────*/
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

/* ── Start ───────────────────────────────────────────────────*/
app.listen(PORT, () => {
  console.log("\n✅  FootballCoin proxy server running");
  console.log("    http://localhost:" + PORT + "/api/health\n");
});

/* ── Helpers ─────────────────────────────────────────────────*/
function resolveStatus(ev) {
  const s = (ev.strStatus || "").toUpperCase();
  if (["1H", "2H", "HT", "ET", "LIVE"].includes(s)) return "live";
  if (s === "FT" || s === "AET")                      return "finished";
  return "upcoming";
}
