// ===========================================================
// auth.js — Logic autentikasi & pengecekan role
// Dipakai bersama oleh login.js, dashboard.js, admin.js, dll.
// Frontend guard di sini HANYA untuk UX (redirect cepat).
// Keamanan sesungguhnya tetap di Firestore Security Rules.
// ===========================================================

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Cari email pemilik sebuah username di collection `users`.
 * Firebase Authentication tetap berbasis email+password di balik layar —
 * ini hanya jembatan supaya user login pakai username.
 *
 * @param {string} username
 * @returns {Promise<string|null>} email jika ditemukan, null jika tidak
 */
export async function getEmailByUsername(username) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().email || null;
}

/**
 * Login dengan username & password.
 * Di belakang layar tetap memakai Firebase Authentication (email+password):
 * username dipetakan ke email lebih dulu lewat Firestore.
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function loginWithUsername(username, password) {
  const email = await getEmailByUsername(username);
  if (!email) {
    const err = new Error("Username tidak ditemukan.");
    err.code = "auth/username-not-found";
    throw err;
  }
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Login dengan email & password secara langsung.
 * Dipertahankan untuk keperluan internal/skrip (mis. re-auth admin),
 * halaman login publik memakai loginWithUsername().
 * @returns {Promise<import('firebase/auth').UserCredential>}
 */
export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Logout user yang sedang aktif. */
export async function logout() {
  await fbSignOut(auth);
  window.location.href = "/index.html";
}

/**
 * Ambil dokumen profil user dari Firestore (users/{uid}).
 * @returns {Promise<object|null>} data profil, atau null jika tidak ada
 */
export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * Jalankan callback setiap kali status login berubah.
 * Membungkus onAuthStateChanged bawaan Firebase.
 */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Wajibkan user sudah login & profilnya aktif.
 * Jika tidak, redirect ke halaman login.
 * Gunakan di awal setiap halaman terproteksi (dashboard, admin).
 *
 * @param {(user: import('firebase/auth').User, profile: object) => void} onReady
 *        dipanggil dengan (user, profile) jika lolos semua pengecekan
 */
export function requireAuth(onReady) {
  watchAuthState(async (user) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    let profile;
    try {
      profile = await getUserProfile(user.uid);
    } catch (err) {
      console.error("Gagal mengambil profil user:", err);
      redirectToLogin();
      return;
    }

    if (!profile) {
      console.error("Profil user tidak ditemukan di Firestore.");
      await logout();
      return;
    }

    if (profile.active === false) {
      alert("Akun Anda telah dinonaktifkan. Hubungi admin.");
      await logout();
      return;
    }

    onReady(user, profile);
  });
}

/**
 * Wajibkan role tertentu untuk mengakses halaman ini.
 * Panggil di dalam callback requireAuth().
 *
 * @param {string} profileRole role user saat ini
 * @param {string} requiredRole role yang dibutuhkan halaman ini
 */
export function requireRole(profileRole, requiredRole) {
  if (profileRole !== requiredRole) {
    if (profileRole === "admin") {
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/dashboard.html";
    }
    return false;
  }
  return true;
}

function redirectToLogin() {
  if (!window.location.pathname.endsWith("index.html") && window.location.pathname !== "/") {
    window.location.href = "/index.html";
  }
}
