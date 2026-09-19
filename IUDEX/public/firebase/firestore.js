// ==========================================================================
// IUDEX — Firestore Service
// Thin, generic wrappers so feature modules (chat.js, discover.js, ...)
// never touch the Firebase SDK directly.
//
// Every `path` argument accepts a slash-separated Firestore path, so the
// same helpers work for top-level collections ("users") and for nested
// subcollections ("conversations/<id>/messages"). That matters here: IUDEX
// stores each conversation's messages underneath the conversation itself,
// which is what makes per-conversation security rules expressible at all.
// ==========================================================================

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit, startAt, endAt,
  onSnapshot, serverTimestamp, increment, arrayUnion, arrayRemove,
  runTransaction, writeBatch, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./config.js";

export {
  serverTimestamp, increment, arrayUnion, arrayRemove, deleteField,
  where, orderBy, limit, startAt, endAt, runTransaction, writeBatch, db, doc
};

/** collection reference from a slash path, e.g. "conversations/abc/messages" */
export function col(path) {
  return collection(db, path);
}

/** document reference from a collection path + id */
export function docRef(path, id) {
  return doc(db, path, id);
}

export async function createDoc(path, data) {
  return addDoc(col(path), { ...data, createdAt: serverTimestamp() });
}

export async function setDocById(path, id, data, merge = true) {
  return setDoc(docRef(path, id), data, { merge });
}

export async function updateDocById(path, id, data) {
  return updateDoc(docRef(path, id), data);
}

export async function deleteDocById(path, id) {
  return deleteDoc(docRef(path, id));
}

export async function getDocById(path, id) {
  const snap = await getDoc(docRef(path, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAll(path, constraints = []) {
  const snap = await getDocs(query(col(path), ...constraints));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribe to a live-updating collection query.
 * Returns an unsubscribe function — callers MUST invoke it on page teardown
 * (router.js does this automatically for the active page's listeners).
 * `onError` lets a caller react to permission-denied instead of only logging,
 * which the chat page uses to show a real message rather than an empty thread.
 */
export function subscribe(path, constraints, onChange, onError) {
  return onSnapshot(
    query(col(path), ...constraints),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error(`[firestore] listener error on ${path}:`, err.message);
      onError?.(err);
    }
  );
}

export function subscribeDoc(path, id, onChange, onError) {
  return onSnapshot(
    docRef(path, id),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => {
      console.error(`[firestore] doc listener error on ${path}/${id}:`, err.message);
      onError?.(err);
    }
  );
}
