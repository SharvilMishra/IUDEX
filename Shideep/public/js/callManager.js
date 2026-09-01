// ==========================================================================
// IUDEX — Call Manager (shell singleton)
// Owns the RTCPeerConnection and microphone stream for the lifetime of the
// session, same pattern as musicPlayer.js — so a call survives navigating
// to another page. The full-screen overlay (components/callOverlay.js)
// subscribes to the state this module broadcasts and never touches
// WebRTC or Firestore directly.
// ==========================================================================
import { showToast } from "../components/toast.js";
import { ICE_SERVERS } from "./iceServers.js";
import {
  subscribeCall, ensureCallRoom, placeCall, acceptCall, endCall,
  pushCandidate, myEmail, partnerEmail
} from "./callSync.js";
import { auth } from "../firebase/config.js";

let pc = null;
let localStream = null;
let remoteAudioEl = null;
let call = { status: "idle" };
let mySide = null; // "caller" | "callee" for the current session
let processedCaller = 0;
let processedCallee = 0;
let currentSessionKey = null; // dedupes re-processing the same call
let callStartedAtMs = null;
let muted = false;

const listeners = new Set();

function broadcast() {
  const snapshot = {
    status: call.status,
    mySide,
    callerName: call.callerName,
    isMe: call.callerEmail === myEmail() || call.calleeEmail === myEmail(),
    muted,
    durationSec: callStartedAtMs ? Math.floor((Date.now() - callStartedAtMs) / 1000) : 0
  };
  listeners.forEach((fn) => {
    try { fn(snapshot); } catch (e) { console.warn("[callManager] listener error:", e); }
  });
}

export function subscribeCallState(fn) {
  listeners.add(fn);
  fn({
    status: call.status,
    mySide,
    callerName: call.callerName,
    isMe: true,
    muted,
    durationSec: 0
  });
  return () => listeners.delete(fn);
}

let durationTimer = null;
function startDurationTimer() {
  stopDurationTimer();
  callStartedAtMs = Date.now();
  durationTimer = setInterval(broadcast, 1000);
}
function stopDurationTimer() {
  if (durationTimer) clearInterval(durationTimer);
  durationTimer = null;
  callStartedAtMs = null;
}

function teardownPeerConnection() {
  stopDurationTimer();
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (pc) {
    pc.close();
    pc = null;
  }
  if (remoteAudioEl) remoteAudioEl.srcObject = null;
  mySide = null;
  processedCaller = 0;
  processedCallee = 0;
  muted = false;
}

function createPeerConnection(side) {
  const conn = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  conn.onicecandidate = (e) => {
    if (e.candidate) pushCandidate(side, e.candidate.toJSON());
  };
  conn.ontrack = (e) => {
    if (remoteAudioEl) {
      remoteAudioEl.srcObject = e.streams[0];
      remoteAudioEl.play().catch(() => { /* autoplay may need a tap — user already tapped Accept/Call */ });
    }
  };
  conn.onconnectionstatechange = () => {
    if (["failed", "disconnected"].includes(conn.connectionState) && call.status === "active") {
      showToast("Call connection lost.", "error");
    }
  };
  return conn;
}

async function getMic() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err) {
    showToast("Couldn't access your microphone — check permissions.", "error");
    throw err;
  }
}

/** Process any newly-arrived ICE candidates from the *other* side. */
function processIncomingCandidates(doc) {
  if (!pc) return;
  if (mySide === "caller") {
    const fresh = (doc.calleeCandidates || []).slice(processedCallee);
    fresh.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
    processedCallee = (doc.calleeCandidates || []).length;
  } else if (mySide === "callee") {
    const fresh = (doc.callerCandidates || []).slice(processedCaller);
    fresh.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
    processedCaller = (doc.callerCandidates || []).length;
  }
}

async function onCallDocChange(doc) {
  if (!doc) return;
  const wasStatus = call.status;
  call = doc;

  const me = myEmail();
  const iAmCallee = doc.calleeEmail === me;
  const iAmCaller = doc.callerEmail === me;

  if (doc.status === "idle") {
    if (wasStatus !== "idle") teardownPeerConnection();
    broadcast();
    return;
  }

  if (doc.status === "ringing" && iAmCallee && !pc) {
    // Incoming call — just show the overlay; peer connection is created on Accept.
    mySide = "callee";
    broadcast();
    return;
  }

  if (doc.status === "ringing" && iAmCaller) {
    broadcast();
    return;
  }

  if (doc.status === "active" && iAmCaller && pc && !pc.currentRemoteDescription && doc.answer) {
    await pc.setRemoteDescription(new RTCSessionDescription(doc.answer));
    startDurationTimer();
  }

  if (pc) processIncomingCandidates(doc);
  broadcast();
}

/** Start a call to your partner. */
export async function startCall() {
  if (call.status !== "idle") {
    showToast("Already on a call.", "error");
    return;
  }
  try {
    mySide = "caller";
    localStream = await getMic();
    pc = createPeerConnection("caller");
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const name = (auth.currentUser?.displayName || "").split(" ")[0] || "Partner";
    await placeCall({
      callerName: name,
      calleeEmail: partnerEmail(),
      offer: { type: offer.type, sdp: offer.sdp }
    });
    broadcast();
  } catch (err) {
    teardownPeerConnection();
    showToast("Couldn't start the call.", "error");
  }
}

/** Accept an incoming call. */
export async function acceptIncomingCall() {
  if (!call.offer) return;
  try {
    localStream = await getMic();
    pc = createPeerConnection("callee");
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

    await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
    processIncomingCandidates(call);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await acceptCall({ type: answer.type, sdp: answer.sdp });
    startDurationTimer();
    broadcast();
  } catch (err) {
    teardownPeerConnection();
    showToast("Couldn't answer the call.", "error");
    endCall().catch(() => {});
  }
}

/** Decline an incoming call, or cancel one you just placed, or hang up an active one. */
export async function hangUp() {
  teardownPeerConnection();
  try {
    await endCall();
  } catch { /* room may already be idle */ }
  broadcast();
}

export function toggleMute() {
  if (!localStream) return;
  muted = !muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  broadcast();
}

let initialized = false;
/** Called once from app.js when the shell mounts. */
export function initCallManager(remoteAudioElId) {
  if (initialized) return;
  initialized = true;
  remoteAudioEl = document.getElementById(remoteAudioElId);
  ensureCallRoom().catch(() => {});
  subscribeCall(onCallDocChange);
}
