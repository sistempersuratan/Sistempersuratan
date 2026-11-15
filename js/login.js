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
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const togglePassword = document.getElementById("togglePassword"); // Tombol ikon mata

function showFormError(message) {
  formError.textContent = message;
  formError.classList.add("show");
}

function clearFormError() {
  formError.textContent = "";
  formError.classList.remove("show");
}

// ===========================================================
// Handler Tombol Lihat/Sembunyikan Password (Ikon Mata SVG)
// ===========================================================
if (togglePassword && passwordInput) {
  togglePassword.addEventListener("click", function () {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
    
    // Mengganti bentuk SVG ikon mata berdasarkan status text/password
    if (type === "password") {
      // Ikon Mata Normal (Tertutup / Tersembunyi)
      togglePassword.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
    } else {
      // Ikon Mata Dicoret (Terbuka / Terlihat)
      togglePassword.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
    }
  });
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
