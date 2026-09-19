// ==========================================================================
// IUDEX — Firebase Configuration
// Single source of truth for the Firebase SDK handles used app-wide.
//
// NOTE: there is deliberately no authorized-email list here any more.
// IUDEX is a public, username-based messenger — anyone may create an
// account. Access control lives entirely in firestore.rules, scoped by
// `request.auth.uid`, which is the only place it can actually be enforced.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsCF40h_NLkXccTle11jY1SwtVeoIjXVQ",
  authDomain: "iudex-34b6f.firebaseapp.com",
  projectId: "iudex-34b6f",
  storageBucket: "iudex-34b6f.firebasestorage.app",
  messagingSenderId: "1095715531260",
  appId: "1:1095715531260:web:f4a3823925b1bb19ef2a79"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
// Always let the user pick which Google account — otherwise Chrome silently
// reuses the last one, which is confusing on a shared/second account.
googleProvider.setCustomParameters({ prompt: "select_account" });
