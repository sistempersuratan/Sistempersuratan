// ===========================================================
// documents.js — Logic halaman pages/documents.html
// Admin: lihat SEMUA dokumen. User: lihat dokumen miliknya saja.
// Alur status: draft -> (user ajukan) pending -> (admin) released / draft (ditolak)
// ===========================================================

import { requireAuth, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { openRowMenu, makeRowsClickable } from "./row-menu.js";
import { db } from "./firebase-config.js";
import {
  sanitizeHtml,
  renderTemplate,
  applyFinishing,
  hasFinishingTokens,
  isSafeImageDataUrl,
  buildDocumentNumber,
  fillNumberPlaceholder,
  markNumberPlaceholder,
  applyLetterhead,
  hasLetterheadToken,
  isLetterheadConfigured,
  DEFAULT_NUMBER_FORMAT
} from "./template-engine.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const navDashboardLinks = document.querySelectorAll(".nav-dashboard-link");
const adminOnlyEls = document.querySelectorAll(".admin-only");
const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const userRoleBadge = document.getElementById("userRoleBadge");
const logoutButtons = document.querySelectorAll(".js-logout");

const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const tableBody = document.getElementById("documentsTableBody");
const exportExcelBtn = document.getElementById("exportExcelBtn");

const detailPanel = document.getElementById("detailPanel");
const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const detailPreview = document.getElementById("detailPreview");
const printBtn = document.getElementById("printBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const downloadWordBtn = document.getElementById("downloadWordBtn");
const shareWaBtn = document.getElementById("shareWaBtn");
const shareEmailBtn = document.getElementById("shareEmailBtn");
const submitBtn = document.getElementById("submitBtn");
const releaseBtn = document.getElementById("releaseBtn");
const rejectBtn = document.getElementById("rejectBtn");
const editBtn = document.getElementById("editBtn");
const deleteBtn = document.getElementById("deleteBtn");
const readerBack = document.getElementById("readerBack");
const exportToggle = document.getElementById("exportToggle");
const exportMenu = document.getElementById("exportMenu");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");

let currentUser = null;
let currentProfile = null;
let documentsCache = [];
let activeDocument = null;

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
    adminOnlyEls.forEach((el) => (el.style.display = ""));
    pageTitle.textContent = "Arsip Dokumen";
    pageSubtitle.textContent = "Seluruh dokumen semua user. Klik salah satu dokumen untuk melihat isi atau mengekspornya.";
  }

  loadDocuments();
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

// Kop surat & logo (settings/letterhead). Dipakai untuk mengisi {{kop_surat}} saat tampil.
let letterhead = null;
async function readLetterhead() {
  try {
    const snap = await getDoc(doc(db, "settings", "letterhead"));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.warn("Kop surat tidak terbaca:", error);
    return null;
  }
}

async function loadDocuments() {
  try {
    let snap;
    if (currentProfile.role === "admin") {
      snap = await getDocs(collection(db, "documents"));
    } else {
      const q = query(collection(db, "documents"), where("userId", "==", currentUser.uid));
      snap = await getDocs(q);
    }
    letterhead = await readLetterhead();
    documentsCache = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, rawHtml: data.renderedHtml || "", renderedHtml: sanitizeHtml(prepareHtmlForDisplay(data)) };
    });
    documentsCache.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    applyUrlParams();
    renderTable();
  } catch (error) {
    console.error("Gagal memuat dokumen:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

// Tautan dari dashboard: ?status=draft|pending|released memfilter daftar,
// ?open=ID langsung membuka detail dokumen.
function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const st = params.get("status");
  if (st && [...statusFilter.options].some((o) => o.value === st)) statusFilter.value = st;
  const openId = params.get("open");
  if (openId) {
    const item = documentsCache.find((d) => d.id === openId);
    if (item) setTimeout(() => openDetail(item), 0);
  }
}

// Dokumen rilis: isi {{nomor_surat}} dengan nomor resmi (juga untuk dokumen lama).
// Belum rilis: tampilkan petunjuk bahwa nomor diberikan saat rilis.
function prepareHtmlForDisplay(data) {
  const isReleased = data.status === "released" && data.documentNumber;
  // {{kop_surat}} diganti kop terbaru; dokumen terbit sudah membawa kopnya sendiri (dibekukan saat rilis).
  const html = applyLetterhead(data.renderedHtml || "", letterhead, { placeholder: !isReleased });
  return isReleased ? fillNumberPlaceholder(html, data.documentNumber) : markNumberPlaceholder(html);
}

function statusInfo(status) {
  switch (status) {
    case "pending": return { cls: "admin", label: "Menunggu Persetujuan" };
    case "released": return { cls: "user", label: "Rilis" };
    default: return { cls: "inactive", label: "Draft" };
  }
}

function getVisibleDocuments() {
  const keyword = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  let list = documentsCache.filter((d) => {
    if (status && (d.status || "draft") !== status) return false;
    if (!keyword) return true;
    const haystack = [d.documentNumber, d.templateName, d.createdByUsername]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(keyword);
  });
  list.sort((a, b) => sortSelect.value === "oldest"
    ? tsToMillis(a.createdAt) - tsToMillis(b.createdAt)
    : tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
  return list;
}

[searchInput, statusFilter, sortSelect].forEach((el) => {
  el.addEventListener("input", () => renderTable());
});

function renderTable() {
  if (documentsCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Belum ada dokumen. Buat dari menu "Buat Dokumen".</td></tr>`;
    return;
  }

  const visible = getVisibleDocuments();
  if (visible.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Tidak ada dokumen yang cocok dengan pencarian/filter.</td></tr>`;
    return;
  }

  const isAdmin = currentProfile.role === "admin";
  tableBody.innerHTML = visible.map((d) => {
    const s = statusInfo(d.status);
    return `
    <tr class="row-click" data-id="${d.id}" tabindex="0">
      <td>${escapeHtml(d.documentNumber || "-")}</td>
      <td>${escapeHtml(d.templateName || "-")}</td>
      <td>${formatDate(d.createdAt)}</td>
      ${isAdmin ? `<td>${escapeHtml(d.createdByUsername || "-")}</td>` : ""}
      <td><span class="badge ${s.cls}">${s.label}</span></td>
    </tr>`;
  }).join("");
}

// Klik baris -> popup pilihan: lihat isi dokumen, download, kirim.
makeRowsClickable(tableBody, (id) => {
  const item = documentsCache.find((d) => d.id === id);
  if (item) openDocumentMenu(item);
});

function openDocumentMenu(item) {
  const s = statusInfo(item.status);
  openRowMenu({
    title: item.templateName || "Dokumen",
    meta: `${item.documentNumber || "Belum bernomor"} · ${s.label}`,
    sections: [
      { items: [{ label: "Lihat isi dokumen", primary: true, onClick: () => openDetail(item) }] },
      { label: "Download", items: [
        { label: "PDF", onClick: () => doPdf(item) },
        { label: "Word (.doc)", onClick: () => doWord(item) },
        { label: "Cetak", onClick: () => doPrint(item) }
      ] },
      { label: "Kirim", items: [
        { label: "WhatsApp", onClick: () => doShare(item, "wa") },
        { label: "Email", onClick: () => doShare(item, "email") }
      ] }
    ]
  });
}

function openDetail(item) {
  activeDocument = item;
  const s = statusInfo(item.status);
  detailTitle.textContent = item.templateName || "Dokumen";
  detailMeta.textContent = `${item.documentNumber ? "No. " + item.documentNumber + " — " : ""}Dibuat ${formatDate(item.createdAt)} oleh ${item.createdByUsername || "-"} — Status: ${s.label}` +
    (item.rejectionReason ? ` — Alasan ditolak sebelumnya: ${item.rejectionReason}` : "");
  detailPreview.innerHTML = item.renderedHtml || "<p>Tidak ada isi.</p>";

  const isAdmin = currentProfile.role === "admin";
  const isOwner = item.userId === currentUser.uid;

  const isDraft = (item.status || "draft") === "draft";
  submitBtn.style.display = !isAdmin && isOwner && isDraft ? "" : "none";
  editBtn.style.display = isOwner && isDraft ? "" : "none";
  deleteBtn.style.display = isOwner && isDraft ? "" : "none";
  // Admin merilis dokumen yang diajukan user, atau draft miliknya sendiri
  releaseBtn.style.display = isAdmin && (item.status === "pending" || (isOwner && isDraft)) ? "" : "none";
  rejectBtn.style.display = isAdmin && item.status === "pending" ? "" : "none";

  closeExportMenu();
  detailPanel.style.display = "block";
  detailPanel.scrollTop = 0;
}

// ---------- Ekspor: Download (PDF / Word / Cetak) dan Kirim (WhatsApp / Email) ----------
// Semua fungsi menerima dokumen yang dipilih, jadi bisa dipanggil dari popup baris
// maupun dari menu "Ekspor" di pembaca surat. Berkas dibuat dari salinan bersih
// berukuran A4 (bukan dari tampilan layar), supaya margin & tata letaknya rapi.

const PDF_OPTIONS = {
  margin: [15, 20, 15, 20], // atas, kiri, bawah, kanan (mm)
  image: { type: "jpeg", quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  pagebreak: { mode: ["css", "legacy"] }
};

// Salinan dokumen selebar area cetak A4 (210mm - margin 20mm kiri/kanan) di luar layar.
async function withExportSheet(item, fn) {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed; left:-10000px; top:0;";
  const sheet = document.createElement("div");
  sheet.style.cssText = "width:170mm; background:#fff; color:#000; font-family:'Times New Roman',Times,serif; font-size:12pt; line-height:1.5;";
  sheet.innerHTML = item.renderedHtml || "";
  holder.appendChild(sheet);
  document.body.appendChild(holder);
  try {
    return await fn(sheet);
  } finally {
    holder.remove();
  }
}

function doPrint(item) {
  if (!item) return;
  const win = window.open("", "_blank");
  if (!win) {
    showToast("Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.", "error");
    return;
  }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(item.templateName || "Cetak")}</title>
<style>@page{size:A4; margin:20mm 20mm 15mm 20mm;} body{margin:0; font-family:'Times New Roman',Times,serif; font-size:12pt; line-height:1.5; color:#000;} img{max-width:100%;}</style>
</head><body>${item.renderedHtml || ""}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

async function doPdf(item) {
  if (!item) return;
  try {
    await withExportSheet(item, (sheet) =>
      html2pdf().set({ ...PDF_OPTIONS, filename: `${fileBaseName(item)}.pdf` }).from(sheet).save()
    );
  } catch (error) {
    console.error("Gagal membuat PDF:", error);
    showToast("Gagal membuat PDF. Coba lagi.", "error");
  }
}

function doWord(item) {
  if (!item) return;
  const head = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>" +
    "<style>@page Section1{size:21cm 29.7cm; margin:2cm 2cm 1.5cm 2cm;} div.Section1{page:Section1;} body{font-family:'Times New Roman',serif; font-size:12pt; line-height:1.5;}</style></head><body><div class='Section1'>";
  const fullHtml = head + (item.renderedHtml || "") + "</div></body></html>";
  const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBaseName(item)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function doShare(item, channel) {
  if (!item) return;
  const filename = fileBaseName(item);
  const text = `Dokumen: ${item.templateName}${item.documentNumber ? " (No. " + item.documentNumber + ")" : ""}`;

  try {
    const pdfBlob = await withExportSheet(item, (sheet) =>
      html2pdf().set(PDF_OPTIONS).from(sheet).outputPdf("blob")
    );
    const file = new File([pdfBlob], `${filename}.pdf`, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: item.templateName, text });
      return;
    }
  } catch (error) {
    console.warn("Web Share tidak tersedia, fallback ke link manual:", error);
  }

  await doPdf(item);
  if (channel === "wa") {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + " (PDF terlampir, silakan lampirkan file yang baru terunduh)")}`, "_blank");
  } else {
    window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent("PDF dokumen terlampir, silakan lampirkan file yang baru terunduh.")}`;
  }
  showToast("PDF sudah diunduh. Lampirkan manual di aplikasi yang terbuka.", "info");
}

// Menu "Ekspor" kecil di kanan atas surat yang terbuka
function closeExportMenu() {
  exportMenu.classList.remove("show");
  exportToggle.setAttribute("aria-expanded", "false");
}
exportToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = exportMenu.classList.toggle("show");
  exportToggle.setAttribute("aria-expanded", String(open));
});
exportMenu.addEventListener("click", closeExportMenu);
document.addEventListener("click", (e) => {
  if (!exportMenu.contains(e.target)) closeExportMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && detailPanel.style.display === "block" && !document.querySelector(".modal-overlay.show")) {
    closeExportMenu();
    detailPanel.style.display = "none";
  }
});
readerBack.addEventListener("click", () => {
  closeExportMenu();
  detailPanel.style.display = "none";
});

