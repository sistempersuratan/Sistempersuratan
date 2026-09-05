// ===========================================================
// login.js — Logic khusus halaman index.html (form login)
// ===========================================================

import { login, getUserProfile, logout } from "./auth.js";
import { mapAuthError, setButtonLoading } from "./ui.js";

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const formError = document.getElementById("formError");

function showFormError(message) {
  formError.textContent = message;
  formError.classList.add("show");
}

function clearFormError() {
  formError.textContent = "";
  formError.classList.remove("show");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFormError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showFormError("Email dan password wajib diisi.");
    return;
  }

  setButtonLoading(loginBtn, true, "Masuk");

  try {
    const credential = await login(email, password);
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
      window.location.href = "/admin.html";
    } else {
      window.location.href = "/dashboard.html";
    }
  } catch (error) {
    showFormError(mapAuthError(error));
  } finally {
    setButtonLoading(loginBtn, false, "Masuk");
  }
});
