// ===========================================================
// users.js — Logic halaman pages/users.html (role: admin)
// Membuat user baru dari sisi client TANPA mengganggu sesi
// login admin: pakai instance Firebase kedua yang sementara,
// dibuang lagi setelah selesai (auth utama admin tidak disentuh).
// ===========================================================

import { requireAuth, requireRole, logout, getEmailByUsername } from "./auth.js";
import { showToast, setButtonLoading, mapAuthError } from "./ui.js";
import { db, firebaseConfig } from "./firebase-config.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as signOutSecondary
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
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
const fName = document.getElementById("fName");
const fUsername = document.getElementById("fUsername");
const fEmail = document.getElementById("fEmail");
const fPassword = document.getElementById("fPassword");
const fRole = document.getElementById("fRole");
const emailField = document.getElementById("emailField");
const passwordField = document.getElementById("passwordField");
const saveBtn = document.getElementById("saveUserBtn");

let currentAdminUid = null;
let usersCache = [];

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;
  currentAdminUid = user.uid;
  userName.textContent = profile.name || user.email;
  userInitial.textContent = (profile.name || user.email || "?").charAt(0).toUpperCase();
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
    usersCache.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderUsers();
  } catch (error) {
    console.error("Gagal memuat daftar user:", error);
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

function renderUsers() {
  if (usersCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada user.</td></tr>`;
    return;
  }

  tableBody.innerHTML = usersCache.map((u) => `
    <tr>
      <td>${escapeHtml(u.name || "-")}</td>
      <td>${escapeHtml(u.username || "-")}</td>
      <td>${escapeHtml(u.email || "-")}</td>
      <td><span class="badge ${u.role === "admin" ? "admin" : "user"}">${u.role === "admin" ? "Admin" : "User"}</span></td>
      <td><span class="badge ${u.active === false ? "inactive" : "user"}">${u.active === false ? "Nonaktif" : "Aktif"}</span></td>
      <td>
        <div class="row-actions">
          <button class="link-btn" data-action="edit" data-id="${u.id}">Edit</button>
          <button class="link-btn ${u.active === false ? "" : "danger"}" data-action="toggle" data-id="${u.id}">
            ${u.active === false ? "Aktifkan" : "Nonaktifkan"}
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const userData = usersCache.find((u) => u.id === btn.dataset.id);
  if (!userData) return;

  if (btn.dataset.action === "edit") {
    openEditModal(userData);
  } else if (btn.dataset.action === "toggle") {
    toggleActive(userData);
  }
});

// ---------- Toggle aktif/nonaktif ----------

async function toggleActive(userData) {
  if (userData.id === currentAdminUid) {
    showToast("Anda tidak bisa menonaktifkan akun sendiri.", "error");
    return;
  }
  const nextActive = userData.active === false;
  const label = nextActive ? "mengaktifkan" : "menonaktifkan";
  if (!confirm(`Yakin ingin ${label} user "${userData.name || userData.username}"?`)) return;

  try {
    await updateDoc(doc(db, "users", userData.id), {
      active: nextActive,
      updatedAt: serverTimestamp()
    });
    showToast(`User berhasil di-${nextActive ? "aktifkan" : "nonaktifkan"}.`, "success");
    loadUsers();
  } catch (error) {
    console.error("Gagal ubah status user:", error);
    showToast("Gagal menyimpan perubahan. Coba lagi.", "error");
  }
}

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
  clearFormError();
  overlay.classList.add("show");
}

function openEditModal(userData) {
  modalTitle.textContent = "Edit User";
  docIdInput.value = userData.id;
  fName.value = userData.name || "";
  fUsername.value = userData.username || "";
  fEmail.value = userData.email || "";
  fPassword.value = "";
  fRole.value = userData.role === "admin" ? "admin" : "user";

  // Email & password tidak diedit dari sini (butuh alur reauth terpisah) — STEP lanjutan.
  emailField.style.display = "none";
  passwordField.style.display = "none";
  fPassword.required = false;

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
  const name = fName.value.trim();
  const username = fUsername.value.trim();
  const role = fRole.value;

  if (!name || !username) {
    showFormError("Nama dan username wajib diisi.");
    return;
  }

  setButtonLoading(saveBtn, true, "Simpan");

  try {
    // Cek username tidak dipakai user lain
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
        name,
        username,
        role,
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
        name,
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

/**
 * Buat akun Firebase Auth baru lewat instance app SEMENTARA,
 * supaya sesi login admin (auth utama) tidak ikut berpindah.
 */
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
