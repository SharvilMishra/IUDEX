// ==========================================================================
// e-CON — Navigation Config
//
// Single source of truth for every destination in the app. Both the app
// bar (which just needs the current section's title) and the nav drawer
// (which lists everything) read from this one array — adding a future
// section is a matter of appending one entry here, not touching component
// code in two places and hoping they stay in sync.
// ==========================================================================

export const NAV_ITEMS = [
  { route: "chats", label: "Chats", icon: "chats" },
  { route: "groupchats", label: "Group Chats", icon: "groupchats" },
  { route: "community", label: "Community", icon: "community" },
  { route: "discover", label: "Discover", icon: "discover" },
  { route: "me", label: "Profile", icon: "profile" },
  { route: "settings", label: "Settings", icon: "settings" }
];

// Routes that aren't nav destinations themselves but should keep the
// matching drawer item lit and show a sensible title in the app bar.
export const ACTIVE_ALIASES = { chat: "chats", u: "discover" };

export function resolveActiveRoute(route) {
  return ACTIVE_ALIASES[route] || route;
}

export function titleForRoute(route) {
  const resolved = resolveActiveRoute(route);
  return NAV_ITEMS.find((item) => item.route === resolved)?.label || "e-CON";
}
