(() => {
  "use strict";

  console.log("app.js loaded ✅");

  // ========= ROUTER (page switching) =========
  const routes = {
    home: ".amber-home",
    space: ".amber-space",
    map: ".amber-map",
    goals: ".amber-goals",
    refresh: ".amber-refresh",
    contact: ".amber-contact",
  };

  const normalizeHash = () => {
    const raw = (location.hash || "#home").replace("#", "");
    const clean = raw.trim().toLowerCase();
    return routes[clean] ? clean : "home";
  };

  function showPage(key) {
    const routeKey = routes[key] ? key : "home";

    // hide all pages (matches your CSS: body > main { display:none; })
    document.querySelectorAll("body > main").forEach((m) => {
      m.classList.remove("is-active");
    });

    // show active page
    const active = document.querySelector(routes[routeKey]);
    if (active) active.classList.add("is-active");

    // update nav active state (you have nav on every page)
    document.querySelectorAll(".nav-link").forEach((a) => {
      const href = (a.getAttribute("href") || "").trim().toLowerCase();
      if (href === `#${routeKey}`) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    window.scrollTo(0, 0);
  }

  function renderRoute() {
    showPage(normalizeHash());
  }

  // ========= APP STATE =========
  const LS_KEY = "amber_state_v1";

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function ensureToastHost() {
    let host = $("#amberToasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "amberToasts";
      host.setAttribute("aria-live", "polite");
      host.style.position = "fixed";
      host.style.right = "16px";
      host.style.bottom = "16px";
      host.style.display = "grid";
      host.style.gap = "10px";
      host.style.zIndex = "9999";
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, type = "info") {
    const host = ensureToastHost();
    const el = document.createElement("div");
    el.role = "status";
    el.textContent = message;
    el.style.padding = "10px 12px";
    el.style.borderRadius = "14px";
    el.style.border = "1px solid rgba(27,34,48,.12)";
    el.style.background = "rgba(255,255,255,.92)";
    el.style.boxShadow = "0 14px 26px rgba(20,30,60,.12)";
    el.style.font =
      "700 13px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
    el.style.color = "rgba(27,34,48,.92)";
    if (type === "success") el.style.borderColor = "rgba(99,230,190,.55)";
    if (type === "warn") el.style.borderColor = "rgba(255,211,166,.65)";
    if (type === "error") el.style.borderColor = "rgba(255,80,80,.55)";
    host.appendChild(el);

    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(4px)";
      el.style.transition = "opacity .2s ease, transform .2s ease";
    }, 2400);
    setTimeout(() => el.remove(), 2800);
  }

  const defaultState = () => ({
    pet: { xp: 0, level: 1, form: "egg" },
    streak: { current: 0, lastActiveDate: null },
    sessions: [],
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const d = defaultState();
      return {
        ...d,
        ...parsed,
        pet: { ...d.pet, ...(parsed.pet || {}) },
        streak: { ...d.streak, ...(parsed.streak || {}) },
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function recomputeStreakAndPet() {
    const days = new Set(state.sessions.map((s) => s.date).filter(Boolean));
    const today = todayISO();

    const hasToday = days.has(today);
    const endDate = hasToday
      ? today
      : new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    let streak = 0;
    let cursor = endDate;

    while (days.has(cursor)) {
      streak += 1;
      const dt = new Date(cursor + "T00:00:00");
      dt.setDate(dt.getDate() - 1);
      cursor = dt.toISOString().slice(0, 10);
    }

    state.streak.current = streak;
    state.streak.lastActiveDate = days.size
      ? Array.from(days).sort().at(-1)
      : null;

    if (streak === 0) state.pet.form = days.size ? "ashes" : "egg";
    else if (streak <= 3) state.pet.form = "egg";
    else state.pet.form = "phoenix";

    const xp = Number(state.pet.xp) || 0;
    state.pet.level = 1 + Math.floor(xp / 50);

    saveState();
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  }

  function setPetUI() {
    const petCard = $(".amber-home .pet-card");
    if (petCard) {
      petCard.classList.remove("pet--egg", "pet--phoenix", "pet--ashes");
      petCard.classList.add(`pet--${state.pet.form}`);
    }

    setText("petLevel", state.pet.level || 1);
    setText("petXP", state.pet.xp || 0);

    const emoji = $("#petEmoji");
    if (emoji) {
      emoji.textContent =
        state.pet.form === "phoenix"
          ? "🔥🦅"
          : state.pet.form === "ashes"
          ? "🫗🪨"
          : "🥚";
      emoji.setAttribute("aria-label", state.pet.form);
    }

    const xp = Number(state.pet.xp) || 0;
    const inLevel = xp % 50;
    const pct = clamp(Math.round((inLevel / 50) * 100), 0, 100);

    const fill = $(".amber-home .progress-fill");
    const bar = $(".amber-home .progress-bar");
    if (fill) fill.style.width = `${pct}%`;
    if (bar) {
      bar.setAttribute("aria-valuenow", String(inLevel));
      bar.setAttribute("aria-valuemin", "0");
      bar.setAttribute("aria-valuemax", "50");
    }

    const hint = $(".amber-home .progress-hint");
    if (hint) hint.textContent = `Next level at ${Math.floor(xp / 50) * 50 + 50} XP`;
  }

  function renderHome() {
    recomputeStreakAndPet();

    const today = todayISO();
    const sessionsToday = state.sessions.filter((s) => s.date === today);
    const minutes = sessionsToday.reduce(
      (sum, s) => sum + (Number(s.minutes) || 0),
      0
    );

    setText("todayMinutes", minutes || 0);
    setText("todayTopics", 0);
    setText("todayMood", sessionsToday.at(-1)?.mood || "—");

    const s = state.streak.current || 0;
    setText("todayStreak", s === 0 ? "No streak yet" : `${s} day${s === 1 ? "" : "s"} active`);
    setText("streakDays", s);

    const statusEl = $("#streakStatus");
    if (statusEl) {
      statusEl.textContent =
        s === 0
          ? "Log something today to start your streak."
          : s <= 3
          ? "Nice! Keep it gentle — show up today to protect your streak."
          : "You’re on fire (the calm kind). Keep the rhythm going.";
    }

    // placeholders (you can wire these later)
    setText("learnedCount", 0);
    setText("lowConfCount", 0);
    setText("midConfCount", 0);
    setText("highConfCount", 0);

    setPetUI();
  }

  function bindHomeActions() {
    // Bind once; buttons exist even when page is hidden
    const heroBtns = $$(".amber-home .hero-actions .btn");

    const logBtn = heroBtns.find((b) =>
      (b.textContent || "").toLowerCase().includes("log")
    );
    const winBtn = heroBtns.find((b) =>
      (b.textContent || "").toLowerCase().includes("small win")
    );
    const nextBtn = heroBtns.find((b) =>
      (b.textContent || "").toLowerCase().includes("next steps")
    );

    logBtn?.addEventListener("click", () => {
      state.sessions.push({ date: todayISO(), minutes: 10, mood: "okay" });
      state.pet.xp = (Number(state.pet.xp) || 0) + 5;
      renderHome();
      toast("Session logged (+5 XP).", "success");
    });

    winBtn?.addEventListener("click", () => {
      state.sessions.push({ date: todayISO(), minutes: 5, mood: "good" });
      state.pet.xp = (Number(state.pet.xp) || 0) + 10;
      renderHome();
      toast("Small win saved. +10 XP 🌸", "success");
    });

    nextBtn?.addEventListener("click", () => {
      location.hash = "#map";
    });

    const footerBtns = $$(".amber-home .card-footer .btn");
    const quickLog = footerBtns.find((b) =>
      (b.textContent || "").toLowerCase().includes("quick log")
    );
    const rulesBtn = footerBtns.find((b) =>
      (b.textContent || "").toLowerCase().includes("streak rules")
    );

    quickLog?.addEventListener("click", () => {
      state.sessions.push({ date: todayISO(), minutes: 10, mood: "okay" });
      state.pet.xp = (Number(state.pet.xp) || 0) + 5;
      renderHome();
      toast("Quick log saved (+5 XP).", "success");
    });

    rulesBtn?.addEventListener("click", () => {
      alert(
        [
          "Streak rules (demo):",
          "• A day counts if you log a session.",
          "• Missing a day resets the streak.",
          "• Pet form: 1–3 days = egg, 4+ days = phoenix, 0 after activity = ashes.",
        ].join("\n")
      );
    });

    const feedBtn = $$(".amber-home .pet-card .card-footer .btn").find((b) =>
      (b.textContent || "").toLowerCase().includes("feed")
    );

    feedBtn?.addEventListener("click", () => {
      state.pet.xp = (Number(state.pet.xp) || 0) + 15;
      renderHome();
      toast("Pet fed. +15 XP 🍓", "success");
    });

    const microBtn = $$(".amber-home .motivation .btn").find((b) =>
      (b.textContent || "").toLowerCase().includes("new message")
    );

    microBtn?.addEventListener("click", () => {
      const msgs = [
        "“Tiny progress is still progress.”",
        "“You don’t need perfect. You need repeatable.”",
        "“One small action beats zero big plans.”",
        "“Confusion is your brain growing.”",
        "“Show up, even softly.”",
      ];
      const el = $("#microMessage");
      if (el) el.textContent = msgs[Math.floor(Math.random() * msgs.length)];
      toast("New micro message ✨", "success");
    });
  }

  function init() {
    // Ensure hash exists on first load
    if (!location.hash) location.hash = "#home";

    // Start routing
    renderRoute();
    window.addEventListener("hashchange", renderRoute);

    // Bind once + render initial UI
    bindHomeActions();
    renderHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
