// ==========================================================================
// e-CON — Navigation Drawer
//
// The full destination list, in a slide-out panel rather than a bottom tab
// row. A tab row runs out of room fast — this scales to any number of
// sections by scrolling, which matters now that Group Chats and Community
// exist alongside the original four, and more are coming.
// ==========================================================================
import { h } from "../js/utils.js";
import { NAV_ITEMS, resolveActiveRoute } from "../js/navConfig.js";

const ICONS = {
  chats: `<path d="M4 5h16v11H8l-4 4V5Z"/>`,
  groupchats: `<circle cx="9" cy="8" r="3"/><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 13c2.5.3 4.5 2 4.5 4.5"/>`,
  community: `<circle cx="12" cy="5" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="19" cy="17" r="2"/><path d="M12 7v4M12 11l-5.5 4M12 11l5.5 4"/>`,
  discover: `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`,
  profile: `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.7 1 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>`
};

function iconSVG(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

/**
 * Mounts the drawer + its backdrop into `container` (kept outside the
 * router's outlet so navigation never tears it down mid-open) and returns
 * { open, close, setActive }.
 */
export function renderNavDrawer(container, onNavigate) {
  const backdrop = h(`<div class="nav-drawer-backdrop" aria-hidden="true"></div>`);
  const drawer = h(`
    <nav class="nav-drawer" role="dialog" aria-modal="true" aria-label="Navigation">
      <div class="nav-drawer-header">
        <span class="nav-drawer-logo" aria-hidden="true">eC</span>
        <span class="nav-drawer-wordmark">e-CON</span>
      </div>
      ${NAV_ITEMS.map((item) => `
        <button class="nav-drawer-item" data-route="${item.route}">
          ${iconSVG(item.icon)}
          <span>${item.label}</span>
        </button>`).join("")}
    </nav>
  `);

  container.appendChild(backdrop);
  container.appendChild(drawer);

  function close() {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
  }
  function open() {
    drawer.classList.add("open");
    backdrop.classList.add("open");
  }

  backdrop.addEventListener("click", close);
  drawer.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-drawer-item");
    if (!btn) return;
    close();
    onNavigate(btn.dataset.route);
  });

  // A drawer that traps you open with no keyboard escape is a real
  // accessibility miss — Escape is the conventional way out of any dialog.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("open")) close();
  });

  function setActive(route) {
    const active = resolveActiveRoute(route);
    drawer.querySelectorAll(".nav-drawer-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === active);
    });
  }

  return { open, close, setActive };
}