printBtn.addEventListener("click", () => doPrint(activeDocument));
downloadPdfBtn.addEventListener("click", () => doPdf(activeDocument));
downloadWordBtn.addEventListener("click", () => doWord(activeDocument));
shareWaBtn.addEventListener("click", () => doShare(activeDocument, "wa"));
shareEmailBtn.addEventListener("click", () => doShare(activeDocument, "email"));

editBtn.addEventListener("click", () => {
  if (!activeDocument) return;
  window.location.href = `create-document.html?edit=${activeDocument.id}`;
});

deleteBtn.addEventListener("click", async () => {
  if (!activeDocument) return;
  if (!confirm("Hapus draft dokumen ini? Tindakan ini tidak bisa dibatalkan.")) return;
  try {
    await deleteDoc(doc(db, "documents", activeDocument.id));
    showToast("Draft dokumen berhasil dihapus.", "success");
    detailPanel.style.display = "none";
    activeDocument = null;
    loadDocuments();
  } catch (error) {
    console.error("Gagal menghapus dokumen:", error);
    showToast("Gagal menghapus dokumen. Coba lagi.", "error");
  }
});

submitBtn.addEventListener("click", async () => {
  if (!activeDocument) return;
  if (!confirm("Ajukan dokumen ini untuk dirilis? Setelah diajukan, kamu tidak bisa membatalkannya sendiri — tunggu keputusan admin.")) return;
  try {
    await updateDoc(doc(db, "documents", activeDocument.id), {
      status: "pending",
      updatedAt: serverTimestamp()
    });
    showToast("Dokumen berhasil diajukan untuk dirilis.", "success");
    detailPanel.style.display = "none";
    loadDocuments();
  } catch (error) {
    console.error("Gagal mengajukan rilis:", error);
    showToast("Gagal mengajukan dokumen. Coba lagi.", "error");
  }
});

