// ===========================================================
// users.js — Logic halaman pages/users.html (role: admin)
// Membuat user baru dari sisi client TANPA mengganggu sesi
// login admin: pakai instance Firebase kedua yang sementara,
// dibuang lagi setelah selesai (auth utama admin tidak disentuh).
// ===========================================================

import { requireAuth, requireRole, logout, getEmailByUsername } from "./auth.js";
import { showToast, setButtonLoading, mapAuthError } from "./ui.js";
import { openRowMenu, makeRowsClickable } from "./row-menu.js";
import { auth, db, firebaseConfig } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as signOutSecondary
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");
const tableBody = document.getElementById("usersTableBody");

const overlay = document.getElementById("userModalOverlay");
const modalTitle = document.getElementById("userModalTitle");
const form = document.getElementById("userForm");
const formError = document.getElementById("userFormError");
const docIdInput = document.getElementById("userDocId");
const fUsername = document.getElementById("fUsername");
const fEmail = document.getElementById("fEmail");
const fPassword = document.getElementById("fPassword");
const fRole = document.getElementById("fRole");
const emailField = document.getElementById("emailField");
const passwordField = document.getElementById("passwordField");
const saveBtn = document.getElementById("saveUserBtn");
const fActive = document.getElementById("fActive");
const activeField = document.getElementById("activeField");
const resetField = document.getElementById("resetField");
const resetPwBtn = document.getElementById("resetPwBtn");

let currentAdminUid = null;
let usersCache = [];

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;
  currentAdminUid = user.uid;
  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();
  loadUsers();
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

// ---------- Load & render daftar user ----------

