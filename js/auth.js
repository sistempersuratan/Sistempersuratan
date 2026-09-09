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

export async function getEmailByUsername(username) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().email || null;
}

export async function loginWithUsername(username, password) {
  const email = await getEmailByUsername(username);
  if (!email) {
    const err = new Error("Username tidak ditemukan.");
    err.code = "auth/username-not-found";
    throw err;
  }
  return signInWithEmailAndPassword(auth, email, password);
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await fbSignOut(auth);
  window.location.href = "index.html";
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

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

export function requireRole(profileRole, requiredRole) {
  if (profileRole !== requiredRole) {
    if (profileRole === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "dashboard.html";
    }
    return false;
  }
  return true;
}

function redirectToLogin() {
  const path = window.location.pathname;
  const onLoginPage = path.endsWith("index.html") || path.endsWith("/");
  if (!onLoginPage) {
    window.location.href = "index.html";
  }
}
