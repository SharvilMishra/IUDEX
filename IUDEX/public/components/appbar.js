// ==========================================================================
// e-CON — Top App Bar
//
// A hamburger button that opens the nav drawer, plus the current section's
// title so the page itself doesn't need to duplicate a heading for it. The
// bar is deliberately thin on logic — the drawer (navdrawer.js) owns the
// actual destination list and open/close state.
// ==========================================================================
import { h } from "../js/utils.js";
import { titleForRoute } from "../js/navConfig.js";
import { renderNavDrawer } from "./navdrawer.js";

const MENU_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;

/**
 * Mounts the app bar and its drawer into `container`. Returns setActive(route),
 * used by the router's onChange hook to keep both the title and the
 * drawer's highlighted item in sync with wherever navigation actually lands.
 */
export function renderAppBar(container, onNavigate) {
  const bar = h(`
    <header class="app-bar">
      <button class="app-bar-menu-btn" id="app-bar-menu" aria-label="Open navigation menu">
        ${MENU_ICON}
      </button>
      <span class="app-bar-title" id="app-bar-title">e-CON</span>
    </header>
  `);
  container.appendChild(bar);

  const drawer = renderNavDrawer(container, onNavigate);

  bar.querySelector("#app-bar-menu").addEventListener("click", drawer.open);

  const titleEl = bar.querySelector("#app-bar-title");

  return function setActive(route) {
    titleEl.textContent = titleForRoute(route);
    drawer.setActive(route);
  };
}
