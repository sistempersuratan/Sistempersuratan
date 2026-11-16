// ===========================================================
// dashboard-view.js — Tampilan dashboard (dipakai dashboard.html & admin.html)
//
// Isi dashboard, berurutan dari yang paling penting:
//   1. Akses cepat (aksi utama: Buat Dokumen Baru)
//   2. Alur pekerjaan: Pilih jenis -> Isi data -> Diperiksa -> Terbit
//      (sekaligus statistik; tiap tahap bisa diklik ke daftar terfilter)
//   3. Perlu tindakan (admin: menunggu persetujuan; user: ditolak/draft)
//   4. Aktivitas terbaru (8 dokumen terakhir: dibuat/diperbarui/diterbitkan)
//
// Hemat baca data: admin memakai query hitung + limit, bukan memuat semua dokumen.
// ===========================================================

import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const docsRef = () => collection(db, "documents");

const ICON = (path) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const I_PLUS = ICON('<path d="M12 5v14M5 12h14"/>');
const I_FOLDER = ICON('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>');
const I_LAYERS = ICON('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>');
const I_USERS = ICON('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>');
const I_PEN = ICON('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>');

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const millis = (ts) => (ts && ts.toMillis ? ts.toMillis() : 0);

function statusBadge(status) {
  if (status === "pending") return `<span class="badge admin">Menunggu</span>`;
  if (status === "released") return `<span class="badge user">Terbit</span>`;
  return `<span class="badge inactive">Draft</span>`;
}

// Kegiatan terakhir dokumen, ditebak dari field yang sudah ada.
function activityLabel(d) {
  if (d.status === "released") return "Diterbitkan";
  const created = millis(d.createdAt);
  const updated = millis(d.updatedAt);
  return updated - created > 2000 ? "Diperbarui" : "Dibuat";
}

function whenText(ts) {
  if (!ts || !ts.toDate) return "-";
  const dt = ts.toDate();
  const now = new Date();
  const hhmm = dt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now.getTime() - 86400000);
  if (sameDay(dt, now)) return `Hari ini ${hhmm}`;
  if (sameDay(dt, yesterday)) return `Kemarin ${hhmm}`;
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function rowHtml(d, { showOwner, note }) {
  const number = d.documentNumber ? d.documentNumber : "Belum bernomor";
  const owner = showOwner && d.createdByUsername ? ` · ${esc(d.createdByUsername)}` : "";
  const when = d.displayTime || d.updatedAt || d.createdAt;
  return `
    <li><a class="act-row" href="pages/documents.html?open=${encodeURIComponent(d.id)}">
      <div class="act-main">
        <div class="t">${esc(d.templateName || "Dokumen")}</div>
        <div class="m">${esc(number)}${owner}</div>
        ${note ? `<div class="m warn">${esc(note)}</div>` : ""}
      </div>
      <div class="act-side">
        ${statusBadge(d.status)}
        <div class="m">${esc(note ? "" : activityLabel(d) + " · ")}${esc(whenText(when))}</div>
      </div>
    </a></li>`;
}

async function count(q) {
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// ---------- Pengambilan data ----------

async function loadAdminData() {
  const [total, pending, released, types, pendingSnap, recentSnap] = await Promise.all([
    count(query(docsRef())),
    count(query(docsRef(), where("status", "==", "pending"))),
    count(query(docsRef(), where("status", "==", "released"))),
    count(query(collection(db, "templates"), where("active", "==", true))),
    getDocs(query(docsRef(), where("status", "==", "pending"), limit(6))),
    getDocs(query(docsRef(), orderBy("updatedAt", "desc"), limit(8)))
  ]);
  const toItem = (s) => ({ id: s.id, ...s.data() });
  const pendingList = pendingSnap.docs.map(toItem).sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
  return {
    types,
    total,
    draft: Math.max(total - pending - released, 0),
    pending,
    released,
    revision: 0,
    actionItems: pendingList,
    recent: recentSnap.docs.map(toItem)
  };
}

async function loadUserData(uid) {
  const [types, snap] = await Promise.all([
    count(query(collection(db, "templates"), where("active", "==", true))),
    getDocs(query(docsRef(), where("userId", "==", uid)))
  ]);
  const all = snap.docs.map((s) => ({ id: s.id, ...s.data() }));
  const byStatus = (st) => all.filter((d) => (d.status || "draft") === st);
  const drafts = byStatus("draft");
  const revisions = drafts.filter((d) => d.rejectionReason);
  return {
    types,
    total: all.length,
    draft: drafts.length,
    pending: byStatus("pending").length,
    released: byStatus("released").length,
    revision: revisions.length,
    actionItems: [...revisions, ...drafts.filter((d) => !d.rejectionReason)]
      .sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt))
      .slice(0, 6),
    recent: [...all].sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt)).slice(0, 8)
  };
}

