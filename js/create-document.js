// ===========================================================
// create-document.js — Logic halaman pages/create-document.html
// Bisa diakses admin & user (requireAuth polos, tanpa requireRole).
// ===========================================================

import { requireAuth, logout } from "./auth.js";
import { showToast, setButtonLoading } from "./ui.js";
import { renderTemplate, markNumberPlaceholder } from "./template-engine.js";

// {{nomor_surat}} diisi sistem saat rilis, jadi field bernama itu tidak ditampilkan di form
// (menjaga template lama yang masih punya field tersebut tetap aman).
const withoutSystemFields = (t) => ({ ...t, fields: (t.fields || []).filter((f) => f.name !== "nomor_surat") });
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const navDashboardLinks = document.querySelectorAll(".nav-dashboard-link");
const adminOnlyLinks = document.querySelectorAll(".admin-only");
const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const userRoleBadge = document.getElementById("userRoleBadge");
const logoutButtons = document.querySelectorAll(".js-logout");

const templateSelect = document.getElementById("templateSelect");
const formPanel = document.getElementById("formPanel");
const formTitle = document.getElementById("formTitle");
const formDescription = document.getElementById("formDescription");
const documentForm = document.getElementById("documentForm");
const previewBtn = document.getElementById("previewBtn");
const saveBtn = document.getElementById("saveBtn");
const previewPanel = document.getElementById("previewPanel");
const previewArea = document.getElementById("previewArea");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

// Mode edit: create-document.html?edit=<id dokumen>
const editId = new URLSearchParams(window.location.search).get("edit");
let editingDocument = null;

let templatesCache = [];
let currentUser = null;
let currentProfile = null;
let selectedTemplate = null;

requireAuth((user, profile) => {
  currentUser = user;
  currentProfile = profile;

  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();
  userRoleBadge.textContent = profile.role === "admin" ? "Admin" : "User";
  userRoleBadge.className = `badge ${profile.role === "admin" ? "admin" : "user"}`;

  navDashboardLinks.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = currentProfile.role === "admin" ? "../admin.html" : "../dashboard.html";
    });
  });

  if (profile.role === "admin") {
    adminOnlyLinks.forEach((el) => (el.style.display = ""));
  }

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
    templatesCache = snap.docs
      .map((d) => withoutSystemFields({ id: d.id, ...d.data() }))
      .filter((t) => t.active !== false);
    templatesCache.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderTemplateOptions();
    if (editId) await startEditMode();
  } catch (error) {
    console.error("Gagal memuat daftar template:", error);
    templateSelect.innerHTML = `<option value="">Gagal memuat template</option>`;
    showToast("Gagal memuat daftar template. Coba refresh halaman.", "error");
  }
}

async function startEditMode() {
  try {
    const snap = await getDoc(doc(db, "documents", editId));
    if (!snap.exists()) {
      showToast("Dokumen tidak ditemukan.", "error");
      return;
    }
    const d = { id: snap.id, ...snap.data() };

    if (d.userId !== currentUser.uid || (d.status || "draft") !== "draft") {
      showToast("Hanya draft milik sendiri yang bisa diedit.", "error");
      setTimeout(() => (window.location.href = "documents.html"), 1200);
      return;
    }

    let tpl = templatesCache.find((t) => t.id === d.templateId);
    if (!tpl) {
      const tSnap = await getDoc(doc(db, "templates", d.templateId));
      if (!tSnap.exists()) {
        showToast("Template dokumen ini sudah dihapus, dokumen tidak bisa diedit.", "error");
        return;
      }
      tpl = withoutSystemFields({ id: tSnap.id, ...tSnap.data() });
      templatesCache.push(tpl);
      renderTemplateOptions();
    }

    editingDocument = d;
    templateSelect.value = tpl.id;
    templateSelect.disabled = true;
    templateSelect.dispatchEvent(new Event("change"));

    // isi form dengan data lama
    for (const f of tpl.fields || []) {
      const el = document.getElementById(`field_${f.name}`);
      if (el && d.data && d.data[f.name] !== undefined) el.value = d.data[f.name];
    }

    pageTitle.textContent = "Edit Dokumen";
    pageSubtitle.textContent = "Ubah isian, lalu simpan. Setelah itu bisa diajukan ulang dari halaman Dokumen Saya.";
    saveBtn.textContent = "Simpan Perubahan";
  } catch (error) {
    console.error("Gagal memuat dokumen untuk diedit:", error);
    showToast("Gagal memuat dokumen. Coba refresh halaman.", "error");
  }
}

