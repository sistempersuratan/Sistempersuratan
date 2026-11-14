# Sistem Persuratan

Aplikasi web untuk membuat surat/dokumen dari template siap pakai.
HTML + CSS + JavaScript vanilla (ES Modules) dengan Firebase
(Authentication + Firestore) sebagai backend. Hosting statis di GitHub Pages.

**Live:** https://sistempersuratan.github.io/Sistempersuratan/

## Fitur

| Peran | Bisa melakukan |
|---|---|
| **Admin** | Kelola user (tambah, edit, nonaktifkan, **kirim email reset password**), kelola template (buat/edit/nonaktifkan/hapus), lihat semua dokumen, setujui/tolak dokumen, export rekap Excel |
| **User** | Pilih template, isi form, simpan draft, edit/hapus draft, ajukan rilis, lihat dokumen sendiri, cetak / PDF / Word / kirim WA & Email, **ubah password sendiri di halaman Profil** |

### Alur dokumen

```
User buat dokumen ──► DRAFT ──(user ajukan)──► PENDING ──(admin setujui + isi nomor)──► RILIS
                        ▲                          │
                        └──────(admin tolak)───────┘
```

- Draft boleh diedit/dihapus pemiliknya. Setelah diajukan (pending) dan setelah
  rilis, user tidak bisa mengubahnya lagi.
- Nomor surat **diberikan otomatis oleh sistem** saat admin merilis (lihat *Penomoran surat*).
- Surat buatan admin juga berstatus Draft dulu, lalu admin menekan *Setujui & Rilis* sendiri.
- Aturan ini **dijaga di Firestore Security Rules** (bukan cuma di tampilan).

## Struktur Project

```
index.html            Login (pakai username)
dashboard.html        Dashboard user
admin.html            Dashboard admin
firestore.rules       Security Rules (salin ke Firebase Console)
css/                  style, dashboard, admin, template-editor
js/
  firebase-config.js  Satu-satunya tempat inisialisasi Firebase
  auth.js             Login username, guard login & role, logout
  ui.js               Toast, loading tombol, pesan error ramah
  template-engine.js  renderTemplate() untuk ganti {{placeholder}}
  login.js, dashboard.js, admin.js
  users.js, templates.js, template-editor.js
  create-document.js, documents.js, profile.js
pages/
  users.html, templates.html, template-editor.html
  create-document.html, documents.html, profile.html
```

## Penomoran surat

Nomor diberikan **otomatis saat admin merilis**, urutannya dihitung **per jenis surat
(template) per tahun**. Diatur di Template Editor:

- **Kode Jenis Surat** — mis. `ST` (Surat Tugas), `INV` (Invoice).
- **Format Nomor** — bawaan `{no}/{kode}/{bln}/{tahun}` → `001/ST/XI/2026`.
  Kode yang bisa dipakai: `{no}` urutan 3 digit, `{kode}`, `{bln}` bulan romawi,
  `{bulan}` bulan angka, `{tahun}`. Wajib memuat `{no}`.
- Taruh `{{nomor_surat}}` di isi surat di tempat nomor ingin muncul. Sebelum rilis,
  tempat itu tampil sebagai "[nomor diberikan saat rilis]".
- `nomor_surat` adalah nama khusus milik sistem — jangan dibuat sebagai field isian
  (Template Editor menolaknya; field lama bernama itu otomatis disembunyikan dari form).
- Pemberian nomor memakai **transaksi Firestore** sehingga dua admin yang merilis
  bersamaan tidak mendapat nomor kembar, dan dokumen tidak bisa dirilis dua kali.
- Template lama yang belum diberi kode memakai kode `DOK` — buka Template Editor
  dan isi Kode Jenis Surat-nya.
- Nomor mulai 001 lagi tiap tahun baru, terpisah untuk tiap template.

## Keamanan

- **Security Rules** (`firestore.rules`) menjaga alur approval di sisi server: user
  tidak bisa merilis dokumen sendiri, mengisi nomor surat, atau mengubah dokumen
  setelah diajukan. Akun nonaktif ditolak Firestore.
- **Anti-XSS tersimpan:** isi `renderedHtml` pada dokumen tidak diperiksa Rules,
  jadi setiap kali ditampilkan dilewatkan `sanitizeHtml()` (`js/template-engine.js`)
  yang membuang `<script>`, `<iframe>`, atribut `on*`, dan tautan `javascript:`.
  Pakai fungsi ini untuk **setiap** HTML dari database yang masuk `innerHTML`.
- **Reset password:** admin menekan *Reset Password* di Kelola User; Firebase
  mengirim email tautan reset ke alamat user (jadi email user harus asli).
  Admin tidak pernah melihat atau menentukan password user.
- Batasan yang diketahui: keunikan username hanya dicek di sisi klien, dan
  lookup username saat login membuka satu dokumen user (email & role) bagi
  yang menebak username.

## Login dengan username

