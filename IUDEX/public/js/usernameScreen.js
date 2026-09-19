// ==========================================================================
// IUDEX — Claim your @username
//
// Shown once, between sign-in and the app, for any account without a
// username. It's a hard gate rather than a skippable prompt: in a
// username-based messenger an account with no handle can't be searched,
// can't be linked to, and can't appear in Discover — so "skip for now"
// would just produce an account that doesn't work.
//
// Availability is checked live for feedback, but the claim itself is
// transactional (services/usernames.js). The UI never pretends otherwise:
// if the transaction loses a race, that error is shown here.
// ==========================================================================

import { h, qs, debounce, escapeHTML } from "./utils.js";
import { logout, refreshAuthState } from "../firebase/auth.js";
import { auth } from "../firebase/config.js";
import {
  validateUsername, normalizeUsername, isUsernameAvailable, claimUsername,
  USERNAME_MIN, USERNAME_MAX
} from "../services/usernames.js";

/** Suggest handles from the Google/display name so most users just tap one. */
function suggestionsFor(displayName = "", email = "") {
  const base = (displayName || email.split("@")[0] || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!base || base.length < USERNAME_MIN) return [];

  const trimmed = base.slice(0, USERNAME_MAX - 3);
  return [
    base.slice(0, USERNAME_MAX),
    `${trimmed}_${Math.floor(10 + Math.random() * 89)}`,
    `${trimmed}${Math.floor(100 + Math.random() * 899)}`
  ]
    .filter((s) => validateUsername(s).valid)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 3);
}

