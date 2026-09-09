// ===========================================================
// ui.js — Helper UI kecil yang dipakai berulang di banyak halaman
// (toast notification, loading state tombol).
// ===========================================================

/**
 * Tampilkan toast notification di pojok kanan atas.
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
export function showToast(message, type = "info") {
  const stack = document.getElementById("toastStack");
  if (!stack) {
    console.warn("toastStack tidak ditemukan di halaman ini.");
    return;
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type === "info" ? "" : type}`.trim();
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/**
 * Set state loading pada tombol (disable + tampilkan spinner).
 * @param {HTMLButtonElement} btn
 * @param {boolean} isLoading
 * @param {string} idleText teks tombol saat tidak loading
 * @param {string} loadingText teks tombol saat loading
 */
export function setButtonLoading(btn, isLoading, idleText, loadingText = "Memproses...") {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading
    ? `<span class="spinner"></span><span>${loadingText}</span>`
    : idleText;
}

/** Pemetaan kode error Firebase Auth ke pesan ramah pengguna. */
export function mapAuthError(error) {
  const code = error && error.code ? error.code : "";
  switch (code) {
    case "auth/username-not-found":
    case "auth/invalid-email":
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Username atau password salah.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
    case "auth/network-request-failed":
      return "Koneksi bermasalah. Periksa internet Anda.";
    default:
      console.error("Firebase auth error:", error);
      return "Terjadi kesalahan. Silakan coba lagi.";
  }
}
