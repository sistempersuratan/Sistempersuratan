// ===========================================================
// Firebase Config & Init — satu-satunya tempat inisialisasi app
// Semua file lain mengimpor `auth` dan `db` dari sini.
// ===========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAuth, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyARRzO1Hnkau_n-jhCBlkHqvl5p2_NcKEQ",
  authDomain: "sistempersuratantci.firebaseapp.com",
  projectId: "sistempersuratantci",
  storageBucket: "sistempersuratantci.firebasestorage.app",
  messagingSenderId: "523809163124",
  appId: "1:523809163124:web:b781a7d56391a1e3154e21"
};

const app = initializeApp(firebaseConfig);

export { firebaseConfig };
// Login disimpan PER TAB (sessionStorage), bukan per browser. Dengan begitu dua tab
// bisa login sebagai akun berbeda tanpa saling menimpa, dan menutup tab = logout
// (lebih aman di komputer bersama). Untuk "ingat login" lintas tab, ganti
// browserSessionPersistence menjadi browserLocalPersistence.
export const auth = initializeAuth(app, { persistence: browserSessionPersistence });
export const db = getFirestore(app);
