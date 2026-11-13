// ===========================================================
// login.js — Logic khusus halaman index.html (form login)
// ===========================================================

import { loginWithUsername, getUserProfile, logout, resetPassword } from "./auth.js";
import { mapAuthError, setButtonLoading } from "./ui.js";

const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const formError = document.getElementById("formError");
const forgotPasswordLink = document.getElementById("forgotPasswordLink"); // <-- Tambahkan ini

function showFormError(message) {
  formError.textContent = message;
  formError.classList.add("show");
}

function clearFormError() {
  formError.textContent = "";
  formError.classList.remove("show");
}

// Handler Submit Login
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFormError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showFormError("Username dan password wajib diisi.");
    return;
  }

  setButtonLoading(loginBtn, true, "Masuk");

  try {
    const credential = await loginWithUsername(username, password);
    const profile = await getUserProfile(credential.user.uid);

    if (!profile) {
      showFormError("Akun ditemukan tapi profil belum terdaftar. Hubungi admin.");
      await logout();
      return;
    }

    if (profile.active === false) {
      showFormError("Akun Anda telah dinonaktifkan. Hubungi admin.");
      await logout();
      return;
    }

    if (profile.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "dashboard.html";
    }
  } catch (error) {
    showFormError(mapAuthError(error));
  } finally {
    setButtonLoading(loginBtn, false, "Masuk");
  }
});

// ===========================================================
// Handler Klik Lupa Password
// ===========================================================
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    clearFormError();

    // Meminta user memasukkan email mereka
    const emailInput = prompt("Masukkan alamat email akun kamu untuk mereset password:");
    
    if (!emailInput) return;

    try {
      await resetPassword(emailInput.trim());
      alert("Link reset password berhasil dikirim! Silakan periksa kotak masuk atau folder spam di email kamu.");
    } catch (error) {
      alert("Gagal mengirim email reset: " + mapAuthError(error));
    }
  });
}
