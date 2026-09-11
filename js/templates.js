// ===========================================================
// templates.js — Logic halaman pages/templates.html (role: admin)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");
const tableBody = document.getElementById("templatesTableBody");

let templatesCache = [];

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;
  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();
  loadTemplates();
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

async function loadTemplates() {
  try {
    const snap = await getDocs(collection(db, "templates"));
    templatesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    templatesCache.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderTemplates();
  } catch (error) {
    console.error("Gagal memuat daftar template:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

function renderTemplates() {
  if (templatesCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Belum ada template. Klik "+ Template Baru" untuk membuat.</td></tr>`;
    return;
  }

  tableBody.innerHTML = templatesCache.map((t) => `
    <tr>
      <td>${escapeHtml(t.name || "-")}</td>
      <td>${escapeHtml(t.category || "-")}</td>
      <td>${(t.fields || []).length}</td>
      <td><span class="badge ${t.active === false ? "inactive" : "user"}">${t.active === false ? "Nonaktif" : "Aktif"}</span></td>
      <td>
        <div class="row-actions">
          <a class="link-btn" href="template-editor.html?id=${t.id}">Edit</a>
          <button class="link-btn" data-action="toggle" data-id="${t.id}">
            ${t.active === false ? "Aktifkan" : "Nonaktifkan"}
          </button>
          <button class="link-btn danger" data-action="delete" data-id="${t.id}">Hapus</button>
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
  const tpl = templatesCache.find((t) => t.id === btn.dataset.id);
  if (!tpl) return;

  if (btn.dataset.action === "toggle") {
    toggleActive(tpl);
  } else if (btn.dataset.action === "delete") {
    deleteTemplate(tpl);
  }
});

async function toggleActive(tpl) {
  const nextActive = tpl.active === false;
  try {
    await updateDoc(doc(db, "templates", tpl.id), {
      active: nextActive,
      updatedAt: serverTimestamp()
    });
    showToast(`Template berhasil di-${nextActive ? "aktifkan" : "nonaktifkan"}.`, "success");
    loadTemplates();
  } catch (error) {
    console.error("Gagal ubah status template:", error);
    showToast("Gagal menyimpan perubahan. Coba lagi.", "error");
  }
}

async function deleteTemplate(tpl) {
  if (!confirm(`Yakin ingin menghapus template "${tpl.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await deleteDoc(doc(db, "templates", tpl.id));
    showToast("Template berhasil dihapus.", "success");
    loadTemplates();
  } catch (error) {
    console.error("Gagal hapus template:", error);
    showToast("Gagal menghapus template. Coba lagi.", "error");
  }
}
