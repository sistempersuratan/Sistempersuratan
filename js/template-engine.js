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
