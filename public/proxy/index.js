"use strict";

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelector(sel);
const getTab = (arr, idx) => arr.find(t => t.index === idx);

const ProxyApp = {
    isFullscreen: false,
    tabs: [],
    currentTab: 0,
    tabCounter: 0,
    scramjet: null,
    connection: null,
    searchEngine: "https://www.google.com/search?q=%s",

    async init() {
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
            this.connection = new BareMux.BareMuxConnection("/baremux/worker.js");
        } catch (err) {
            this.showError("Failed to initialize Scramjet", err);
            console.error(err);
        }

        this.setupUI();
        this.addTab();
    },

    setupUI() {
        // Fullscreen
        const fsBtn = $("fullscreen-btn");
        if (fsBtn) {
            fsBtn.addEventListener("click", () => this.toggleFullscreen());
            ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange"].forEach(ev =>
                document.addEventListener(ev, () => this.handleFullscreenChange())
            );
        }

        // Navigation
        ["back-btn", "forward-btn", "refresh-btn"].forEach(id => {
            const btn = $(id);
            if (btn) {
                const action = id.replace("-btn", "");
                btn.addEventListener("click", () => this[`navigate${action.charAt(0).toUpperCase() + action.slice(1)}`]?.());
            }
        });

        // Address bar
        const searchBtn = $("search-btn");
        const addressBar = $("address-bar");
        if (searchBtn) searchBtn.addEventListener("click", () => this.handleNavigation());
        if (addressBar) addressBar.addEventListener("keydown", (e) => e.key === "Enter" && this.handleNavigation());

        // Tabs
        const tabsBar = $$(".tabs-bar");
        const tabAdd = $$(".tab-add");
        if (tabAdd) tabAdd.addEventListener("click", () => this.addTab());
        if (tabsBar) {
            tabsBar.addEventListener("click", (e) => {
                const tab = e.target.closest(".tab");
                const closeBtn = e.target.closest(".tab-close");
                if (closeBtn) {
                    e.stopPropagation();
                    this.closeTab(parseInt(tab.dataset.tab));
                } else if (tab) {
                    this.switchTab(parseInt(tab.dataset.tab));
                }
            });
        }

        ThemeManager.updateSwitcher();
    },

    handleFullscreenChange() {
        const header = $$("header");
        if (!header) return;
        const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
        this.isFullscreen = !!isFull;
        header.style.display = isFull ? "none" : "";
    },

    toggleFullscreen() {
        const elem = $$(".browser-chrome");
        if (!elem) return;

        if (!this.isFullscreen) {
            const req = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen;
            req?.call(elem);
        } else {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
            exit?.call(document);
        }
    },

    navigateBack() {
        const tab = this.tabs[this.currentTab];
        tab?.frame?.frame?.contentWindow?.history.back();
    },

    navigateForward() {
        const tab = this.tabs[this.currentTab];
        tab?.frame?.frame?.contentWindow?.history.forward();
    },

    refreshPage() {
        const tab = this.tabs[this.currentTab];
        if (tab?.url) this.navigateTo(tab.url);
    },

    async handleNavigation() {
        const addressBar = $("address-bar");
        if (!addressBar?.value.trim()) return;

        try {
            await registerSW();
        } catch (err) {
            this.showError("Failed to register service worker", err);
            return;
        }

        this.navigateTo(search(addressBar.value.trim(), this.searchEngine));
    },

    async navigateTo(url) {
        const tab = this.tabs[this.currentTab];
        if (!tab) return;

        try {
            const proto = location.protocol === "https:" ? "wss" : "ws";
            const wispUrl = `${proto}://${location.host}/wisp/`;

            if ((await this.connection.getTransport()) !== "/libcurl/index.mjs") {
                await this.connection.setTransport("/libcurl/index.mjs", [{ websocket: wispUrl }]);
            }

            tab.frame?.frame?.remove();

            const frame = this.scramjet.createFrame();
            frame.frame.style.cssText = "width:100%;height:100%;border:none";

            const tabContent = $$(`.tab-content[data-tab="${this.currentTab}"]`);
            if (tabContent) {
                tabContent.innerHTML = "";
                tabContent.appendChild(frame.frame);
            }

            tab.frame = frame;
            tab.url = url;
            this.updateTabTitle(this.currentTab, this.getHostname(url));
            frame.go(url);

            const addressBar = $("address-bar");
            if (addressBar) addressBar.value = url;
            this.hideError();
        } catch (err) {
            this.showError("Failed to load page", err);
        }
    },

    addTab() {
        const idx = this.tabCounter++;
        const tabData = { index: idx, title: "New Tab", url: null, frame: null };
        this.tabs.push(tabData);

        const tabsBar = $$(".tabs-bar");
        const tabAdd = $$(".tab-add");
        const tabEl = document.createElement("div");
        tabEl.className = "tab";
        tabEl.dataset.tab = idx;
        tabEl.innerHTML = `<span class="tab-title">New Tab</span><button type="button" class="tab-close" title="Close tab"><i data-lucide="x"></i></button>`;
        tabsBar?.insertBefore(tabEl, tabAdd);

        const tabContent = document.createElement("div");
        tabContent.className = "tab-content";
        tabContent.dataset.tab = idx;
        $$(".browser-content")?.appendChild(tabContent);

        this.switchTab(idx);
    },

    closeTab(tabIdx) {
        const dataIdx = this.tabs.findIndex(t => t.index === tabIdx);
        if (dataIdx === -1 || this.tabs.length === 1) return;

        this.tabs[dataIdx].frame?.frame?.remove();
        this.tabs.splice(dataIdx, 1);
        $$(`  .tab[data-tab="${tabIdx}"]`)?.remove();
        $$(`  .tab-content[data-tab="${tabIdx}"]`)?.remove();

        if (this.currentTab === tabIdx) {
            const newIdx = Math.min(dataIdx, this.tabs.length - 1);
            this.switchTab(this.tabs[newIdx].index);
        }
    },

    switchTab(tabIdx) {
        if (this.currentTab === tabIdx) return;

        const prev = this.currentTab;
        this.currentTab = tabIdx;

        $$(`  .tab[data-tab="${prev}"]`)?.classList.remove("active");
        $$(`  .tab[data-tab="${tabIdx}"]`)?.classList.add("active");
        $$(`  .tab-content[data-tab="${prev}"]`)?.classList.remove("active");
        $$(`  .tab-content[data-tab="${tabIdx}"]`)?.classList.add("active");

        const tab = getTab(this.tabs, tabIdx);
        const addressBar = $("address-bar");
        if (addressBar && tab) addressBar.value = tab.url || "";
    },

    updateTabTitle(tabIdx, title) {
        const tab = getTab(this.tabs, tabIdx);
        if (tab) tab.title = title;
        const el = $$(`  .tab[data-tab="${tabIdx}"] .tab-title`);
        if (el) el.textContent = title;
    },

    showError(message, err) {
        $("sj-error")?.textContent && ($("sj-error").textContent = message);
        if ($("sj-error-code") && err) $("sj-error-code").textContent = err.toString();
        $("error-container")?.style.display === "none" && ($("error-container").style.display = "block");
    },

    hideError() {
        const container = $("error-container");
        if (container) container.style.display = "none";
    },

    getHostname(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return url.substring(0, 20) + "...";
        }
    },
};

document.addEventListener("DOMContentLoaded", () => {
    ProxyApp.init();
    loadNavbar("../components/navbar.html");
    lucide.createIcons();
});
