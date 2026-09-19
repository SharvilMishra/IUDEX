// ==========================================================================
// IUDEX — Chats (home)
// Live list of your conversations, most recent first.
// ==========================================================================
import { h, escapeHTML, timeAgo, truncate } from "../../js/utils.js";
import { skeletonList } from "../../components/loader.js";
import { avatarHTML } from "../../components/avatar.js";
import { navigate } from "../../js/router.js";
import { auth } from "../../firebase/config.js";
import {
  subscribeMyConversations, peerUidOf, peerInfoOf, hasUnread
} from "../../services/conversations.js";

function rowHTML(conv) {
  const peerUid = peerUidOf(conv);
  const peer = peerInfoOf(conv) || {};
  const unread = hasUnread(conv);
  const last = conv.lastMessage;
  const mine = last?.senderId === auth.currentUser?.uid;

  const preview = last?.text
    ? `${mine ? "You: " : ""}${truncate(last.text, 44)}`
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
          ${unread ? `<span class="unread-dot" aria-label="Unread messages"></span>` : ""}
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

      <div id="chat-list" class="chat-list">${skeletonList(4, "height:68px; margin-bottom:10px;")}</div>
    </div>
  `));

  const listEl = document.getElementById("chat-list");

  document.getElementById("chats-new").addEventListener("click", () => navigate("discover"));
  document.getElementById("chats-search").addEventListener("click", () => navigate("discover"));

  listEl.addEventListener("click", (e) => {
    const row = e.target.closest(".chat-row");
    if (row) navigate("chat", row.dataset.conv);
  });

  const unsubscribe = subscribeMyConversations(
    (conversations) => {
      // Brand-new conversations have no messages yet, so they'd be sorted
      // by a server timestamp that hasn't resolved locally — keep them
      // visible rather than letting them fall to the bottom.
      const visible = conversations.filter((c) => c.participants?.length === 2);

      if (!visible.length) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div style="font-size:34px;">💬</div>
            <h3 style="margin-bottom:6px;">No conversations yet</h3>
            <p style="max-width:300px;">Find someone by their @username and start talking.</p>
            <button class="btn btn--primary" id="empty-discover" style="margin-top:18px;">Discover people</button>
          </div>`;
        document.getElementById("empty-discover")
          ?.addEventListener("click", () => navigate("discover"));
        return;
      }

      listEl.innerHTML = visible.map(rowHTML).join("");
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
