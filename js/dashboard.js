// ===========================================================
// dashboard.js — Logic halaman dashboard.html (role: user)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const greeting = document.getElementById("greeting");
const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");
const statTemplates = document.getElementById("statTemplates");
const statMyDocs = document.getElementById("statMyDocs");
const statMonthDocs = document.getElementById("statMonthDocs");

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "user")) return;

  greeting.textContent = `Halo, ${profile.username || "Pengguna"}`;
  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();

  loadStats(user.uid);
});

logoutButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Gagal logout:", error);
      showToast("Gagal keluar. Coba lagi.", "error");
    }
  });
});

async function loadStats(uid) {
  try {
    const snap = await getCountFromServer(query(collection(db, "templates"), where("active", "==", true)));
    statTemplates.textContent = snap.data().count;
  } catch (error) {
    console.error("Gagal hitung template:", error);
    statTemplates.textContent = "-";
  }

  try {
    const docsSnap = await getDocs(query(collection(db, "documents"), where("userId", "==", uid)));
    const docs = docsSnap.docs.map((d) => d.data());
    statMyDocs.textContent = docs.length;

    const now = new Date();
    const monthCount = docs.filter((d) => {
      if (!d.createdAt || !d.createdAt.toDate) return false;
      const dt = d.createdAt.toDate();
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;
    statMonthDocs.textContent = monthCount;
  } catch (error) {
    console.error("Gagal hitung dokumen:", error);
    statMyDocs.textContent = "-";
    statMonthDocs.textContent = "-";
  }
}