// ===========================================================
// Penerbitan dokumen: pilih kelengkapan (TTD & cap), pratinjau, lalu terbitkan.
// Keamanan: isi dokumen DIRENDER ULANG dari data isian + jenis dokumen (tepercaya),
// bukan memakai HTML kiriman user. Aset TTD/cap dipasang HANYA di sini, dan hasilnya
// disalin ke dokumen, sehingga dokumen terbit tidak berubah bila pengaturan diganti.
// ===========================================================

const releaseOverlay = document.getElementById("releaseOverlay");
const releaseSub = document.getElementById("releaseSub");
const releaseOptions = document.getElementById("releaseOptions");
const releaseWarn = document.getElementById("releaseWarn");
const releasePreview = document.getElementById("releasePreview");
const releaseCancel = document.getElementById("releaseCancel");
const releaseConfirm = document.getElementById("releaseConfirm");

const MAX_FINAL_HTML = 900000; // jaga di bawah batas 1 MiB dokumen Firestore
let rel = null;

releaseBtn.addEventListener("click", () => {
  if (activeDocument) openReleaseDialog(activeDocument);
});
releaseCancel.addEventListener("click", closeRelease);
releaseOverlay.addEventListener("click", (e) => {
  if (e.target === releaseOverlay) closeRelease();
});

