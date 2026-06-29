

(function (global) {
  "use strict";

  var pollTimer = null;

  function statusFromSportsDB(ev) {
    var s = (ev.strStatus || "").toUpperCase();
    var progress = (ev.strProgress || "").toUpperCase();
    if (["1H", "2H", "HT", "ET", "LIVE", "IN PLAY"].indexOf(s) !== -1 || progress.indexOf("LIVE") !== -1) {
      return "live";
    }
    if (s === "FT" || s === "AET" || s === "FT_PEN" || (ev.intHomeScore !== null && ev.intHomeScore !== undefined && s === "")) {
      return "finished";
    }
    if (s === "NS" || s === "" ) {
      return "upcoming";
    }
    return "finished";
  }

  function normalizeSportsDBEvent(ev) {
    return {
      id: "api_" + ev.idEvent,
      externalId: ev.idEvent,
      competition: ev.strLeague || "Football",
      homeTeam: ev.strHomeTeam,
      awayTeam: ev.strAwayTeam,
      homeAbbr: (ev.strHomeTeam || "").slice(0, 3).toUpperCase(),
      awayAbbr: (ev.strAwayTeam || "").slice(0, 3).toUpperCase(),
      homeScore: ev.intHomeScore !== null && ev.intHomeScore !== undefined ? parseInt(ev.intHomeScore, 10) : null,
      awayScore: ev.intAwayScore !== null && ev.intAwayScore !== undefined ? parseInt(ev.intAwayScore, 10) : null,
      status: statusFromSportsDB(ev),
      minute: ev.strProgress || null,
      kickoff: ev.dateEvent && ev.strTime ? ev.dateEvent + "T" + ev.strTime : null,
      source: "api",
      updatedAt: Date.now()
    };
  }

  function todayISO() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }

  /**
   * Fetch matches from the configured external provider.
   * Returns a Promise<Array<NormalizedMatch>>.
   */
  function fetchFromProvider(settings) {
    settings = settings || (global.FCStore ? global.FCStore.getApiSettings() : { provider: "thesportsdb", apiKey: "123", league: "English Premier League" });

    if (settings.provider === "thesportsdb") {
  var key = settings.apiKey; // your premium key here
  var PROXY_BASE_URL = "https://www.thesportsdb.com/api/v2/json/livescore/soccer";

  return fetch(url, {
    headers: {
      "X-API-KEY": key
    }
  })
  .then(function(res) {
    if (!res.ok) throw new Error("API error " + res.status);
    return res.json();
  })
  .then(function(data) {
    var events = data && data.livescore ? data.livescore : [];
    return events.map(function(ev) {
      return {
        id: "api_" + ev.idEvent,
        competition: ev.strLeague || "Football",
        homeTeam: ev.strHomeTeam,
        awayTeam: ev.strAwayTeam,
        homeAbbr: (ev.strHomeTeam || "").slice(0,3).toUpperCase(),
        awayAbbr: (ev.strAwayTeam || "").slice(0,3).toUpperCase(),
        homeScore: ev.intHomeScore !== null ? parseInt(ev.intHomeScore) : null,
        awayScore: ev.intAwayScore !== null ? parseInt(ev.intAwayScore) : null,
        status: ev.strStatus === "1H" || ev.strStatus === "2H" ? "live" : "finished",
        minute: ev.strProgress || null,
        source: "api",
        updatedAt: Date.now()
      };
    });
  });
}

    // Placeholder for other providers (football-data.org, livescore-api.com, ...).
    // Wire up your backend proxy here and return the same normalized shape.
    return Promise.reject(new Error("Provider '" + settings.provider + "' is not configured yet."));
  }

  /**
   * Start polling the external API on an interval, invoking
   * callback(matches, error) every cycle.
   */
  function startAutoSync(intervalSec, callback) {
    stopAutoSync();
    var run = function () {
      fetchFromProvider()
        .then(function (matches) { callback(matches, null); })
        .catch(function (err) { callback([], err); });
    };
    run();
    pollTimer = setInterval(run, Math.max(15, intervalSec || 60) * 1000);
    return pollTimer;
  }

  function stopAutoSync() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  global.FCLiveScore = {
    fetchFromProvider: fetchFromProvider,
    startAutoSync: startAutoSync,
    stopAutoSync: stopAutoSync,
    normalizeSportsDBEvent: normalizeSportsDBEvent
  };
})(window);