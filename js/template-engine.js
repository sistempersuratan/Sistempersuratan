// ===========================================================
// template-engine.js — Rendering placeholder {{field}} pada template.
// REUSABLE: dipakai di template-editor.js (preview) dan nanti di
// create-document.js (STEP 4) untuk render dokumen sungguhan.
// ===========================================================

export function renderTemplate(html, data) {
  if (!html) return "";
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined && data[key] !== "") {
      return escapeHtml(String(data[key]));
    }
    return match;
  });
}

export function extractPlaceholders(html) {
  if (!html) return [];
  const matches = [...html.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Bersihkan HTML dari elemen/atribut yang bisa menjalankan skrip.
 * DIPAKAI setiap kali HTML yang TERSIMPAN di database (renderedHtml)
 * ditampilkan ke layar, karena isi field itu tidak diperiksa oleh
 * Security Rules — user nakal bisa menulis apa saja lewat Console,
 * dan skripnya akan jalan di browser admin saat dokumen dibuka.
 *
 * - Menghapus <script>, <iframe>, <object>, <embed>, <form>, <link>, <meta>, <base>
 * - Menghapus semua atribut on* (onclick, onerror, onload, dst)
 * - Menghapus href/src/action yang memakai skema berbahaya (javascript:, data:text/html, dst)
 *
 * @param {string} html
 * @returns {string} HTML aman
 */
export function sanitizeHtml(html) {
  if (!html) return "";
  const parsed = new DOMParser().parseFromString(String(html), "text/html");

  const blocked = "script,iframe,frame,frameset,object,embed,applet,form,link,meta,base";
  parsed.querySelectorAll(blocked).forEach((el) => el.remove());

  const urlAttrs = ["href", "src", "xlink:href", "action", "formaction", "srcdoc", "poster", "background"];
  const safeScheme = /^(https?:|mailto:|tel:|#)/;

  parsed.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        el.removeAttribute(attr.name);
        return;
      }
      if (urlAttrs.includes(name)) {
        const value = attr.value.replace(/[\u0000-\u0020]/g, "").toLowerCase();
        const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(value);
        const okDataImage = /^data:image\/(png|jpe?g|gif|webp);/.test(value);
        if (hasScheme && !safeScheme.test(value) && !okDataImage) {
          el.removeAttribute(attr.name);
        }
      }
    });
  });

  // <style> di awal template dipindah parser ke <head>; ikutkan supaya tampilan tidak hilang
  const styles = [...parsed.head.querySelectorAll("style")].map((el) => el.outerHTML).join("");
  return styles + parsed.body.innerHTML;
}

// ===========================================================
// Penomoran surat otomatis (per jenis surat)
// Dipakai: documents.js (saat admin merilis) & template-editor.js (contoh format)
// ===========================================================

export const DEFAULT_NUMBER_FORMAT = "{no}/{kode}/{bln}/{tahun}";
const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/**
 * Susun nomor surat dari format template.
 * Kode yang dikenali: {no} urutan 3 digit, {kode} kode jenis surat,
 * {bln} bulan romawi, {bulan} bulan 2 digit, {tahun} tahun 4 digit.
 * Format tanpa {no} dianggap tidak valid dan diganti format bawaan.
 */
export function buildDocumentNumber(format, code, seq, date = new Date()) {
  const fmt = format && format.includes("{no}") ? format : DEFAULT_NUMBER_FORMAT;
  const month = date.getMonth();
  return fmt
    .replaceAll("{no}", String(seq).padStart(3, "0"))
    .replaceAll("{kode}", code || "DOK")
    .replaceAll("{bln}", ROMAN_MONTHS[month])
    .replaceAll("{bulan}", String(month + 1).padStart(2, "0"))
    .replaceAll("{tahun}", String(date.getFullYear()));
}

// {{nomor_surat}} = placeholder khusus yang DIISI SISTEM saat dokumen dirilis.
const NUMBER_PLACEHOLDER = /\{\{\s*nomor_surat\s*\}\}/g;

/** Isi {{nomor_surat}} dengan nomor resmi (dipakai saat rilis). */
export function fillNumberPlaceholder(html, number) {
  return (html || "").replace(NUMBER_PLACEHOLDER, () => escapeHtml(String(number)));
}

/** Tampilkan petunjuk sementara untuk {{nomor_surat}} pada dokumen yang belum dirilis. */
// ---------- Posisi tanda tangan & cap ----------
// Template menandai posisinya dengan {{ttd_gambar}} dan {{cap_gambar}}
// (biasanya di dalam satu kotak berukuran tetap, supaya ruangnya tetap ada
// walau gambarnya tidak dipasang). Gambar asli HANYA dipasang saat admin
// menerbitkan dokumen (lihat applyFinishing).
const TTD_TOKEN = /\{\{\s*ttd_gambar\s*\}\}/g;
const CAP_TOKEN = /\{\{\s*cap_gambar\s*\}\}/g;

