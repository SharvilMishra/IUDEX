// ==========================================================================
// Shideep — Bottom Navigation
// ==========================================================================
import { h } from "../js/utils.js";

const ICONS = {
  home: `<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>`,
  chat: `<path d="M4 5h16v11H8l-4 4V5Z"/>`,
  games: `<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M7 12h3M8.5 10.5v3"/><circle cx="15" cy="10.5" r="0.8" fill="currentColor"/><circle cx="17" cy="13" r="0.8" fill="currentColor"/>`,
  gallery: `<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 16-5-5-5 5-3-3-5 5"/>`,
  bucketlist: `<path d="M4 6h16M4 12h16M4 18h9"/><path d="M4 6.5v0M4 12.5v0"/>`,
  memories: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`,
  music: `<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`,
  mood: `<circle cx="12" cy="12" r="9"/><path d="M8.5 15c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/><path d="M9 9.5h.01M15 9.5h.01"/>`,
  settings: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.2.6.7 1 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>`
};

const NAV_ITEMS = [
  { route: "home", label: "Home" },
  { route: "chat", label: "Chat" },
  { route: "games", label: "Games" },
  { route: "gallery", label: "Gallery" },
  { route: "bucketlist", label: "Goals" },
  { route: "memories", label: "Memories" },
  { route: "music", label: "Music" },
  { route: "mood", label: "Mood" },
  { route: "settings", label: "Settings" }
];

function iconSVG(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
}

/**
 * Renders the navbar and wires click handlers to `onNavigate(route)`.
 * Call `setActive(route)` (returned) whenever the router changes pages.
 */
export function renderNavbar(container, currentRoute, onNavigate) {
  const nav = h(`
    <nav class="navbar" aria-label="Primary">
      ${NAV_ITEMS.map(
        (item) => `
        <button class="nav-item ${item.route === currentRoute ? "active" : ""}" data-route="${item.route}" aria-label="${item.label}">
          ${iconSVG(item.route)}
          <span>${item.label}</span>
        </button>`
      ).join("")}
    </nav>
  `);

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest(".nav-item");
    if (!btn) return;
    onNavigate(btn.dataset.route);
  });

  container.appendChild(nav);

  return function setActive(route) {
    nav.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.route === route);
    });
  };
}
