"use strict";

/**
 * Component loader utility
 */

/**
 * Insert HTML content and execute any contained scripts
 * @param {HTMLElement} container - Target container element
 * @param {string} html - HTML content to insert
 */
function insertHTMLWithScripts(container, html) {
  if (!container) {
    console.warn("Container is null or undefined");
    return;
  }

  container.innerHTML = html;

  // Re-execute script tags so they run properly
  container.querySelectorAll("script").forEach((oldScript) => {
    const newScript = document.createElement("script");

    if (oldScript.src) {
      // External script
      newScript.src = oldScript.src;
      newScript.async = false;
    } else {
      // Inline script
      newScript.textContent = oldScript.textContent;
    }

    // Replace the original script with the new one (which executes it)
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
}

// Track if navbar has been loaded to prevent duplicate loads
let navbarLoaded = false;

/**
 * Load navbar component (once per session)
 * @param {string} navPath - Path to navbar HTML file
 * @param {string} containerId - ID of container element (default: "navbar-container")
 * @returns {Promise<void>}
 */
function loadNavbar(navPath, containerId = "navbar-container") {
  // Guard: prevent loading navbar multiple times
  if (navbarLoaded) {
    return Promise.resolve();
  }

  const container = document.getElementById(containerId);

  if (!container) {
    console.warn(`Navbar container "${containerId}" not found.`);
    return Promise.reject(new Error(`Navbar container "${containerId}" not found`));
  }

  navbarLoaded = true;

  return fetch(navPath)
    .then((response) => {
      if (!response.ok) {
        throw new Error(
          `Failed to load ${navPath}: ${response.status} ${response.statusText}`
        );
      }
      return response.text();
    })
    .then((html) => {
      insertHTMLWithScripts(container, html);
    })
    .catch((error) => {
      console.error("Failed to load navbar component:", error);
      navbarLoaded = false; // Reset flag on error so it can retry
    });
}