export function hasFinishingTokens(html) {
  const h = html || "";
  return { signature: /\{\{\s*ttd_gambar\s*\}\}/.test(h), stamp: /\{\{\s*cap_gambar\s*\}\}/.test(h) };
}

// Hanya data URL gambar biasa yang boleh dipasang (bukan svg / skema lain).
export function isSafeImageDataUrl(url) {
  return typeof url === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url);
}

/**
 * Pasang (atau kosongkan) tanda tangan & cap pada HTML dokumen.
 * mode "complete": ganti penanda dengan gambar. mode "plain": penanda dikosongkan,
 * ruang kotaknya tetap sehingga layout dan tanda tangan basah tetap rapi.
 */
export function applyFinishing(html, { mode, signatureSrc, stampSrc } = {}) {
  const complete = mode === "complete";
  const sig = complete && isSafeImageDataUrl(signatureSrc)
    ? `<img alt="Tanda tangan" src="${signatureSrc}" style="position:absolute; left:26px; top:4px; height:68px;">` : "";
  const stamp = complete && isSafeImageDataUrl(stampSrc)
    ? `<img alt="Cap" src="${stampSrc}" style="position:absolute; left:-6px; top:-4px; height:84px; opacity:.88;">` : "";
  return (html || "").replace(CAP_TOKEN, () => stamp).replace(TTD_TOKEN, () => sig);
}

// Untuk tampilan dokumen yang BELUM terbit (draft/pending, pratinjau):
// nomor & posisi TTD/cap hanya ditandai, tanpa gambar asli.
export function markNumberPlaceholder(html) {
  const box = (label, left) =>
    `<span style="position:absolute; left:${left}px; top:8px; border:1px dashed #aaa; color:#888; font-size:9pt; padding:12px 8px;">${label}</span>`;
  return (html || "")
    .replace(NUMBER_PLACEHOLDER, '<span style="background:#fff3cd; padding:0 4px;">[nomor diberikan saat rilis]</span>')
    .replace(CAP_TOKEN, () => box("Cap", 0))
    .replace(TTD_TOKEN, () => box("Tanda tangan", 70));
}

// ===========================================================
// Kop surat (logo + nama instansi + alamat)
// Diatur admin di menu "Kop, TTD & Cap" (settings/letterhead), dibaca semua
// pengguna. Template menandai posisinya dengan {{kop_surat}}. Seperti nomor
// surat, penanda ini diganti saat dokumen DITAMPILKAN, jadi dokumen draft
// selalu memakai kop terbaru; dokumen terbit menyimpan hasil akhirnya.
// ===========================================================
const KOP_TOKEN = /\{\{\s*kop_surat\s*\}\}/g;

export function hasLetterheadToken(html) {
  return /\{\{\s*kop_surat\s*\}\}/.test(html || "");
}

export function isLetterheadConfigured(cfg) {
  return !!(cfg && (String(cfg.name || "").trim() || isSafeImageDataUrl(cfg.logo)));
}

/** Susun HTML kop surat dari pengaturan { name, address, contact, logo }. */
export function buildLetterheadHtml(cfg) {
  if (!isLetterheadConfigured(cfg)) return "";
  const logo = isSafeImageDataUrl(cfg.logo)
    ? `<img alt="Logo" src="${cfg.logo}" style="max-height:80px; max-width:96px;">` : "";
  const line = (text, style) => (String(text || "").trim()
    ? `<div style="${style}">${escapeHtml(String(text).trim())}</div>` : "");
  // Kolom logo & kolom kosong selebar sama, supaya teks tetap tepat di tengah halaman.
  return `<table style="width:100%; border-collapse:collapse; border-bottom:3px double #000; margin-bottom:18px;"><tr>`
    + `<td style="width:100px; padding:0 0 8px 0; vertical-align:middle; text-align:left;">${logo}</td>`
    + `<td style="padding:0 0 8px 0; vertical-align:middle; text-align:center; line-height:1.35;">`
    + line(cfg.name, "font-size:16pt; font-weight:bold; text-transform:uppercase;")
    + line(cfg.address, "font-size:11pt; white-space:pre-line;")
    + line(cfg.contact, "font-size:10pt;")
    + `</td><td style="width:100px;"></td></tr></table>`;
}

/**
 * Ganti {{kop_surat}} dengan kop surat.
 * placeholder:true -> bila kop belum diatur, tampilkan petunjuk (untuk pratinjau/draft).
 */
export function applyLetterhead(html, cfg, { placeholder = false } = {}) {
  const kop = buildLetterheadHtml(cfg)
    || (placeholder
      ? '<div style="border:1px dashed #aaa; color:#888; font-size:10pt; padding:10px; text-align:center; margin-bottom:18px;">[Kop surat belum diatur admin]</div>'
      : "");
  return (html || "").replace(KOP_TOKEN, () => kop);
}
