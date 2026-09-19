// ==========================================================================
// IUDEX — Sign In / Create Account
//
// One screen, two modes (sign in / create account) and two providers
// (email+password, Google). Google is placed above the email form because
// it's one tap and skips password entry entirely; the divider makes it
// clear they're alternatives, not steps.
//
// Nothing here decides *where the user goes next* — app.js owns that, off
// the back of watchAuthState. This module's only job is to produce a
// signed-in Firebase user, or an error the user can act on.
// ==========================================================================

import { h, qs } from "./utils.js";
import { showToast } from "../components/toast.js";
import { getStored, setStored } from "./storage.js";
import {
  signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword
} from "../firebase/auth.js";

const MODE_KEY = "auth_mode"; // remember which tab they used last

const GOOGLE_MARK = `
  <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.93v2.33A9 9 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.93a9 9 0 0 0 0 8.1l3.04-2.33Z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .93 4.95l3.04 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/>
  </svg>`;

/**
 * Firebase auth error codes -> copy a person can act on.
 *
 * `invalid-credential` is the modern catch-all: Firebase deliberately stopped
 * distinguishing "no such user" from "wrong password" so an attacker can't
 * enumerate which emails have accounts. The message has to stay vague for the
 * same reason — being more "helpful" here would leak exactly that.
 */
const AUTH_ERRORS = {
  "auth/invalid-credential": "That email and password don't match an account.",
  "auth/wrong-password": "That email and password don't match an account.",
  "auth/user-not-found": "That email and password don't match an account.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/email-already-in-use": "An account already exists for that email. Try signing in.",
  "auth/weak-password": "Passwords need to be at least 6 characters.",
  "auth/missing-password": "Enter your password.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "No connection. Check your network and try again.",
  "auth/popup-closed-by-user": "Sign-in was closed before it finished.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with a different sign-in method.",
  "auth/unauthorized-domain": "This domain isn't authorized in Firebase Auth settings."
};

