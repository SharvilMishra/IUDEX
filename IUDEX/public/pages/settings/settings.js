// ==========================================================================
// e-CON — Settings
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
import { getUserById, setPrivateAccount, isPrivateAccount } from "../../services/users.js";
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

      <h3 class="settings-heading">Privacy</h3>
      <div class="card settings-row settings-row--toggle">
        <span class="settings-toggle-text">
          <span>Private account</span>
          <span class="field-hint">New messages need your approval before the chat opens.</span>
        </span>
        <button type="button" class="toggle" id="privacy-toggle"
                role="switch" aria-checked="false" aria-label="Private account">
          <span class="toggle-thumb"></span>
        </button>
      </div>

      <h3 class="settings-heading">App</h3>
      <div id="install-card" hidden></div>
      <div class="card settings-row">
        <span class="text-muted">Version</span>
        <span>e-CON 1.0</span>
      </div>

      <button class="btn btn--danger settings-signout" id="logout-btn">Sign out</button>
    </div>
  `));

  /* ---- account card + privacy toggle ---- */
  const accountEl = qs("#settings-account");
  const privacyToggle = qs("#privacy-toggle");
  let togglingPrivacy = false;

  function paintToggle(isPrivate) {
    privacyToggle.classList.toggle("toggle--on", isPrivate);
    privacyToggle.setAttribute("aria-checked", String(isPrivate));
  }

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

    paintToggle(isPrivateAccount(profile));
  } catch (err) {
    reportError(err, "loading your account");
    accountEl.innerHTML = "";
  }

  privacyToggle.addEventListener("click", async () => {
    if (togglingPrivacy) return;
    togglingPrivacy = true;

    const next = !privacyToggle.classList.contains("toggle--on");
    paintToggle(next); // optimistic — flip back on failure below

    try {
      await setPrivateAccount(next);
      showToast(
        next ? "Your account is now private." : "Your account is now public.",
        "success"
      );
    } catch (err) {
      paintToggle(!next);
      reportError(err, "updating privacy setting");
    } finally {
      togglingPrivacy = false;
    }
  });

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
        <div class="eyebrow" style="margin-bottom:8px;">Install e-CON</div>
        <p class="text-muted" style="margin-bottom:12px;">Add it to your home screen — no browser bar, opens instantly.</p>
        <button class="btn btn--primary" id="install-btn" style="width:100%;">Install app</button>
      </div>`;
    qs("#install-btn").addEventListener("click", async () => {
      const accepted = await promptInstall();
      if (accepted) showToast("Installed! Look for e-CON on your home screen.", "success");
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
