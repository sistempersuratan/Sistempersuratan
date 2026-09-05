// ===========================================================
// dashboard.js — Logic halaman dashboard.html (role: user)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";

const greeting = document.getElementById("greeting");
const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutBtn = document.getElementById("logoutBtn");
const statTemplates = document.getElementById("statTemplates");
const statMyDocs = document.getElementById("statMyDocs");
const statMonthDocs = document.getElementById("statMonthDocs");

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "user")) return;

  greeting.textContent = `Halo, ${profile.name || "Pengguna"}`;
  userName.textContent = profile.name || user.email;
  userInitial.textContent = (profile.name || user.email || "?").charAt(0).toUpperCase();

  // Placeholder — akan diisi data asli setelah STEP 3-5 (template & dokumen).
  statTemplates.textContent = "0";
  statMyDocs.textContent = "0";
  statMonthDocs.textContent = "0";
});

logoutBtn.addEventListener("click", async () => {
  try {
    await logout();
  } catch (error) {
    console.error("Gagal logout:", error);
    showToast("Gagal keluar. Coba lagi.", "error");
  }
});
