// ===========================================================
// profile.js — Logic halaman pages/profile.html (admin & user)
// Menampilkan info akun dan mengubah password sendiri.
// Ubah password butuh login ulang (reauthenticate) dengan
// password saat ini — aturan keamanan bawaan Firebase.
// ===========================================================

import { requireAuth, logout } from "./auth.js";
import { showToast, setButtonLoading } from "./ui.js";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const navDashboardLinks = document.querySelectorAll(".nav-dashboard-link");
const adminOnlyEls = document.querySelectorAll(".admin-only");
const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const userRoleBadge = document.getElementById("userRoleBadge");
const logoutButtons = document.querySelectorAll(".js-logout");

const infoUsername = document.getElementById("infoUsername");
const infoEmail = document.getElementById("infoEmail");
const infoRole = document.getElementById("infoRole");

const form = document.getElementById("passwordForm");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const saveBtn = document.getElementById("savePasswordBtn");
const errorBox = document.getElementById("passwordError");

let currentUser = null;

requireAuth((user, profile) => {
  currentUser = user;
  const isAdmin = profile.role === "admin";

  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();
  userRoleBadge.textContent = isAdmin ? "Admin" : "User";
  userRoleBadge.className = `badge ${isAdmin ? "admin" : "user"}`;

  infoUsername.value = profile.username || "-";
  infoEmail.value = profile.email || user.email || "-";
  infoRole.value = isAdmin ? "Admin" : "User";

  if (isAdmin) adminOnlyEls.forEach((el) => (el.style.display = ""));

  navDashboardLinks.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isAdmin ? "../admin.html" : "../dashboard.html";
    });
  });
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

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("show");
}
function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("show");
}

function mapPasswordError(error) {
  switch (error && error.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Password saat ini salah.";
    case "auth/weak-password":
      return "Password baru terlalu lemah (minimal 6 karakter).";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
    case "auth/requires-recent-login":
      return "Sesi sudah terlalu lama. Keluar lalu masuk lagi, kemudian ulangi.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Periksa internet Anda.";
    default:
      console.error("Gagal ubah password:", error);
      return "Terjadi kesalahan. Silakan coba lagi.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const current = currentPassword.value;
  const next = newPassword.value;
  const confirm = confirmPassword.value;

  if (!current || !next || !confirm) {
    showError("Semua kolom wajib diisi.");
    return;
  }
  if (next.length < 6) {
    showError("Password baru minimal 6 karakter.");
    return;
  }
  if (next !== confirm) {
    showError("Konfirmasi password baru tidak sama.");
    return;
  }
  if (next === current) {
    showError("Password baru harus berbeda dari password saat ini.");
    return;
  }

  setButtonLoading(saveBtn, true, "Simpan Password");
  try {
    const credential = EmailAuthProvider.credential(currentUser.email, current);
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, next);
    form.reset();
    showToast("Password berhasil diubah.", "success");
  } catch (error) {
    showError(mapPasswordError(error));
  } finally {
    setButtonLoading(saveBtn, false, "Simpan Password");
  }
});
