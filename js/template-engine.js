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
export function markNumberPlaceholder(html) {
  return (html || "").replace(
    NUMBER_PLACEHOLDER,
    '<span style="background:#fff3cd; padding:0 4px;">[nomor diberikan saat rilis]</span>'
  );
}
