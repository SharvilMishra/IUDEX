// ==========================================================================
// IUDEX — Music Sync
// Shared Firestore plumbing for the synced listening room (MUS-001..005).
// One singleton "room" doc holds what's currently playing + its timestamp;
// a "musicQueue" collection holds what's up next. Reuses gameSync's role
// logic so P1 is always the deterministic auto-advance owner — avoids a
// double-skip race when a song ends on both devices at ~the same moment.
// ==========================================================================
import {
  subscribeDoc, setDocById, updateDocById, getDocById, serverTimestamp,
  subscribe, createDoc, deleteDocById, orderBy
} from "../firebase/firestore.js";
import { getMyRole } from "./gameSync.js";

export { getMyRole };

const ROOM_ID = "room";

/** Live-subscribe to the single shared room doc. */
export function subscribeRoom(onChange) {
  return subscribeDoc("music", ROOM_ID, onChange);
}

/** Create the room doc only if it doesn't exist yet — never resets a session in progress. */
export async function ensureRoom() {
  const existing = await getDocById("music", ROOM_ID);
  if (!existing) {
    await setDocById(
      "music",
      ROOM_ID,
      {
        videoId: null,
        title: "",
        author: "",
        thumbnail: "",
        isPlaying: false,
        position: 0,
        updatedAt: serverTimestamp(),
        updatedBy: null
      },
      false
    );
  }
}

/** Partial update to the room — always stamps who/when for drift correction. */
export async function updateRoom(partial) {
  await updateDocById("music", ROOM_ID, {
    ...partial,
    updatedAt: serverTimestamp(),
    updatedBy: getMyRole()
  });
}

/** Given the last-known room doc, compute where playback should be *right now*. */
export function expectedPosition(room) {
  if (!room || !room.videoId) return 0;
  const base = room.position || 0;
  if (!room.isPlaying) return base;
  const updatedAtMs = room.updatedAt?.toDate ? room.updatedAt.toDate().getTime() : Date.now();
  const elapsed = (Date.now() - updatedAtMs) / 1000;
  return base + Math.max(0, elapsed);
}

/** Live-subscribe to the shared queue, oldest-added first. */
export function subscribeQueue(onChange) {
  return subscribe("musicQueue", [orderBy("createdAt", "asc")], onChange);
}

export async function addToQueue(item) {
  await createDoc("musicQueue", item);
}

export async function removeFromQueue(id) {
  await deleteDocById("musicQueue", id);
}
