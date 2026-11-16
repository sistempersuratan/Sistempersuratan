// ===========================================================
// admin.js — Halaman admin.html (role: admin)
// Tampilan ada di dashboard-view.js (dipakai bersama dashboard user).
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { renderDashboard } from "./dashboard-view.js";

const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;

  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();

  renderDashboard(document.getElementById("dashboardRoot"), { role: "admin", uid: user.uid });
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