function authErrorMessage(err) {
  return AUTH_ERRORS[err?.code] || "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------------ */

export function renderAuthScreen(appEl) {
  const startMode = getStored(MODE_KEY) === "signup" ? "signup" : "signin";

  appEl.innerHTML = "";
  appEl.appendChild(h(`
    <div class="auth-screen">
      <div class="auth-card glass anim-fade-up">

        <header class="auth-header">
          <div class="auth-logo" aria-hidden="true">IX</div>
          <h1 class="auth-wordmark">IUDEX</h1>
          <p class="auth-tagline">Message anyone by @username.</p>
        </header>

        <div class="auth-tabs" role="tablist" aria-label="Sign in or create an account">
          <button class="auth-tab" role="tab" data-mode="signin" aria-selected="false">Sign in</button>
          <button class="auth-tab" role="tab" data-mode="signup" aria-selected="false">Create account</button>
          <span class="auth-tab-indicator" aria-hidden="true"></span>
        </div>

        <button type="button" class="btn btn--google" id="auth-google">
          ${GOOGLE_MARK}<span id="auth-google-label">Continue with Google</span>
        </button>

        <div class="auth-divider"><span>or use your email</span></div>

        <form class="auth-form" id="auth-form" novalidate>
          <div class="field" id="field-name" hidden>
            <label for="auth-name">Display name</label>
            <input id="auth-name" name="name" type="text" autocomplete="name"
                   placeholder="What should people call you?" maxlength="50">
          </div>

          <div class="field">
            <label for="auth-email">Email</label>
            <input id="auth-email" name="email" type="email" autocomplete="email"
                   inputmode="email" placeholder="you@example.com" required>
          </div>

          <div class="field">
            <label for="auth-password">Password</label>
            <div class="input-affix">
              <input id="auth-password" name="password" type="password"
                     autocomplete="current-password" placeholder="••••••••" required>
              <button type="button" class="input-affix-btn" id="auth-toggle-pw"
                      aria-label="Show password" aria-pressed="false">Show</button>
            </div>
            <p class="field-hint" id="pw-hint" hidden>At least 6 characters.</p>
          </div>

          <button type="button" class="auth-link" id="auth-forgot">Forgot password?</button>

          <p class="auth-error" id="auth-error" role="alert" hidden></p>

          <button type="submit" class="btn btn--primary auth-submit" id="auth-submit">
            <span id="auth-submit-label">Sign in</span>
          </button>
        </form>

        <p class="auth-switch">
          <span id="auth-switch-text">New to IUDEX?</span>
          <button type="button" class="auth-link" id="auth-switch-btn">Create an account</button>
        </p>

        <p class="auth-fineprint">
          You'll pick your unique @username right after this.
        </p>
      </div>
    </div>
  `));

  /* ---- element handles ---- */
  const form = qs("#auth-form");
  const tabs = Array.from(document.querySelectorAll(".auth-tab"));
  const indicator = qs(".auth-tab-indicator");
  const nameField = qs("#field-name");
  const nameInput = qs("#auth-name");
  const emailInput = qs("#auth-email");
  const pwInput = qs("#auth-password");
  const pwHint = qs("#pw-hint");
  const togglePw = qs("#auth-toggle-pw");
  const forgotBtn = qs("#auth-forgot");
  const errorEl = qs("#auth-error");
  const submitBtn = qs("#auth-submit");
  const submitLabel = qs("#auth-submit-label");
  const switchText = qs("#auth-switch-text");
  const switchBtn = qs("#auth-switch-btn");
  const googleBtn = qs("#auth-google");
  const googleLabel = qs("#auth-google-label");

  let mode = startMode;
  let busy = false;

  /* ---- error display ---- */
  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }
  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  /* ---- mode switching ---- */
  function setMode(next) {
    mode = next;
    clearError();
    setStored(MODE_KEY, next);

    const isSignup = next === "signup";

    tabs.forEach((t) => {
      const active = t.dataset.mode === next;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", String(active));
    });
    indicator.style.transform = isSignup ? "translateX(100%)" : "translateX(0)";

    nameField.hidden = !isSignup;
    nameInput.required = false; // optional — a display name can be set later
    pwHint.hidden = !isSignup;

    pwInput.autocomplete = isSignup ? "new-password" : "current-password";
    submitLabel.textContent = isSignup ? "Create account" : "Sign in";
    googleLabel.textContent = isSignup ? "Sign up with Google" : "Continue with Google";
    forgotBtn.hidden = isSignup;

    switchText.textContent = isSignup ? "Already have an account?" : "New to IUDEX?";
    switchBtn.textContent = isSignup ? "Sign in" : "Create an account";
  }

  tabs.forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
  switchBtn.addEventListener("click", () => setMode(mode === "signup" ? "signin" : "signup"));

  /* ---- password visibility ---- */
  togglePw.addEventListener("click", () => {
    const showing = pwInput.type === "text";
    pwInput.type = showing ? "password" : "text";
    togglePw.textContent = showing ? "Show" : "Hide";
    togglePw.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    togglePw.setAttribute("aria-pressed", String(!showing));
    pwInput.focus();
  });

  /* ---- busy state ----
     Both providers share one lock: with Google open in a popup and the
     email form still live behind it, two concurrent sign-ins are otherwise
     easy to trigger and produce a confusing race. */
  function setBusy(isBusy, label) {
    busy = isBusy;
    submitBtn.disabled = isBusy;
    googleBtn.disabled = isBusy;
    if (label) submitLabel.textContent = label;
    else submitLabel.textContent = mode === "signup" ? "Create account" : "Sign in";
    submitBtn.classList.toggle("is-busy", isBusy);
  }

  /* ---- client-side validation ----
     Catches the obvious cases without a network round-trip; Firebase stays
     the authority on everything else. */
  function validate() {
    const email = emailInput.value.trim();
    const password = pwInput.value;

    if (!email) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "That doesn't look like a valid email address.";
    }
    if (!password) return "Enter your password.";
    if (mode === "signup" && password.length < 6) {
      return "Passwords need to be at least 6 characters.";
    }
    return null;
  }

  [emailInput, pwInput, nameInput].forEach((el) =>
    el.addEventListener("input", () => { if (!errorEl.hidden) clearError(); })
  );

  /* ---- submit ---- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    clearError();

    const problem = validate();
    if (problem) {
      showError(problem);
      (problem.includes("email") ? emailInput : pwInput).focus();
      return;
    }

    setBusy(true, mode === "signup" ? "Creating account…" : "Signing in…");
    try {
      if (mode === "signup") {
        await signUpWithEmail(emailInput.value, pwInput.value, nameInput.value);
      } else {
        await signInWithEmail(emailInput.value, pwInput.value);
      }
      // watchAuthState in app.js takes it from here.
    } catch (err) {
      console.error("[auth] email sign-in failed:", err?.code || err);
      showError(authErrorMessage(err));
      setBusy(false);
      pwInput.focus();
      pwInput.select?.();
    }
  });

  /* ---- Google ---- */
  googleBtn.addEventListener("click", async () => {
    if (busy) return;
    clearError();
    setBusy(true);
    googleLabel.textContent = "Opening Google…";
    try {
      await signInWithGoogle();
      // Popup path: watchAuthState fires. Redirect path: the page navigates
      // away and completeRedirectSignIn() resolves it on the way back.
    } catch (err) {
      console.error("[auth] google sign-in failed:", err?.code || err);
      // A user closing the popup is a decision, not a failure — don't
      // shout about it in the error slot.
      if (err?.code === "auth/popup-closed-by-user") {
        showToast("Sign-in cancelled.", "info");
      } else {
        showError(authErrorMessage(err));
      }
      setBusy(false);
      googleLabel.textContent = mode === "signup" ? "Sign up with Google" : "Continue with Google";
    }
  });

  /* ---- password reset ---- */
  forgotBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) {
      showError("Enter your email address first, then tap “Forgot password?”.");
      emailInput.focus();
      return;
    }
    clearError();
    forgotBtn.disabled = true;
    try {
      await resetPassword(email);
      // Confirm unconditionally: saying "no account with that email" here
      // would leak which addresses are registered.
      showToast("If that email has an account, a reset link is on its way.", "success", 5000);
    } catch (err) {
      console.error("[auth] password reset failed:", err?.code || err);
      showError(authErrorMessage(err));
    } finally {
      forgotBtn.disabled = false;
    }
  });

  setMode(startMode);
  // Don't steal focus on touch devices — it yanks the on-screen keyboard up
  // before the user has even read the screen.
  if (!matchMedia("(pointer: coarse)").matches) emailInput.focus();
}
