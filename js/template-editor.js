// ===========================================================
// template-editor.js — Logic halaman pages/template-editor.html
// Mode: buat baru (tanpa ?id=) atau edit (dengan ?id=xxx)
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast, setButtonLoading } from "./ui.js";
import { db } from "./firebase-config.js";
import { renderTemplate } from "./template-engine.js";
import {
  doc,
  getDoc,
  addDoc,
  setDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");
const editorTitle = document.getElementById("editorTitle");
const formError = document.getElementById("editorFormError");

const tplName = document.getElementById("tplName");
const tplCategory = document.getElementById("tplCategory");
const tplDescription = document.getElementById("tplDescription");
const tplHtml = document.getElementById("tplHtml");

const fieldsList = document.getElementById("fieldsList");
const fieldsEmptyState = document.getElementById("fieldsEmptyState");
const addFieldBtn = document.getElementById("addFieldBtn");
const placeholderChips = document.getElementById("placeholderChips");

const previewBtn = document.getElementById("previewBtn");
const previewOverlay = document.getElementById("previewOverlay");
const previewContent = document.getElementById("previewContent");
const closePreviewBtn = document.getElementById("closePreviewBtn");

const saveBtn = document.getElementById("saveTemplateBtn");

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" }
];

const templateId = new URLSearchParams(window.location.search).get("id");
let fields = [];
let fieldUidCounter = 0;

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;
  userName.textContent = profile.username || user.email;
  userInitial.textContent = (profile.username || user.email || "?").charAt(0).toUpperCase();

  if (templateId) {
    editorTitle.textContent = "Edit Template";
    loadExistingTemplate(templateId);
  } else {
    renderFields();
  }
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

async function loadExistingTemplate(id) {
  try {
    const snap = await getDoc(doc(db, "templates", id));
    if (!snap.exists()) {
      showFormError("Template tidak ditemukan. Mungkin sudah dihapus.");
      return;
    }
    const data = snap.data();
    tplName.value = data.name || "";
    tplCategory.value = data.category || "";
    tplDescription.value = data.description || "";
    tplHtml.value = data.html || "";
    fields = (data.fields || []).map((f) => ({ ...f, uid: "f" + (fieldUidCounter++) }));
    renderFields();
  } catch (error) {
    console.error("Gagal memuat template:", error);
    showFormError("Gagal memuat data template. Coba refresh halaman.");
  }
}

addFieldBtn.addEventListener("click", () => {
  fields.push({
    uid: "f" + (fieldUidCounter++),
    name: "",
    label: "",
    type: "text",
    required: false,
    options: ""
  });
  renderFields();
});

function renderFields() {
  fieldsEmptyState.style.display = fields.length === 0 ? "block" : "none";

  fieldsList.innerHTML = fields.map((f) => `
    <div class="field-row" data-uid="${f.uid}">
      <div>
        <span class="field-row-label">Nama Field (kode)</span>
        <input type="text" class="f-name" value="${escapeAttr(f.name)}" placeholder="nomor_surat">
      </div>
      <div>
        <span class="field-row-label">Label</span>
        <input type="text" class="f-label" value="${escapeAttr(f.label)}" placeholder="Nomor Surat">
      </div>
      <div>
        <span class="field-row-label">Tipe</span>
        <select class="f-type">
          ${FIELD_TYPES.map((t) => `<option value="${t.value}" ${f.type === t.value ? "selected" : ""}>${t.label}</option>`).join("")}
        </select>
      </div>
      <div class="required-toggle">
        <input type="checkbox" class="f-required" ${f.required ? "checked" : ""}>
        <label>Wajib</label>
      </div>
      <button type="button" class="remove-field-btn" title="Hapus field">&times;</button>
      ${f.type === "select" ? `
        <div class="options-input">
          <span class="field-row-label">Pilihan (pisahkan dengan koma)</span>
          <input type="text" class="f-options" value="${escapeAttr(f.options || "")}" placeholder="Manager, Staff, Supervisor">
        </div>
      ` : ""}
    </div>
  `).join("");

  renderPlaceholderChips();
}

fieldsList.addEventListener("input", (e) => {
  const row = e.target.closest(".field-row");
  if (!row) return;
  const f = fields.find((x) => x.uid === row.dataset.uid);
  if (!f) return;

  if (e.target.classList.contains("f-name")) {
    f.name = e.target.value.trim().replace(/\s+/g, "_");
    renderPlaceholderChips();
  } else if (e.target.classList.contains("f-label")) {
    f.label = e.target.value;
  } else if (e.target.classList.contains("f-options")) {
    f.options = e.target.value;
  }
});

