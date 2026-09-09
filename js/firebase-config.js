// ===========================================================
// Firebase Config & Init — satu-satunya tempat inisialisasi app
// Semua file lain mengimpor `auth` dan `db` dari sini.
// ===========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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

export const auth = getAuth(app);
export const db = getFirestore(app);
