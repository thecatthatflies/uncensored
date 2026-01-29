/* no stackoverflow involved trust me bro */

function insertHTMLWithScripts(container, html) {
  container.innerHTML = html;
  container.querySelectorAll("script").forEach((script) => {
    const injected = document.createElement("script");
    if (script.src) {
      injected.src = script.src;
      injected.async = false;
    } else {
      injected.textContent = script.textContent;
    }
    document.body.appendChild(injected);
    document.body.removeChild(injected);
    script.remove();
  });
}

function loadNavbar(navPath, containerId = "navbar-container") {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Navbar container "${containerId}" not found.`);
    return Promise.reject(new Error("Navbar container missing"));
  }

  return fetch(navPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to load ${navPath}: ${response.status} ${response.statusText}`,
        );
      }
      return response.text();
    })
    .then((html) => insertHTMLWithScripts(container, html))
    .catch((error) => {
      console.error("Navbar load failed", error);
    });
}