function closeRelease() {
  releaseOverlay.classList.remove("show");
  rel = null;
}

async function loadActiveAsset(id, type) {
  if (!id) return null;
  const snap = await getDoc(doc(db, "signingAssets", id));
  if (!snap.exists()) return null;
  const a = { id: snap.id, ...snap.data() };
  if (a.status !== "active" || a.type !== type || !isSafeImageDataUrl(a.image)) return null;
  return a;
}

async function openReleaseDialog(target) {
  rel = { target, template: null, signature: null, stamp: null, baseHtml: "", rerendered: false, tokens: { signature: false, stamp: false }, mode: "plain", mismatch: false, ack: false };
  releaseSub.textContent = `${target.templateName || "Dokumen"} — dibuat oleh ${target.createdByUsername || "-"}`;
  releaseOptions.innerHTML = "";
  releaseWarn.innerHTML = "";
  releasePreview.textContent = "Memuat...";
  releaseConfirm.disabled = true;
  releaseOverlay.classList.add("show");

  try {
    try {
      const t = await getDoc(doc(db, "templates", target.templateId));
      if (t.exists()) rel.template = { id: t.id, ...t.data() };
    } catch (e) {
      console.warn("Jenis dokumen tidak terbaca:", e);
    }

    rel.letterhead = await readLetterhead();
    rel.kopMissing = !isLetterheadConfigured(rel.letterhead);

    if (rel.template && rel.template.html) {
      rel.usesKop = hasLetterheadToken(rel.template.html);
      rel.baseHtml = sanitizeHtml(applyLetterhead(renderTemplate(rel.template.html, target.data || {}), rel.letterhead));
      rel.rerendered = true;
      rel.tokens = hasFinishingTokens(rel.template.html);
    } else {
      rel.usesKop = hasLetterheadToken(target.rawHtml);
      rel.baseHtml = sanitizeHtml(applyLetterhead(target.rawHtml || "", rel.letterhead));
    }

    try {
      const st = await getDoc(doc(db, "settings", "finishing"));
      const cfg = st.exists() ? st.data() : {};
      rel.signature = await loadActiveAsset(cfg.activeSignatureId, "signature");
      rel.stamp = await loadActiveAsset(cfg.activeStampId, "stamp");
    } catch (e) {
      console.warn("Aset TTD/cap tidak terbaca:", e);
    }

    const signer = String((target.data || {}).nama_penandatangan || "").trim().toLowerCase();
    rel.mismatch = !!(rel.signature && signer && String(rel.signature.ownerName || "").trim().toLowerCase() !== signer);

    const t = rel.template || {};
    const requested = target.finishing && target.finishing.requested;
    rel.mode = t.finishingChoice === "user" && (requested === "complete" || requested === "plain")
      ? requested
      : (t.finishingDefault === "complete" ? "complete" : "plain");
    if (rel.mode === "complete" && !canComplete()) rel.mode = "plain";
  } catch (error) {
    console.error("Gagal menyiapkan dialog rilis:", error);
    showToast("Gagal menyiapkan penerbitan. Coba lagi.", "error");
    closeRelease();
    return;
  }
  renderReleaseDialog();
}

