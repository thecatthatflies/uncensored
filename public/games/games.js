"use strict";

// Constants
const CLOAK_TITLE_KEY = "newton-cloak-title";
const CLOAK_FAVICON_KEY = "newton-cloak-favicon";
const MODE_KEY = "newton-mode";
const DEFAULT_MODE = "window";
const DEFAULT_CLOAK_TITLE = "Google";
const DEFAULT_CLOAK_FAVICON = "https://www.google.com/favicon.ico";
const API_BASE = "https://cdn.jsdelivr.net/gh/gn-math";
const ZONES_URL = `${API_BASE}/assets@main/zones.json?t=${Date.now()}`;
const EXCLUDED_PATTERNS = ["chat", "bot", "ai"];

// State
let GAMES = [];
let MODE = DEFAULT_MODE;
let dragState = { active: false, x: 0, y: 0, offsetX: 0, offsetY: 0 };

// Utilities
const $ = (id) => document.getElementById(id);
const escapeHTML = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

const App = {
  async init() {
    ThemeManager.init();
    MODE = localStorage.getItem(MODE_KEY) || DEFAULT_MODE;
    this.loadCloak();
    this.setupUI();

    try {
      await this.loadGames();
      this.render();
    } catch (err) {
      this.showError("Failed to load games. Please refresh.");
      console.error(err);
    }
  },

  async loadGames() {
    const res = await fetch(ZONES_URL);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    GAMES = Array.isArray(data) ? data.slice(1) : [];
  },

  setupUI() {
    // Search
    const search = $("gameSearch");
    if (search) search.addEventListener("input", (e) => this.render(e.target.value));

    // Mode switcher
    document.querySelectorAll(".switcher button[id^='mode-']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        MODE = e.target.id.replace("mode-", "");
        localStorage.setItem(MODE_KEY, MODE);
        this.updateUI();
      });
    });

    // Settings
    const settingsTrigger = document.querySelector("#settings-trigger button");
    if (settingsTrigger) settingsTrigger.addEventListener("click", () => this.toggleSettings());

    const modal = $("settings-modal");
    if (modal) {
      modal.querySelector(".save-btn")?.addEventListener("click", () => this.saveSettings());
      modal.querySelector(".close-btn")?.addEventListener("click", () => this.toggleSettings());
    }

    // Window controls
    const winBar = $("window-bar");
    if (winBar) {
      winBar.querySelector(".dot.close")?.addEventListener("click", () => this.close());
      winBar.querySelector(".dot.min")?.addEventListener("click", () => this.minimize());
      winBar.querySelector(".dot.max")?.addEventListener("click", () => this.maximize());
      winBar.addEventListener("dblclick", (e) => {
        if (e.target.id === "window-bar" || e.target.id === "win-title") this.maximize();
      });
    }

    $("restore-btn")?.addEventListener("click", () => this.restore());
    this.setupDragging();
  },

  setupDragging() {
    const win = $("game-window");
    const bar = $("window-bar");
    if (!win || !bar) return;

    const getPos = (e) => ({
      x: e.touches?.[0].clientX ?? e.clientX,
      y: e.touches?.[0].clientY ?? e.clientY,
    });

    const startDrag = (e) => {
      if (win.classList.contains("maximized") || e.target.closest(".window-bar-buttons")) return;
      if (!bar.contains(e.target)) return;

      dragState.active = true;
      if (e.touches) e.preventDefault();
      const pos = getPos(e);
      dragState.x = pos.x - dragState.offsetX;
      dragState.y = pos.y - dragState.offsetY;
    };

    const doDrag = (e) => {
      if (!dragState.active) return;
      if (e.touches) e.preventDefault();
      const pos = getPos(e);
      dragState.offsetX = pos.x - dragState.x;
      dragState.offsetY = pos.y - dragState.y;
      win.style.transform = `translate(${dragState.offsetX}px, ${dragState.offsetY}px)`;
    };

    const endDrag = () => {
      dragState.active = false;
    };

    bar.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", endDrag);
    bar.addEventListener("touchstart", startDrag, { passive: false });
    document.addEventListener("touchmove", doDrag, { passive: false });
    document.addEventListener("touchend", endDrag);
  },

  render(query = "") {
    const list = $("gameList");
    if (!list) return;

    const q = query.toLowerCase();
    const filtered = GAMES.filter((g) => {
      const name = g.name.toLowerCase();
      return name.includes(q) && !EXCLUDED_PATTERNS.some((p) => name.includes(p));
    });

    list.innerHTML = "";
    filtered.forEach((g) => {
      const card = document.createElement("div");
      card.className = "game-card";
      card.textContent = g.name.toUpperCase();
      card.addEventListener("click", () => this.play(g.id));
      list.appendChild(card);
    });
  },

  close() {
    const win = $("game-window");
    const overlay = $("window-overlay");
    const frame = $("game-frame");
    const restore = $("restore-btn");

    if (!win || !overlay || !frame) return;
    win.classList.remove("active", "minimized");
    if (restore) restore.style.display = "none";

    setTimeout(() => {
      frame.srcdoc = "";
      frame.src = "";
      overlay.style.display = "none";
      win.style.transform = "";
      dragState.offsetX = dragState.offsetY = 0;
    }, 400);
  },

  maximize() {
    const win = $("game-window");
    if (!win) return;
    win.classList.toggle("maximized");
    if (win.classList.contains("maximized")) win.style.transform = "";
    $("game-frame")?.focus();
  },

  minimize() {
    const win = $("game-window");
    if (win) {
      win.classList.add("minimized");
      win.classList.remove("maximized");
    }
    const restore = $("restore-btn");
    if (restore) restore.style.display = "block";
  },

  restore() {
    const win = $("game-window");
    if (win) win.classList.remove("minimized");
    const restore = $("restore-btn");
    if (restore) restore.style.display = "none";
    $("game-frame")?.focus();
  },

  toggleSettings() {
    const modal = $("settings-modal");
    if (!modal) return;
    const opening = modal.classList.toggle("active");
    if (opening) {
      const title = $("cloak-title");
      const favicon = $("cloak-favicon");
      if (title) title.value = localStorage.getItem(CLOAK_TITLE_KEY) || "";
      if (favicon) favicon.value = localStorage.getItem(CLOAK_FAVICON_KEY) || "";
    }
  },

  saveSettings() {
    const title = $("cloak-title")?.value.trim();
    const favicon = $("cloak-favicon")?.value.trim();

    if (title) localStorage.setItem(CLOAK_TITLE_KEY, title);
    if (favicon) localStorage.setItem(CLOAK_FAVICON_KEY, favicon);

    this.applyCloak(title || DEFAULT_CLOAK_TITLE, favicon || DEFAULT_CLOAK_FAVICON);
    this.toggleSettings();
  },

  loadCloak() {
    const title = localStorage.getItem(CLOAK_TITLE_KEY);
    const favicon = localStorage.getItem(CLOAK_FAVICON_KEY);
    if (title || favicon) {
      this.applyCloak(title || DEFAULT_CLOAK_TITLE, favicon || DEFAULT_CLOAK_FAVICON);
    }
  },

  applyCloak(title, favicon) {
    if (title) document.title = escapeHTML(title);
    if (favicon) {
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
  },

  getShell(body, title, favicon) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#000";
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(title)}</title><link rel="icon" href="${favicon}"><style>body,html{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${escapeHTML(bg)};display:flex;align-items:center;justify-content:center}iframe{width:100%;height:100%;border:none}</style></head><body>${body}</body></html>`;
  },

  injectContent(content, isRaw, win, title, favicon) {
    const fav = favicon || DEFAULT_CLOAK_FAVICON;
    let html = isRaw ?
      content
        .replace(/<title>.*?<\/title>/i, `<title>${escapeHTML(title)}</title>`)
        .replace(/<head>/i, `<head><link rel="icon" href="${fav}">`) :
      this.getShell(content, title, fav);

    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.document.title = escapeHTML(title);
    } else {
      const frame = $("game-frame");
      const overlay = $("window-overlay");
      if (frame) frame.srcdoc = html;
      if (overlay) {
        overlay.style.display = "flex";
        setTimeout(() => $("game-window")?.classList.add("active"), 10);
      }
    }
  },

  async play(id) {
    const game = GAMES.find((g) => g.id === id);
    if (!game) {
      this.showError("Game not found");
      return;
    }

    try {
      const title = localStorage.getItem(CLOAK_TITLE_KEY) || DEFAULT_CLOAK_TITLE;
      const favicon = localStorage.getItem(CLOAK_FAVICON_KEY) || DEFAULT_CLOAK_FAVICON;
      const isExternal = game.url.includes("://");
      const url = isExternal ? game.url : game.url.replace("{COVER_URL}", `${API_BASE}/covers@main`).replace("{HTML_URL}", `${API_BASE}/html@main`);

      if (MODE === "tab") {
        await this.playInTab(url, isExternal, title, favicon);
      } else {
        await this.playInWindow(url, isExternal, game.name, title, favicon);
      }
    } catch (err) {
      this.showError("Failed to load game.");
      console.error(err);
    }
  },

  async playInTab(url, isExternal, title, favicon) {
    const win = window.open("about:blank", "_blank");
    if (!win) {
      this.showError("Popups blocked. Allow popups and try again.");
      return;
    }

    if (isExternal) {
      this.injectContent(`<iframe src="${escapeHTML(url)}"></iframe>`, false, win, title, favicon);
    } else {
      const content = await fetch(url).then((r) => r.text());
      this.injectContent(content, true, win, title, favicon);
    }
  },

  async playInWindow(url, isExternal, gameName, title, favicon) {
    const winTitle = $("win-title");
    if (winTitle) winTitle.textContent = gameName.toUpperCase();

    if (isExternal) {
      const frame = $("game-frame");
      const overlay = $("window-overlay");
      if (frame) frame.src = url;
      if (overlay) overlay.style.display = "flex";
      setTimeout(() => $("game-window")?.classList.add("active"), 10);
    } else {
      const content = await fetch(url).then((r) => r.text());
      this.injectContent(content, true, null, title, favicon);
    }
  },

  updateUI() {
    document.querySelectorAll(".switcher button[id^='mode-']").forEach((btn) => {
      btn.classList.toggle("active", btn.id.replace("mode-", "") === MODE);
    });
  },

  showError(message) {
    const error = document.createElement("div");
    error.style.cssText = "position:fixed;top:20px;right:20px;background:#d43d1f;color:#fff;padding:1rem 1.5rem;border-radius:.5rem;z-index:1000;font:inherit";
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 5000);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  App.init();
  loadNavbar("../components/navbar.html");
  lucide.createIcons();
});