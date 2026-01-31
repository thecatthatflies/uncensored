"use strict";

/**
 * Centralized theme management module
 */

const THEME_KEY = "newton-theme";
const DEFAULT_THEME = "quartz";

const ThemeManager = {
  /**
   * Initialize theme from localStorage or use default
   */
  init() {
    const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    this.setTheme(saved);
  },

  /**
   * Set active theme and update UI
   * @param {string} theme - Theme name (quartz, slate, midnight)
   */
  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
    this.updateSwitcher();
  },

  /**
   * Update theme switcher UI to show active theme
   */
  updateSwitcher() {
    const currentTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    const switchers = document.querySelectorAll(".switcher button[id^='theme-']");

    switchers.forEach((btn) => {
      const themeId = btn.id.replace("theme-", "");
      btn.classList.toggle("active", themeId === currentTheme);
    });
  },

  /**
   * Get current active theme
   * @returns {string} Active theme name
   */
  getCurrentTheme() {
    return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  },

  /**
   * Setup theme switcher event listeners (called once during init)
   */
  setupListeners() {
    document.querySelectorAll(".switcher button[id^='theme-']").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const theme = e.target.id.replace("theme-", "");
        this.setTheme(theme);
      });
    });
  },
};

// Apply theme immediately before DOMContentLoaded to prevent flashing
(function() {
  const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", saved);
})();

// Initialize event listeners
document.addEventListener("DOMContentLoaded", () => {
  ThemeManager.setupListeners();
});
