// ==========================================================================
// IUDEX — Settings
// Account summary, install-to-home-screen, and sign out.
// ==========================================================================
import { h, escapeHTML, qs } from "../../js/utils.js";
import { skeleton } from "../../components/loader.js";
import { avatarHTML } from "../../components/avatar.js";
import { confirmDialog } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import { navigate } from "../../js/router.js";
import { auth } from "../../firebase/config.js";
import { logout } from "../../firebase/auth.js";
import { getUserById } from "../../services/users.js";
import {
  isInstallAvailable, onInstallAvailabilityChange, promptInstall, isRunningStandalone
} from "../../js/installPrompt.js";

/** Which provider(s) this account actually signed in with. */
function providerLabel(user) {
  const ids = (user?.providerData || []).map((p) => p.providerId);
  const names = [];
  if (ids.includes("google.com")) names.push("Google");
  if (ids.includes("password")) names.push("Email & password");
  return names.join(" · ") || "—";
}

export async function render(container) {
  const user = auth.currentUser;

  container.appendChild(h(`
    <div class="page">
      <div class="page-head"><h1>Settings</h1></div>

      <div id="settings-account">${skeleton("height:92px;")}</div>

      <h3 class="settings-heading">Account</h3>
      <div class="card settings-row">
        <span class="text-muted">Sign-in method</span>
        <span>${escapeHTML(providerLabel(user))}</span>
      </div>
      <div class="card settings-row">
        <span class="text-muted">Email</span>
        <span class="settings-value">${escapeHTML(user?.email || "—")}</span>
      </div>
      <div class="card settings-row">
        <span class="text-muted">Email verified</span>
        <span>${user?.emailVerified ? "Yes" : "No"}</span>
      </div>

      <h3 class="settings-heading">App</h3>
      <div id="install-card" hidden></div>
      <div class="card settings-row">
        <span class="text-muted">Version</span>
        <span>IUDEX 1.0</span>
      </div>

      <button class="btn btn--danger settings-signout" id="logout-btn">Sign out</button>
    </div>
  `));

  /* ---- account card ---- */
  const accountEl = qs("#settings-account");
  try {
    const profile = await getUserById(user.uid);
    accountEl.innerHTML = `
      <button class="card settings-account-card" id="settings-profile">
        ${avatarHTML(profile || {}, 54)}
        <span class="settings-account-text">
          <span class="settings-account-name">${escapeHTML(profile?.name || "You")}</span>
          <span class="settings-account-handle">@${escapeHTML(profile?.username || "")}</span>
        </span>
        <span class="user-row-chevron" aria-hidden="true">›</span>
      </button>`;
    qs("#settings-profile").addEventListener("click", () => navigate("me"));
  } catch (err) {
    reportError(err, "loading your account");
    accountEl.innerHTML = "";
  }

  /* ---- install ---- */
  const installEl = qs("#install-card");
  function renderInstallCard(available) {
    if (isRunningStandalone() || !available) {
      installEl.hidden = true;
      return;
    }
    installEl.hidden = false;
    installEl.innerHTML = `
      <div class="card">
        <div class="eyebrow" style="margin-bottom:8px;">Install IUDEX</div>
        <p class="text-muted" style="margin-bottom:12px;">Add it to your home screen — no browser bar, opens instantly.</p>
        <button class="btn btn--primary" id="install-btn" style="width:100%;">Install app</button>
      </div>`;
    qs("#install-btn").addEventListener("click", async () => {
      const accepted = await promptInstall();
      if (accepted) showToast("Installed! Look for IUDEX on your home screen.", "success");
    });
  }
  renderInstallCard(isInstallAvailable());
  const unsubInstall = onInstallAvailabilityChange(renderInstallCard);

  /* ---- sign out ---- */
  qs("#logout-btn").addEventListener("click", () => {
    confirmDialog("You'll need to sign in again to get back in.", {
      confirmLabel: "Sign out",
      onConfirm: async () => {
        try {
          await logout();
        } catch (err) {
          reportError(err, "signing out");
        }
      }
    });
  });

  return function teardown() {
    unsubInstall?.();
  };
}
