import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. Cek Sesi Login & Ambil Profil User dari Firestore
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Tampilkan nama dan role di sidebar
        document.getElementById("userName").textContent = userData.username || user.email;
        const roleBadge = document.getElementById("userRoleBadge");
        
        if (userData.role === "admin") {
          roleBadge.textContent = "Admin";
          document.querySelectorAll(".admin-only").forEach(el => {
            el.style.display = "inline-block";
          });
        } else {
          roleBadge.textContent = "User";
        }

        // Inisial avatar
        const initial = (userData.username || user.email).charAt(0).toUpperCase();
        document.getElementById("userInitial").textContent = initial;
        
        // Muat data dokumen
        loadDocumentsTable(user.uid, userData.role);
      } else {
        console.error("Dokumen profil user tidak ditemukan di koleksi users!");
      }
    } catch (error) {
      console.error("Gagal memuat profil user:", error);
    }
  } else {
    // Jika belum login, lempar ke halaman utama/login
    window.location.href = "../index.html";
  }
});

// 2. Fungsi Tombol Logout
document.querySelectorAll(".js-logout").forEach(btn => {
  btn.addEventListener("click", () => {
    signOut(auth).then(() => {
      window.location.href = "../index.html";
    }).catch((error) => {
      console.error("Gagal keluar:", error);
    });
  });
});

// 3. Fungsi Render Tabel Dokumen
async function loadDocumentsTable(uid, role) {
  const tbody = document.getElementById("documentsTableBody");
  if (!tbody) return;

  try {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Memuat data...</td></tr>`;
    const querySnapshot = await getDocs(collection(db, "documents"));
    
    tbody.innerHTML = "";
    if (querySnapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Belum ada dokumen.</td></tr>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Filter jika bukan admin, hanya tampilkan dokumen milik sendiri (jika ada field userId)
      if (role !== "admin" && data.userId && data.userId !== uid) return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.nomor_surat || '-'}</td>
        <td>${data.template_name || 'Invoice'}</td>
        <td>${data.tanggal_dibuat || '-'}</td>
        <td><span class="badge">${data.status || 'Draft'}</span></td>
        <td><button class="btn btn-sm" onclick="alert('Detail dokumen')">Lihat</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Gagal mengambil data dokumen:", error);
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Gagal memuat data.</td></tr>`;
  }
}