export function renderUsernameScreen(appEl, { user, profile }) {
  const displayName = profile?.name || user?.displayName || "";
  const suggestions = suggestionsFor(displayName, user?.email || "");
  const firstName = displayName.split(" ")[0];

  appEl.innerHTML = "";
  appEl.appendChild(h(`
    <div class="auth-screen">
      <div class="auth-card glass anim-fade-up">

        <header class="auth-header">
          <div class="auth-logo" aria-hidden="true">IX</div>
          <h1 class="auth-wordmark">Pick your @username</h1>
          <p class="auth-tagline">
            ${firstName ? `Nice to meet you, ${escapeHTML(firstName)}. ` : ""}This is how people find and message you on IUDEX.
          </p>
        </header>

        <form class="auth-form" id="username-form" novalidate>
          <div class="field">
            <label for="username-input">Username</label>
            <div class="input-affix input-affix--lead">
              <span class="input-affix-lead" aria-hidden="true">@</span>
              <input id="username-input" type="text" autocomplete="username"
                     autocapitalize="none" autocorrect="off" spellcheck="false"
                     placeholder="yourname" maxlength="${USERNAME_MAX}" required>
              <span class="username-status" id="username-status" aria-hidden="true"></span>
            </div>
            <p class="field-hint" id="username-hint">
              ${USERNAME_MIN}–${USERNAME_MAX} characters. Letters, numbers and underscores.
            </p>
          </div>

          ${suggestions.length ? `
            <div class="username-suggestions">
              <span class="eyebrow">Suggestions</span>
              <div class="chip-row">
                ${suggestions.map((s) => `<button type="button" class="chip" data-suggestion="${escapeHTML(s)}">@${escapeHTML(s)}</button>`).join("")}
              </div>
            </div>` : ""}

          <p class="auth-error" id="username-error" role="alert" hidden></p>

          <button type="submit" class="btn btn--primary auth-submit" id="username-submit" disabled>
            <span id="username-submit-label">Claim username</span>
          </button>
        </form>

        <p class="auth-fineprint">
          Usernames are permanent for now, so choose one you'll want to keep.
        </p>

        <p class="auth-switch">
          <span>Signed in as ${escapeHTML(user?.email || "")}</span>
          <button type="button" class="auth-link" id="username-signout">Sign out</button>
        </p>
      </div>
    </div>
  `));

  const form = qs("#username-form");
  const input = qs("#username-input");
  const statusEl = qs("#username-status");
  const hintEl = qs("#username-hint");
  const errorEl = qs("#username-error");
  const submitBtn = qs("#username-submit");
  const submitLabel = qs("#username-submit-label");

  let checkToken = 0;       // guards against out-of-order availability replies
  let lastKnownGood = null;
  let busy = false;

  function setStatus(state, message) {
    statusEl.className = `username-status username-status--${state}`;
    statusEl.textContent =
      state === "checking" ? "…" : state === "ok" ? "✓" : state === "bad" ? "✕" : "";
    hintEl.textContent = message;
    hintEl.className = `field-hint field-hint--${state}`;
  }

  function setSubmitEnabled(enabled) {
    submitBtn.disabled = !enabled || busy;
  }

  /**
   * Each check carries a token. A slower earlier request resolving after a
   * newer one would otherwise overwrite fresh feedback with stale feedback —
   * which is exactly how a UI ends up saying "available" about a name the
   * user already typed past.
   */
  const checkAvailability = debounce(async (raw) => {
    const token = ++checkToken;
    const { valid, username, reason } = validateUsername(raw);

    if (!valid) {
      setStatus("bad", reason);
      setSubmitEnabled(false);
      return;
    }

    setStatus("checking", "Checking availability…");
    setSubmitEnabled(false);

    try {
      const available = await isUsernameAvailable(username);
      if (token !== checkToken) return; // superseded

      if (available) {
        lastKnownGood = username;
        setStatus("ok", `@${username} is available.`);
        setSubmitEnabled(true);
      } else {
        lastKnownGood = null;
        setStatus("bad", `@${username} is already taken.`);
        setSubmitEnabled(false);
      }
    } catch (err) {
      if (token !== checkToken) return;
      console.warn("[username] availability check failed:", err);
      // A failed check shouldn't block the user — let the transaction decide.
      setStatus("idle", "Couldn't check right now. You can still try to claim it.");
      setSubmitEnabled(true);
    }
  }, 350);

  input.addEventListener("input", () => {
    errorEl.hidden = true;
    const normalized = normalizeUsername(input.value);
    if (input.value !== normalized) {
      const pos = input.selectionStart;
      input.value = normalized;
      input.setSelectionRange?.(pos, pos);
    }
    if (!normalized) {
      setStatus("idle", `${USERNAME_MIN}–${USERNAME_MAX} characters. Letters, numbers and underscores.`);
      setSubmitEnabled(false);
      return;
    }
    checkAvailability(normalized);
  });

  document.querySelectorAll("[data-suggestion]").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.dataset.suggestion;
      input.dispatchEvent(new Event("input"));
      input.focus();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const { valid, username, reason } = validateUsername(input.value);
    if (!valid) {
      errorEl.textContent = reason;
      errorEl.hidden = false;
      return;
    }

    busy = true;
    submitBtn.disabled = true;
    submitLabel.textContent = "Claiming…";
    errorEl.hidden = true;

    try {
      await claimUsername(auth.currentUser.uid, username);
      await refreshAuthState(); // re-evaluates onboarding; app.js swaps in the shell
    } catch (err) {
      console.error("[username] claim failed:", err?.code || err);
      errorEl.textContent =
        err?.code === "USERNAME_TAKEN"
          ? "Someone just took that one. Try another."
          : err?.message || "Couldn't claim that username. Please try again.";
      errorEl.hidden = false;

      busy = false;
      submitLabel.textContent = "Claim username";
      setSubmitEnabled(lastKnownGood === username ? false : true);
      input.focus();
      input.select();
    }
  });

  qs("#username-signout").addEventListener("click", () => logout());

  if (suggestions.length) {
    input.value = suggestions[0];
    input.dispatchEvent(new Event("input"));
  }
  if (!matchMedia("(pointer: coarse)").matches) input.focus();
}
