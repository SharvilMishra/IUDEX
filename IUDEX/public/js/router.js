// ==========================================================================
// e-CON — Router
// Hash routing with a single optional parameter: #/route/param
//   #/chats                     -> { route: "chats" }
//   #/u/sharvil                 -> { route: "u", param: "sharvil" }
//   #/chat/uidA_uidB            -> { route: "chat", param: "uidA_uidB" }
//
// Each page module exports: render(container, ctx) -> teardown fn | void.
// The previous page's teardown always runs before the next page mounts, so
// Firestore onSnapshot listeners can never leak across navigations — with a
// real-time chat list plus an open thread, a leak here would mean every
// visited conversation stays subscribed for the rest of the session.
// ==========================================================================

const routes = {};
let currentTeardown = null;
let outletEl = null;
let onRouteChange = null;

export function registerRoute(route, loader) {
  routes[route] = loader;
}

export function initRouter(outlet, { onChange } = {}) {
  outletEl = outlet;
  onRouteChange = onChange;
  window.addEventListener("hashchange", () => renderCurrentRoute());
}

export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { route: "chats", param: null };

  const [route, ...rest] = raw.split("/");
  return {
    route: route || "chats",
    param: rest.length ? decodeURIComponent(rest.join("/")) : null
  };
}

export function navigate(route, param = null) {
  const next = param ? `/${route}/${encodeURIComponent(param)}` : `/${route}`;
  if (window.location.hash === `#${next}`) {
    renderCurrentRoute(); // re-render when tapping the already-active tab
    return;
  }
  window.location.hash = next;
}

export function back() {
  if (window.history.length > 1) window.history.back();
  else navigate("chats");
}

export async function renderCurrentRoute(ctx = {}) {
  const { route, param } = parseHash();
  const resolved = routes[route] ? route : "chats";
  const loader = routes[resolved];

  if (typeof currentTeardown === "function") {
    try { currentTeardown(); } catch (e) { console.warn("[router] teardown error:", e); }
  }
  currentTeardown = null;

  outletEl.classList.remove("page-enter");
  void outletEl.offsetWidth; // reflow so the animation restarts
  outletEl.classList.add("page-enter");
  outletEl.innerHTML = "";

  try {
    const mod = await loader();
    currentTeardown = await mod.render(outletEl, { ...ctx, param, route: resolved });
  } catch (err) {
    console.error(`[router] failed to render "${resolved}":`, err);
    outletEl.innerHTML = `
      <div class="empty-state">
        <div style="font-size:32px;">⚠️</div>
        <p>This page didn't load. Check your connection and try again.</p>
      </div>`;
  }

  onRouteChange?.(resolved, param);
}
