// ===========================================================
// Firebase Config & Init — satu-satunya tempat inisialisasi app
// Semua file lain mengimpor `auth` dan `db` dari sini.
// ===========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: ganti dengan konfigurasi project Firebase Anda sendiri.
// Ambil dari: Firebase Console > Project Settings > General > Your apps > SDK setup and configuration
const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI.firebaseapp.com",
  projectId: "GANTI_PROJECT_ID",
  storageBucket: "GANTI.appspot.com",
  messagingSenderId: "GANTI_SENDER_ID",
  appId: "GANTI_APP_ID"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
