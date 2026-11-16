// ===========================================================
// templates.js — Logic halaman pages/templates.html (role: admin)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { openRowMenu, makeRowsClickable } from "./row-menu.js";
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
    tableBody.innerHTML = `<tr><td colspan="4" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

function renderTemplates() {
  if (templatesCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="table-empty">Belum ada jenis dokumen. Klik "+ Jenis Dokumen Baru" untuk membuat.</td></tr>`;
    return;
  }

  tableBody.innerHTML = templatesCache.map((t) => `
    <tr class="row-click" data-id="${t.id}" tabindex="0">
      <td>${escapeHtml(t.name || "-")}</td>
      <td>${escapeHtml(t.category || "-")}</td>
      <td>${(t.fields || []).length}</td>
      <td><span class="badge ${t.active === false ? "inactive" : "user"}">${t.active === false ? "Nonaktif" : "Aktif"}</span></td>
    </tr>
  `).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Klik baris -> popup pilihan: Edit / Aktifkan-Nonaktifkan / Hapus.
makeRowsClickable(tableBody, (id) => {
  const tpl = templatesCache.find((t) => t.id === id);
  if (!tpl) return;
  openRowMenu({
    title: tpl.name || "Jenis dokumen",
    meta: `${tpl.category || "-"} · ${(tpl.fields || []).length} isian · ${tpl.active === false ? "Nonaktif" : "Aktif"}`,
    sections: [{
      items: [
        { label: "Edit jenis dokumen", primary: true, onClick: () => { window.location.href = `template-editor.html?id=${tpl.id}`; } },
        { label: tpl.active === false ? "Aktifkan" : "Nonaktifkan", onClick: () => toggleActive(tpl) },
        { label: "Hapus jenis dokumen", danger: true, onClick: () => deleteTemplate(tpl) }
      ]
    }]
  });
});

async function toggleActive(tpl) {
  const nextActive = tpl.active === false;
  try {
    await updateDoc(doc(db, "templates", tpl.id), {
      active: nextActive,
      updatedAt: serverTimestamp()
    });
    showToast(`Jenis dokumen berhasil di-${nextActive ? "aktifkan" : "nonaktifkan"}.`, "success");
    loadTemplates();
  } catch (error) {
    console.error("Gagal ubah status template:", error);
    showToast("Gagal menyimpan perubahan. Coba lagi.", "error");
  }
}

async function deleteTemplate(tpl) {
  if (!confirm(`Yakin ingin menghapus jenis dokumen "${tpl.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  try {
    await deleteDoc(doc(db, "templates", tpl.id));
    showToast("Jenis dokumen berhasil dihapus.", "success");
    loadTemplates();
  } catch (error) {
    console.error("Gagal hapus template:", error);
    showToast("Gagal menghapus jenis dokumen. Coba lagi.", "error");
  }
}
