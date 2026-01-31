"use strict";

/**
 * Games library management and UI logic
 */

// Constants
const CLOAK_TITLE_KEY = "newton-cloak-title";
const CLOAK_FAVICON_KEY = "newton-cloak-favicon";
const MODE_KEY = "newton-mode";
const DEFAULT_MODE = "window";
const DEFAULT_CLOAK_TITLE = "Google";
const DEFAULT_CLOAK_FAVICON = "https://www.google.com/favicon.ico";
const API_BASE = "https://cdn.jsdelivr.net/gh/gn-math";
const ZONES_URL = `${API_BASE}/assets@main/zones.json?t=${Date.now()}`;
const TRANSITION_DURATION_MS = 400;
const ANIMATION_DELAY_MS = 10;

// Remove the broken gn-math AI
const EXCLUDED_PATTERNS = ["chat", "bot", "ai"];

// State
let GAMES = [];
let MODE = DEFAULT_MODE;

/**
 * Element getter with warning
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null
 */
const getElement = (id) => {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id "${id}" not found`);
  }
  return element;
};

/**
 * Check if a game name matches any excluded pattern
 * @param {string} name - Game name
 * @returns {boolean} True if excluded
 */
const isGameExcluded = (name) => {
  const lowerName = name.toLowerCase();
  return EXCLUDED_PATTERNS.some((pattern) => lowerName.includes(pattern));
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
const escapeHTML = (text) => {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Main App object
 */
const App = {
  /**
   * Init
   */
  async init() {
    ThemeManager.init();
    this.setMode(localStorage.getItem(MODE_KEY) || DEFAULT_MODE);
    this.loadCloak();
    this.setupEventListeners();
    this.setupDragging();

    try {
      await this.loadGames();
      this.render();
    } catch (error) {
      this.showError("Failed to load games. Please refresh the page.");
      console.error("Failed to load games:", error);
    }
  },

  /**
   * Fetch games from API
   */
  async loadGames() {
    const response = await fetch(ZONES_URL);
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Invalid games data format");
    }

    // Remove first element (gn-math advertisement)
    GAMES = data.slice(1);
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    const searchInput = getElement("gameSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => this.render(e.target.value));
    }

    // Mode switcher
    document.querySelectorAll(".switcher button[id^='mode-']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const mode = e.target.id.replace("mode-", "");
        this.setMode(mode);
      });
    });

    // Settings modal
    const settingsTrigger = document.querySelector("#settings-trigger button");
    if (settingsTrigger) {
      settingsTrigger.addEventListener("click", () => this.toggleSettings());
    }

    // Settings buttons
    const settingsModal = getElement("settings-modal");
    const saveBtn = settingsModal && settingsModal.querySelector(".save-btn");
    const closeBtn = settingsModal && settingsModal.querySelector(".close-btn");
    if (saveBtn) saveBtn.addEventListener("click", () => this.saveSettings());
    if (closeBtn) closeBtn.addEventListener("click", () => this.toggleSettings());

    // Window controls
    const windowBar = getElement("window-bar");
    const closeBtn2 = windowBar && windowBar.querySelector(".dot.close");
    const minBtn = windowBar && windowBar.querySelector(".dot.min");
    const maxBtn = windowBar && windowBar.querySelector(".dot.max");
    const restoreBtn = getElement("restore-btn");

    if (closeBtn2) closeBtn2.addEventListener("click", () => this.close());
    if (minBtn) minBtn.addEventListener("click", () => this.minimize());
    if (maxBtn) maxBtn.addEventListener("click", () => this.maximize());
    if (restoreBtn) restoreBtn.addEventListener("click", () => this.restore());

    // Double click bar to maximize
    const winBar = getElement("window-bar");
    if (winBar) {
      winBar.addEventListener("dblclick", (e) => {
        if (e.target.id === "window-bar" || e.target.id === "win-title") {
          this.maximize();
        }
      });
    }
  },

  /**
   * Setup draggable window functionality
   */
  setupDragging() {
    const win = getElement("game-window");
    const bar = getElement("window-bar");
    if (!win || !bar) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    const getPointerPos = (e) => {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    };

    const applyTransform = (x, y) => {
      win.style.transform = `translate(${x}px, ${y}px)`;
    };

    const dragStart = (e) => {
      if (win.classList.contains("maximized")) return;
      if (e.target.closest(".window-bar-buttons")) return;
      if (!bar.contains(e.target) && e.target !== bar) return;

      isDragging = true;

      if (e.touches) {
        e.preventDefault();
      }

      const pos = getPointerPos(e);
      startX = pos.x - offsetX;
      startY = pos.y - offsetY;
    };

    const drag = (e) => {
      if (!isDragging) return;

      if (e.touches) {
        e.preventDefault();
      }

      const pos = getPointerPos(e);
      offsetX = pos.x - startX;
      offsetY = pos.y - startY;

      applyTransform(offsetX, offsetY);
    };

    const dragEnd = () => {
      isDragging = false;
    };

    bar.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    bar.addEventListener("touchstart", dragStart, { passive: false });
    document.addEventListener("touchmove", drag, { passive: false });
    document.addEventListener("touchend", dragEnd);

    const originalClose = this.close.bind(this);
    this.close = () => {
      originalClose();
      offsetX = 0;
      offsetY = 0;
      applyTransform(0, 0);
      isDragging = false;
    };
  },

  /**
   * Render game cards to the DOM
   * @param {string} query - Search query
   */
  render(query = "") {
    const gameList = getElement("gameList");
    if (!gameList) return;

    const searchQuery = query.toLowerCase();
    const filteredGames = GAMES.filter((game) => {
      const gameName = game.name.toLowerCase();
      const matchesSearch = gameName.includes(searchQuery);
      const isNotExcluded = !isGameExcluded(gameName);
      return matchesSearch && isNotExcluded;
    });

    // Create game cards
    gameList.innerHTML = "";
    filteredGames.forEach((game) => {
      const card = document.createElement("div");
      card.className = "game-card";
      card.textContent = game.name.toUpperCase();
      card.addEventListener("click", () => this.play(game.id));
      gameList.appendChild(card);
    });
  },

  /**
   * Set play mode (window or tab)
   * @param {string} mode - "window" or "tab"
   */
  setMode(mode) {
    MODE = mode;
    localStorage.setItem(MODE_KEY, mode);
    this.updateModeSwitcher();
  },

  /**
   * Update mode switcher UI
   */
  updateModeSwitcher() {
    document.querySelectorAll(".switcher button[id^='mode-']").forEach((btn) => {
      const modeId = btn.id.replace("mode-", "");
      btn.classList.toggle("active", modeId === MODE);
    });
  },

  /**
   * Close the game window
   */
  close() {
    const gameWindow = getElement("game-window");
    const overlay = getElement("window-overlay");
    const gameFrame = getElement("game-frame");
    const restoreBtn = getElement("restore-btn");

    if (!gameWindow || !overlay || !gameFrame) return;

    gameWindow.classList.remove("active", "minimized");
    if (restoreBtn) restoreBtn.style.display = "none";

    setTimeout(() => {
      gameFrame.srcdoc = "";
      gameFrame.src = "";
      overlay.style.display = "none";
      gameWindow.style.transform = "";
    }, TRANSITION_DURATION_MS);
  },

  /**
   * Toggle maximize state
   */
  maximize() {
    const gameWindow = getElement("game-window");
    if (gameWindow) {
      gameWindow.classList.toggle("maximized");
      if (gameWindow.classList.contains("maximized")) {
        gameWindow.style.transform = "";
      }
      const gameFrame = getElement("game-frame");
      if (gameFrame) gameFrame.focus();
    }
  },

  /**
   * Minimize the game window
   */
  minimize() {
    const gameWindow = getElement("game-window");
    const restoreBtn = getElement("restore-btn");

    if (gameWindow) {
      gameWindow.classList.add("minimized");
      gameWindow.classList.remove("maximized");
    }
    if (restoreBtn) restoreBtn.style.display = "block";
  },

  /**
   * Restore minimized window
   */
  restore() {
    const gameWindow = getElement("game-window");
    const restoreBtn = getElement("restore-btn");

    if (gameWindow) gameWindow.classList.remove("minimized");
    if (restoreBtn) restoreBtn.style.display = "none";
    const gameFrame = getElement("game-frame");
    if (gameFrame) gameFrame.focus();
  },

  /**
   * Toggle settings modal
   */
  toggleSettings() {
    const modal = getElement("settings-modal");
    if (!modal) return;

    const isOpening = modal.classList.toggle("active");
    if (isOpening) {
      const titleInput = getElement("cloak-title");
      const faviconInput = getElement("cloak-favicon");

      if (titleInput) {
        titleInput.value = localStorage.getItem(CLOAK_TITLE_KEY) || "";
      }
      if (faviconInput) {
        faviconInput.value = localStorage.getItem(CLOAK_FAVICON_KEY) || "";
      }
    }
  },

  /**
   * Save settings from modal
   */
  saveSettings() {
    const titleInput = getElement("cloak-title");
    const faviconInput = getElement("cloak-favicon");

    if (!titleInput || !faviconInput) return;

    const title = titleInput.value.trim();
    const favicon = faviconInput.value.trim();

    if (title) localStorage.setItem(CLOAK_TITLE_KEY, title);
    if (favicon) localStorage.setItem(CLOAK_FAVICON_KEY, favicon);

    this.applyCloak(title || DEFAULT_CLOAK_TITLE, favicon || DEFAULT_CLOAK_FAVICON);
    this.toggleSettings();
  },

  /**
   * Load cloak settings from storage
   */
  loadCloak() {
    const title = localStorage.getItem(CLOAK_TITLE_KEY);
    const favicon = localStorage.getItem(CLOAK_FAVICON_KEY);

    if (title || favicon) {
      this.applyCloak(
        title || DEFAULT_CLOAK_TITLE,
        favicon || DEFAULT_CLOAK_FAVICON
      );
    }
  },

  /**
   * Apply cloaking to page
   * @param {string} title - Page title
   * @param {string} favicon - Favicon URL
   */
  applyCloak(title, favicon) {
    if (title) {
      document.title = escapeHTML(title);
    }

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

  /**
   * Get background color from CSS variables
   * @returns {string} Background color
   */
  getBackgroundColor() {
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();
    return bgColor || "#000";
  },

  /**
   * Create HTML shell for game content
   * @param {string} body - Content HTML
   * @param {string} title - Page title
   * @param {string} favicon - Favicon URL
   * @returns {string} Complete HTML document
   */
  createShell(body, title, favicon) {
    const bg = escapeHTML(this.getBackgroundColor());
    const escapedTitle = escapeHTML(title);

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapedTitle}</title>
    <link rel="icon" href="${favicon}">
    <style>
      body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: ${bg};
        display: flex;
        align-items: center;
        justify-content: center;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: none;
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
  },

  /**
   * Inject content into game frame or new window
   * @param {string} content - HTML content
   * @param {boolean} isRaw - Whether content is raw HTML or needs wrapping
   * @param {Window} win - Target window (null for iframe)
   * @param {string} title - Page title for cloaking
   * @param {string} favicon - Favicon for cloaking
   */
  injectContent(content, isRaw, win, title, favicon) {
    const safeFavicon = favicon || DEFAULT_CLOAK_FAVICON;

    let html;
    if (isRaw) {
      // Replace title and favicon in raw HTML
      html = content
        .replace(/<title>.*?<\/title>/i, `<title>${escapeHTML(title)}</title>`)
        .replace(/<head>/i, `<head><link rel="icon" href="${safeFavicon}">`);
    } else {
      // Wrap content in shell
      html = this.createShell(content, title, safeFavicon);
    }

    if (win) {
      // Inject into new window
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.document.title = escapeHTML(title);
    } else {
      // Inject into iframe
      const gameFrame = getElement("game-frame");
      const overlay = getElement("window-overlay");

      if (gameFrame) {
        gameFrame.srcdoc = html;
      }
      if (overlay) {
        overlay.style.display = "flex";
        setTimeout(() => {
          const gameWindow = getElement("game-window");
          if (gameWindow) gameWindow.classList.add("active");
        }, ANIMATION_DELAY_MS);
      }
    }
  },

  /**
   * Play a game by ID
   * @param {string} id - Game ID
   */
  async play(id) {
    const game = GAMES.find((g) => g.id === id);
    if (!game) {
      this.showError("Game not found");
      return;
    }

    try {
      const cloakTitle =
        localStorage.getItem(CLOAK_TITLE_KEY) || DEFAULT_CLOAK_TITLE;
      const cloakFavicon =
        localStorage.getItem(CLOAK_FAVICON_KEY) || DEFAULT_CLOAK_FAVICON;

      const isExternalURL = game.url.includes("://");
      const gameURL = isExternalURL ?
        game.url :
        game.url
          .replace("{COVER_URL}", `${API_BASE}/covers@main`)
          .replace("{HTML_URL}", `${API_BASE}/html@main`);

      if (MODE === "tab") {
        await this.playInTab(gameURL, isExternalURL, cloakTitle, cloakFavicon);
      } else {
        await this.playInWindow(gameURL, isExternalURL, game.name, cloakTitle, cloakFavicon);
      }
    } catch (error) {
      this.showError("Failed to load game. Please try again.");
      console.error("Error playing game:", error);
    }
  },

  /**
   * Play game in new tab
   * @param {string} url - Game URL
   * @param {boolean} isExternal - Is external URL
   * @param {string} title - Cloak title
   * @param {string} favicon - Cloak favicon
   */
  async playInTab(url, isExternal, title, favicon) {
    const win = window.open("about:blank", "_blank");
    if (!win) {
      this.showError("Popups are blocked. Please allow popups and try again.");
      return;
    }

    if (isExternal) {
      this.injectContent(
        `<iframe src="${escapeHTML(url)}"></iframe>`,
        false,
        win,
        title,
        favicon
      );
    } else {
      const content = await fetch(url).then((r) => r.text());
      this.injectContent(content, true, win, title, favicon);
    }
  },

  /**
   * Play game in window modal
   * @param {string} url - Game URL
   * @param {boolean} isExternal - Is external URL
   * @param {string} gameName - Game name
   * @param {string} title - Cloak title
   * @param {string} favicon - Cloak favicon
   */
  async playInWindow(url, isExternal, gameName, title, favicon) {
    const windowTitle = getElement("win-title");
    if (windowTitle) {
      windowTitle.textContent = gameName.toUpperCase();
    }

    if (isExternal) {
      const gameFrame = getElement("game-frame");
      const overlay = getElement("window-overlay");

      if (gameFrame) gameFrame.src = url;
      if (overlay) overlay.style.display = "flex";

      setTimeout(() => {
        const gameWindow = getElement("game-window");
        if (gameWindow) gameWindow.classList.add("active");
      }, ANIMATION_DELAY_MS);
    } else {
      const content = await fetch(url).then((r) => r.text());
      this.injectContent(content, true, null, title, favicon);
    }
  },

  /**
   * Show error message to user
   * @param {string} message - Error message
   */
  showError(message) {
    // Create temporary error notification
    const error = document.createElement("div");
    error.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #d43d1f;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 0.5rem;
      z-index: 1000;
      font: inherit;
    `;
    error.textContent = message;
    document.body.appendChild(error);

    setTimeout(() => error.remove(), 5000);
  },
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  App.init();
  loadNavbar("../components/navbar.html");
  lucide.createIcons();
});