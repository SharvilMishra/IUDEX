// ==========================================================================
// IUDEX — Router
// Hash-based SPA routing (TAD §5). Unknown routes redirect to Home.
// Each page module exports: { render(container, ctx) -> teardown fn|void }
// Router calls the previous page's teardown before mounting the next page,
// so Firestore onSnapshot listeners never leak across navigations.
// ==========================================================================

const routes = {}; // route -> () => Promise<pageModule>
let currentTeardown = null;
let outletEl = null;
let onRouteChange = null; // (route) => void, used to sync navbar active state

export function registerRoute(route, loader) {
  routes[route] = loader;
}

export function initRouter(outlet, { onChange } = {}) {
  outletEl = outlet;
  onRouteChange = onChange;
  window.addEventListener("hashchange", () => renderCurrentRoute());
}

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  return hash || "home";
}

export function navigate(route) {
  if (parseRoute() === route) {
    renderCurrentRoute(); // allow re-render if user taps active tab
    return;
  }
  window.location.hash = `/${route}`;
}

export async function renderCurrentRoute(ctx = {}) {
  const route = parseRoute();
  const loader = routes[route] || routes["home"];
  const resolvedRoute = routes[route] ? route : "home";

  if (typeof currentTeardown === "function") {
    try { currentTeardown(); } catch (e) { console.warn("[router] teardown error:", e); }
    currentTeardown = null;
  }

  outletEl.classList.remove("page-enter");
  void outletEl.offsetWidth; // reflow to restart animation
  outletEl.classList.add("page-enter");
  outletEl.innerHTML = "";

  const mod = await loader();
  currentTeardown = await mod.render(outletEl, ctx);

  onRouteChange?.(resolvedRoute);
}
