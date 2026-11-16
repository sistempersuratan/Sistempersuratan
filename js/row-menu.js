// ===========================================================
// row-menu.js — Popup pilihan untuk baris tabel yang bisa diklik.
// Dipakai tabel Arsip Dokumen, Kelola User, dan Jenis Dokumen,
// supaya tabel tidak perlu kolom "Aksi" dan tampilannya konsisten.
//
//   makeRowsClickable(tbody, (id) => ...)   // baris: <tr class="row-click" data-id tabindex="0">
//   openRowMenu({ title, meta, sections: [{ label?, items: [{ label, primary?, danger?, onClick }] }] })
// ===========================================================

let overlay = null;
let listEl = null;
let titleEl = null;
let metaEl = null;

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box small" role="dialog" aria-modal="true">
      <h3 class="rm-title" style="margin:0;"></h3>
      <div class="rm-meta muted" style="font-size:13px; margin:2px 0 10px;"></div>
      <div class="menu-list"></div>
    </div>`;
  document.body.appendChild(overlay);
  titleEl = overlay.querySelector(".rm-title");
  metaEl = overlay.querySelector(".rm-meta");
  listEl = overlay.querySelector(".menu-list");
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeRowMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeRowMenu();
  });
}

export function closeRowMenu() {
  if (overlay) overlay.classList.remove("show");
}

export function openRowMenu({ title, meta, sections }) {
  ensureOverlay();
  titleEl.textContent = title || "";
  metaEl.textContent = meta || "";
  listEl.innerHTML = "";

  sections.forEach((section) => {
    if (section.label) {
      const lab = document.createElement("div");
      lab.className = "menu-label";
      lab.textContent = section.label;
      listEl.appendChild(lab);
    }
    section.items.forEach((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "menu-item" + (item.primary ? " primary" : "") + (item.danger ? " danger" : "");
      btn.textContent = item.label;
      if (item.disabled) btn.disabled = true;
      btn.addEventListener("click", () => {
        closeRowMenu();
        if (item.onClick) item.onClick();
      });
      listEl.appendChild(btn);
    });
  });

  overlay.classList.add("show");
  const first = listEl.querySelector("button:not([disabled])");
  if (first) first.focus();
}

export function makeRowsClickable(tbody, onSelect) {
  tbody.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row) onSelect(row.dataset.id);
  });
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    e.preventDefault();
    onSelect(row.dataset.id);
  });
}
