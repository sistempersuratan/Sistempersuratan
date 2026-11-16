// ===========================================================
// dashboard-view.js — Tampilan dashboard (dipakai dashboard.html & admin.html)
//
// Isi dashboard (sengaja ringkas; menu sudah ada di sidebar kiri):
//   1. Alur pekerjaan: Pilih jenis -> Isi data -> Diperiksa -> Terbit
//      (sekaligus statistik; tiap tahap bisa diklik ke daftar terfilter)
//   2. Satu daftar yang paling relevan:
//      - "Perlu tindakan" bila ada (admin: menunggu persetujuan; user: ditolak/draft)
//      - jika tidak ada, "Aktivitas terbaru"
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

  // Hanya SATU daftar: yang perlu ditindak kalau ada, kalau tidak, aktivitas terbaru.
  const hasActions = data.actionItems.length > 0;
  const items = (hasActions ? data.actionItems : data.recent).slice(0, 5);
  const rows = items.map((d) =>
    hasActions
      ? rowHtml(d, { showOwner: isAdmin, note: !isAdmin && d.rejectionReason ? `Ditolak: ${d.rejectionReason}` : (!isAdmin ? "Draft belum diajukan" : "") })
      : rowHtml(d, { showOwner: isAdmin, note: "" })
  ).join("");

  const listPanel = `
    <section class="panel">
      <div class="panel-title">
        <h3>${hasActions ? (isAdmin ? "Menunggu persetujuan" : "Perlu tindakan Anda") : "Aktivitas terbaru"}</h3>
        <a href="pages/documents.html${hasActions ? `?status=${isAdmin ? "pending" : "draft"}` : ""}">${hasActions ? "Lihat semua" : "Arsip"}</a>
      </div>
      ${items.length === 0
        ? `<div class="empty-state" style="padding:24px 8px;"><p>Belum ada dokumen. Mulai dari menu <strong>Buat Dokumen</strong>.</p></div>`
        : `<ul class="act-list">${rows}</ul>`}
    </section>`;

  root.innerHTML = `${flow}<div style="margin-top:20px;">${listPanel}</div>`;
}
