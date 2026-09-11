// ===========================================================
// admin.js — Logic halaman admin.html (role: admin)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");
const statUsers = document.getElementById("statUsers");
const statTemplates = document.getElementById("statTemplates");
const statDocs = document.getElementById("statDocs");
const statDocsToday = document.getElementById("statDocsToday");

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;

  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();

  loadStats();
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

async function loadStats() {
  try {
    const snap = await getCountFromServer(collection(db, "users"));
    statUsers.textContent = snap.data().count;
  } catch (error) {
    console.error("Gagal hitung user:", error);
    statUsers.textContent = "-";
  }

  try {
    const snap = await getCountFromServer(collection(db, "templates"));
    statTemplates.textContent = snap.data().count;
  } catch (error) {
    console.error("Gagal hitung template:", error);
    statTemplates.textContent = "-";
  }

  try {
    const docsSnap = await getDocs(collection(db, "documents"));
    const docs = docsSnap.docs.map((d) => d.data());
    statDocs.textContent = docs.length;

    const today = new Date();
    const todayCount = docs.filter((d) => {
      if (!d.createdAt || !d.createdAt.toDate) return false;
      return d.createdAt.toDate().toDateString() === today.toDateString();
    }).length;
    statDocsToday.textContent = todayCount;
  } catch (error) {
    console.error("Gagal hitung dokumen:", error);
    statDocs.textContent = "-";
    statDocsToday.textContent = "-";
  }
}
