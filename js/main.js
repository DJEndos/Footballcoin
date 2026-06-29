/* =====================================================
   FootballCoin — main.js
   ===================================================== */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    initNavbar();
    initRevealOnScroll();
    initCounters();
    initBackToTop();
    initNewsletterForm();
    initContactForm();
    initLiveMatchWidgets();
    initFooterYear();
    initEnrollForm();
    initAutoSync();

    window.addEventListener("fc:store-updated", initLiveMatchWidgets);
    window.addEventListener("storage", initLiveMatchWidgets);
  });

  /* --- Navbar --- */
  function initNavbar() {
    var navbar = document.querySelector(".fc-navbar");
    if (!navbar) return;
    function toggleSolid() {
      if (window.scrollY > 24) navbar.classList.add("fc-solid");
      else if (!navbar.classList.contains("fc-navbar-solid")) navbar.classList.remove("fc-solid");
    }
    toggleSolid();
    window.addEventListener("scroll", toggleSolid, { passive: true });

    var collapseEl = document.getElementById("fcNavbarNav");
    if (collapseEl && window.bootstrap) {
      var bsCollapse = new bootstrap.Collapse(collapseEl, { toggle: false });
      collapseEl.querySelectorAll(".nav-link").forEach(function (link) {
        link.addEventListener("click", function () {
          if (collapseEl.classList.contains("show")) bsCollapse.hide();
        });
      });
    }
    var current = window.location.pathname.split("/").pop() || "index.html";
    navbar.querySelectorAll(".nav-link[data-page]").forEach(function (link) {
      if (link.getAttribute("data-page") === current) link.classList.add("active");
    });
  }

  /* --- Reveal on scroll --- */
  function initRevealOnScroll() {
    var items = document.querySelectorAll(".fc-reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("fc-in"); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("fc-in"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { obs.observe(el); });
  }

  /* --- Animated counters --- */
  function initCounters() {
    var counters = document.querySelectorAll("[data-counter]");
    if (!counters.length) return;
    var stats = window.FCStore ? window.FCStore.getStats() : {};
    counters.forEach(function (el) {
      var key = el.getAttribute("data-counter");
      var target = stats[key] !== undefined ? stats[key] : (parseInt(el.textContent, 10) || 0);
      el.setAttribute("data-target", target);
      el.textContent = "0";
    });
    function runCounter(el) {
      var target = parseInt(el.getAttribute("data-target"), 10) || 0;
      var dur = 1200; var start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        el.textContent = Math.floor(p * target) + "+";
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = target + "+";
      }
      requestAnimationFrame(step);
    }
    if (!("IntersectionObserver" in window)) { counters.forEach(runCounter); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { runCounter(e.target); obs.unobserve(e.target); } });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { obs.observe(el); });
  }

  /* --- Back to top --- */
  function initBackToTop() {
    var btn = document.querySelector(".fc-back-to-top");
    if (!btn) return;
    window.addEventListener("scroll", function () { btn.classList.toggle("show", window.scrollY > 500); }, { passive: true });
    btn.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  /* --- Footer year --- */
  function initFooterYear() {
    var el = document.querySelector("[data-current-year]"); if (el) el.textContent = new Date().getFullYear();
  }

  /* --- Newsletter form --- */
  function initNewsletterForm() {
    var form = document.querySelector("#newsletterForm"); if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type=email]");
      var fb = form.querySelector(".fc-form-feedback");
      if (!input.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) { input.classList.add("is-invalid"); return; }
      input.classList.remove("is-invalid"); input.value = "";
      if (fb) { fb.textContent = "Thanks for subscribing! Check your inbox."; fb.classList.remove("d-none"); }
    });
  }

  /* --- Contact form --- */
  function initContactForm() {
    var form = document.querySelector("#contactForm"); if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
      var s = document.querySelector("#contactSuccess");
      form.reset(); form.classList.remove("was-validated");
      if (s) { s.classList.remove("d-none"); setTimeout(function () { s.classList.add("d-none"); }, 6000); }
    });
  }

  /* --- Enrol form (programs page modal) --- */
  function initEnrollForm() {
    var form = document.querySelector("#enrollForm"); if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!form.checkValidity()) { form.classList.add("was-validated"); return; }
      var s = document.querySelector("#enrollSuccess");
      var m = document.querySelector("#enrollModal");
      form.reset(); form.classList.remove("was-validated");
      if (m && window.bootstrap) { var bsM = bootstrap.Modal.getInstance(m); if (bsM) bsM.hide(); }
      if (s) { s.classList.remove("d-none"); setTimeout(function () { s.classList.add("d-none"); }, 6000); }
    });
  }

  /* --- Live match widget render --- */
  function statusBadge(status) {
    if (status === "live") return '<span class="fc-badge-live"><span class="fc-live-dot"></span>Live</span>';
    if (status === "upcoming") return '<span class="fc-badge-upcoming">&#9656; Upcoming</span>';
    return '<span class="fc-badge-finished">Full Time</span>';
  }
  function renderMatchRow(m) {
    var hs = (m.homeScore === null || m.homeScore === undefined) ? "-" : m.homeScore;
    var as = (m.awayScore === null || m.awayScore === undefined) ? "-" : m.awayScore;
    return '<div class="fc-match-row flex-wrap">' +
      '<div class="fc-match-team"><span class="fc-team-badge">' + (m.homeAbbr||m.homeTeam.slice(0,3)).toUpperCase() + '</span><span class="truncate">' + m.homeTeam + '</span></div>' +
      '<div class="fc-match-score">' + hs + ' &ndash; ' + as + '</div>' +
      '<div class="fc-match-team justify-content-end text-end"><span class="truncate">' + m.awayTeam + '</span><span class="fc-team-badge">' + (m.awayAbbr||m.awayTeam.slice(0,3)).toUpperCase() + '</span></div>' +
      '<div class="fc-match-meta">' + statusBadge(m.status) + ' &middot; ' + (m.competition||"Friendly") + '</div>' +
    '</div>';
  }

  function initLiveMatchWidgets() {
    if (!window.FCStore) return;
    var container = document.querySelector("#liveMatchList");
    if (container) {
      var matches = window.FCStore.getMatches().slice(0, 4);
      container.innerHTML = matches.length ? matches.map(renderMatchRow).join("") : '<p class="text-muted small mb-0 py-2">No match data published yet.</p>';
    }
    var nextWrap = document.querySelector("#nextMatchWidget");
    if (nextWrap) {
      var nm = window.FCStore.getNextMatch();
      var dateLabel = "";
      try { dateLabel = new Date(nm.date + "T" + (nm.time || "00:00")).toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" }); } catch(e){ dateLabel = nm.date; }
      var setT = function(sel, txt) { var el = nextWrap.querySelector(sel); if(el) el.textContent = txt; };
      setT("[data-next-home]", nm.homeTeam);
      setT("[data-next-away]", nm.awayTeam);
      setT("[data-next-date]", dateLabel + (nm.time ? " \u00B7 " + nm.time : "") + (nm.venue ? " \u00B7 " + nm.venue : ""));
      var ctaEl = nextWrap.querySelector("[data-next-cta]");
      if (ctaEl) { ctaEl.textContent = nm.ctaLabel || "Be Part of the Legacy"; if (nm.ctaLink) ctaEl.href = nm.ctaLink; }
    }
  }
  window.FCRenderLiveWidgets = initLiveMatchWidgets;

  /* --- Auto-sync with live API if enabled --- */
  function initAutoSync() {
    if (!window.FCStore || !window.FCLiveScore) return;
    var settings = window.FCStore.getApiSettings();
    if (!settings.autoSyncEnabled) return;
    window.FCLiveScore.startAutoSync(settings.pollIntervalSec || 60, function (matches) {
      if (matches && matches.length) {
        var existing = window.FCStore.getMatches().filter(function(m){ return m.source === "manual"; });
        window.FCStore.saveMatches(matches.concat(existing));
        initLiveMatchWidgets();
      }
    });
  }
})();