function canComplete() {
  return rel.rerendered && (rel.tokens.signature || rel.tokens.stamp) && !!(rel.signature || rel.stamp);
}

function releaseFinishing() {
  const complete = rel.mode === "complete";
  return {
    mode: rel.mode,
    signature: complete && rel.tokens.signature ? rel.signature : null,
    stamp: complete && rel.tokens.stamp ? rel.stamp : null
  };
}

function buildFinalHtml() {
  const f = releaseFinishing();
  return applyFinishing(rel.baseHtml, {
    mode: rel.mode,
    signatureSrc: f.signature && f.signature.image,
    stampSrc: f.stamp && f.stamp.image
  });
}

function renderReleaseDialog() {
  const ok = canComplete();
  const sig = rel.signature ? escapeHtml(rel.signature.ownerName) : "belum diatur";
  const stp = rel.stamp ? escapeHtml(rel.stamp.ownerName) : "belum diatur";
  const requested = rel.target.finishing && rel.target.finishing.requested;

  releaseOptions.innerHTML = `
    <label class="check-row"><input type="radio" name="relMode" value="plain" ${rel.mode === "plain" ? "checked" : ""}>
      <span><strong>Tanpa tanda tangan &amp; cap</strong><br><span class="muted">Ruang tetap ada, cocok untuk tanda tangan basah.</span></span></label>
    <label class="check-row" ${ok ? "" : 'style="opacity:.55;"'}><input type="radio" name="relMode" value="complete" ${rel.mode === "complete" ? "checked" : ""} ${ok ? "" : "disabled"}>
      <span><strong>Lengkap (tanda tangan &amp; cap)</strong><br><span class="muted">Tanda tangan: ${sig} · Cap: ${stp}</span></span></label>`;

  const warns = [];
  if (!rel.template) warns.push("Jenis dokumen sudah dihapus. Dokumen diterbitkan sesuai isi tersimpan, tanpa TTD/cap.");
  else if (!rel.tokens.signature && !rel.tokens.stamp) warns.push("Jenis dokumen ini belum punya penanda posisi TTD/cap. Tambahkan <code>{{ttd_gambar}}</code> dan <code>{{cap_gambar}}</code> di Editor Jenis Dokumen.");
  else if (!rel.signature && !rel.stamp) warns.push("Belum ada tanda tangan/cap yang dipakai. Atur di menu Kop, TTD &amp; Cap.");
  else if (rel.mode === "complete" && (!rel.signature || !rel.stamp)) warns.push(`${!rel.signature ? "Tanda tangan" : "Cap"} belum diatur, jadi tidak dipasang.`);
  if (rel.target.finishing && requested && rel.template && rel.template.finishingChoice === "user") {
    warns.push(`Pengguna meminta: ${requested === "complete" ? "Lengkap" : "Tanpa TTD/cap"}.`);
  }
  if (rel.usesKop && rel.kopMissing) warns.push("Kop surat belum diatur, jadi dokumen terbit tanpa kop. Atur di menu Kop, TTD &amp; Cap.");
  if (rel.rerendered) warns.push("Isi dirender ulang dari data isian dan jenis dokumen saat ini.");

  let html = warns.map((w) => `<div class="field-hint">• ${w}</div>`).join("");
  if (rel.mode === "complete" && rel.mismatch) {
    html += `<label class="check-row" style="margin-top:8px; color:var(--accent);"><input type="checkbox" id="relAck">
      <span>Nama pada tanda tangan (${escapeHtml(rel.signature.ownerName)}) berbeda dengan penandatangan di dokumen. Saya memastikan tanda tangan ini sah untuk dokumen ini.</span></label>`;
  }
  releaseWarn.innerHTML = html;
  updateReleasePreview();
}

