// ==========================================================================
// Shideep — ICE Servers Config
// STUN handles the majority of calls for free with zero signup (Google's
// public servers). TURN is only needed as a fallback for the minority of
// networks where a direct connection can't be established (symmetric NAT,
// strict firewalls) — calls will still mostly work without it, but adding
// a free TURN relay makes it reliable everywhere.
//
// To add free TURN (optional but recommended):
//   1. Sign up free at https://www.metered.ca/tools/openrelay/ (20GB/month
//      free, no credit card)
//   2. Copy your API key from the dashboard
//   3. Replace the placeholder values below with your real turn: URLs,
//      username, and credential from that dashboard
// ==========================================================================
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },

  // --- Optional free TURN relay (fill in after signing up — see above) ---
  // { urls: "turn:a.relay.metered.ca:80", username: "YOUR_USERNAME", credential: "YOUR_CREDENTIAL" },
  // { urls: "turn:a.relay.metered.ca:443", username: "YOUR_USERNAME", credential: "YOUR_CREDENTIAL" }
];
