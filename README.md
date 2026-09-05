# Sistem Persuratan

Aplikasi web untuk membuat surat/dokumen dari template siap pakai.
Dibangun dengan HTML + CSS + JavaScript (vanilla, ES Modules) dan Firebase
(Authentication + Firestore). Tanpa framework frontend, tanpa backend Node.js
khusus — Firebase menjadi backend, Netlify menjadi hosting.

> **Status:** STEP 1 — struktur dasar, login, dan pemisahan dashboard
> user/admin berdasarkan role. Fitur template & dokumen menyusul di STEP
> berikutnya.

## Struktur Project

```
persuratan/
├── index.html            # Halaman login
├── dashboard.html         # Dashboard user
├── admin.html              # Dashboard admin
├── pages/                    # Halaman tambahan (STEP berikutnya)
├── css/
│   ├── style.css            # Token desain + halaman login
│   ├── dashboard.css     # Layout sidebar/bottom-nav
│   └── admin.css           # Style tambahan khusus admin
├── js/
│   ├── firebase-config.js  # Init Firebase (SATU-SATUNYA tempat config)
│   ├── auth.js                  # Logic login/logout/guard role (reusable)
│   ├── ui.js                     # Toast & helper UI kecil (reusable)
│   ├── login.js                # Logic halaman index.html
│   ├── dashboard.js       # Logic halaman dashboard.html
│   └── admin.js               # Logic halaman admin.html
└── assets/
    ├── logo.png
    └── favicon.png
```

## 1. Setup Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add
   project** → beri nama (mis. `sistem-persuratan`).
2. Di dalam project, buka **Build → Authentication → Get started** → aktifkan
   sign-in method **Email/Password**.
3. Buka **Build → Firestore Database → Create database** → pilih mode
   **Production** → pilih region terdekat (mis. `asia-southeast2`).
4. Buka **Project settings (ikon gerigi) → General → Your apps** → klik ikon
   web `</>` → daftarkan app (nama bebas) → **jangan** centang Firebase
   Hosting (kita pakai Netlify).
5. Salin objek `firebaseConfig` yang muncul, lalu tempel ke
   `js/firebase-config.js` menggantikan nilai `GANTI_...`.
6. Buka **Firestore Database → Rules**, tempel isi berikut, lalu **Publish**:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function myProfile() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isAdmin() {
      return isSignedIn() && myProfile().role == 'admin';
    }

    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isAdmin();
      allow update: if isAdmin()
                    || (request.auth.uid == userId
                        && request.resource.data.role == resource.data.role
                        && request.resource.data.active == resource.data.active);
      allow delete: if isAdmin();
    }

    match /templates/{templateId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /documents/{documentId} {
      allow read: if isSignedIn() &&
                  (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isSignedIn() &&
                  (resource.data.userId == request.auth.uid || isAdmin());
    }

    match /settings/{docId} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }
  }
}
```

Catatan: rule di atas mencegah user mengubah `role`/`active` miliknya sendiri
(sesuai poin 13 di spesifikasi) — hanya admin yang boleh mengubah dua field
itu.

## 2. Membuat Admin Pertama

Karena STEP 1 belum memiliki halaman "Kelola User", admin pertama dibuat
manual satu kali:

1. Buka **Authentication → Users → Add user** → masukkan email & password →
   **Add user**. Salin **User UID** yang muncul.
2. Buka **Firestore Database → Start collection** → Collection ID: `users`.
3. Document ID: **tempel UID** dari langkah 1. Isi field:
   | Field | Type | Value |
   |---|---|---|
   | name | string | Nama Admin |
   | email | string | (sama dengan email di Authentication) |
   | role | string | `admin` |
   | active | boolean | `true` |
   | createdAt | timestamp | (klik "current date") |
   | updatedAt | timestamp | (klik "current date") |
4. Save. Admin pertama siap dipakai login.

Untuk user biasa, ulangi langkah yang sama dengan `role: "user"` — proses ini
akan digantikan halaman **Kelola User** di STEP 2.

## 3. Menjalankan Project Secara Lokal

Karena semua modul JavaScript pakai `type="module"`, file harus dibuka lewat
server lokal (bukan `file://`), agar tidak kena batasan CORS browser.

Pilih salah satu:

```bash
# Opsi A — pakai Python (biasanya sudah terpasang)
cd persuratan
python3 -m http.server 5500
# lalu buka http://localhost:5500

# Opsi B — pakai Node.js
npx serve .
```

Atau gunakan ekstensi **Live Server** di VS Code (klik kanan `index.html` →
"Open with Live Server").

## 4. Deploy ke Netlify (ringkas — detail lengkap juga di chat)

1. **Push ke GitHub**: `git init && git add . && git commit -m "STEP 1"`,
   buat repo baru di GitHub, lalu `git remote add origin <url>` dan
   `git push -u origin main`.
2. **Connect ke Netlify**: di [app.netlify.com](https://app.netlify.com) →
   **Add new site → Import an existing project** → pilih repo GitHub tadi.
3. **Build settings**: build command kosongkan, publish directory `.`
   (karena tidak ada proses build — murni static).
4. **Deploy** → Netlify akan memberi domain seperti `nama-acak.netlify.app`.
5. **Tambahkan domain ke Firebase**: buka **Authentication → Settings →
   Authorized domains → Add domain**, masukkan domain Netlify tadi (dan
   domain custom jika ada nanti).

## Checklist Pengujian STEP 1

- [ ] Buka `index.html` lewat server lokal, form login tampil rapi (desktop
      & mobile).
- [ ] Login dengan email/password yang salah → muncul pesan
      "Email atau password salah." (bukan error teknis Firebase).
- [ ] Login dengan akun admin → diarahkan ke `admin.html`, bukan
      `dashboard.html`.
- [ ] Login dengan akun user biasa → diarahkan ke `dashboard.html`.
- [ ] Nama & inisial di sidebar sesuai field `name` di Firestore.
- [ ] Tombol **Keluar** berhasil logout dan kembali ke `index.html`.
- [ ] Membuka `dashboard.html` atau `admin.html` langsung tanpa login →
      otomatis dilempar ke `index.html`.
- [ ] Login sebagai user lalu membuka `admin.html` secara manual →
      ditolak, dilempar balik ke `dashboard.html`.
- [ ] Set `active: false` pada user di Firestore → user tersebut gagal login
      (langsung ter-logout dengan pesan akun dinonaktifkan).
- [ ] Layout sidebar berubah jadi bottom navigation di lebar layar < 860px.
