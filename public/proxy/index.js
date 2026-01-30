"use strict";

/**
 * Proxy browser with Scramjet functionality
 * Combines the UI from /proxy with the Scramjet functionality from /proxy-ez
 */

const ProxyApp = {
    isFullscreen: false,
    tabs: [],
    currentTab: 0,
    tabCounter: 0,
    scramjet: null,
    connection: null,
    searchEngine: "https://www.google.com/search?q=%s",
    error: null,
    errorCode: null,

    async init() {
        // Get error elements
        this.error = document.getElementById("sj-error");
        this.errorCode = document.getElementById("sj-error-code");

        // Initialize Scramjet
        try {
            const { ScramjetController } = $scramjetLoadController();

            this.scramjet = new ScramjetController({
                files: {
                    wasm: "/scram/scramjet.wasm.wasm",
                    all: "/scram/scramjet.all.js",
                    sync: "/scram/scramjet.sync.js",
                },
            });

            this.scramjet.init();

            // Initialize BareMux connection
            this.connection = new BareMux.BareMuxConnection("/baremux/worker.js");
        } catch (err) {
            this.showError("Failed to initialize Scramjet", err);
            console.error(err);
        }

        // Setup UI
        this.setupThemeSwitcher();
        this.setupFullscreen();
        this.setupNavControls();
        this.setupAddressBar();
        this.setupTabs();
        this.setupInitialState();

        // Initialize first tab
        this.addTab();
    },

    /**
     * Setup theme switcher event listeners
     */
    setupThemeSwitcher() {
        document.querySelectorAll(".switcher button[id^='theme-']").forEach((button) => {
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
     * Setup navigation controls (back, forward, refresh)
     */
    setupNavControls() {
        const backBtn = document.getElementById("back-btn");
        const forwardBtn = document.getElementById("forward-btn");
        const refreshBtn = document.getElementById("refresh-btn");

        if (backBtn) {
            backBtn.addEventListener("click", () => this.navigateBack());
        }

        if (forwardBtn) {
            forwardBtn.addEventListener("click", () => this.navigateForward());
        }

        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => this.refreshPage());
        }
    },

    /**
     * Setup address bar functionality
     */
    setupAddressBar() {
        const addressBar = document.getElementById("address-bar");
        const searchBtn = document.getElementById("search-btn");

        if (searchBtn) {
            searchBtn.addEventListener("click", () => this.handleNavigation());
        }

        if (addressBar) {
            addressBar.addEventListener("keydown", (e) => {
                if (e.key === "Enter") {
                    this.handleNavigation();
                }
            });
        }
    },

    /**
     * Setup tab management
     */
    setupTabs() {
        const tabAdd = document.querySelector(".tab-add");

        if (tabAdd) {
            tabAdd.addEventListener("click", () => this.addTab());
        }

        // Delegate tab clicks
        const tabsBar = document.querySelector(".tabs-bar");
        if (tabsBar) {
            tabsBar.addEventListener("click", (e) => {
                const tab = e.target.closest(".tab");
                const closeBtn = e.target.closest(".tab-close");

                if (closeBtn) {
                    e.stopPropagation();
                    const tabIndex = parseInt(tab.dataset.tab);
                    this.closeTab(tabIndex);
                } else if (tab) {
                    const tabIndex = parseInt(tab.dataset.tab);
                    this.switchTab(tabIndex);
                }
            });
        }
    },

    /**
     * Initialize page state
     */
    setupInitialState() {
        ThemeManager.updateSwitcher();
        this.updateStatus("Ready");
    },

    /**
     * Handle navigation from address bar
     */
    async handleNavigation() {
        const addressBar = document.getElementById("address-bar");
        if (!addressBar || !addressBar.value.trim()) return;

        const url = addressBar.value.trim();

        try {
            // Register service worker if not already registered
            await registerSW();
        } catch (err) {
            this.showError("Failed to register service worker", err);
            return;
        }

        const fullUrl = search(url, this.searchEngine);
        this.navigateTo(fullUrl);
    },

    /**
     * Navigate to a URL in the current tab
     */
    async navigateTo(url) {
        const tab = this.tabs[this.currentTab];
        if (!tab) return;

        this.updateStatus("Loading...");

        try {
            // Setup WISP transport if needed
            let wispUrl =
                (location.protocol === "https:" ? "wss" : "ws") +
                "://" +
                location.host +
                "/wisp/";

            if ((await this.connection.getTransport()) !== "/libcurl/index.mjs") {
                await this.connection.setTransport("/libcurl/index.mjs", [
                    { websocket: wispUrl },
                ]);
            }

            // Clear existing frame if any
            if (tab.frame) {
                tab.frame.frame.remove();
            }

            // Create new Scramjet frame
            const frame = this.scramjet.createFrame();
            frame.frame.style.width = "100%";
            frame.frame.style.height = "100%";
            frame.frame.style.border = "none";

            // Add frame to current tab content
            const tabContent = document.querySelector(`.tab-content[data-tab="${this.currentTab}"]`);
            if (tabContent) {
                tabContent.innerHTML = "";
                tabContent.appendChild(frame.frame);
            }

            // Store frame reference
            tab.frame = frame;
            tab.url = url;

            // Update tab title
            this.updateTabTitle(this.currentTab, this.getHostname(url));

            // Navigate to URL
            frame.go(url);

            // Update address bar
            const addressBar = document.getElementById("address-bar");
            if (addressBar) {
                addressBar.value = url;
            }

            this.updateStatus("Loaded");
            this.hideError();
        } catch (err) {
            this.showError("Failed to load page", err);
            this.updateStatus("Error loading page");
        }
    },

    /**
     * Navigate back in current tab
     */
    navigateBack() {
        const tab = this.tabs[this.currentTab];
        if (tab && tab.frame && tab.frame.frame.contentWindow) {
            try {
                tab.frame.frame.contentWindow.history.back();
            } catch (err) {
                console.error("Failed to navigate back", err);
            }
        }
    },

    /**
     * Navigate forward in current tab
     */
    navigateForward() {
        const tab = this.tabs[this.currentTab];
        if (tab && tab.frame && tab.frame.frame.contentWindow) {
            try {
                tab.frame.frame.contentWindow.history.forward();
            } catch (err) {
                console.error("Failed to navigate forward", err);
            }
        }
    },

    /**
     * Refresh current tab
     */
    refreshPage() {
        const tab = this.tabs[this.currentTab];
        if (tab && tab.url) {
            this.navigateTo(tab.url);
        }
    },

    /**
     * Add a new tab
     */
    addTab() {
        const tabIndex = this.tabCounter++;

        // Create tab data
        const tabData = {
            index: tabIndex,
            title: "New Tab",
            url: null,
            frame: null,
        };

        this.tabs.push(tabData);

        // Create tab element
        const tabsBar = document.querySelector(".tabs-bar");
        const tabAdd = tabsBar.querySelector(".tab-add");

        const tabEl = document.createElement("div");
        tabEl.className = "tab";
        tabEl.dataset.tab = tabIndex;
        tabEl.innerHTML = `
            <span class="tab-title">New Tab</span>
            <button type="button" class="tab-close" title="Close tab"><i data-lucide="x"></i></button>
        `;

        tabsBar.insertBefore(tabEl, tabAdd);

        // Create tab content
        const browserContent = document.querySelector(".browser-content");
        const tabContent = document.createElement("div");
        tabContent.className = "tab-content";
        tabContent.dataset.tab = tabIndex;
        browserContent.appendChild(tabContent);

        // Switch to new tab
        this.switchTab(tabIndex);

        // Reinitialize lucide icons
        lucide.createIcons();
    },

    /**
     * Close a tab
     */
    closeTab(tabIndex) {
        const tabDataIndex = this.tabs.findIndex(t => t.index === tabIndex);
        if (tabDataIndex === -1) return;

        // Can't close the last tab
        if (this.tabs.length === 1) return;

        // Remove frame if exists
        const tab = this.tabs[tabDataIndex];
        if (tab.frame) {
            tab.frame.frame.remove();
        }

        // Remove tab data
        this.tabs.splice(tabDataIndex, 1);

        // Remove tab elements
        const tabEl = document.querySelector(`.tab[data-tab="${tabIndex}"]`);
        const tabContent = document.querySelector(`.tab-content[data-tab="${tabIndex}"]`);

        if (tabEl) tabEl.remove();
        if (tabContent) tabContent.remove();

        // Switch to another tab if we closed the current one
        if (this.currentTab === tabIndex) {
            const newIndex = Math.min(tabDataIndex, this.tabs.length - 1);
            this.switchTab(this.tabs[newIndex].index);
        }
    },

    /**
     * Switch to a different tab
     */
    switchTab(tabIndex) {
        // Update current tab
        this.currentTab = tabIndex;

        // Update tab UI
        document.querySelectorAll(".tab").forEach(tab => {
            tab.classList.toggle("active", parseInt(tab.dataset.tab) === tabIndex);
        });

        // Update content UI
        document.querySelectorAll(".tab-content").forEach(content => {
            content.classList.toggle("active", parseInt(content.dataset.tab) === tabIndex);
        });

        // Update address bar
        const tab = this.tabs.find(t => t.index === tabIndex);
        const addressBar = document.getElementById("address-bar");
        if (addressBar && tab) {
            addressBar.value = tab.url || "";
        }
    },

    /**
     * Update tab title
     */
    updateTabTitle(tabIndex, title) {
        const tab = this.tabs.find(t => t.index === tabIndex);
        if (tab) {
            tab.title = title;
        }

        const tabEl = document.querySelector(`.tab[data-tab="${tabIndex}"] .tab-title`);
        if (tabEl) {
            tabEl.textContent = title;
        }
    },

    /**
     * Update status bar
     */
    updateStatus(text) {
        const statusText = document.getElementById("status-text");
        if (statusText) {
            statusText.textContent = text;
        }
    },

    /**
     * Show error message
     */
    showError(message, err) {
        const errorContainer = document.getElementById("error-container");
        if (this.error) {
            this.error.textContent = message;
        }
        if (this.errorCode && err) {
            this.errorCode.textContent = err.toString();
        }
        if (errorContainer) {
            errorContainer.style.display = "block";
        }
    },

    /**
     * Hide error message
     */
    hideError() {
        const errorContainer = document.getElementById("error-container");
        if (errorContainer) {
            errorContainer.style.display = "none";
        }
    },

    /**
     * Extract hostname from URL
     */
    getHostname(url) {
        try {
            return new URL(url).hostname;
        } catch (err) {
            return url.substring(0, 20) + "...";
        }
    },
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    ProxyApp.init();
    loadNavbar("../components/navbar.html");
    lucide.createIcons();
});
