// ==========================================================================
// IUDEX — Firebase Configuration
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

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
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const AUTHORIZED_EMAILS = [
  "sharvilm112@gmail.com",
  "user2@example.com"
];