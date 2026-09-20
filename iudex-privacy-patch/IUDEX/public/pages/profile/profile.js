// ==========================================================================
// IUDEX — Profile
// Serves two routes from one module:
//   #/u/<username>  — someone else's profile, with "Message"
//   #/me            — your own, with inline editing
// ==========================================================================
import { h, escapeHTML, timeAgo, qs } from "../../js/utils.js";
import { skeleton } from "../../components/loader.js";
import { avatarHTML } from "../../components/avatar.js";
import { showToast } from "../../components/toast.js";
import { openModal, closeModal } from "../../components/modal.js";
import { reportError } from "../../js/ui.js";
import { navigate, back } from "../../js/router.js";
import { auth } from "../../firebase/config.js";
import { getDocById } from "../../firebase/firestore.js";
import { findUserByUsername } from "../../services/usernames.js";
import { getUserById, updateMyProfile, isOnline, isPrivateAccount } from "../../services/users.js";
import {
  openConversationWith, conversationId, isPending, isRequester, isDeclined
} from "../../services/conversations.js";

/** Message button label + whether it should be disabled, from the existing conversation (if any). */
function messageButtonState(existingConv) {
  if (!existingConv) return { label: "Message", disabled: false };
  if (isDeclined(existingConv)) return { label: "View conversation", disabled: false };
  if (isPending(existingConv)) {
    return isRequester(existingConv)
      ? { label: "Request sent", disabled: false }
      : { label: "Respond to request", disabled: false };
  }
  return { label: "Message", disabled: false };
}

function profileHTML(user, { isMe, existingConv }) {
  const online = isOnline(user);
  const { label: messageLabel } = messageButtonState(existingConv);

  return `
    <div class="profile-head">
      ${avatarHTML(user, 96, { online })}
      <h1 class="profile-name">${escapeHTML(user.name || user.username)}</h1>
      <p class="profile-handle">@${escapeHTML(user.username)}</p>
      ${isPrivateAccount(user) ? `<p class="private-badge">🔒 Private account</p>` : ""}
      <p class="profile-status">${
        online
          ? `<span class="status-dot status-dot--online"></span> Online now`
          : user.lastSeen
            ? `Last seen ${escapeHTML(timeAgo(user.lastSeen))}`
            : ""
      }</p>
      ${user.bio ? `<p class="profile-bio">${escapeHTML(user.bio)}</p>` : ""}

      <div class="profile-actions">
        ${isMe
          ? `<button class="btn btn--primary" id="profile-edit">Edit profile</button>`
          : `<button class="btn btn--primary" id="profile-message">${escapeHTML(messageLabel)}</button>`}
      </div>

      ${user.joinedAt ? `<p class="profile-joined">Joined ${escapeHTML(timeAgo(user.joinedAt))}</p>` : ""}
    </div>`;
}

function notFoundHTML(username) {
  return `
    <div class="empty-state" style="min-height:50vh;">
      <div style="font-size:34px;">🫥</div>
      <h3 style="margin-bottom:6px;">No such user</h3>
      <p style="max-width:300px;">Nobody on IUDEX goes by @${escapeHTML(username || "")}.</p>
      <button class="btn btn--ghost" id="profile-back" style="margin-top:18px;">Back to Discover</button>
    </div>`;
}

export async function render(container, ctx = {}) {
  const isMe = ctx.route === "me" || !ctx.param;

  container.appendChild(h(`
    <div class="page">
      <div class="page-head">
        <button class="btn btn--icon" id="profile-back-btn" aria-label="Go back">‹</button>
        <h1 style="font-size:1.35rem;">${isMe ? "Your profile" : "Profile"}</h1>
      </div>
      <div id="profile-body">${skeleton("height:280px;")}</div>
    </div>
  `));

  qs("#profile-back-btn").addEventListener("click", () => back());

  const bodyEl = qs("#profile-body");
  let user = null;
  let alive = true;

  try {
    user = isMe
      ? await getUserById(auth.currentUser.uid)
      : await findUserByUsername(ctx.param);
  } catch (err) {
    reportError(err, "loading profile");
    if (alive) bodyEl.innerHTML = notFoundHTML(ctx.param);
    return () => { alive = false; };
  }

  if (!alive) return () => {};

  if (!user?.username) {
    bodyEl.innerHTML = notFoundHTML(ctx.param);
    qs("#profile-back")?.addEventListener("click", () => navigate("discover"));
    return () => { alive = false; };
  }

  // Whether we already have a thread with this person, and what state it's
  // in, decides the Message button's label (see messageButtonState above).
  let existingConv = null;
  if (!isMe) {
    try {
      existingConv = await getDocById(
        "conversations",
        conversationId(auth.currentUser.uid, user.uid)
      );
    } catch (err) {
      // A denied read means no conversation exists yet — the button just
      // falls back to "Message", same convention used throughout
      // services/conversations.js.
      if (err?.code !== "permission-denied") reportError(err, "checking conversation status");
    }
  }

  function paint() {
    bodyEl.innerHTML = profileHTML(user, { isMe, existingConv });
    wire();
  }

  function wire() {
    qs("#profile-message")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = "Opening…";
      try {
        const convId = await openConversationWith(user);
        navigate("chat", convId);
      } catch (err) {
        reportError(err, "starting conversation");
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = "Message";
      }
    });

    qs("#profile-edit")?.addEventListener("click", openEditor);
  }

  function openEditor() {
    openModal({
      title: "Edit profile",
      bodyHTML: `
        <div class="field" style="margin-bottom:14px;">
          <label for="edit-name">Display name</label>
          <input id="edit-name" type="text" maxlength="50" value="${escapeHTML(user.name || "")}" placeholder="Your name">
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label for="edit-bio">Bio</label>
          <textarea id="edit-bio" rows="3" maxlength="160" placeholder="A line about you">${escapeHTML(user.bio || "")}</textarea>
        </div>
        <div class="field">
          <label for="edit-photo">Photo URL</label>
          <input id="edit-photo" type="url" value="${escapeHTML(user.photoURL || "")}" placeholder="https://…">
          <p class="field-hint">Paste a link to an image. Firebase Storage isn't enabled on this project, so uploads aren't available.</p>
        </div>
        <p class="field-hint" style="margin-top:14px;">Your @username can't be changed.</p>
      `,
      actions: [
        { label: "Cancel", variant: "ghost" },
        {
          label: "Save",
          variant: "primary",
          closeOnClick: false,
          onClick: async () => {
            const name = qs("#edit-name").value;
            const bio = qs("#edit-bio").value;
            const photoURL = qs("#edit-photo").value.trim();

            if (photoURL && !/^https?:\/\//i.test(photoURL)) {
              showToast("Photo URL must start with http:// or https://", "error");
              return;
            }

            try {
              user = await updateMyProfile({ name, bio, photoURL });
              closeModal();
              showToast("Profile updated", "success");
              if (alive) paint();
            } catch (err) {
              reportError(err, "saving profile");
            }
          }
        }
      ]
    });
  }

  paint();

  return function teardown() {
    alive = false;
    closeModal();
  };
}
