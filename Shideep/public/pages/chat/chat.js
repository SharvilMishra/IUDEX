// ==========================================================================
// Shideep — Chat (CHAT-001..010)
// ==========================================================================
import { h, escapeHTML, debounce } from "../../js/utils.js";
import { reportError } from "../../js/ui.js";
import { showToast } from "../../components/toast.js";
import {
  subscribe, subscribeDoc, createDoc, updateDocById, setDocById,
  orderBy, limit, serverTimestamp
} from "../../firebase/firestore.js";
import { openModal } from "../../components/modal.js";
import { auth, AUTHORIZED_EMAILS } from "../../firebase/config.js";
import { startCall } from "../../js/callManager.js";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "😮", "😢"];
const TYPING_TIMEOUT_MS = 3000;

let allMessages = [];
let replyTarget = null;
let typingTimer = null;

export async function render(container) {
  const me = auth.currentUser;

  container.appendChild(
    h(`
      <div class="page" style="padding-bottom:0; display:flex; flex-direction:column; height:calc(100vh - var(--nav-height)); padding-left:0; padding-right:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:0 20px 12px; gap:10px;">
          <h1 style="font-size:1.5rem;">Chat</h1>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn--icon" id="chat-call-btn" aria-label="Start a call">📞</button>
            <input id="chat-search" type="text" placeholder="Search…" style="max-width:120px; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:999px; padding:8px 14px; font-size:0.85rem;">
          </div>
        </div>
        <div id="typing-indicator" class="text-muted" style="height:20px; padding:0 20px; font-size:0.8rem;"></div>
        <div id="message-list" style="flex:1; overflow-y:auto; padding:0 16px; display:flex; flex-direction:column; gap:10px;"></div>
        <div id="reply-preview"></div>
        <div style="display:flex; gap:10px; align-items:center; padding:12px 16px; border-top:1px solid var(--border);">
          <button class="btn btn--icon" id="chat-image-btn" style="flex-shrink:0;" aria-label="Send a photo link">🔗</button>
          <input id="chat-text-input" type="text" placeholder="Message…" style="flex:1; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:999px; padding:12px 18px;">
          <button class="btn btn--primary btn--icon" id="chat-send-btn" aria-label="Send">➤</button>
        </div>
      </div>
    `)
  );

  const listEl = document.getElementById("message-list");
  const textInput = document.getElementById("chat-text-input");

  function bubbleHTML(msg) {
    const mine = msg.sender === me.uid;
    const repliedTo = msg.replyTo ? allMessages.find((m) => m.id === msg.replyTo) : null;

    return `
      <div class="chat-bubble anim-fade-up" data-id="${msg.id}" style="align-self:${mine ? "flex-end" : "flex-start"}; max-width:78%;">
        <div class="card" style="padding:10px 14px; background:${mine ? "var(--accent-primary)" : "var(--card)"}; border-radius:${mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px"};">
          ${repliedTo ? `<div style="border-left:2px solid rgba(255,255,255,0.4); padding-left:8px; margin-bottom:6px; opacity:0.75; font-size:0.8rem;">${escapeHTML(repliedTo.text?.slice(0, 60) || "Photo")}</div>` : ""}
          ${msg.image ? `<img src="${msg.image}" alt="" style="width:100%; border-radius:12px; margin-bottom:${msg.text ? "6px" : "0"};">` : ""}
          ${msg.text ? `<span>${escapeHTML(msg.text)}</span>` : ""}
        </div>
        <div style="display:flex; gap:6px; align-items:center; margin-top:4px; ${mine ? "justify-content:flex-end;" : ""}">
          <span class="eyebrow">${msg.timestamp ? new Date(msg.timestamp.toDate ? msg.timestamp.toDate() : msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
          ${mine && msg.readBy ? `<span class="eyebrow" style="color:var(--accent-secondary);">${msg.readBy ? "Read" : "Sent"}</span>` : ""}
          ${msg.reactions && Object.keys(msg.reactions).length ? `<span>${Object.values(msg.reactions).join(" ")}</span>` : ""}
        </div>
        <div class="bubble-actions" style="display:flex; gap:10px; margin-top:2px; ${mine ? "justify-content:flex-end;" : ""}">
          <button class="eyebrow" data-action="reply">Reply</button>
          <button class="eyebrow" data-action="react">React</button>
        </div>
      </div>
    `;
  }

  function renderMessages(messages, filterQuery = "") {
    const filtered = filterQuery
      ? messages.filter((m) => m.text?.toLowerCase().includes(filterQuery.toLowerCase()))
      : messages;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state"><div style="font-size:32px;">💬</div><p>${filterQuery ? "No messages match your search." : "Say hello — this is just for the two of you."}</p></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(bubbleHTML).join("");

    listEl.querySelectorAll("[data-action='reply']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.closest("[data-id]").dataset.id;
        setReplyTarget(messages.find((m) => m.id === id));
      });
    });
    listEl.querySelectorAll("[data-action='react']").forEach((btn) => {
      btn.addEventListener("click", (e) => showReactionPicker(e.target, btn.closest("[data-id]").dataset.id));
    });

    // CHAT-010: auto-scroll to newest
    if (!filterQuery) listEl.scrollTop = listEl.scrollHeight;
  }

  // CHAT-002: real-time messages, last 300
  const unsubMessages = subscribe("messages", [orderBy("timestamp", "asc"), limit(300)], (messages) => {
    allMessages = messages;
    renderMessages(messages, document.getElementById("chat-search").value.trim());
    markLatestAsRead(messages);
  });

  // CHAT-003: typing indicator — subscribe to the *other* user's typing doc
  const otherEmail = AUTHORIZED_EMAILS.find((e) => e !== me.email);
  const typingIndicatorEl = document.getElementById("typing-indicator");
  const unsubTyping = subscribeDoc("typing", otherEmail, (doc) => {
    const isRecent = doc?.at && Date.now() - (doc.at.toMillis ? doc.at.toMillis() : new Date(doc.at).getTime()) < TYPING_TIMEOUT_MS;
    typingIndicatorEl.textContent = isRecent ? "Typing…" : "";
  });

  textInput.addEventListener("input", () => {
    clearTimeout(typingTimer);
    setDocById("typing", me.email, { at: serverTimestamp() }).catch(() => {});
    typingTimer = setTimeout(() => {
      setDocById("typing", me.email, { at: null }).catch(() => {});
    }, TYPING_TIMEOUT_MS);
  });

  // CHAT-008: search previous messages
  document.getElementById("chat-search").addEventListener(
    "input",
    debounce((e) => renderMessages(allMessages, e.target.value.trim()), 150)
  );

  // CHAT-001: send text message
  async function sendMessage() {
    const text = textInput.value.trim();
    if (!text) return;
    textInput.value = "";
    try {
      await createDoc("messages", {
        sender: me.uid,
        text,
        image: null,
        timestamp: serverTimestamp(),
        edited: false,
        replyTo: replyTarget?.id || null,
        reactions: {}
      });
      clearReplyTarget();
    } catch (err) {
      reportError(err, "sending message");
    }
  }
  document.getElementById("chat-send-btn").addEventListener("click", sendMessage);
  document.getElementById("chat-call-btn").addEventListener("click", () => startCall());
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // CHAT-007: send image — via pasted link rather than upload (no paid
  // Storage plan required). See firebase/storage.js header for why.
  document.getElementById("chat-image-btn").addEventListener("click", () => {
    const close = openModal({
      title: "Send a photo link",
      bodyHTML: `
        <div class="field">
          <label for="chat-image-url">Image URL</label>
          <input id="chat-image-url" type="url" placeholder="https://…">
        </div>
      `,
      actions: [
        { label: "Cancel", variant: "ghost" },
        {
          label: "Send",
          variant: "primary",
          closeOnClick: false,
          onClick: async () => {
            const input = document.getElementById("chat-image-url");
            const url = input.value.trim();
            let valid = false;
            try {
              const u = new URL(url);
              valid = u.protocol === "http:" || u.protocol === "https:";
            } catch {
              valid = false;
            }
            if (!valid) {
              showToast("That doesn't look like a valid image link", "error");
              input.focus();
              return;
            }
            try {
              await createDoc("messages", {
                sender: me.uid,
                text: "",
                image: url,
                timestamp: serverTimestamp(),
                edited: false,
                replyTo: replyTarget?.id || null,
                reactions: {}
              });
              clearReplyTarget();
              close();
            } catch (err) {
              reportError(err, "sending image");
            }
          }
        }
      ]
    });
    setTimeout(() => document.getElementById("chat-image-url")?.focus(), 50);
  });

  function setReplyTarget(msg) {
    replyTarget = msg;
    document.getElementById("reply-preview").innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 20px; background:var(--card); border-top:1px solid var(--border);">
        <span class="text-muted" style="font-size:0.85rem;">Replying to: ${escapeHTML((msg.text || "Photo").slice(0, 50))}</span>
        <button id="cancel-reply-btn" class="eyebrow">Cancel</button>
      </div>`;
    document.getElementById("cancel-reply-btn").addEventListener("click", clearReplyTarget);
    textInput.focus();
  }
  function clearReplyTarget() {
    replyTarget = null;
    document.getElementById("reply-preview").innerHTML = "";
  }

  // CHAT-006: emoji reactions
  function showReactionPicker(anchorEl, messageId) {
    const existing = document.querySelector(".reaction-picker");
    if (existing) existing.remove();

    const picker = h(`
      <div class="reaction-picker glass" style="position:absolute; display:flex; gap:6px; padding:8px; z-index:60;">
        ${QUICK_REACTIONS.map((e) => `<button data-emoji="${e}" style="font-size:20px;">${e}</button>`).join("")}
      </div>
    `);
    const rect = anchorEl.getBoundingClientRect();
    picker.style.top = `${rect.top - 50}px`;
    picker.style.left = `${Math.max(8, rect.left - 40)}px`;
    document.body.appendChild(picker);

    picker.querySelectorAll("[data-emoji]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          const msg = allMessages.find((m) => m.id === messageId);
          const reactions = { ...(msg.reactions || {}), [me.uid]: btn.dataset.emoji };
          await updateDocById("messages", messageId, { reactions });
        } catch (err) {
          reportError(err, "reacting to message");
        } finally {
          picker.remove();
        }
      });
    });

    setTimeout(() => {
      document.addEventListener("click", function closePicker(ev) {
        if (!picker.contains(ev.target) && ev.target !== anchorEl) {
          picker.remove();
          document.removeEventListener("click", closePicker);
        }
      });
    }, 0);
  }

  // CHAT-004: read receipts — mark newest message from the other user as read
  function markLatestAsRead(messages) {
    const lastFromOther = [...messages].reverse().find((m) => m.sender !== me.uid && !m.readBy);
    if (lastFromOther) {
      updateDocById("messages", lastFromOther.id, { readBy: true }).catch(() => {});
    }
  }

  return function teardown() {
    unsubMessages();
    unsubTyping();
    clearTimeout(typingTimer);
    setDocById("typing", me.email, { at: null }).catch(() => {});
    document.querySelector(".reaction-picker")?.remove();
  };
}
