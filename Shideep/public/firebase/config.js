// ==========================================================================
// Shideep — Firebase Configuration
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAfLH-zL1hDLSpdrnXsMO0Oyyp1J1T7DtI",
  authDomain: "shideep.firebaseapp.com",
  projectId: "shideep",
  storageBucket: "shideep.firebasestorage.app",
  messagingSenderId: "426466891128",
  appId: "1:426466891128:web:40f844b8d03d1a5b85a48d"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export const AUTHORIZED_EMAILS = [
  "rajputmandeep931@gmail.com",
  "dass27296@gmail.com"
];