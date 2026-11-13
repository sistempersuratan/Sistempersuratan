import { db, auth } from './firebase-config.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      if (!db) {
        console.error("Database belum terinisialisasi.");
        return;
      }

      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        const userNameEl = document.getElementById("userName");
        if (userNameEl) userNameEl.textContent = userData.username || user.email;
        
        const roleBadge = document.getElementById("userRoleBadge");
        if (roleBadge) {
          if (userData.role === "admin") {
            roleBadge.textContent = "Admin";
            document.querySelectorAll(".admin-only").forEach(el => {
              el.style.display = "inline-block";
            });
          } else {
            roleBadge.textContent = "User";
          }
        }

        const userInitialEl = document.getElementById("userInitial");
        if (userInitialEl) {
          userInitialEl.textContent = (userData.username || user.email).charAt(0).toUpperCase();
        }
        
        loadDocumentsTable(user.uid, userData.role);
      } else {
        console.error("Profil user tidak ditemukan!");
      }
    } catch (error) {
      console.error("Gagal memuat profil:", error);
    }
  } else {
    window.location.href = "../index.html";
  }
});

document.querySelectorAll(".js-logout").forEach(btn => {
  btn.addEventListener("click", () => {
    signOut(auth).then(() => {
      window.location.href = "../index.html";
    }).catch((error) => {
      console.error("Gagal keluar:", error);
    });
  });
});

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
      
      if (role !== "admin" && data.userId && data.userId !== uid) return;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.nomor_surat || '-'}</td>
        <td>${data.template_name || 'Invoice'}</td>
        <td>${data.tanggal_dibuat || '-'}</td>
        <td class="admin-only" style="display: ${role === 'admin' ? 'table-cell' : 'none'};">${data.creator_name || data.userEmail || '-'}</td>
        <td><span class="badge">${data.status || 'Draft'}</span></td>
        <td><button class="btn btn-sm view-doc-btn" data-id="${docSnap.id}">Lihat</button></td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".view-doc-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const docId = e.target.getAttribute("data-id");
        alert("Detail dokumen ID: " + docId);
        const detailPanel = document.getElementById("detailPanel");
        if (detailPanel) detailPanel.style.display = "block";
      });
    });

  } catch (error) {
    console.error("Gagal mengambil data dokumen:", error);
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Gagal memuat data dari database.</td></tr>`;
  }
}