Firebase Auth hanya mengenal email+password, jadi `auth.js` mencari `email`
berdasarkan `username` di collection `users`, lalu memanggil
`signInWithEmailAndPassword`. Setiap dokumen `users` wajib punya `username`
yang unik.

## Struktur data Firestore

- `users/{uid}`: `username`, `email`, `role` (`admin`/`user`), `active`, `createdAt`, `updatedAt`
- `templates/{id}`: `name`, `category`, `description`, `numberCode`, `numberFormat`, `html`, `fields[]`
  (`name`, `label`, `type`, `required`, `options`), `active`, `createdAt`, `updatedAt`
- `counters/{templateId}_{tahun}`: `last` (nomor urut terakhir), `templateId`, `year`, `updatedAt`
- `documents/{id}`: `userId`, `createdByUsername`, `templateId`, `templateName`,
  `data`, `renderedHtml`, `status` (`draft`/`pending`/`released`), `documentNumber`,
  `rejectionReason`, `releasedAt`, `releasedBy`, `createdAt`, `updatedAt`

## Setup Firebase

1. Buat project di [Firebase Console](https://console.firebase.google.com).
2. **Authentication** → aktifkan sign-in **Email/Password**.
   Tambahkan domain hosting ke **Authentication → Settings → Authorized domains**
   (contoh: `sistempersuratan.github.io`).
3. **Firestore Database** → Create database (mode Production).
4. **Project settings → Your apps → Web app** → salin `firebaseConfig` ke
   `js/firebase-config.js`.
5. **Firestore → Rules** → tempel seluruh isi file `firestore.rules` → **Publish**.
   Ulangi langkah ini setiap kali file itu berubah.

### Membuat admin pertama (sekali saja)

1. **Authentication → Users → Add user** (email + password). Salin **User UID**.
2. **Firestore → Start collection `users`**, Document ID = UID tadi, isi:

   | Field | Type | Value |
   |---|---|---|
   | username | string | mis. `admin` (unik, untuk login) |
   | email | string | sama dengan email di Authentication |
   | role | string | `admin` |
   | active | boolean | `true` |
   | createdAt | timestamp | waktu sekarang |
   | updatedAt | timestamp | waktu sekarang |

User berikutnya dibuat dari halaman **Kelola User**. Membuat user baru memakai
instance Firebase sementara supaya sesi login admin tidak berpindah.

## Menjalankan lokal

Wajib lewat server lokal (bukan `file://`) karena memakai ES Modules:

```bash
python3 -m http.server 5500   # lalu buka http://localhost:5500
```

## Deploy (GitHub Pages)

Repo → **Settings → Pages** → Source: *Deploy from a branch*, branch `main`,
folder `/ (root)`. File `.nojekyll` sudah ada. Semua path di kode bersifat
relatif (helper `pagePrefix()` di `auth.js`), jadi aman di subfolder
`/Sistempersuratan/`.

## Checklist pengujian

- [ ] Login username berhasil; admin ke `admin.html`, user ke `dashboard.html`.
- [ ] User **tidak** bisa membuka halaman admin (dilempar balik).
- [ ] User membuat dokumen → status Draft; tombol Edit & Hapus muncul.
- [ ] Edit draft → perubahan tersimpan, isi pratinjau ikut berubah.
- [ ] User Ajukan Rilis → status Menunggu; Edit/Hapus hilang.
- [ ] Admin Tolak → kembali Draft (alasan tampil); user bisa edit lalu ajukan ulang.
- [ ] Admin Setujui & Rilis → status Rilis, nomor otomatis (mis. `001/ST/XI/2026`),
      dokumen kedua jenis yang sama dapat `002`, jenis lain mulai `001` sendiri.
- [ ] `{{nomor_surat}}` di isi surat berubah menjadi nomor resmi setelah rilis.
- [ ] Template Editor: Kode Jenis Surat wajib; contoh nomor berubah saat diketik.
- [ ] Dua tab, login akun berbeda → tidak saling menimpa (login per tab).
- [ ] Search, filter status, dan sort di daftar dokumen bekerja.
- [ ] **Uji keamanan:** login sebagai user, buka Console, coba
      `updateDoc` status dokumen jadi `released` → harus ditolak
      (permission-denied).
- [ ] Nonaktifkan user → user itu tidak bisa login / membaca data lagi.
- [ ] **Profil:** menu Profil ada di sidebar & menu bawah; username/email/peran tampil.
- [ ] **Ubah password:** password lama salah → ditolak; benar → berhasil, login ulang
      dengan password baru jalan.
- [ ] **Reset password (admin):** Kelola User → Reset Password → email masuk ke user.
- [ ] **Mobile (lebar ~360px):** admin punya menu bawah di semua halaman; filter
      dokumen tidak terpotong.
- [ ] **Uji XSS:** sebagai user, ubah `renderedHtml` dokumen lewat Console menjadi
      `<img src=x onerror=alert(1)>`; saat admin membuka dokumen itu tidak boleh
      ada popup.
