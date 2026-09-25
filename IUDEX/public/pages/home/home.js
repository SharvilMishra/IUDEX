// ==========================================================================
// e-CON — Chats (home)
// Live list of your conversations, most recent first — plus any pending
// message requests waiting on your decision, shown separately above them.
// ==========================================================================
import { h, escapeHTML, timeAgo, truncate, qs } from "../../js/utils.js";
import { skeletonList } from "../../components/loader.js";
import { avatarHTML } from "../../components/avatar.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import { navigate } from "../../js/router.js";
import { auth } from "../../firebase/config.js";
import {
  subscribeMyConversations, peerUidOf, peerInfoOf, hasUnread,
  isAwaitingMyResponse, isRequester, isDeclined, acceptRequest, declineRequest
} from "../../services/conversations.js";

function requestRowHTML(conv) {
  const peer = peerInfoOf(conv) || {};
  return `
    <div class="request-row" data-conv="${escapeHTML(conv.id)}">
      <button class="request-row-identity" data-open="${escapeHTML(conv.id)}">
        ${avatarHTML(peer, 44)}
        <span class="chat-row-body">
          <span class="chat-row-name">${escapeHTML(peer.name || peer.username || "Unknown")}</span>
          <span class="chat-row-handle">@${escapeHTML(peer.username || "")}</span>
        </span>
      </button>
      <span class="request-row-actions">
        <button class="btn btn--ghost btn--sm" data-decline="${escapeHTML(conv.id)}">Decline</button>
        <button class="btn btn--primary btn--sm" data-accept="${escapeHTML(conv.id)}">Accept</button>
      </span>
    </div>`;
}

function rowHTML(conv) {
  const peerUid = peerUidOf(conv);
  const peer = peerInfoOf(conv) || {};
  const unread = hasUnread(conv);
  const pendingMine = isRequester(conv); // I sent this and it hasn't been accepted yet
  const last = conv.lastMessage;
  const mine = last?.senderId === auth.currentUser?.uid;

  const preview = last?.text
    ? `${mine ? "You: " : ""}${truncate(last.text, 44)}`
    : pendingMine
      ? "Request sent — waiting for a reply."
      : "No messages yet — say hello.";

  return `
    <button class="chat-row ${unread ? "chat-row--unread" : ""}" data-conv="${escapeHTML(conv.id)}" data-peer="${escapeHTML(peerUid || "")}">
      ${avatarHTML(peer, 48)}
      <span class="chat-row-body">
        <span class="chat-row-top">
          <span class="chat-row-name">${escapeHTML(peer.name || peer.username || "Unknown")}</span>
          <span class="chat-row-time">${last?.at ? timeAgo(last.at) : ""}</span>
        </span>
        <span class="chat-row-bottom">
          <span class="chat-row-preview">${escapeHTML(preview)}</span>
          ${pendingMine ? `<span class="pending-tag">Pending</span>` : ""}
          ${unread && !pendingMine ? `<span class="unread-dot" aria-label="Unread messages"></span>` : ""}
        </span>
        <span class="chat-row-handle">@${escapeHTML(peer.username || "")}</span>
      </span>
    </button>`;
}

export async function render(container) {
  container.appendChild(h(`
    <div class="page">
      <div class="page-head">
        <h1>Chats</h1>
        <button class="btn btn--icon" id="chats-new" aria-label="Find people to message">＋</button>
      </div>

      <button class="search-trigger" id="chats-search" type="button">
        <span aria-hidden="true">🔍</span> Search @username
      </button>

      <div id="requests-section"></div>
      <div id="chat-list" class="chat-list">${skeletonList(4, "height:68px; margin-bottom:10px;")}</div>
    </div>
  `));

  const requestsEl = qs("#requests-section");
  const listEl = qs("#chat-list");
  let busyIds = new Set();

  qs("#chats-new").addEventListener("click", () => navigate("discover"));
  qs("#chats-search").addEventListener("click", () => navigate("discover"));

  listEl.addEventListener("click", (e) => {
    const row = e.target.closest(".chat-row");
    if (row) navigate("chat", row.dataset.conv);
  });

  requestsEl.addEventListener("click", async (e) => {
    const openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      navigate("chat", openBtn.dataset.open);
      return;
    }

    const acceptId = e.target.closest("[data-accept]")?.dataset.accept;
    const declineId = e.target.closest("[data-decline]")?.dataset.decline;
    const convId = acceptId || declineId;
    if (!convId || busyIds.has(convId)) return;

    busyIds.add(convId);
    try {
      if (acceptId) {
        await acceptRequest(convId);
        showToast("Request accepted.", "success");
      } else {
        await declineRequest(convId);
        showToast("Request declined.", "info");
      }
      // The live subscription below repaints both lists once Firestore
      // confirms the write — no local list surgery needed here.
    } catch (err) {
      reportError(err, acceptId ? "accepting request" : "declining request");
    } finally {
      busyIds.delete(convId);
    }
  });

  const unsubscribe = subscribeMyConversations(
    (conversations) => {
      // Brand-new conversations have no messages yet, so they'd be sorted
      // by a server timestamp that hasn't resolved locally — keep them
      // visible rather than letting them fall to the bottom. Declined
      // requests are dead ends for both sides and just clutter the list.
      const visible = conversations.filter(
        (c) => c.participants?.length === 2 && !isDeclined(c)
      );

      const requests = visible.filter(isAwaitingMyResponse);
      const chats = visible.filter((c) => !isAwaitingMyResponse(c));

      requestsEl.innerHTML = requests.length
        ? `
          <div class="requests-section">
            <div class="eyebrow requests-eyebrow">
              Message requests ${requests.length > 1 ? `(${requests.length})` : ""}
            </div>
            ${requests.map(requestRowHTML).join("")}
          </div>`
        : "";

      if (!chats.length) {
        listEl.innerHTML = requests.length
          ? "" // the requests section alone is enough context, no empty-state needed
          : `
            <div class="empty-state">
              <div style="font-size:34px;">💬</div>
              <h3 style="margin-bottom:6px;">No conversations yet</h3>
              <p style="max-width:300px;">Find someone by their @username and start talking.</p>
              <button class="btn btn--primary" id="empty-discover" style="margin-top:18px;">Discover people</button>
            </div>`;
        qs("#empty-discover")?.addEventListener("click", () => navigate("discover"));
        return;
      }

      listEl.innerHTML = chats.map(rowHTML).join("");
    },
    (err) => {
      listEl.innerHTML = `
        <div class="empty-state">
          <div style="font-size:30px;">⚠️</div>
          <p style="max-width:320px;">Couldn't load your chats.${
            err?.code === "failed-precondition"
              ? " Firestore needs the composite index from firestore.indexes.json — deploy it with <code>firebase deploy --only firestore:indexes</code>."
              : ""
          }</p>
        </div>`;
    }
  );

  return function teardown() {
    unsubscribe();
  };
}
