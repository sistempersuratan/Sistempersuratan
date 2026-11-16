// ===========================================================
// dashboard.js — Halaman dashboard.html (role: user)
// Tampilan ada di dashboard-view.js (dipakai bersama dashboard admin).
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { renderDashboard } from "./dashboard-view.js";

const greeting = document.getElementById("greeting");
const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "user")) return;

  greeting.textContent = `Halo, ${profile.username || "Pengguna"}`;
  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();

  renderDashboard(document.getElementById("dashboardRoot"), { role: "user", uid: user.uid });
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
