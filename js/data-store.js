/* =====================================================
   FootballCoin — Data Store
   A tiny localStorage-backed data layer that stands in for
   a real backend/database. The public site reads from it,
   and /admin writes to it. Because it's localStorage, data
   is scoped to this browser — see README.md for notes on
   wiring this up to a real backend/API.
   ===================================================== */

(function (global) {
  "use strict";

  var KEYS = {
    matches: "fc_matches_v1",
    nextMatch: "fc_next_match_v1",
    stats: "fc_stats_v1",
    auth: "fc_admin_auth_v1",
    apiSettings: "fc_api_settings_v1"
  };

  /* ---------- seed data (mirrors the original design) ---------- */

  var SEED_MATCHES = [
    {
      id: "m1",
      competition: "Premier League U18",
      homeTeam: "Football Coin FC",
      homeAbbr: "FC",
      awayTeam: "City FC",
      awayAbbr: "CFC",
      homeScore: 2,
      awayScore: 1,
      status: "finished",
      minute: null,
      source: "manual",
      updatedAt: Date.now()
    },
    {
      id: "m2",
      competition: "Premier League U16",
      homeTeam: "Football Coin FC",
      homeAbbr: "FC",
      awayTeam: "Athletic United",
      awayAbbr: "AU",
      homeScore: 2,
      awayScore: 2,
      status: "finished",
      minute: null,
      source: "manual",
      updatedAt: Date.now()
    }
  ];

  var SEED_NEXT_MATCH = {
    id: "next1",
    homeTeam: "Football Coin FC",
    awayTeam: "Brighton Mariners FC",
    date: "2026-07-24",
    time: "12:00",
    venue: "Emirates Stadium",
    ctaLabel: "Be Part of the Legacy",
    ctaLink: "contact.html"
  };

  var SEED_STATS = {
    activePlayers: 91,
    academyAlumni: 271,
    partnerClubs: 42,
    yearsExcellence: 15,
    playersDeveloped: 500,
    countriesReached: 10
  };

  /* ---------- low level helpers ---------- */

  function read(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("FCStore: could not read", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      global.dispatchEvent(new CustomEvent("fc:store-updated", { detail: { key: key } }));
      return true;
    } catch (e) {
      console.warn("FCStore: could not write", key, e);
      return false;
    }
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- public API ---------- */

  var FCStore = {
    KEYS: KEYS,

    /* Matches shown in the "Live Match Updates" widget */
    getMatches: function () {
      return read(KEYS.matches, SEED_MATCHES.slice());
    },
    saveMatches: function (matches) {
      return write(KEYS.matches, matches);
    },
    addMatch: function (match) {
      var matches = this.getMatches();
      match.id = match.id || uid("m");
      match.updatedAt = Date.now();
      matches.unshift(match);
      this.saveMatches(matches);
      return match;
    },
    updateMatch: function (id, patch) {
      var matches = this.getMatches();
      var idx = matches.findIndex(function (m) { return m.id === id; });
      if (idx === -1) return null;
      matches[idx] = Object.assign({}, matches[idx], patch, { updatedAt: Date.now() });
      this.saveMatches(matches);
      return matches[idx];
    },
    deleteMatch: function (id) {
      var matches = this.getMatches().filter(function (m) { return m.id !== id; });
      this.saveMatches(matches);
    },

    /* Featured "Next Match" banner */
    getNextMatch: function () {
      return read(KEYS.nextMatch, SEED_NEXT_MATCH);
    },
    saveNextMatch: function (data) {
      return write(KEYS.nextMatch, data);
    },

    /* Headline stats ("Building Champions", "Our Impact") */
    getStats: function () {
      return read(KEYS.stats, SEED_STATS);
    },
    saveStats: function (stats) {
      return write(KEYS.stats, Object.assign({}, this.getStats(), stats));
    },

    /* Live-score API connection settings, editable from the admin dashboard */
    getApiSettings: function () {
      return read(KEYS.apiSettings, {
        provider: "thesportsdb",
        apiKey: "3",
        league: "English Premier League",
        autoSyncEnabled: false,
        pollIntervalSec: 60
      });
    },
    saveApiSettings: function (settings) {
      return write(KEYS.apiSettings, Object.assign({}, this.getApiSettings(), settings));
    },

    /* Very small "session" used to gate /admin pages. NOT secure —
       it only prevents accidental access in this static demo. A real
       deployment must authenticate against a server. */
    isAdminLoggedIn: function () {
      return read(KEYS.auth, null) !== null;
    },
    login: function (username) {
      return write(KEYS.auth, { username: username, at: Date.now() });
    },
    logout: function () {
      global.localStorage.removeItem(KEYS.auth);
      global.dispatchEvent(new CustomEvent("fc:store-updated", { detail: { key: KEYS.auth } }));
    },

    resetToDefaults: function () {
      global.localStorage.removeItem(KEYS.matches);
      global.localStorage.removeItem(KEYS.nextMatch);
      global.localStorage.removeItem(KEYS.stats);
      global.dispatchEvent(new CustomEvent("fc:store-updated", { detail: { key: "all" } }));
    },

    uid: uid
  };

  global.FCStore = FCStore;
})(window);
