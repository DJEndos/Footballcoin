/* =====================================================
   FootballCoin — admin.js
   Drives the entire admin dashboard SPA.
   ===================================================== */
(function () {
  "use strict";

  var store = window.FCStore;
  var pendingDeleteId = null;
  var editingMatchId = null;
  var deleteModal = null;

  /* ---- Boot ---- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!store) return;

    deleteModal = new bootstrap.Modal(document.getElementById("deleteModal"));

    // Sidebar navigation
    document.querySelectorAll(".adm-nav-link").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var section = link.getAttribute("data-section");
        ADM.navigate(section);
        // Close mobile sidebar
        document.getElementById("sidebar").classList.remove("open");
        document.getElementById("sidebarOverlay").classList.remove("show");
      });
    });

    // Mobile hamburger
    document.getElementById("hamburgerBtn").addEventListener("click", function () {
      document.getElementById("sidebar").classList.toggle("open");
      document.getElementById("sidebarOverlay").classList.toggle("show");
    });
    document.getElementById("sidebarOverlay").addEventListener("click", function () {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("sidebarOverlay").classList.remove("show");
    });

    // Logout
    document.getElementById("logoutLink").addEventListener("click", function (e) {
      e.preventDefault();
      store.logout();
      window.location.replace("login.html");
    });

    // Match form
    document.getElementById("addMatchBtn").addEventListener("click", ADM.showMatchForm);
    document.getElementById("matchFormSave").addEventListener("click", ADM.saveMatch);

    // Live score fetch
    document.getElementById("fetchNowBtn").addEventListener("click", ADM.fetchLiveNow);
    document.getElementById("toggleAutoSync").addEventListener("click", ADM.toggleAutoSync);

    // Next match
    document.getElementById("saveNextMatch").addEventListener("click", ADM.saveNextMatch);
    ["nm-home","nm-away","nm-date","nm-time","nm-venue","nm-ctalabel"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", ADM.updateNextMatchPreview);
    });

    // Stats
    document.getElementById("saveStats").addEventListener("click", ADM.saveStats);

    // API settings
    document.getElementById("saveApiSettings").addEventListener("click", ADM.saveApiSettings);

    // Delete confirmation
    document.getElementById("confirmDelete").addEventListener("click", function () {
      if (pendingDeleteId) {
        store.deleteMatch(pendingDeleteId);
        pendingDeleteId = null;
        deleteModal.hide();
        ADM.renderMatchList();
        ADM.renderOverview();
        ADM.toast("Match deleted.");
      }
    });

    // Initial render
    ADM.navigate("overview");
    ADM.loadNextMatchForm();
    ADM.loadStatsForm();
    ADM.loadApiSettingsForm();
    ADM.updateSyncBadge();
  });

  /* ================================================================
     ADM — public admin controller
  ================================================================ */
  var ADM = window.ADM = {

    /* ---- Navigation ---- */
    navigate: function (section) {
      document.querySelectorAll(".adm-section").forEach(function (el) { el.classList.add("d-none"); });
      var target = document.getElementById("section-" + section);
      if (target) target.classList.remove("d-none");

      document.querySelectorAll(".adm-nav-link").forEach(function (a) {
        a.classList.toggle("active", a.getAttribute("data-section") === section);
      });

      var titles = { overview: "Overview", matches: "Live Matches", "next-match": "Next Match", stats: "Site Stats", api: "API Settings" };
      var headerTitle = document.getElementById("headerTitle");
      if (headerTitle) headerTitle.textContent = titles[section] || section;

      if (section === "overview") ADM.renderOverview();
      if (section === "matches") ADM.renderMatchList();
    },

    /* ---- Overview ---- */
    renderOverview: function () {
      var stats = store.getStats();
      var matches = store.getMatches();
      var setText = function(id, val) { var el = document.getElementById(id); if(el) el.textContent = val; };
      setText("ov-matches", matches.length);
      setText("ov-players", stats.activePlayers || 0);
      setText("ov-clubs", stats.partnerClubs || 0);
      setText("ov-countries", stats.countriesReached || 0);

      var list = document.getElementById("ov-match-list");
      if (!list) return;
      if (!matches.length) { list.innerHTML = '<div class="p-3 text-muted small">No matches published.</div>'; return; }
      list.innerHTML = matches.slice(0, 6).map(function (m) {
        var hs = m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : "-";
        var as = m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : "-";
        return '<div class="adm-match-item">' +
          '<div class="adm-match-teams">' + m.homeTeam + ' <span style="color:#8B8DA3">vs</span> ' + m.awayTeam + '</div>' +
          '<div class="adm-match-score-inline">' + hs + " – " + as + '</div>' +
          '<div class="adm-match-status ' + m.status + '">' + m.status.toUpperCase() + '</div>' +
        '</div>';
      }).join("");
    },

    /* ---- Match list (admin) ---- */
    renderMatchList: function () {
      var matches = store.getMatches();
      var countEl = document.getElementById("matchCount");
      if (countEl) countEl.textContent = matches.length + " match" + (matches.length !== 1 ? "es" : "");

      var list = document.getElementById("adminMatchList");
      if (!list) return;
      if (!matches.length) { list.innerHTML = '<div class="p-3 text-muted small">No matches yet. Click "Add Match" to publish one.</div>'; return; }

      list.innerHTML = matches.map(function (m) {
        var hs = m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : "-";
        var as = m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : "-";
        var sourceTag = m.source === "api" ? '<span style="font-size:0.7rem;background:#e0f7fa;color:#0097a7;padding:2px 7px;border-radius:6px;margin-left:6px">API</span>' : "";
        return '<div class="adm-match-item" data-id="' + m.id + '">' +
          '<div class="adm-match-teams">' + m.homeTeam + ' vs ' + m.awayTeam + sourceTag + '<div style="font-size:0.75rem;color:#8B8DA3;margin-top:2px">' + (m.competition||"") + '</div></div>' +
          '<div class="adm-match-score-inline">' + hs + ' – ' + as + '</div>' +
          '<div class="adm-match-status ' + m.status + '">' + m.status + (m.minute ? " · " + m.minute : "") + '</div>' +
          '<div class="adm-match-actions">' +
            '<button class="edit-btn" data-id="' + m.id + '">Edit</button>' +
            '<button class="delete-btn" data-id="' + m.id + '">Delete</button>' +
          '</div>' +
        '</div>';
      }).join("");

      list.querySelectorAll(".edit-btn").forEach(function (btn) {
        btn.addEventListener("click", function () { ADM.editMatch(btn.getAttribute("data-id")); });
      });
      list.querySelectorAll(".delete-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          pendingDeleteId = btn.getAttribute("data-id");
          deleteModal.show();
        });
      });
    },

    /* ---- Match form show/hide ---- */
    showMatchForm: function () {
      editingMatchId = null;
      document.getElementById("matchFormTitle").textContent = "New Match";
      ["mf-id","mf-home","mf-homeabbr","mf-away","mf-awayabbr","mf-homescore","mf-awayscore","mf-minute","mf-comp"].forEach(function(id){
        document.getElementById(id).value = "";
      });
      document.getElementById("mf-status").value = "upcoming";
      document.getElementById("matchForm").classList.remove("d-none");
      document.getElementById("matchForm").scrollIntoView({ behavior: "smooth", block: "start" });
    },

    editMatch: function (id) {
      var m = store.getMatches().find(function(x){ return x.id === id; });
      if (!m) return;
      editingMatchId = id;
      document.getElementById("matchFormTitle").textContent = "Edit Match";
      document.getElementById("mf-id").value = m.id;
      document.getElementById("mf-home").value = m.homeTeam || "";
      document.getElementById("mf-homeabbr").value = m.homeAbbr || "";
      document.getElementById("mf-away").value = m.awayTeam || "";
      document.getElementById("mf-awayabbr").value = m.awayAbbr || "";
      document.getElementById("mf-homescore").value = m.homeScore !== null && m.homeScore !== undefined ? m.homeScore : "";
      document.getElementById("mf-awayscore").value = m.awayScore !== null && m.awayScore !== undefined ? m.awayScore : "";
      document.getElementById("mf-status").value = m.status || "upcoming";
      document.getElementById("mf-minute").value = m.minute || "";
      document.getElementById("mf-comp").value = m.competition || "";
      document.getElementById("matchForm").classList.remove("d-none");
      document.getElementById("matchForm").scrollIntoView({ behavior: "smooth", block: "start" });
    },

    hideMatchForm: function () {
      document.getElementById("matchForm").classList.add("d-none");
      editingMatchId = null;
    },

    saveMatch: function () {
      var home = document.getElementById("mf-home").value.trim();
      var away = document.getElementById("mf-away").value.trim();
      if (!home || !away) { ADM.toast("Home and away team names are required.", true); return; }

      var hsRaw = document.getElementById("mf-homescore").value;
      var asRaw = document.getElementById("mf-awayscore").value;

      var patch = {
        homeTeam: home,
        homeAbbr: document.getElementById("mf-homeabbr").value.trim().toUpperCase() || home.slice(0,3).toUpperCase(),
        awayTeam: away,
        awayAbbr: document.getElementById("mf-awayabbr").value.trim().toUpperCase() || away.slice(0,3).toUpperCase(),
        homeScore: hsRaw !== "" ? parseInt(hsRaw, 10) : null,
        awayScore: asRaw !== "" ? parseInt(asRaw, 10) : null,
        status: document.getElementById("mf-status").value,
        minute: document.getElementById("mf-minute").value.trim() || null,
        competition: document.getElementById("mf-comp").value.trim(),
        source: "manual"
      };

      if (editingMatchId) {
        store.updateMatch(editingMatchId, patch);
        ADM.toast("Match updated and published.");
      } else {
        store.addMatch(patch);
        ADM.toast("Match added and published.");
      }

      ADM.hideMatchForm();
      ADM.renderMatchList();
      ADM.renderOverview();
    },

    /* ---- Live score fetch ---- */
    fetchLiveNow: function () {
      var btn = document.getElementById("fetchNowBtn");
      var status = document.getElementById("syncStatus");
      btn.disabled = true;
      btn.textContent = "Fetching…";
      status.textContent = "Connecting to API…";

      window.FCLiveScore.fetchFromProvider(store.getApiSettings())
        .then(function (matches) {
          if (!matches.length) {
            status.textContent = "No matches found for today in that league. Try changing the league in API Settings.";
          } else {
            // Merge: keep manual matches, replace API ones
            var manual = store.getMatches().filter(function(m){ return m.source === "manual"; });
            store.saveMatches(matches.concat(manual));
            ADM.renderMatchList();
            ADM.renderOverview();
            status.textContent = "✓ Fetched " + matches.length + " match(es) from API. Last sync: " + new Date().toLocaleTimeString();
            ADM.toast("Fetched " + matches.length + " live match(es).");
          }
        })
        .catch(function (err) {
          status.textContent = "⚠ API error: " + err.message;
          ADM.toast("API error: " + err.message, true);
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = "⬇ Fetch Matches Now";
        });
    },

    toggleAutoSync: function () {
      var settings = store.getApiSettings();
      settings.autoSyncEnabled = !settings.autoSyncEnabled;
      store.saveApiSettings(settings);
      ADM.updateSyncBadge();

      if (settings.autoSyncEnabled) {
        window.FCLiveScore.startAutoSync(settings.pollIntervalSec || 60, function (matches, err) {
          if (err) { document.getElementById("syncStatus").textContent = "⚠ Auto-sync error: " + err.message; return; }
          if (matches.length) {
            var manual = store.getMatches().filter(function(m){ return m.source === "manual"; });
            store.saveMatches(matches.concat(manual));
            ADM.renderMatchList();
            document.getElementById("syncStatus").textContent = "✓ Auto-sync: " + matches.length + " match(es). " + new Date().toLocaleTimeString();
          }
        });
        ADM.toast("Auto-sync enabled every " + (settings.pollIntervalSec || 60) + "s.");
      } else {
        window.FCLiveScore.stopAutoSync();
        document.getElementById("syncStatus").textContent = "Auto-sync paused.";
        ADM.toast("Auto-sync disabled.");
      }
    },

    updateSyncBadge: function () {
      var settings = store.getApiSettings();
      var badge = document.getElementById("syncBadge");
      var btn = document.getElementById("toggleAutoSync");
      if (!badge || !btn) return;
      if (settings.autoSyncEnabled) {
        badge.textContent = "Auto-sync ON · " + (settings.pollIntervalSec || 60) + "s";
        badge.className = "adm-sync-badge on";
        btn.textContent = "Disable Auto-sync";
      } else {
        badge.textContent = "Auto-sync off";
        badge.className = "adm-sync-badge off";
        btn.textContent = "Enable Auto-sync";
      }
    },

    /* ---- Next match ---- */
    loadNextMatchForm: function () {
      var nm = store.getNextMatch();
      document.getElementById("nm-home").value = nm.homeTeam || "";
      document.getElementById("nm-away").value = nm.awayTeam || "";
      document.getElementById("nm-date").value = nm.date || "";
      document.getElementById("nm-time").value = nm.time || "";
      document.getElementById("nm-venue").value = nm.venue || "";
      document.getElementById("nm-ctalabel").value = nm.ctaLabel || "";
      document.getElementById("nm-ctalink").value = nm.ctaLink || "";
      ADM.updateNextMatchPreview();
    },

    saveNextMatch: function () {
      var data = {
        homeTeam: document.getElementById("nm-home").value.trim(),
        awayTeam: document.getElementById("nm-away").value.trim(),
        date: document.getElementById("nm-date").value,
        time: document.getElementById("nm-time").value,
        venue: document.getElementById("nm-venue").value.trim(),
        ctaLabel: document.getElementById("nm-ctalabel").value.trim() || "Be Part of the Legacy",
        ctaLink: document.getElementById("nm-ctalink").value.trim() || "contact.html"
      };
      store.saveNextMatch(data);
      ADM.updateNextMatchPreview();
      ADM.toast("Next match banner updated.");
    },

    updateNextMatchPreview: function () {
      var home = document.getElementById("nm-home").value || "—";
      var away = document.getElementById("nm-away").value || "—";
      var date = document.getElementById("nm-date").value;
      var time = document.getElementById("nm-time").value;
      var venue = document.getElementById("nm-venue").value;
      var cta = document.getElementById("nm-ctalabel").value || "Be Part of the Legacy";

      var dateLabel = "—";
      if (date) {
        try { dateLabel = new Date(date + "T" + (time || "00:00")).toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" }); } catch(e) { dateLabel = date; }
      }

      var setT = function(id,val){ var el = document.getElementById(id); if(el) el.textContent = val; };
      setT("nm-preview-home", home);
      setT("nm-preview-away", away);
      setT("nm-preview-date", dateLabel + (time ? " · " + time : "") + (venue ? " · " + venue : ""));
      setT("nm-preview-cta", cta);
    },

    /* ---- Stats ---- */
    loadStatsForm: function () {
      var stats = store.getStats();
      var keys = ["activePlayers","academyAlumni","partnerClubs","yearsExcellence","playersDeveloped","countriesReached"];
      keys.forEach(function(k) {
        var el = document.getElementById("st-" + k);
        if (el) el.value = stats[k] !== undefined ? stats[k] : "";
      });
    },

    saveStats: function () {
      var keys = ["activePlayers","academyAlumni","partnerClubs","yearsExcellence","playersDeveloped","countriesReached"];
      var data = {};
      keys.forEach(function(k) {
        var el = document.getElementById("st-" + k);
        if (el && el.value !== "") data[k] = parseInt(el.value, 10);
      });
      store.saveStats(data);
      ADM.renderOverview();
      ADM.toast("Stats saved and published to site.");
    },

    /* ---- API settings ---- */
    loadApiSettingsForm: function () {
      var s = store.getApiSettings();
      document.getElementById("api-provider").value = s.provider || "thesportsdb";
      document.getElementById("api-key").value = s.apiKey || "3";
      document.getElementById("api-league").value = s.league || "English Premier League";
      document.getElementById("api-interval").value = s.pollIntervalSec || 60;
      document.getElementById("api-autosync").checked = !!s.autoSyncEnabled;
    },

    saveApiSettings: function () {
      var settings = {
        provider: document.getElementById("api-provider").value,
        apiKey: document.getElementById("api-key").value.trim(),
        league: document.getElementById("api-league").value.trim(),
        pollIntervalSec: parseInt(document.getElementById("api-interval").value, 10) || 60,
        autoSyncEnabled: document.getElementById("api-autosync").checked
      };
      store.saveApiSettings(settings);
      ADM.updateSyncBadge();
      ADM.toast("API settings saved.");
    },

    /* ---- Toast notification ---- */
    toast: function (msg, isError) {
      var t = document.getElementById("admToast");
      t.textContent = (isError ? "⚠ " : "✓ ") + msg;
      t.style.background = isError ? "#C0392B" : "#14152B";
      t.classList.add("show");
      setTimeout(function () { t.classList.remove("show"); }, 3500);
    }
  };

})();
