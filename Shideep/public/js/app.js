// ==========================================================================
// Shideep — App Entry Point
// Auth flow per TAD §6: Sign-In -> Firebase Auth -> Check Email -> Allowed?
//   Yes -> Load Dashboard      No -> Access Denied
// ==========================================================================
import { watchAuthState, signInWithGoogle, logout } from "../firebase/auth.js";
import { registerRoute, initRouter, navigate, renderCurrentRoute } from "./router.js";
import { renderNavbar } from "../components/navbar.js";
import { renderMiniPlayer } from "../components/miniplayer.js";
import { initMusicPlayer } from "./musicPlayer.js";
import { renderCallOverlay } from "../components/callOverlay.js";
import { initCallManager } from "./callManager.js";
import { renderPresenceBadge } from "../components/presenceBadge.js";
import { initPresence, setPresenceRoute } from "./presence.js";
import "./installPrompt.js"; // side effect: registers beforeinstallprompt listener as early as possible
import { loaderScreen } from "../components/loader.js";
import { reportError } from "./ui.js";
import { h } from "./utils.js";

const appEl = document.getElementById("app");

// ---- Route registry (TAD §5). Only Home is fully built in Phase 1; the
// rest are stubbed so navigation and layout can be verified end-to-end,
// and swapped for real modules in Phases 2-4 without touching this file. ----
registerRoute("home", () => import("../pages/home/home.js"));
registerRoute("chat", () => import("../pages/chat/chat.js"));
registerRoute("gallery", () => import("../pages/gallery/gallery.js"));
registerRoute("bucketlist", () => import("../pages/bucketlist/bucketlist.js"));
registerRoute("memories", () => import("../pages/memories/memories.js"));
registerRoute("games", () => import("../pages/games/games.js"));
registerRoute("music", () => import("../pages/music/music.js"));
registerRoute("mood", () => import("../pages/mood/mood.js"));
registerRoute("settings", () => import("../pages/settings/settings.js"));

async function stub(title, note) {
  return {
    render(container) {
      container.appendChild(
        h(`<div class="page"><h1>${title}</h1><p style="margin-top:12px;">${note}</p></div>`)
      );
    }
  };
}

function renderLoading() {
  appEl.innerHTML = "";
  appEl.appendChild(h(`<div>${loaderScreen()}</div>`));
}

function renderSignIn() {
  appEl.innerHTML = "";
  appEl.appendChild(
    h(`
      <div class="access-denied">
        <h1 style="font-size:2rem;">Shideep</h1>
        <p style="max-width:280px;">A private space for two. Sign in with your Google account to continue.</p>
        <button class="btn btn--primary" id="google-signin" style="margin-top:16px;">Continue with Google</button>
      </div>
    `)
  );
  document.getElementById("google-signin").addEventListener("click", async (e) => {
    e.target.disabled = true;
    e.target.textContent = "Signing in…";
    try {
      await signInWithGoogle();
      // watchAuthState's callback will fire and render the app shell.
    } catch (err) {
      reportError(err, "sign-in");
      e.target.disabled = false;
      e.target.textContent = "Continue with Google";
    }
  });
}

function renderAccessDenied() {
  appEl.innerHTML = "";
  appEl.appendChild(
    h(`
      <div class="access-denied">
        <h1 style="font-size:1.75rem;">Access denied</h1>
        <p style="max-width:280px;">This account isn't part of Shideep. Only two people are allowed in here.</p>
        <button class="btn btn--ghost" id="signout-btn" style="margin-top:16px;">Sign out</button>
      </div>
    `)
  );
  document.getElementById("signout-btn").addEventListener("click", () => logout());
}

let navbarWired = false;

function renderShell() {
  appEl.innerHTML = `
    <main id="outlet"></main>
    <div id="yt-player-target" class="yt-hidden-player"></div>
    <audio id="remote-call-audio" autoplay playsinline></audio>
  `;
  const outlet = document.getElementById("outlet");

  const setActive = renderNavbar(appEl, "home", (route) => navigate(route));
  renderMiniPlayer(appEl);
  renderCallOverlay(appEl);
  renderPresenceBadge(appEl);
  initMusicPlayer("yt-player-target");
  initCallManager("remote-call-audio");
  initPresence();

  initRouter(outlet, {
    onChange: (route) => {
      setActive(route);
      setPresenceRoute(route);
    }
  });
  renderCurrentRoute();
  navbarWired = true;
}

// ---- Boot ----
renderLoading();
watchAuthState((state) => {
  if (state.status === "signed-out") {
    navbarWired = false;
    renderSignIn();
  } else if (state.status === "denied") {
    navbarWired = false;
    renderAccessDenied();
  } else if (state.status === "authorized") {
    if (!navbarWired) renderShell();
  }
});
