// ===========================================================
// create-document.js — Logic halaman pages/create-document.html
// Bisa diakses admin & user (requireAuth polos, tanpa requireRole).
// ===========================================================

import { requireAuth, logout } from "./auth.js";
import { showToast, setButtonLoading } from "./ui.js";
import { renderTemplate } from "./template-engine.js";
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
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

   navDashboardLinks.forEach((el) => (el.href = profile.role === "admin" ? "../admin.html" : "../dashboard.html"));
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
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((t) => t.active !== false);
    templatesCache.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderTemplateOptions();
  } catch (error) {
    console.error("Gagal memuat daftar template:", error);
    templateSelect.innerHTML = `<option value="">Gagal memuat template</option>`;
    showToast("Gagal memuat daftar template. Coba refresh halaman.", "error");
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
  previewArea.innerHTML = html;
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

  setButtonLoading(saveBtn, true, "Simpan Dokumen", "Menyimpan...");
  try {
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
    previewArea.innerHTML = renderedHtml;
    previewPanel.style.display = "block";
  } catch (error) {
    console.error("Gagal menyimpan dokumen:", error);
    showToast("Gagal menyimpan dokumen. Coba lagi.", "error");
  } finally {
    setButtonLoading(saveBtn, false, "Simpan Dokumen");
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
