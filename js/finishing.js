// ===========================================================
// finishing.js — Halaman pages/finishing.html (khusus admin)
// - Kelola aset tanda tangan & cap (koleksi signingAssets, tak bisa diganti, hanya dicabut)
// - Pilih aset yang dipakai (settings/finishing)
// - Default kelengkapan per jenis dokumen (templates.finishingDefault / finishingChoice)
// Gambar disimpan sebagai data URL kecil di Firestore (tanpa Firebase Storage).
// Hanya admin yang bisa membaca koleksi ini (lihat firestore.rules).
// ===========================================================

import { requireAuth, requireRole, logout } from "./auth.js";
import { showToast, setButtonLoading } from "./ui.js";
import { db } from "./firebase-config.js";
import { isSafeImageDataUrl } from "./template-engine.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MAX_DATA_URL = 200000; // ±150 KB sebagai gambar; aman untuk batas 1 MiB dokumen Firestore

const userName = document.getElementById("userName");
const userInitial = document.getElementById("userInitial");
const logoutButtons = document.querySelectorAll(".js-logout");

const assetType = document.getElementById("assetType");
const assetOwner = document.getElementById("assetOwner");
const assetOwnerLabel = document.getElementById("assetOwnerLabel");
const assetTitle = document.getElementById("assetTitle");
const assetTitleField = document.getElementById("assetTitleField");
const assetFile = document.getElementById("assetFile");
const assetPreview = document.getElementById("assetPreview");
const assetPreviewWrap = document.getElementById("assetPreviewWrap");
const assetConfirm = document.getElementById("assetConfirm");
const assetSaveBtn = document.getElementById("assetSaveBtn");
const assetError = document.getElementById("assetError");
const assetList = document.getElementById("assetList");
const typeBody = document.getElementById("typeBody");

let currentUsername = "";
let pendingImage = null;
let assets = [];
let settings = { activeSignatureId: null, activeStampId: null };
let types = [];

requireAuth((user, profile) => {
  if (!requireRole(profile.role, "admin")) return;
  currentUsername = profile.username || user.email;
  userName.textContent = currentUsername;
  userInitial.textContent = currentUsername.charAt(0).toUpperCase();
  loadAll();
});

logoutButtons.forEach((btn) => {
  btn.addEventListener("click", async () => {
    try { await logout(); } catch (e) { showToast("Gagal keluar. Coba lagi.", "error"); }
  });
});

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function showError(msg) { assetError.textContent = msg; assetError.classList.add("show"); }
function clearError() { assetError.textContent = ""; assetError.classList.remove("show"); }

// ---------- Form tambah aset ----------

assetType.addEventListener("change", () => {
  const sig = assetType.value === "signature";
  assetOwnerLabel.textContent = sig ? "Nama pejabat (sesuai penandatangan di dokumen)" : "Nama/label cap (mis. Cap Kantor)";
  assetTitleField.style.display = sig ? "" : "none";
});

assetFile.addEventListener("change", async () => {
  clearError();
  pendingImage = null;
  assetPreviewWrap.style.display = "none";
  const file = assetFile.files[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    showError("Format harus PNG, JPG, atau WebP.");
    return;
  }
  try {
    pendingImage = await shrinkImage(file);
    assetPreview.src = pendingImage;
    assetPreviewWrap.style.display = "block";
  } catch (e) {
    showError(e.message || "Gambar tidak dapat diproses.");
  }
});