async function loadUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    usersCache.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    renderUsers();
  } catch (error) {
    console.error("Gagal memuat daftar user:", error);
    tableBody.innerHTML = `<tr><td colspan="4" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

function renderUsers() {
  if (usersCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="table-empty">Belum ada user.</td></tr>`;
    return;
  }

  tableBody.innerHTML = usersCache.map((u) => `
    <tr class="row-click" data-id="${u.id}" tabindex="0">
      <td>${escapeHtml(u.username || "-")}</td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td><span class="badge ${u.role === "admin" ? "admin" : "user"}">${u.role === "admin" ? "Admin" : "User"}</span></td>
      <td><span class="badge ${u.active === false ? "inactive" : "user"}">${u.active === false ? "Nonaktif" : "Aktif"}</span></td>
    </tr>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Klik baris -> popup pilihan: Edit akun / Hapus akun.
makeRowsClickable(tableBody, (id) => {
  const userData = usersCache.find((u) => u.id === id);
  if (userData) openUserMenu(userData);
});

function openUserMenu(userData) {
  const isSelf = userData.id === currentAdminUid;
  openRowMenu({
    title: userData.username || "Akun",
    meta: `${userData.email || "-"} · ${userData.role === "admin" ? "Admin" : "User"} · ${userData.active === false ? "Nonaktif" : "Aktif"}`,
    sections: [{
      items: [
        { label: "Edit akun", primary: true, onClick: () => openEditModal(userData) },
        { label: isSelf ? "Hapus akun (tidak bisa menghapus akun sendiri)" : "Hapus akun", danger: true, disabled: isSelf, onClick: () => deleteUser(userData) }
      ]
    }]
  });
}

// ---------- Reset password (kirim email tautan reset) ----------

async function resetPassword(userData) {
  if (!userData.email) {
    showToast("User ini tidak punya email.", "error");
    return;
  }
  if (!confirm(`Kirim email reset password ke ${userData.email}?`)) return;
  try {
    await sendPasswordResetEmail(auth, userData.email);
    showToast(`Email reset password dikirim ke ${userData.email}.`, "success");
  } catch (error) {
    console.error("Gagal kirim email reset password:", error);
    showToast("Gagal mengirim email reset. Pastikan email user valid.", "error");
  }
}

// ---------- Hapus akun ----------
// Menghapus PROFIL user di Firestore: user tidak bisa login lagi (aplikasi menolak akun tanpa
// profil, dan username-nya tidak ditemukan saat login). Dokumen yang pernah dibuatnya tetap ada.
// Akun login Firebase Authentication TIDAK ikut terhapus karena tidak bisa dilakukan dari browser;
// hapus manual di Firebase Console > Authentication bila emailnya mau dipakai lagi.
// Untuk menutup akses sementara dan masih bisa dibuka lagi, pakai status Nonaktif di Edit akun.

async function deleteUser(userData) {
  if (userData.id === currentAdminUid) {
    showToast("Anda tidak bisa menghapus akun sendiri.", "error");
    return;
  }
  const activeAdmins = usersCache.filter((u) => u.role === "admin" && u.active !== false);
  if (userData.role === "admin" && userData.active !== false && activeAdmins.length <= 1) {
    showToast("Tidak bisa menghapus admin aktif terakhir.", "error");
    return;
  }
  const ok = confirm(
    `Hapus akun "${userData.username}"?\n\n` +
    `• Akun ini tidak bisa login lagi dan tidak bisa dipulihkan.\n` +
    `• Dokumen yang pernah dibuatnya tidak ikut terhapus.\n` +
    `• Email ${userData.email || ""} baru bisa dipakai untuk akun baru setelah dihapus manual di Firebase Console (Authentication).\n\n` +
    `Jika hanya ingin menutup akses sementara, pilih Edit akun lalu ubah status menjadi Nonaktif.`
  );
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "users", userData.id));
    showToast("Akun berhasil dihapus.", "success");
    loadUsers();
  } catch (error) {
    console.error("Gagal menghapus akun:", error);
    showToast("Gagal menghapus akun. Coba lagi.", "error");
  }
}

resetPwBtn.addEventListener("click", () => {
  const current = usersCache.find((u) => u.id === docIdInput.value);
  if (current) resetPassword(current);
});

// ---------- Modal: buka untuk tambah / edit ----------

document.getElementById("openAddUserBtn").addEventListener("click", () => {
  openAddModal();
});
document.getElementById("cancelUserBtn").addEventListener("click", closeModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeModal();
});

function openAddModal() {
  modalTitle.textContent = "Tambah User";
  docIdInput.value = "";
  form.reset();
  emailField.style.display = "";
  passwordField.style.display = "";
  fEmail.disabled = false;
  fPassword.required = true;
  activeField.style.display = "none";
  resetField.style.display = "none";
  fRole.disabled = false;
  fActive.disabled = false;
  clearFormError();
  overlay.classList.add("show");
}

function openEditModal(userData) {
  modalTitle.textContent = "Edit User";
  docIdInput.value = userData.id;
  fUsername.value = userData.username || "";
  fEmail.value = userData.email || "";
  fPassword.value = "";
  fRole.value = userData.role === "admin" ? "admin" : "user";

  // Email & password tidak diedit dari sini (butuh alur reauth terpisah) — STEP lanjutan.
  emailField.style.display = "none";
  passwordField.style.display = "none";
  fPassword.required = false;

  // Status akun (aktif/nonaktif) dan reset password dipindah ke sini dari kolom tabel.
  fActive.value = userData.active === false ? "inactive" : "active";
  activeField.style.display = "";
  resetField.style.display = userData.email ? "" : "none";
  // Akun sendiri: role dan status dikunci agar admin tidak mengunci dirinya sendiri.
  const isSelf = userData.id === currentAdminUid;
  fRole.disabled = isSelf;
  fActive.disabled = isSelf;

  clearFormError();
  overlay.classList.add("show");
}

function closeModal() {
  overlay.classList.remove("show");
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.add("show");
}
function clearFormError() {
  formError.textContent = "";
  formError.classList.remove("show");
}

// ---------- Submit form (tambah atau edit) ----------

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFormError();

  const isEdit = !!docIdInput.value;
  const username = fUsername.value.trim();
  const role = fRole.value;

  if (!username) {
    showFormError("Username wajib diisi.");
    return;
  }

  setButtonLoading(saveBtn, true, "Simpan");

  try {
    const existingEmail = await getEmailByUsername(username);
    if (isEdit) {
      const current = usersCache.find((u) => u.id === docIdInput.value);
      if (existingEmail && current && username !== current.username) {
        showFormError("Username sudah dipakai user lain.");
        setButtonLoading(saveBtn, false, "Simpan");
        return;
      }
    } else if (existingEmail) {
      showFormError("Username sudah dipakai user lain.");
      setButtonLoading(saveBtn, false, "Simpan");
      return;
    }

    if (isEdit) {
      await updateDoc(doc(db, "users", docIdInput.value), {
        username,
        role,
        active: fActive.value !== "inactive",
        updatedAt: serverTimestamp()
      });
      showToast("Perubahan user disimpan.", "success");
    } else {
      const email = fEmail.value.trim();
      const password = fPassword.value;
      if (!email || password.length < 6) {
        showFormError("Email wajib diisi dan password minimal 6 karakter.");
        setButtonLoading(saveBtn, false, "Simpan");
        return;
      }

      const uid = await createAuthUserWithoutSwitchingSession(email, password);

      await setDoc(doc(db, "users", uid), {
        username,
        email,
        role,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("User baru berhasil dibuat.", "success");
    }

    closeModal();
    loadUsers();
  } catch (error) {
    showFormError(mapAuthError(error));
  } finally {
    setButtonLoading(saveBtn, false, "Simpan");
  }
});

async function createAuthUserWithoutSwitchingSession(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, "Secondary-" + Date.now());
  try {
    const secondaryAuth = getAuth(secondaryApp);
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = credential.user.uid;
    await signOutSecondary(secondaryAuth);
    return uid;
  } finally {
    await deleteApp(secondaryApp);
  }
}
