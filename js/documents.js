// ===========================================================
// documents.js — Logic halaman pages/documents.html
// Admin: lihat SEMUA dokumen. User: lihat dokumen miliknya saja.
// Alur status: draft -> (user ajukan) pending -> (admin) released / draft (ditolak)
// ===========================================================

import { requireAuth, logout } from "./auth.js";
import { showToast } from "./ui.js";
import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
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
  navDashboardLinks.forEach((el) => (el.href = profile.role === "admin" ? "../admin.html" : "../dashboard.html"));

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
    documentsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    documentsCache.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    renderTable();
  } catch (error) {
    console.error("Gagal memuat dokumen:", error);
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

function statusInfo(status) {
  switch (status) {
    case "pending": return { cls: "admin", label: "Menunggu Persetujuan" };
    case "released": return { cls: "user", label: "Rilis" };
    default: return { cls: "inactive", label: "Draft" };
  }
}

function renderTable() {
  if (documentsCache.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada dokumen. Buat dari menu "Buat Dokumen".</td></tr>`;
    return;
  }

  const isAdmin = currentProfile.role === "admin";
  tableBody.innerHTML = documentsCache.map((d) => {
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

  submitBtn.style.display = !isAdmin && isOwner && item.status === "draft" ? "" : "none";
  releaseBtn.style.display = isAdmin && item.status === "pending" ? "" : "none";
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

submitBtn.addEventListener("click", async () => {
  if (!activeDocument)
