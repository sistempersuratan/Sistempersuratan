// ===========================================================
// documents.js — Logic halaman pages/documents.html
// Admin: lihat SEMUA dokumen. User: lihat dokumen miliknya saja.
// Alur status: draft -> (user ajukan) pending -> (admin) released / draft (ditolak)
// ===========================================================

import { requireAuth, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { db } from "./firebase-config.js";
import {
  sanitizeHtml,
  buildDocumentNumber,
  fillNumberPlaceholder,
  markNumberPlaceholder,
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
    pageTitle.textContent = "Semua Dokumen";
    pageSubtitle.textContent = "Seluruh dokumen yang dibuat oleh semua user.";
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

async function loadDocuments() {
  try {
    let snap;
    if (currentProfile.role === "admin") {
      snap = await getDocs(collection(db, "documents"));
    } else {
      const q = query(collection(db, "documents"), where("userId", "==", currentUser.uid));
      snap = await getDocs(q);
    }
    documentsCache = snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, renderedHtml: sanitizeHtml(prepareHtmlForDisplay(data)) };
    });
    documentsCache.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    renderTable();
  } catch (error) {
    console.error("Gagal memuat dokumen:", error);
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

// Dokumen rilis: isi {{nomor_surat}} dengan nomor resmi (juga untuk dokumen lama).
// Belum rilis: tampilkan petunjuk bahwa nomor diberikan saat rilis.
function prepareHtmlForDisplay(data) {
  const html = data.renderedHtml || "";
  return data.status === "released" && data.documentNumber
    ? fillNumberPlaceholder(html, data.documentNumber)
    : markNumberPlaceholder(html);
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
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada dokumen. Buat dari menu "Buat Dokumen".</td></tr>`;
    return;
  }

  const visible = getVisibleDocuments();
  if (visible.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Tidak ada dokumen yang cocok dengan pencarian/filter.</td></tr>`;
    return;
  }

  const isAdmin = currentProfile.role === "admin";
  tableBody.innerHTML = visible.map((d) => {
    const s = statusInfo(d.status);
    return `
    <tr>
      <td>${escapeHtml(d.documentNumber || "-")}</td>
      <td>${escapeHtml(d.templateName || "-")}</td>
      <td>${formatDate(d.createdAt)}</td>
      ${isAdmin ? `<td>${escapeHtml(d.createdByUsername || "-")}</td>` : ""}
      <td><span class="badge ${s.cls}">${s.label}</span></td>
      <td><button class="link-btn" data-id="${d.id}">Lihat</button></td>
    </tr>`;
  }).join("");
}

tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const item = documentsCache.find((d) => d.id === btn.dataset.id);
  if (item) openDetail(item);
});

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

  detailPanel.style.display = "block";
  detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

printBtn.addEventListener("click", () => {
  if (!activeDocument) return;
  const win = window.open("", "_blank");
  win.document.write(`<html><head><title>${escapeHtml(activeDocument.templateName || "Cetak")}</title></head><body>${activeDocument.renderedHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
});

downloadPdfBtn.addEventListener("click", () => {
  if (!activeDocument) return;
  const filename = fileBaseName(activeDocument);
  html2pdf().set({
    margin: 10,
    filename: `${filename}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  }).from(detailPreview).save();
});

downloadWordBtn.addEventListener("click", () => {
  if (!activeDocument) return;
  const filename = fileBaseName(activeDocument);
  const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
  const postHtml = "</body></html>";
  const fullHtml = preHtml + activeDocument.renderedHtml + postHtml;
  const blob = new Blob(["\ufeff", fullHtml], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

shareWaBtn.addEventListener("click", () => shareDocument("wa"));
shareEmailBtn.addEventListener("click", () => shareDocument("email"));

async function shareDocument(channel) {
  if (!activeDocument) return;
  const filename = fileBaseName(activeDocument);
  const text = `Dokumen: ${activeDocument.templateName}${activeDocument.documentNumber ? " (No. " + activeDocument.documentNumber + ")" : ""}`;

  try {
    const pdfBlob = await html2pdf().set({
      margin: 10,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(detailPreview).outputPdf("blob");

    const file = new File([pdfBlob], `${filename}.pdf`, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: activeDocument.templateName, text });
      return;
    }
  } catch (error) {
    console.warn("Web Share tidak tersedia, fallback ke link manual:", error);
  }

  downloadPdfBtn.click();
  if (channel === "wa") {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + " (PDF terlampir, silakan lampirkan file yang baru terunduh)")}`, "_blank");
  } else {
    window.location.href = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent("PDF dokumen terlampir, silakan lampirkan file yang baru terunduh.")}`;
  }
  showToast("PDF sudah diunduh. Lampirkan manual di aplikasi yang terbuka.", "info");
}

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

releaseBtn.addEventListener("click", async () => {
  if (!activeDocument) return;
  if (!confirm("Setujui dan rilis dokumen ini? Nomor surat akan diberikan otomatis sesuai jenis surat.")) return;

  const target = activeDocument;
  releaseBtn.disabled = true;
  try {
    // Kode & format nomor ada di template (fallback bila template sudah dihapus / belum diatur)
    let code = "DOK";
    let format = DEFAULT_NUMBER_FORMAT;
    try {
      const tplSnap = await getDoc(doc(db, "templates", target.templateId));
      if (tplSnap.exists()) {
        code = tplSnap.data().numberCode || code;
        format = tplSnap.data().numberFormat || format;
      }
    } catch (e) {
      console.warn("Template tidak terbaca, pakai kode bawaan:", e);
    }

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
        renderedHtml: fillNumberPlaceholder(current.renderedHtml || "", number),
        rejectionReason: null,
        releasedAt: serverTimestamp(),
        releasedBy: currentProfile.username || currentUser.email,
        updatedAt: serverTimestamp()
      });
      return number;
    });

    showToast(`Dokumen dirilis dengan nomor ${nomor}.`, "success");
    detailPanel.style.display = "none";
    loadDocuments();
  } catch (error) {
    console.error("Gagal merilis dokumen:", error);
    if (error && error.message === "already-released") {
      showToast("Dokumen ini sudah dirilis.", "error");
      loadDocuments();
    } else {
      showToast("Gagal merilis dokumen. Coba lagi.", "error");
    }
  } finally {
    releaseBtn.disabled = false;
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
    "Template": d.templateName || "-",
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
