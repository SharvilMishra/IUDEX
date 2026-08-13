// ==========================================================================
// Shideep — Call Sync
// Firestore-based WebRTC signaling. Since Shideep only ever has two users,
// one shared "room" doc is enough — no need for arbitrary call IDs. The
// doc holds the offer/answer SDP plus each side's trickled ICE candidates
// as arrays (appended via arrayUnion so concurrent writes never clobber
// each other). Reused pattern: subscribeDoc/ensure/update, same shape as
// musicSync.js and gameSync.js.
// ==========================================================================
import {
  subscribeDoc, setDocById, updateDocById, getDocById,
  serverTimestamp, arrayUnion
} from "../firebase/firestore.js";
import { auth, AUTHORIZED_EMAILS } from "../firebase/config.js";

const ROOM_ID = "room";

export function myEmail() {
  return auth.currentUser?.email?.toLowerCase();
}

export function partnerEmail() {
  const mine = myEmail();
  return AUTHORIZED_EMAILS.find((e) => e.toLowerCase() !== mine);
}

/** Live-subscribe to the shared call room doc. */
export function subscribeCall(onChange) {
  return subscribeDoc("calls", ROOM_ID, onChange);
}

/** Create the room doc only if it doesn't exist yet. */
export async function ensureCallRoom() {
  const existing = await getDocById("calls", ROOM_ID);
  if (!existing) {
    await setDocById("calls", ROOM_ID, { status: "idle" }, false);
  }
}

/** Caller: start a fresh call — fully overwrites the room (previous call is over). */
export async function placeCall({ callerName, calleeEmail, offer }) {
  await setDocById(
    "calls",
    ROOM_ID,
    {
      status: "ringing",
      callerUid: auth.currentUser?.uid,
      callerEmail: myEmail(),
      callerName,
      calleeEmail,
      offer,
      answer: null,
      callerCandidates: [],
      calleeCandidates: [],
      startedAt: serverTimestamp()
    },
    false
  );
}

/** Callee: accept — attach the answer SDP and flip to active. */
export async function acceptCall(answer) {
  await updateDocById("calls", ROOM_ID, { answer, status: "active" });
}

/** Either side: end the call and reset the room for next time. */
export async function endCall() {
  await setDocById("calls", ROOM_ID, { status: "idle" }, false);
}

export async function pushCandidate(side, candidateJSON) {
  const field = side === "caller" ? "callerCandidates" : "calleeCandidates";
  await updateDocById("calls", ROOM_ID, { [field]: arrayUnion(candidateJSON) });
}
