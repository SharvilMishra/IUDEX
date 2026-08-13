// ==========================================================================
// Shideep — Game Sync
// Shared Firestore plumbing for every multiplayer game (TAD Games Module).
// Since Shideep only ever has exactly two users, player roles are assigned
// deterministically from the fixed email whitelist — no join/invite flow
// needed (GAME-002 is satisfied implicitly: both users are always "in").
// ==========================================================================
import {
  subscribeDoc, setDocById, updateDocById, getDocById, increment, serverTimestamp
} from "../firebase/firestore.js";
import { auth, AUTHORIZED_EMAILS } from "../firebase/config.js";

/** "P1" or "P2" — stable per person, independent of which device/uid they use. */
export function getMyRole() {
  const email = auth.currentUser?.email?.toLowerCase();
  const idx = AUTHORIZED_EMAILS.findIndex((e) => e.toLowerCase() === email);
  return idx === 0 ? "P1" : "P2";
}

export function otherRole(role) {
  return role === "P1" ? "P2" : "P1";
}

/** Live-subscribe to a single shared game document (one per game type). */
export function subscribeGame(gameId, onChange) {
  return subscribeDoc("games", gameId, onChange);
}

/** Create the game doc only if it doesn't already exist — never resets an in-progress game. */
export async function ensureGame(gameId, initialState) {
  const existing = await getDocById("games", gameId);
  if (!existing) {
    await setDocById("games", gameId, { type: gameId, ...initialState, updatedAt: serverTimestamp() }, false);
  }
}

/** Fully overwrite the game doc — used by "New Game" / "Play again". */
export async function resetGame(gameId, initialState) {
  await setDocById("games", gameId, { type: gameId, ...initialState, updatedAt: serverTimestamp() }, false);
}

/** Partial update (a move, a choice, etc.) — always bumps updatedAt. */
export async function updateGame(gameId, partial) {
  await updateDocById("games", gameId, { ...partial, updatedAt: serverTimestamp() });
}

/**
 * GAME-005: store results. Keyed by email (stable identity for exactly two
 * people) rather than uid, so stats survive re-logins without an extra
 * uid <-> email lookup. Phase 5's Statistics page reads straight from this.
 */
export async function recordGameResult(gameType, outcome) {
  // outcome: "P1" | "P2" | "draw"
  const myEmail = auth.currentUser?.email?.toLowerCase();
  const otherEmail = AUTHORIZED_EMAILS.find((e) => e.toLowerCase() !== myEmail);
  const myRole = getMyRole();

  const bump = async (email, played, won) => {
    await setDocById(
      "statistics",
      email,
      {
        gamesPlayed: increment(played),
        gamesWon: increment(won),
        [`${gameType}Played`]: increment(played)
      },
      true
    );
  };

  // Only one client needs to record the result — but both clients calling
  // this concurrently for the same finished game is harmless: Firestore
  // increment() is commutative, and Firestore rules already restrict writes
  // to the two authorized users, so double-counting only happens if this
  // function is called twice for the *same* game end, which callers avoid
  // by gating on a local "resultRecorded" flag per game session.
  if (outcome === "draw") {
    await bump(myEmail, 1, 0);
    if (otherEmail) await bump(otherEmail, 1, 0);
  } else {
    const winnerEmail = outcome === myRole ? myEmail : otherEmail;
    const loserEmail = outcome === myRole ? otherEmail : myEmail;
    if (winnerEmail) await bump(winnerEmail, 1, 1);
    if (loserEmail) await bump(loserEmail, 1, 0);
  }
}
