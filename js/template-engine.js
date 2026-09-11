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