// ---------- Tampilan ----------

export async function renderDashboard(root, { role, uid }) {
  const isAdmin = role === "admin";
  root.innerHTML = `<div class="muted">Memuat ringkasan...</div>`;

  let data;
  try {
    data = isAdmin ? await loadAdminData() : await loadUserData(uid);
  } catch (error) {
    console.error("Gagal memuat dashboard:", error);
    root.innerHTML = `<div class="panel"><div class="empty-state"><p>Gagal memuat ringkasan. Coba refresh halaman.</p></div></div>`;
    return;
  }

  const actions = `
    <div class="dash-actions">
      <a class="btn btn-primary btn-act" href="pages/create-document.html">${I_PLUS}<span>Buat Dokumen Baru</span></a>
      <a class="btn btn-act" href="pages/documents.html">${I_FOLDER}<span>Arsip Dokumen</span></a>
      ${isAdmin ? `
        <a class="btn btn-act" href="pages/templates.html">${I_LAYERS}<span>Jenis Dokumen</span></a>
        <a class="btn btn-act" href="pages/finishing.html">${I_PEN}<span>Tanda Tangan &amp; Cap</span></a>
        <a class="btn btn-act" href="pages/users.html">${I_USERS}<span>Kelola User</span></a>` : ""}
    </div>`;

  const step2Attn = !isAdmin && data.revision > 0;
  const flow = `
    <section class="flow" aria-label="Alur pekerjaan">
      <a class="flow-step" href="pages/create-document.html">
        <div class="no">1 · Pilih jenis</div>
        <div class="n">${data.types}</div>
        <div class="c">jenis dokumen tersedia</div>
      </a>
      <a class="flow-step ${step2Attn ? "attn" : ""}" href="pages/documents.html?status=draft">
        <div class="no">2 · Isi data</div>
        <div class="n">${data.draft}</div>
        <div class="c">${step2Attn ? `draft, ${data.revision} perlu revisi` : "draft"}</div>
      </a>
      <a class="flow-step ${isAdmin && data.pending > 0 ? "attn" : ""}" href="pages/documents.html?status=pending">
        <div class="no">3 · Diperiksa</div>
        <div class="n">${data.pending}</div>
        <div class="c">${isAdmin ? "menunggu persetujuan Anda" : "menunggu persetujuan admin"}</div>
      </a>
      <a class="flow-step" href="pages/documents.html?status=released">
        <div class="no">4 · Terbit</div>
        <div class="n">${data.released}</div>
        <div class="c">dari ${data.total} dokumen</div>
      </a>
    </section>`;

  const actionRows = data.actionItems.map((d) =>
    rowHtml(d, { showOwner: isAdmin, note: !isAdmin && d.rejectionReason ? `Ditolak: ${d.rejectionReason}` : (!isAdmin ? "Draft belum diajukan" : "") })
  ).join("");
  const actionPanel = data.actionItems.length === 0 ? "" : `
    <section class="panel">
      <div class="panel-title"><h3>${isAdmin ? "Menunggu persetujuan" : "Perlu tindakan Anda"}</h3>
        <a href="pages/documents.html?status=${isAdmin ? "pending" : "draft"}">Lihat semua</a></div>
      <ul class="act-list">${actionRows}</ul>
    </section>`;

  const recentPanel = `
    <section class="panel">
      <div class="panel-title"><h3>Aktivitas terbaru</h3><a href="pages/documents.html">Arsip</a></div>
      ${data.recent.length === 0
        ? `<div class="empty-state" style="padding:24px 8px;"><p>Belum ada dokumen. Mulai dengan <strong>Buat Dokumen Baru</strong>.</p></div>`
        : `<ul class="act-list">${data.recent.map((d) => rowHtml(d, { showOwner: isAdmin, note: "" })).join("")}</ul>`}
    </section>`;

  root.innerHTML = `
    ${actions}
    ${flow}
    <div class="dash-cols ${actionPanel ? "" : "single"}">${actionPanel}${recentPanel}</div>`;
}
