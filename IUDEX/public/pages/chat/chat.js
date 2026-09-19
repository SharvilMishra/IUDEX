// ==========================================================================
// IUDEX — Conversation
//
// Renders one thread: conversations/{convId}/messages. Two live listeners —
// one on the conversation doc (peer info, typing, read state) and one on the
// message subcollection — both torn down by the router on navigation.
//
// The conversation id is checked against the signed-in uid before anything
// is subscribed. Firestore rules are the real enforcement, but failing here
// gives a comprehensible screen instead of a silent permission error.
// ==========================================================================
import { h, escapeHTML, qs, debounce } from "../../js/utils.js";
import { showToast } from "../../components/toast.js";
import { openModal } from "../../components/modal.js";
import { avatarHTML } from "../../components/avatar.js";
import { reportError } from "../../js/ui.js";
import { navigate, back } from "../../js/router.js";
import { auth } from "../../firebase/config.js";
import { getUserById, isOnline } from "../../services/users.js";
import {
  subscribeConversation, subscribeMessages, sendMessage, reactToMessage,
  deleteMessage, setTyping, markRead, isPeerTyping, isMessageRead,
  peerUidOf, TYPING_TIMEOUT_MS
} from "../../services/conversations.js";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];

export async function render(container, ctx = {}) {
  const convId = ctx.param;
  const me = auth.currentUser;

  if (!convId || !me || !convId.split("_").includes(me.uid)) {
    container.appendChild(h(`
      <div class="empty-state" style="min-height:60vh;">
        <div style="font-size:32px;">🔒</div>
        <h3 style="margin-bottom:6px;">Conversation unavailable</h3>
        <p style="max-width:300px;">This thread doesn't exist, or it isn't yours.</p>
        <button class="btn btn--ghost" id="chat-home" style="margin-top:18px;">Back to Chats</button>
      </div>`));
    qs("#chat-home").addEventListener("click", () => navigate("chats"));
    return () => {};
  }

  container.appendChild(h(`
    <div class="chat-page">
      <header class="chat-header">
        <button class="btn btn--icon" id="chat-back" aria-label="Back to chats">‹</button>
        <button class="chat-peer" id="chat-peer" aria-label="View profile">
          <span id="chat-peer-avatar"></span>
          <span class="chat-peer-text">
            <span class="chat-peer-name" id="chat-peer-name">…</span>
            <span class="chat-peer-sub" id="chat-peer-sub"></span>
          </span>
        </button>
      </header>

      <div id="message-list" class="message-list" aria-live="polite"></div>

      <div id="reply-preview"></div>

      <div class="composer">
        <button class="btn btn--icon" id="chat-image-btn" aria-label="Send a photo link">🔗</button>
        <input id="chat-input" type="text" placeholder="Message…" autocomplete="off"
               aria-label="Message" maxlength="2000">
        <button class="btn btn--primary btn--icon" id="chat-send" aria-label="Send">➤</button>
      </div>
    </div>
  `));

  const listEl = qs("#message-list");
  const input = qs("#chat-input");
  const peerNameEl = qs("#chat-peer-name");
  const peerSubEl = qs("#chat-peer-sub");
  const peerAvatarEl = qs("#chat-peer-avatar");

  let conversation = null;
  let peer = null;
  let peerUid = null;
  let messages = [];
  let replyTarget = null;
  let typingTimer = null;
  let typingTick = null;
  let alive = true;

  qs("#chat-back").addEventListener("click", () => back());
  qs("#chat-peer").addEventListener("click", () => {
    if (peer?.username) navigate("u", peer.username);
  });

  /* ---- header ---- */
  function paintHeader() {
    if (!peer) return;
    peerAvatarEl.innerHTML = avatarHTML(peer, 38, { online: isOnline(peer) });
    peerNameEl.textContent = peer.name || peer.username;

    if (conversation && isPeerTyping(conversation, peerUid)) {
      peerSubEl.textContent = "typing…";
      peerSubEl.className = "chat-peer-sub chat-peer-sub--typing";
    } else {
      peerSubEl.textContent = `@${peer.username || ""}`;
      peerSubEl.className = "chat-peer-sub";
    }
  }

  /* ---- messages ---- */
  function bubbleHTML(msg) {
    const mine = msg.senderId === me.uid;
    const repliedTo = msg.replyTo ? messages.find((m) => m.id === msg.replyTo) : null;
    const reactions = Object.values(msg.reactions || {});
    const time = msg.timestamp?.toDate
      ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    return `
      <div class="bubble-row ${mine ? "bubble-row--mine" : ""} anim-fade-up" data-id="${escapeHTML(msg.id)}">
        <div class="bubble ${mine ? "bubble--mine" : ""}">
          ${repliedTo ? `<div class="bubble-quote">${escapeHTML((repliedTo.text || "Photo").slice(0, 70))}</div>` : ""}
          ${msg.image ? `<img class="bubble-image" src="${escapeHTML(msg.image)}" alt="" loading="lazy">` : ""}
          ${msg.text ? `<span class="bubble-text">${escapeHTML(msg.text)}</span>` : ""}
        </div>
        ${reactions.length ? `<div class="bubble-reactions">${reactions.join(" ")}</div>` : ""}
        <div class="bubble-meta">
          <span>${time}</span>
          ${mine && conversation && isMessageRead(conversation, msg, peerUid)
            ? `<span class="bubble-read">Read</span>` : ""}
          <button class="bubble-action" data-action="reply">Reply</button>
          <button class="bubble-action" data-action="react">React</button>
          ${mine ? `<button class="bubble-action" data-action="delete">Delete</button>` : ""}
        </div>
      </div>`;
  }

  function paintMessages() {
    if (!alive) return;

    if (!messages.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:30px;">👋</div>
          <p style="max-width:280px;">No messages yet. Send the first one.</p>
        </div>`;
      return;
    }

    // Only stick to the bottom if the reader was already there — yanking
    // someone back down mid-scroll while they're reading history is worse
    // than making them tap once to catch up.
    const nearBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 140;

    listEl.innerHTML = messages.map(bubbleHTML).join("");
    if (nearBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  listEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".bubble-action");
    if (!btn) return;
    const id = btn.closest("[data-id]")?.dataset.id;
    const msg = messages.find((m) => m.id === id);
    if (!msg) return;

    if (btn.dataset.action === "reply") setReplyTarget(msg);
    if (btn.dataset.action === "react") showReactionPicker(btn, id);
    if (btn.dataset.action === "delete") {
      deleteMessage(convId, id).catch((err) => reportError(err, "deleting message"));
    }
  });

  /* ---- reply ---- */
  function setReplyTarget(msg) {
    replyTarget = msg;
    qs("#reply-preview").innerHTML = `
      <div class="reply-preview">
        <span>Replying to: ${escapeHTML((msg.text || "Photo").slice(0, 50))}</span>
        <button id="cancel-reply" class="auth-link">Cancel</button>
      </div>`;
    qs("#cancel-reply").addEventListener("click", clearReplyTarget);
    input.focus();
  }
  function clearReplyTarget() {
    replyTarget = null;
    qs("#reply-preview").innerHTML = "";
  }

  /* ---- reactions ---- */
  function showReactionPicker(anchorEl, messageId) {
    document.querySelector(".reaction-picker")?.remove();

    const picker = h(`
      <div class="reaction-picker glass">
        ${QUICK_REACTIONS.map((e) => `<button data-emoji="${e}">${e}</button>`).join("")}
      </div>`);

    const rect = anchorEl.getBoundingClientRect();
    picker.style.top = `${Math.max(8, rect.top - 52)}px`;
    picker.style.left = `${Math.min(window.innerWidth - 240, Math.max(8, rect.left - 40))}px`;
    document.body.appendChild(picker);

    picker.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-emoji]");
      if (!btn) return;
      try {
        await reactToMessage(convId, messageId, btn.dataset.emoji);
      } catch (err) {
        reportError(err, "reacting to message");
      } finally {
        picker.remove();
      }
    });

    setTimeout(() => {
      document.addEventListener("click", function close(ev) {
        if (!picker.contains(ev.target)) {
          picker.remove();
          document.removeEventListener("click", close);
        }
      });
    }, 0);
  }

  /* ---- sending ---- */
  async function send() {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    const pendingReply = replyTarget?.id || null;
    clearReplyTarget();

    try {
      await sendMessage(convId, { text, replyTo: pendingReply });
      setTyping(convId, false);
    } catch (err) {
      reportError(err, "sending message");
      input.value = text; // don't silently swallow what they typed
    }
  }

  qs("#chat-send").addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  /* ---- typing ----
     One write on the leading edge, one on the trailing edge. Writing on
     every keystroke would bill a document write per character. */
  const pingTyping = debounce(() => setTyping(convId, true), 400, true);

  input.addEventListener("input", () => {
    pingTyping();
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => setTyping(convId, false), TYPING_TIMEOUT_MS);
  });

  /* ---- photo link ---- */
  qs("#chat-image-btn").addEventListener("click", () => {
    const close = openModal({
      title: "Send a photo link",
      bodyHTML: `
        <div class="field">
          <label for="chat-image-url">Image URL</label>
          <input id="chat-image-url" type="url" placeholder="https://…">
          <p class="field-hint">Firebase Storage isn't enabled on this project, so images are shared as links.</p>
        </div>`,
      actions: [
        { label: "Cancel", variant: "ghost" },
        {
          label: "Send",
          variant: "primary",
          closeOnClick: false,
          onClick: async () => {
            const urlInput = qs("#chat-image-url");
            const url = urlInput.value.trim();

            let valid = false;
            try {
              const parsed = new URL(url);
              valid = parsed.protocol === "http:" || parsed.protocol === "https:";
            } catch { valid = false; }

            if (!valid) {
              showToast("That doesn't look like a valid image link", "error");
              urlInput.focus();
              return;
            }

            try {
              await sendMessage(convId, { image: url, replyTo: replyTarget?.id || null });
              clearReplyTarget();
              close();
            } catch (err) {
              reportError(err, "sending image");
            }
          }
        }
      ]
    });
    setTimeout(() => qs("#chat-image-url")?.focus(), 50);
  });

  /* ---- live data ---- */
  const unsubConversation = subscribeConversation(
    convId,
    async (doc) => {
      if (!alive) return;
      conversation = doc;

      if (!peer && doc) {
        peerUid = peerUidOf(doc);
        if (peerUid) {
          peer = await getUserById(peerUid);
          if (!alive) return;
        }
      }
      paintHeader();
      paintMessages(); // read receipts live on the conversation doc
    },
    (err) => {
      if (err?.code === "permission-denied") {
        listEl.innerHTML = `<div class="empty-state"><div style="font-size:30px;">🔒</div><p>You don't have access to this conversation.</p></div>`;
      }
    }
  );

  const unsubMessages = subscribeMessages(convId, (docs) => {
    if (!alive) return;
    messages = docs;
    paintMessages();
    markRead(convId);
  });

  // Typing state is a timestamp, so it expires on the clock rather than on a
  // new snapshot — without this tick, "typing…" would stay up until the peer
  // next wrote something.
  typingTick = setInterval(paintHeader, 1500);

  markRead(convId);

  return function teardown() {
    alive = false;
    unsubConversation();
    unsubMessages();
    clearInterval(typingTick);
    clearTimeout(typingTimer);
    setTyping(convId, false);
    document.querySelector(".reaction-picker")?.remove();
  };
}
