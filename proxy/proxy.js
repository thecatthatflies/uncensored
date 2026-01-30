/**
 * Proxy browser page logic
 */

const ProxyApp = {
    isFullscreen: false,

    init() {
        this.setupThemeSwitcher();
        this.setupFullscreen();
        this.setupInitialState();
    },

    /**
     * Setup theme switcher event listeners
     */
    setupThemeSwitcher() {
        document.querySelectorAll(".switcher span[id^='theme-']").forEach((button) => {
            button.addEventListener("click", (e) => {
                const theme = e.target.id.replace("theme-", "");
                ThemeManager.setTheme(theme);
            });
        });
    },

    /**
     * Setup fullscreen toggle functionality
     */
    setupFullscreen() {
        const fullscreenBtn = document.getElementById("fullscreen-btn");
        if (!fullscreenBtn) return;

        fullscreenBtn.addEventListener("click", () => this.toggleFullscreen());
    },

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
        const browserChrome = document.querySelector(".browser-chrome");
        const header = document.querySelector("header");

        if (!browserChrome || !header) return;

        if (!this.isFullscreen) {
            // Enter fullscreen
            const requestFullscreen =
                browserChrome.requestFullscreen ||
                browserChrome.webkitRequestFullscreen ||
                browserChrome.mozRequestFullScreen;

            if (requestFullscreen) {
                requestFullscreen.call(browserChrome);
            }

            header.style.display = "none";
            this.isFullscreen = true;
        } else {
            // Exit fullscreen
            const exitFullscreen =
                document.exitFullscreen ||
                document.webkitExitFullscreen ||
                document.mozCancelFullScreen;

            if (exitFullscreen) {
                exitFullscreen.call(document);
            }

            header.style.display = "";
            this.isFullscreen = false;
        }
    },

    /**
     * Initialize page state
     */
    setupInitialState() {
        ThemeManager.updateSwitcher();
    },
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    ProxyApp.init();
    loadNavbar("../components/navbar.html");
    lucide.createIcons();
});