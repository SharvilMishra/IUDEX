// ==========================================================================
// IUDEX — Conversation Service
//
// The old build had one global `messages` collection, which only worked
// because exactly two people could ever sign in. IUDEX is open, so
// messages are scoped to a conversation between two specific uids.
//
// Conversation ids are deterministic: the two uids sorted and joined with
// an underscore. That means "start a conversation with @someone" needs no
// lookup and no lock — both sides independently compute the same id, so
// opening a chat twice from two devices can't create two threads. It also
// makes the security rule trivial: a participant's uid must literally
// appear in the document id's own `participants` array.
//
//   conversations/{convId}
//     participants: [uidA, uidB]
//     participantInfo: { uid: { username, name, photoURL } }
//     lastMessage: { text, senderId, at }
//     typing: { uid: Timestamp }
//     readAt: { uid: Timestamp }
//   conversations/{convId}/messages/{messageId}
// ==========================================================================

import {
  getDocById, setDocById, updateDocById, createDoc, subscribe, subscribeDoc,
  orderBy, limit, where, serverTimestamp, deleteDocById
} from "../firebase/firestore.js";
import { auth } from "../firebase/config.js";

export const MESSAGE_PAGE_SIZE = 200;
export const TYPING_TIMEOUT_MS = 4000;

/** Deterministic, order-independent id for a pair of uids. */
export function conversationId(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

export function messagesPath(convId) {
  return `conversations/${convId}/messages`;
}

function publicInfo(user) {
  return {
    username: user.username || "",
    name: user.name || "",
    photoURL: user.photoURL || ""
  };
}

/**
 * Get the conversation with `otherUser`, creating it if this is the first
 * time. Returns the conversation id.
 *
 * `participantInfo` is denormalized onto the conversation so the chat list
 * can render names and avatars without N extra reads per row. It's a cache,
 * not the source of truth — profile.js always reads users/{uid} directly.
 */
export async function openConversationWith(otherUser) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not signed in.");
  if (otherUser.uid === me.uid) {
    const err = new Error("You can't message yourself.");
    err.code = "SELF_CONVERSATION";
    throw err;
  }

  const convId = conversationId(me.uid, otherUser.uid);

  // A denied read here means "not created yet" as far as this flow is
  // concerned — treat it as absent rather than failing the whole action.
  let existing = null;
  try {
    existing = await getDocById("conversations", convId);
  } catch (err) {
    if (err?.code !== "permission-denied") throw err;
  }

  const myProfile = await getDocById("users", me.uid);

  if (!existing) {
    // Whether this opens as a live chat or a pending request depends on
    // the *recipient's* privacy setting, never the sender's — messaging a
    // private account is what needs approval, not being messaged by one.
    // The client decision here is only for UX; firestore.rules independently
    // re-derives the same check from the recipient's stored profile, so a
    // tampered client can't just write "active" and skip the gate.
    const targetIsPrivate = !!otherUser.private;

    await setDocById(
      "conversations",
      convId,
      {
        participants: [me.uid, otherUser.uid].sort(),
        participantInfo: {
          [me.uid]: publicInfo(myProfile || {}),
          [otherUser.uid]: publicInfo(otherUser)
        },
        lastMessage: null,
        status: targetIsPrivate ? "pending" : "active",
        requestedBy: targetIsPrivate ? me.uid : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      },
      false
    );
  } else {
    // Refresh the cached copies — either side may have renamed themselves.
    // Status is untouched: reopening an existing thread never resets a
    // decision that was already made.
    await updateDocById("conversations", convId, {
      [`participantInfo.${me.uid}`]: publicInfo(myProfile || {}),
      [`participantInfo.${otherUser.uid}`]: publicInfo(otherUser)
    });
  }

  return convId;
}

/* ---- Message requests -----------------------------------------------------
   A conversation with no `status` field is legacy data from before this
   feature existed — treated as "active" everywhere below, so nothing needs
   a migration.
   ------------------------------------------------------------------------- */

export function isPending(conversation) {
  return conversation?.status === "pending";
}

export function isDeclined(conversation) {
  return conversation?.status === "declined";
}

/** True if *I* am the one who sent this request (not the one deciding it). */
export function isRequester(conversation) {
  return !!conversation?.requestedBy && conversation.requestedBy === auth.currentUser?.uid;
}

/** True if this is a pending request sitting in my queue to accept/decline. */
export function isAwaitingMyResponse(conversation) {
  return isPending(conversation) && !isRequester(conversation);
}

export async function acceptRequest(convId) {
  await updateDocById("conversations", convId, { status: "active", updatedAt: serverTimestamp() });
}

