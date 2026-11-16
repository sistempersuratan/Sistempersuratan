// ===========================================================
// nav.js — Sidebar & menu bawah yang dipakai SEMUA halaman.
// Satu tempat untuk mengubah menu, supaya tidak perlu mengedit
// 8 file HTML setiap kali ada menu baru / ganti nama.
//
// Cara pakai di halaman:
//   <body data-nav="admin|user|shared" data-nav-active="kunci-menu">
//   <aside class="sidebar" id="appSidebar"></aside>
//   <nav class="bottom-nav" id="appBottomNav"></nav>
//   <script type="module" src="js/nav.js"></script>   (SEBELUM script halaman)
//
// data-nav:
//   admin  = halaman khusus admin (semua menu tampil)
//   user   = halaman khusus user (menu admin tidak ada)
//   shared = halaman untuk semua peran; menu admin disembunyikan lalu
//            ditampilkan oleh JS halaman lewat class .admin-only
//            (cara yang sama seperti sebelumnya).
// ===========================================================

const ico = (path) =>
  `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const ICONS = {
  dashboard: ico('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  create: ico('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v6M9 15h6"/>'),
  documents: ico('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  types: ico('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  finishing: ico('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  users: ico('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>'),
  profile: ico('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  logout: ico('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>')
};

// Daftar menu — ubah di sini saja.
const ITEMS = [
  { key: "dashboard", label: "Dashboard", short: "Dashboard", icon: "dashboard", dashboard: true },
  { key: "create", label: "Buat Dokumen", short: "Buat", icon: "create", href: "pages/create-document.html" },
  { key: "documents", label: "Arsip Dokumen", short: "Arsip", icon: "documents", href: "pages/documents.html" },
  { key: "types", label: "Jenis Dokumen", short: "Jenis", icon: "types", href: "pages/templates.html", admin: true },
  { key: "finishing", label: "Kop, TTD & Cap", short: "Kop/TTD", icon: "finishing", href: "pages/finishing.html", admin: true },
  { key: "users", label: "Kelola User", short: "User", icon: "users", href: "pages/users.html", admin: true, noBottom: true },
  { key: "profile", label: "Profil", short: "Profil", icon: "profile", href: "pages/profile.html" }
];

const body = document.body;
const mode = body.dataset.nav || "shared";
const active = body.dataset.navActive || "";
const inPages = window.location.pathname.includes("/pages/");
const prefix = inPages ? "../" : "";

function linkFor(item) {
  if (item.dashboard) {
    if (mode === "admin") return prefix + "admin.html";
    return prefix + "dashboard.html"; // shared: JS halaman mengarahkan ulang sesuai peran
  }
  return prefix + item.href;
}

function renderItem(item, bottom) {
  if (item.admin && mode === "user") return "";
  if (bottom && item.noBottom) return "";
  const classes = ["nav-link"];
  if (item.dashboard && mode === "shared") classes.push("nav-dashboard-link");
  if (item.admin) classes.push("admin-only");
  if (item.key === active) classes.push("active");
  const hidden = item.admin && mode === "shared" ? ' style="display:none;"' : "";
  const label = bottom ? item.short : item.label;
  return `<a class="${classes.join(" ")}" href="${linkFor(item)}"${hidden}>${ICONS[item.icon]}<span>${label}</span></a>`;
}

const roleText = mode === "admin" ? "Admin" : "User";
const roleClass = mode === "admin" ? "admin" : "user";

const sidebar = document.getElementById("appSidebar");
if (sidebar) {
  sidebar.innerHTML = `
    <div class="brand"><div class="seal">SP</div><div class="name">Persuratan</div></div>
    <nav class="nav-group">${ITEMS.map((i) => renderItem(i, false)).join("")}</nav>
    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="avatar" id="userInitial">?</div>
        <div class="who">
          <div class="n" id="userName">Memuat...</div>
          <div class="r"><span class="badge ${roleClass}" id="userRoleBadge">${roleText}</span></div>
        </div>
      </div>
      <button class="nav-link js-logout" id="logoutBtn" type="button">${ICONS.logout}<span>Keluar</span></button>
    </div>`;
}

const bottomNav = document.getElementById("appBottomNav");
if (bottomNav) {
  bottomNav.innerHTML = ITEMS.map((i) => renderItem(i, true)).join("");
}
