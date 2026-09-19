// ==========================================================================
// IUDEX — Bottom Navigation
// Four destinations. The old nine-tab bar existed because the two-user app
// bundled a dozen shared features; a messenger has one job and the nav
// should say so.
// ==========================================================================
import { h } from "../js/utils.js";

const ICONS = {
  chats: `<path d="M4 5h16v11H8l-4 4V5Z"/>`,
  discover: `<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>`,
  me: `<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.7 1 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>`
};

const NAV_ITEMS = [
  { route: "chats", label: "Chats" },
  { route: "discover", label: "Discover" },
  { route: "me", label: "Profile" },
  { route: "settings", label: "Settings" }
];

// Routes that aren't nav destinations themselves but should keep a tab lit.
const ACTIVE_ALIASES = { chat: "chats", u: "discover" };

function iconSVG(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

export function renderNavbar(container, onNavigate) {
  const nav = h(`
    <nav class="navbar" aria-label="Primary">
      ${NAV_ITEMS.map((item) => `
        <button class="nav-item" data-route="${item.route}" aria-label="${item.label}">
          ${iconSVG(item.route)}
          <span>${item.label}</span>
        </button>`).join("")}
    </nav>
  `);

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (btn) onNavigate(btn.dataset.route);
  });

  container.appendChild(nav);

  return function setActive(route) {
    const active = ACTIVE_ALIASES[route] || route;
    nav.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === active);
    });
  };
}
