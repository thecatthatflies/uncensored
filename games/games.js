/* I have 3 conflicting code prettiers running at the same time. */

const THEME_KEY = "newton-theme";
const MODE_KEY = "newton-mode";
const CLOAK_TITLE_KEY = "newton-cloak-title";
const CLOAK_FAVICON_KEY = "newton-cloak-favicon";

/* Constants */
const BASE = "https://cdn.jsdelivr.net/gh/gn-math",
  ZONES = `${BASE}/assets@main/zones.json?t=${Date.now()}`;

let GAMES = [],
  MODE = "window";

const EL = (id) => document.getElementById(id);

const App = {
  async init() {
    this.setTheme(localStorage.getItem(THEME_KEY) || "midnight"); // sets default theme to midnight
    this.setMode(localStorage.getItem(MODE_KEY) || "window"); // sets default mode to window
    this.loadCloak();

    try {
      // Fetch games
      const resp = await fetch(ZONES);
      GAMES = (await resp.json()).slice(1);
      this.render();
      EL("gameSearch").oninput = (e) => this.render(e.target.value);
    } catch (e) {
      console.error("Initialization failed:", e);
    }
  },

  render(q = "") {
    const list = EL("gameList");
    if (!list) return;

    // Render game cards
    list.innerHTML = GAMES.filter((g) =>
      g.name.toLowerCase().includes(q.toLowerCase()),
    )
      .map(
        (g) =>
          `<div class="game-card" onclick="App.play('${g.id}')"><div>${g.name.toUpperCase()}</div></div>`,
      )
      .join("");
  },

  setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(THEME_KEY, t);
    this.toggle("theme", t);
  },

  setMode(m) {
    MODE = m;
    localStorage.setItem(MODE_KEY, m);
    this.toggle("mode", m);
  },

  toggle(type, val) {
    document
      .querySelectorAll(`#${type}-switcher span`)
      .forEach((s) => s.classList.toggle("active", s.id === `${type}-${val}`));
  },

  close() {
    EL("game-window").classList.remove("active", "minimized");
    EL("restore-btn").style.display = "none";
    setTimeout(() => {
      EL("game-frame").srcdoc = EL("game-frame").src = "";
      EL("window-overlay").style.display = "none";
    }, 400); // match with CSS transition duration
  },

  maximize: () => EL("game-window").classList.toggle("maximized"),
  minimize: () => {
    EL("game-window").classList.add("minimized");
    EL("restore-btn").style.display = "block";
  },

  restore: () => {
    EL("game-window").classList.remove("minimized");
    EL("restore-btn").style.display = "none";
  },

  toggleSettings: () => {
    const modal = EL("settings-modal");
    const isOpen = modal.classList.toggle("active");
    if (isOpen) {
      EL("cloak-title").value = localStorage.getItem(CLOAK_TITLE_KEY) || "";
      EL("cloak-favicon").value = localStorage.getItem(CLOAK_FAVICON_KEY) || "";
    }
  },

  saveSettings() {
    const title = EL("cloak-title").value;
    const favicon = EL("cloak-favicon").value;

    localStorage.setItem(CLOAK_TITLE_KEY, title);
    localStorage.setItem(CLOAK_FAVICON_KEY, favicon);

    this.applyCloak(title, favicon);
    this.toggleSettings();
  },

  loadCloak() {
    const title = localStorage.getItem(CLOAK_TITLE_KEY);
    const favicon = localStorage.getItem(CLOAK_FAVICON_KEY);
    if (title || favicon) this.applyCloak(title, favicon);
  },

  applyCloak(title, favicon) {
    if (title) document.title = title;
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

  async play(id) {
    const g = GAMES.find((x) => x.id == id);
    if (!g) return;

    // Determine if the URL is external or internal
    const isExt = g.url.includes("://");
    const url = isExt
      ? g.url
      : g.url
          .replace("{COVER_URL}", `${BASE}/covers@main`)
          .replace("{HTML_URL}", `${BASE}/html@main`);
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg")
      .trim();

    // Payload shell for internal games
    const shell = (body) =>
      `<!DOCTYPE html><html><head><title>Google</title><link rel="icon" href="https://www.google.com/favicon.ico"><style>body,html{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:${bg};display:flex;align-items:center;justify-content:center;}iframe{width:100%;height:100%;border:none;}</style></head><body>${body}</body></html>`;

    // Inject content into iframe or new window
    const inject = (content, isRaw, win = null) => {
      const html = isRaw
        ? content
            .replace(/<title>.*?<\/title>/i, "<title>Google</title>")
            .replace(
              /<head>/i,
              '<head><link rel="icon" href="https://www.google.com/favicon.ico">',
            )
        : shell(content);

      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
      } else {
        EL("game-frame").srcdoc = html;
        EL("window-overlay").style.display = "flex";
        setTimeout(() => EL("game-window").classList.add("active"), 10);
      }
    };

    // Inject game payload based on mode and URL type
    if (MODE === "tab") {
      const win = window.open("about:blank", "_blank");
      if (!win) return alert("Popup blocked! Please allow popups.");
      if (isExt) inject(`<iframe src="${url}"></iframe>`, false, win);
      else inject(await (await fetch(url)).text(), true, win);
    } else {
      EL("win-title").innerText = g.name.toUpperCase();
      if (isExt) {
        EL("game-frame").src = url;
        EL("window-overlay").style.display = "flex";
        setTimeout(() => EL("game-window").classList.add("active"), 10);
      } else {
        inject(await (await fetch(url)).text(), true);
      }
    }
  },
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => App.init());
} else {
  App.init();
}