function renderTemplateOptions() {
  if (templatesCache.length === 0) {
    templateSelect.innerHTML = `<option value="">Belum ada template aktif</option>`;
    return;
  }
  templateSelect.innerHTML =
    `<option value="">— Pilih template —</option>` +
    templatesCache.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
}

templateSelect.addEventListener("change", () => {
  const id = templateSelect.value;
  selectedTemplate = templatesCache.find((t) => t.id === id) || null;
  previewPanel.style.display = "none";
  previewArea.innerHTML = "";

  if (!selectedTemplate) {
    formPanel.style.display = "none";
    return;
  }

  formTitle.textContent = selectedTemplate.name;
  formDescription.textContent = selectedTemplate.description || "";
  buildFormFields(selectedTemplate.fields || []);
  formPanel.style.display = "block";
});

function buildFormFields(fields) {
  if (fields.length === 0) {
    documentForm.innerHTML = `<p class="subtitle">Template ini tidak punya field yang bisa diisi.</p>`;
    return;
  }

  documentForm.innerHTML = fields.map((f) => {
    const req = f.required ? "required" : "";
    const label = `<label for="field_${f.name}" style="display:block; font-weight:600; margin:14px 0 6px;">${escapeHtml(f.label || f.name)}${f.required ? " *" : ""}</label>`;

    let input;
    if (f.type === "textarea") {
      input = `<textarea id="field_${f.name}" name="${f.name}" class="input" rows="4" ${req}></textarea>`;
    } else if (f.type === "select" && Array.isArray(f.options)) {
      const opts = f.options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("");
      input = `<select id="field_${f.name}" name="${f.name}" class="input" ${req}><option value="">— Pilih —</option>${opts}</select>`;
    } else {
      const type = f.type === "date" || f.type === "number" ? f.type : "text";
      input = `<input id="field_${f.name}" name="${f.name}" type="${type}" class="input" ${req}>`;
    }

    return label + input;
  }).join("");
}

function getFormData() {
  const fields = selectedTemplate.fields || [];
  const data = {};
  for (const f of fields) {
    const el = document.getElementById(`field_${f.name}`);
    data[f.name] = el ? el.value.trim() : "";
  }
  return data;
}

function validateForm(data) {
  const fields = selectedTemplate.fields || [];
  for (const f of fields) {
    if (f.required && !data[f.name]) {
      showToast(`"${f.label || f.name}" wajib diisi.`, "error");
      return false;
    }
  }
  return true;
}

previewBtn.addEventListener("click", () => {
  if (!selectedTemplate) return;
  const data = getFormData();
  if (!validateForm(data)) return;

  const html = renderTemplate(selectedTemplate.html, data);
  previewArea.innerHTML = markNumberPlaceholder(html);
  previewPanel.style.display = "block";
  previewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});

saveBtn.addEventListener("click", async () => {
  if (!selectedTemplate) {
    showToast("Pilih template terlebih dahulu.", "error");
    return;
  }
  const data = getFormData();
  if (!validateForm(data)) return;

  const renderedHtml = renderTemplate(selectedTemplate.html, data);

  const idleText = editingDocument ? "Simpan Perubahan" : "Simpan Dokumen";
  setButtonLoading(saveBtn, true, idleText, "Menyimpan...");
  try {
    if (editingDocument) {
      await updateDoc(doc(db, "documents", editingDocument.id), {
        data,
        renderedHtml,
        updatedAt: serverTimestamp()
      });
      showToast("Perubahan dokumen disimpan.", "success");
      window.location.href = "documents.html";
      return;
    }

    await addDoc(collection(db, "documents"), {
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      data,
      renderedHtml,
      status: "draft",
      documentNumber: null,
      userId: currentUser.uid,
      createdByUsername: currentProfile.username || currentUser.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    showToast("Dokumen berhasil disimpan.", "success");
    previewArea.innerHTML = markNumberPlaceholder(renderedHtml);
    previewPanel.style.display = "block";
  } catch (error) {
    console.error("Gagal menyimpan dokumen:", error);
    showToast("Gagal menyimpan dokumen. Coba lagi.", "error");
  } finally {
    setButtonLoading(saveBtn, false, editingDocument ? "Simpan Perubahan" : "Simpan Dokumen");
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