function updateReleasePreview() {
  releasePreview.innerHTML = sanitizeHtml(markNumberPlaceholder(buildFinalHtml()));
  releaseConfirm.disabled = rel.mode === "complete" && rel.mismatch && !rel.ack;
}

releaseOptions.addEventListener("change", (e) => {
  if (!rel || e.target.name !== "relMode") return;
  rel.mode = e.target.value;
  rel.ack = false;
  renderReleaseDialog();
});
releaseWarn.addEventListener("change", (e) => {
  if (!rel || e.target.id !== "relAck") return;
  rel.ack = e.target.checked;
  updateReleasePreview();
});

releaseConfirm.addEventListener("click", async () => {
  if (!rel) return;
  const { target, template } = rel;
  const f = releaseFinishing();
  releaseConfirm.disabled = true;
  try {
    const code = (template && template.numberCode) || "DOK";
    const format = (template && template.numberFormat) || DEFAULT_NUMBER_FORMAT;
    const finalTemplateHtml = buildFinalHtml();
    if (finalTemplateHtml.length > MAX_FINAL_HTML) throw new Error("too-large");

    const now = new Date();
    const docRef = doc(db, "documents", target.id);
    // Urutan dihitung per jenis surat per tahun. Transaksi memastikan dua admin
    // yang merilis bersamaan tidak mendapat nomor kembar, dan dokumen yang sama
    // tidak bisa dirilis dua kali.
    const counterRef = doc(db, "counters", `${target.templateId}_${now.getFullYear()}`);

    const nomor = await runTransaction(db, async (tx) => {
      const docSnap = await tx.get(docRef);
      const counterSnap = await tx.get(counterRef);
      if (!docSnap.exists()) throw new Error("doc-not-found");
      const current = docSnap.data();
      if (current.status === "released") throw new Error("already-released");

      const next = (counterSnap.exists() ? counterSnap.data().last || 0 : 0) + 1;
      const number = buildDocumentNumber(format, code, next, now);

      tx.set(counterRef, {
        templateId: target.templateId,
        year: now.getFullYear(),
        last: next,
        updatedAt: serverTimestamp()
      });
      tx.update(docRef, {
        status: "released",
        documentNumber: number,
        renderedHtml: sanitizeHtml(fillNumberPlaceholder(finalTemplateHtml, number)),
        finishing: {
          mode: rel.mode,
          signatureAssetId: f.signature ? f.signature.id : null,
          stampAssetId: f.stamp ? f.stamp.id : null,
          signerName: f.signature ? f.signature.ownerName || null : null,
          requested: (target.finishing && target.finishing.requested) || null,
          decidedBy: currentProfile.username || currentUser.email,
          decidedAt: serverTimestamp()
        },
        rejectionReason: null,
        releasedAt: serverTimestamp(),
        releasedBy: currentProfile.username || currentUser.email,
        updatedAt: serverTimestamp()
      });
      return number;
    });

    closeRelease();
    showToast(`Dokumen dirilis dengan nomor ${nomor}.`, "success");
    detailPanel.style.display = "none";
    loadDocuments();
  } catch (error) {
    console.error("Gagal merilis dokumen:", error);
    if (error && error.message === "already-released") {
      closeRelease();
      showToast("Dokumen ini sudah dirilis.", "error");
      loadDocuments();
    } else if (error && error.message === "too-large") {
      showToast("Dokumen terlalu besar untuk diterbitkan dengan TTD/cap. Perkecil gambar aset.", "error");
      releaseConfirm.disabled = false;
    } else {
      showToast("Gagal merilis dokumen. Coba lagi.", "error");
      releaseConfirm.disabled = false;
    }
  }
});