// Kecilkan gambar sampai muat batas ukuran. PNG dipertahankan agar transparansi tidak hilang.
function shrinkImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Berkas bukan gambar yang valid."));
      img.onload = () => {
        for (const maxSide of [600, 480, 360, 260]) {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          const url = canvas.toDataURL("image/png");
          if (url.length <= MAX_DATA_URL) return resolve(url);
        }
        reject(new Error("Gambar terlalu besar/detail. Gunakan gambar yang lebih sederhana."));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

assetSaveBtn.addEventListener("click", async () => {
  clearError();
  const owner = assetOwner.value.trim();
  const isSig = assetType.value === "signature";
  if (!owner) return showError(isSig ? "Nama pejabat wajib diisi." : "Nama/label cap wajib diisi.");
  if (!pendingImage || !isSafeImageDataUrl(pendingImage)) return showError("Pilih berkas gambar terlebih dahulu.");
  if (!assetConfirm.checked) return showError("Centang pernyataan persetujuan pejabat berwenang.");

  setButtonLoading(assetSaveBtn, true, "Simpan Aset");
  try {
    await addDoc(collection(db, "signingAssets"), {
      type: assetType.value,
      ownerName: owner,
      ownerTitle: isSig ? assetTitle.value.trim() : "",
      image: pendingImage,
      status: "active",
      authorization: {
        statement: "Disetujui pejabat berwenang untuk dipakai pada dokumen resmi kantor.",
        confirmedBy: currentUsername,
        confirmedAt: serverTimestamp()
      },
      createdBy: currentUsername,
      createdAt: serverTimestamp()
    });
    assetOwner.value = "";
    assetTitle.value = "";
    assetFile.value = "";
    assetConfirm.checked = false;
    pendingImage = null;
    assetPreviewWrap.style.display = "none";
    showToast("Aset berhasil disimpan.", "success");
    await loadAssets();
  } catch (error) {
    console.error("Gagal simpan aset:", error);
    showError("Gagal menyimpan aset. Coba lagi.");
  } finally {
    setButtonLoading(assetSaveBtn, false, "Simpan Aset");
  }
});

// ---------- Daftar aset ----------

async function loadAll() {
  await Promise.all([loadAssets(), loadTypes()]);
}

async function loadAssets() {
  try {
    const [setSnap, listSnap] = await Promise.all([
      getDoc(doc(db, "settings", "finishing")),
      getDocs(query(collection(db, "signingAssets"), orderBy("createdAt", "desc")))
    ]);
    settings = { activeSignatureId: null, activeStampId: null, ...(setSnap.exists() ? setSnap.data() : {}) };
    assets = listSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAssets();
  } catch (error) {
    console.error("Gagal memuat aset:", error);
    assetList.innerHTML = `<div class="muted">Gagal memuat aset. Coba refresh halaman.</div>`;
  }
}

function renderAssets() {
  if (assets.length === 0) {
    assetList.innerHTML = `<div class="muted">Belum ada aset. Tambahkan tanda tangan atau cap di atas.</div>`;
    return;
  }
  assetList.innerHTML = assets.map((a) => {
    const isSig = a.type === "signature";
    const inUse = isSig ? settings.activeSignatureId === a.id : settings.activeStampId === a.id;
    const revoked = a.status === "revoked";
    return `
      <div class="asset-card ${revoked ? "revoked" : ""}">
        <div class="thumb">${isSafeImageDataUrl(a.image) ? `<img src="${a.image}" alt="">` : ""}</div>
        <div class="ttl">${esc(a.ownerName)}</div>
        <div class="sub">${isSig ? "Tanda tangan" : "Cap"}${a.ownerTitle ? " · " + esc(a.ownerTitle) : ""}</div>
        <div>
          ${revoked ? '<span class="badge inactive">Dicabut</span>' : inUse ? '<span class="badge user">Dipakai</span>' : '<span class="badge admin">Tersedia</span>'}
        </div>
        ${revoked ? "" : `<div class="acts">
          ${inUse ? "" : `<button class="link-btn" data-act="use" data-id="${a.id}">Pakai</button>`}
          <button class="link-btn danger" data-act="revoke" data-id="${a.id}">Cabut</button>
        </div>`}
      </div>`;
  }).join("");
}

assetList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const asset = assets.find((a) => a.id === btn.dataset.id);
  if (!asset) return;
  const isSig = asset.type === "signature";
  const field = isSig ? "activeSignatureId" : "activeStampId";

  try {
    if (btn.dataset.act === "use") {
      await setDoc(doc(db, "settings", "finishing"), { [field]: asset.id, updatedAt: serverTimestamp(), updatedBy: currentUsername }, { merge: true });
      showToast("Aset dijadikan yang dipakai.", "success");
    } else if (btn.dataset.act === "revoke") {
      if (!confirm(`Cabut aset "${asset.ownerName}"? Aset tidak bisa dipakai lagi. Dokumen yang sudah terbit tidak berubah.`)) return;
      await updateDoc(doc(db, "signingAssets", asset.id), { status: "revoked", revokedAt: serverTimestamp(), revokedBy: currentUsername });
      if (settings[field] === asset.id) {
        await setDoc(doc(db, "settings", "finishing"), { [field]: null, updatedAt: serverTimestamp(), updatedBy: currentUsername }, { merge: true });
      }
      showToast("Aset dicabut.", "success");
    }
    await loadAssets();
  } catch (error) {
    console.error("Gagal ubah aset:", error);
    showToast("Gagal menyimpan perubahan. Coba lagi.", "error");
  }
});

// ---------- Pengaturan per jenis dokumen ----------

async function loadTypes() {
  try {
    const snap = await getDocs(collection(db, "templates"));
    types = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    renderTypes();
  } catch (error) {
    console.error("Gagal memuat jenis dokumen:", error);
    typeBody.innerHTML = `<tr><td colspan="4" class="table-empty">Gagal memuat data. Coba refresh halaman.</td></tr>`;
  }
}

function renderTypes() {
  if (types.length === 0) {
    typeBody.innerHTML = `<tr><td colspan="4" class="table-empty">Belum ada jenis dokumen.</td></tr>`;
    return;
  }
  typeBody.innerHTML = types.map((t) => {
    const def = t.finishingDefault === "complete" ? "complete" : "plain";
    const choice = t.finishingChoice === "user" ? "user" : "admin";
    return `
      <tr data-id="${t.id}">
        <td>${esc(t.name)}</td>
        <td><select class="input" data-f="default" style="width:auto;">
          <option value="plain" ${def === "plain" ? "selected" : ""}>Tanpa TTD &amp; cap</option>
          <option value="complete" ${def === "complete" ? "selected" : ""}>Lengkap (TTD &amp; cap)</option>
        </select></td>
        <td><select class="input" data-f="choice" style="width:auto;">
          <option value="admin" ${choice === "admin" ? "selected" : ""}>Hanya admin</option>
          <option value="user" ${choice === "user" ? "selected" : ""}>Pengguna boleh meminta</option>
        </select></td>
        <td><button class="link-btn" data-save="${t.id}">Simpan</button></td>
      </tr>`;
  }).join("");
}

typeBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-save]");
  if (!btn) return;
  const row = btn.closest("tr");
  try {
    await updateDoc(doc(db, "templates", btn.dataset.save), {
      finishingDefault: row.querySelector('[data-f="default"]').value,
      finishingChoice: row.querySelector('[data-f="choice"]').value,
      updatedAt: serverTimestamp()
    });
    showToast("Pengaturan disimpan.", "success");
  } catch (error) {
    console.error("Gagal simpan pengaturan:", error);
    showToast("Gagal menyimpan pengaturan. Coba lagi.", "error");
  }
});