fieldsList.addEventListener("change", (e) => {
  const row = e.target.closest(".field-row");
  if (!row) return;
  const f = fields.find((x) => x.uid === row.dataset.uid);
  if (!f) return;

  if (e.target.classList.contains("f-type")) {
    f.type = e.target.value;
    renderFields();
  } else if (e.target.classList.contains("f-required")) {
    f.required = e.target.checked;
  }
});

fieldsList.addEventListener("click", (e) => {
  if (!e.target.classList.contains("remove-field-btn")) return;
  const row = e.target.closest(".field-row");
  if (!row) return;
  fields = fields.filter((x) => x.uid !== row.dataset.uid);
  renderFields();
});

function renderPlaceholderChips() {
  const namedFields = fields.filter((f) => f.name);
  if (namedFields.length === 0) {
    placeholderChips.innerHTML = `<span class="chip-empty">Isi "Nama Field" dulu supaya muncul di sini.</span>`;
    return;
  }
  placeholderChips.innerHTML = namedFields.map((f) =>
    `<button type="button" class="chip" data-name="${escapeAttr(f.name)}">{{${escapeAttr(f.name)}}}</button>`
  ).join("");
}

placeholderChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const insertText = `{{${chip.dataset.name}}}`;
  const start = tplHtml.selectionStart ?? tplHtml.value.length;
  const end = tplHtml.selectionEnd ?? tplHtml.value.length;
  tplHtml.value = tplHtml.value.slice(0, start) + insertText + tplHtml.value.slice(end);
  tplHtml.focus();
  tplHtml.selectionStart = tplHtml.selectionEnd = start + insertText.length;
});

previewBtn.addEventListener("click", () => {
  const sampleData = {};
  fields.forEach((f) => {
    if (f.name) sampleData[f.name] = `[Contoh: ${f.label || f.name}]`;
  });
  previewContent.innerHTML = renderTemplate(tplHtml.value, sampleData) || "<p style='color:#999;'>Isi HTML masih kosong.</p>";
  previewOverlay.classList.add("show");
});
closePreviewBtn.addEventListener("click", () => previewOverlay.classList.remove("show"));
previewOverlay.addEventListener("click", (e) => {
  if (e.target === previewOverlay) previewOverlay.classList.remove("show");
});

saveBtn.addEventListener("click", async () => {
  clearFormError();

  const name = tplName.value.trim();
  const category = tplCategory.value.trim();
  const description = tplDescription.value.trim();
  const html = tplHtml.value;

  if (!name) {
    showFormError("Nama template wajib diisi.");
    return;
  }
  if (fields.some((f) => !f.name)) {
    showFormError("Semua field harus punya \"Nama Field\" (kode), tidak boleh kosong.");
    return;
  }
  const fieldNames = fields.map((f) => f.name);
  if (new Set(fieldNames).size !== fieldNames.length) {
    showFormError("Ada Nama Field yang duplikat — setiap field harus punya nama unik.");
    return;
  }

  setButtonLoading(saveBtn, true, "Simpan Template");

  const payload = {
    name,
    category,
    description,
    html,
    fields: fields.map((f) => ({
      name: f.name,
      label: f.label || f.name,
      type: f.type,
      required: !!f.required,
      ...(f.type === "select" ? { options: (f.options || "").split(",").map((o) => o.trim()).filter(Boolean) } : {})
    })),
    updatedAt: serverTimestamp()
  };

  try {
    if (templateId) {
      await setDoc(doc(db, "templates", templateId), payload, { merge: true });
      showToast("Template berhasil diperbarui.", "success");
    } else {
      payload.active = true;
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "templates"), payload);
      showToast("Template baru berhasil dibuat.", "success");
    }
    window.location.href = "templates.html";
  } catch (error) {
    console.error("Gagal menyimpan template:", error);
    showFormError("Gagal menyimpan template. Coba lagi.");
  } finally {
    setButtonLoading(saveBtn, false, "Simpan Template");
  }
});

function showFormError(message) {
  formError.textContent = message;
  formError.classList.add("show");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearFormError() {
  formError.textContent = "";
  formError.classList.remove("show");
}

function escapeAttr(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML.replace(/"/g, "&quot;");
}