rejectBtn.addEventListener("click", async () => {
  if (!activeDocument) return;
  const reason = prompt("Alasan penolakan (boleh dikosongkan):", "");
  if (reason === null) return;
  try {
    await updateDoc(doc(db, "documents", activeDocument.id), {
      status: "draft",
      rejectionReason: reason.trim() || null,
      updatedAt: serverTimestamp()
    });
    showToast("Dokumen ditolak dan dikembalikan ke draft.", "success");
    detailPanel.style.display = "none";
    loadDocuments();
  } catch (error) {
    console.error("Gagal menolak dokumen:", error);
    showToast("Gagal menolak dokumen. Coba lagi.", "error");
  }
});

exportExcelBtn.addEventListener("click", () => {
  const rows = getVisibleDocuments().map((d) => ({
    "Nomor Surat": d.documentNumber || "-",
    "Jenis Dokumen": d.templateName || "-",
    "Status": statusInfo(d.status).label,
    "Dibuat Oleh": d.createdByUsername || "-",
    "Tanggal Dibuat": formatDate(d.createdAt),
    "Tanggal Rilis": formatDate(d.releasedAt)
  }));
  if (rows.length === 0) {
    showToast("Tidak ada data untuk diexport.", "error");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Surat");
  XLSX.writeFile(wb, `rekap-surat-${Date.now()}.xlsx`);
});

function fileBaseName(item) {
  return (item.documentNumber || item.templateName || "dokumen").replace(/[^a-zA-Z0-9]+/g, "-");
}

function tsToMillis(ts) {
  if (!ts) return 0;
  return ts.toMillis ? ts.toMillis() : 0;
}

function formatDate(ts) {
  if (!ts || !ts.toDate) return "-";
  return ts.toDate().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
