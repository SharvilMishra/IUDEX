// ==========================================================================
// IUDEX — Firestore Service
// Thin, generic wrappers so feature modules (chat.js, gallery.js, ...)
// never touch the Firebase SDK directly. Keeps query patterns consistent
// and makes security-rule debugging easier (one place logs writes).
// ==========================================================================

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, serverTimestamp, increment, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./config.js";

export { serverTimestamp, increment, arrayUnion };

export function col(name) {
  return collection(db, name);
}

export async function createDoc(collectionName, data) {
  return addDoc(col(collectionName), { ...data, createdAt: serverTimestamp() });
}

export async function setDocById(collectionName, id, data, merge = true) {
  return setDoc(doc(db, collectionName, id), data, { merge });
}

export async function updateDocById(collectionName, id, data) {
  return updateDoc(doc(db, collectionName, id), data);
}

export async function deleteDocById(collectionName, id) {
  return deleteDoc(doc(db, collectionName, id));
}

export async function getDocById(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAll(collectionName, constraints = []) {
  const q = query(col(collectionName), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribe to a live-updating collection query.
 * Returns an unsubscribe function — callers MUST invoke it on page teardown
 * (router.js does this automatically for the active page's listeners).
 */
export function subscribe(collectionName, constraints, onChange) {
  const q = query(col(collectionName), ...constraints);
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error(`[firestore] listener error on ${collectionName}:`, err.message)
  );
}

export function subscribeDoc(collectionName, id, onChange) {
  return onSnapshot(
    doc(db, collectionName, id),
    (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => console.error(`[firestore] doc listener error on ${collectionName}/${id}:`, err.message)
  );
}

export { where, orderBy, limit };