export async function declineRequest(convId) {
  // Declined rather than deleted: Firestore doesn't cascade-delete a
  // document's subcollection, so removing the conversation doc would orphan
  // its messages rather than clean them up. A status flag keeps the whole
  // thread (and its rules) coherent, and gives the sender an honest answer
  // instead of the request silently vanishing.
  await updateDocById("conversations", convId, { status: "declined", updatedAt: serverTimestamp() });
}

/**
 * Live list of my conversations, most recently active first.
 * Needs the composite index in firestore.indexes.json
 * (participants ARRAY_CONTAINS + updatedAt DESC).
 */
export function subscribeMyConversations(cb, onError) {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => {};

  return subscribe(
    "conversations",
    [where("participants", "array-contains", uid), orderBy("updatedAt", "desc"), limit(50)],
    cb,
    onError
  );
}

export function subscribeConversation(convId, cb, onError) {
  return subscribeDoc("conversations", convId, cb, onError);
}

export function subscribeMessages(convId, cb, onError) {
  return subscribe(
    messagesPath(convId),
    [orderBy("timestamp", "asc"), limit(MESSAGE_PAGE_SIZE)],
    cb,
    onError
  );
}

export async function sendMessage(convId, { text = "", image = null, replyTo = null }) {
  const me = auth.currentUser;
  if (!me) throw new Error("Not signed in.");
  if (!text.trim() && !image) return null;

  const ref = await createDoc(messagesPath(convId), {
    senderId: me.uid,
    text: text.trim(),
    image,
    replyTo,
    reactions: {},
    timestamp: serverTimestamp()
  });

  // Denormalized preview for the chat list, and the sort key for it.
  await updateDocById("conversations", convId, {
    lastMessage: {
      text: text.trim() || (image ? "📷 Photo" : ""),
      senderId: me.uid,
      at: serverTimestamp()
    },
    updatedAt: serverTimestamp()
  });

  return ref.id;
}

export async function reactToMessage(convId, messageId, emoji) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDocById(messagesPath(convId), messageId, {
    [`reactions.${uid}`]: emoji
  });
}

export async function deleteMessage(convId, messageId) {
  await deleteDocById(messagesPath(convId), messageId);
}

/* ---- Typing + read state -------------------------------------------------
   Both live on the conversation doc as uid-keyed maps rather than as
   separate documents. One doc, one listener, and the security rule that
   already covers the conversation covers these too.
   ------------------------------------------------------------------------- */

export async function setTyping(convId, isTyping) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDocById("conversations", convId, {
    [`typing.${uid}`]: isTyping ? serverTimestamp() : null
  }).catch(() => {}); // never let a typing ping surface as an error
}

export function isPeerTyping(conversation, peerUid) {
  const at = conversation?.typing?.[peerUid];
  const ms = at?.toMillis ? at.toMillis() : null;
  return !!ms && Date.now() - ms < TYPING_TIMEOUT_MS;
}

export async function markRead(convId) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await updateDocById("conversations", convId, {
    [`readAt.${uid}`]: serverTimestamp()
  }).catch(() => {});
}

/** True when the peer has read up to (at least) this message. */
export function isMessageRead(conversation, message, peerUid) {
  const readAt = conversation?.readAt?.[peerUid];
  const readMs = readAt?.toMillis ? readAt.toMillis() : null;
  const sentMs = message?.timestamp?.toMillis ? message.timestamp.toMillis() : null;
  return !!readMs && !!sentMs && readMs >= sentMs;
}

/** Unread count for the chat list — approximate, based on readAt vs lastMessage. */
export function hasUnread(conversation) {
  const uid = auth.currentUser?.uid;
  if (!uid) return false;
  // A request awaiting my decision is "unread" in spirit even before any
  // message has landed — it's something of mine that needs attention.
  if (isAwaitingMyResponse(conversation)) return true;
  if (!conversation?.lastMessage) return false;
  if (conversation.lastMessage.senderId === uid) return false;

  const readAt = conversation.readAt?.[uid];
  const readMs = readAt?.toMillis ? readAt.toMillis() : 0;
  const lastMs = conversation.lastMessage.at?.toMillis
    ? conversation.lastMessage.at.toMillis()
    : 0;
  return lastMs > readMs;
}

export function peerUidOf(conversation) {
  const uid = auth.currentUser?.uid;
  // Without a signed-in uid, "the other participant" is meaningless — a
  // find() here would just return whoever happens to be first, which is
  // silently wrong rather than obviously wrong.
  if (!uid) return null;
  return (conversation?.participants || []).find((p) => p !== uid) || null;
}

export function peerInfoOf(conversation) {
  const peer = peerUidOf(conversation);
  return conversation?.participantInfo?.[peer] || null;
}
