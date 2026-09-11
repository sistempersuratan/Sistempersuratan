// ===========================================================
// admin.js — Logic halaman admin.html (role: admin)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";

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
  // Placeholder — akan diisi query Firestore asli setelah STEP 2 (user management).
  
  statUsers.textContent = "0";
  statTemplates.textContent = "0";
  statDocs.textContent = "0";
  statDocsToday.textContent = "0";
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
