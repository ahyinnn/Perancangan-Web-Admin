/* ================================================================
   ADMIN PANEL — CatchyPinang
   Realtime CRUD via Firebase Realtime Database
   ================================================================ */

/* ----------------------------------------------------------------
   CREDENTIALS (simpel, cukup untuk demo akademik)
   ---------------------------------------------------------------- */
const ADMIN_CREDS = {
  username: "admin",
  password: "catchypinang2025"
};

/* ----------------------------------------------------------------
   STATE
   ---------------------------------------------------------------- */
let allWisata    = [];   // [{fbKey, id, nama, kat, ...}]
let allReviews   = [];   // [{fbKey, wisataId, wisataName, name, ...}]
let allContacts  = [];   // [{fbKey, nama, email, ...}]
let editingKey   = null; // fbKey sedang diedit
let deleteAction = null; // fn yang dipanggil saat konfirmasi hapus

/* ----------------------------------------------------------------
   FIREBASE HELPERS
   ---------------------------------------------------------------- */
function db()   { return window._fbDb; }
function fbRef(path)  { return window._fbRef(db(), path); }

async function fbSet(path, data) {
  await window._fbSet(fbRef(path), data);
}
async function fbPush(path, data) {
  return await window._fbPush(fbRef(path), data);
}
async function fbDel(path) {
  await window._fbRemove(fbRef(path));
}
async function fbUpdate(path, data) {
  await window._fbUpdate(fbRef(path), data);
}
function fbListen(path, cb) {
  return window._fbOnValue(fbRef(path), snap => cb(snap.val()));
}

/* ----------------------------------------------------------------
   AUTH
   ---------------------------------------------------------------- */
function isLoggedIn() {
  return sessionStorage.getItem("cp_admin_auth") === "1";
}

function doAdminLogin() {
  const u = document.getElementById("adminUser").value.trim();
  const p = document.getElementById("adminPass").value;
  let ok = true;
  document.getElementById("errUser").classList.toggle("show", !u); if (!u) ok = false;
  document.getElementById("errPass").classList.toggle("show", !p); if (!p) ok = false;
  if (!ok) return;
  if (u !== ADMIN_CREDS.username || p !== ADMIN_CREDS.password) {
    const el = document.getElementById("errLogin");
    el.textContent = "Username atau password salah";
    el.classList.add("show");
    return;
  }
  document.getElementById("errLogin").classList.remove("show");
  sessionStorage.setItem("cp_admin_auth", "1");
  showAdminApp();
}

function doAdminLogout() {
  sessionStorage.removeItem("cp_admin_auth");
  location.reload();
}

/* --- Logout Confirm --- */
function askLogout() {
  // Tutup gear menu dulu
  const gm = document.getElementById("gearMenu");
  if (gm) gm.classList.remove("open");
  document.getElementById("logoutConfirmOv").classList.add("open");
}
function confirmLogout() {
  document.getElementById("logoutConfirmOv").classList.add("open");
}
function closeLogoutConfirm() {
  document.getElementById("logoutConfirmOv").classList.remove("open");
}

function togglePw() {
  const inp = document.getElementById("adminPass");
  inp.type = inp.type === "password" ? "text" : "password";
}

/* ----------------------------------------------------------------
   INIT
   ---------------------------------------------------------------- */
function init() {
  // Update tanggal di header
  document.getElementById("headerDate").textContent =
    new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });

  // Subscribe realtime ke semua data
  listenWisata();
  listenReviews();
  listenContacts();
}

function showAdminApp() {
  document.getElementById("loginPage").style.display = "none";
  document.getElementById("adminApp").style.display  = "flex";
  init();
  checkBackupSchedule();
}

/* ----------------------------------------------------------------
   REALTIME LISTENERS
   ---------------------------------------------------------------- */
function listenWisata() {
  fbListen("wisata", data => {
    if (!data) {
      allWisata = [];
    } else {
      allWisata = Object.entries(data).map(([k, v]) => ({ fbKey: k, ...v }));
      // Urutkan berdasarkan id (numerik) jika ada, atau fbKey
      allWisata.sort((a, b) => (a.id || 0) - (b.id || 0));
    }
    // Detect new wisata
    if (_knownWisataKeys !== null) {
      const newOnes = allWisata.filter(w => !_knownWisataKeys.has(w.fbKey));
      if (newOnes.length) {
        newCounts.wisata += newOnes.length;
        updateBadge("badgeWisata", newCounts.wisata);
        newOnes.forEach(w => pushNotif("wisata", w));
      }
    }
    _knownWisataKeys = new Set(allWisata.map(w => w.fbKey));

    document.getElementById("statWisata").textContent = allWisata.length;
    renderWisataTable();
    renderRecentWisata();
    populateReviewFilter();
    updateCapacityBar("capBarWisata", allWisata.length, CAPACITY.wisata, "Destinasi");
  });
}

// Track known keys for notif detection
let _knownReviewKeys  = null;
let _knownContactKeys = null;
let _knownWisataKeys  = null;

// Badge counter: hanya item BARU (belum dibaca)
const newCounts = { wisata: 0, reviews: 0, contacts: 0 };

function clearBadge(section) {
  newCounts[section] = 0;
  const map = { wisata: 'badgeWisata', reviews: 'badgeReviews', contacts: 'badgeContacts' };
  updateBadge(map[section], 0);
}

function listenReviews() {
  fbListen("reviews", data => {
    allReviews = [];
    if (data) {
      Object.entries(data).forEach(([wisataId, revMap]) => {
        const w = allWisata.find(x => String(x.id) === String(wisataId));
        const wisataName = w ? w.nama : "Destinasi #" + wisataId;
        if (revMap && typeof revMap === "object") {
          Object.entries(revMap).forEach(([fbKey, rev]) => {
            allReviews.push({ fbKey, wisataId, wisataName, ...rev });
          });
        }
      });
      allReviews.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }
    // Detect new reviews
    if (_knownReviewKeys !== null) {
      const newOnes = allReviews.filter(r => !_knownReviewKeys.has(r.fbKey));
      if (newOnes.length) {
        newCounts.reviews += newOnes.length;
        updateBadge("badgeReviews", newCounts.reviews);
        newOnes.forEach(r => pushNotif("review", r));
      }
    }
    _knownReviewKeys = new Set(allReviews.map(r => r.fbKey));

    // Badge hanya new
    if (_knownReviewKeys !== null) {
      // (newOnes sudah di-push di atas)
    }
    const total = allReviews.length;
    document.getElementById("statReviews").textContent = total;
    renderReviewTable();
    renderRecentReviews();
    updateCapacityBar("capBarReviews", total, CAPACITY.reviews, "Ulasan");
  });
}

function listenContacts() {
  fbListen("contacts", data => {
    allContacts = [];
    if (data) {
      allContacts = Object.entries(data).map(([k, v]) => ({ fbKey: k, ...v }));
      allContacts.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }
    // Detect new contacts
    if (_knownContactKeys !== null) {
      const newOnes = allContacts.filter(c => !_knownContactKeys.has(c.fbKey));
      if (newOnes.length) {
        newCounts.contacts += newOnes.length;
        updateBadge("badgeContacts", newCounts.contacts);
        newOnes.forEach(c => pushNotif("contact", c));
      }
    }
    _knownContactKeys = new Set(allContacts.map(c => c.fbKey));
    document.getElementById("statContacts").textContent = allContacts.length;
    renderContactTable();
    updateCapacityBar("capBarContacts", allContacts.length, CAPACITY.contacts, "Pesan Kontak");
  });
}

/* ----------------------------------------------------------------
   NAVIGATION
   ---------------------------------------------------------------- */
function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".snav-item").forEach(s => s.classList.remove("active"));
  document.getElementById("snav-" + name).classList.add("active");
  // Hapus badge saat halaman dibuka
  if (name === "wisata")   clearBadge("wisata");
  if (name === "reviews")  clearBadge("reviews");
  if (name === "contacts") clearBadge("contacts");
  // Tutup notif panel & gear menu saat pindah halaman
  closeNotifPanel();
  const gm = document.getElementById("gearMenu");
  if (gm) gm.classList.remove("open");
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOv").classList.toggle("open");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOv").classList.remove("open");
}

/* --- Sidebar Expand (Google Classroom style) --- */
// expanded = diklik & di-pin terbuka; hover selalu buka tanpa pin
let sidebarPinned = false;
function toggleSidebarExpand() {
  sidebarPinned = !sidebarPinned;
  const sb  = document.getElementById("sidebar");
  const btn = document.getElementById("sidebarHamBtn");
  if (sidebarPinned) {
    sb.classList.add("expanded");
    if (btn) btn.style.color = "white";
  } else {
    sb.classList.remove("expanded");
    if (btn) btn.style.color = "";
  }
}

/* --- Gear Menu --- */
function toggleGearMenu(e) {
  e.stopPropagation();
  document.getElementById("gearMenu").classList.toggle("open");
}

/* ----------------------------------------------------------------
   BADGE
   ---------------------------------------------------------------- */
function updateBadge(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = n;
  el.style.display = n > 0 ? "flex" : "none";
}

/* ----------------------------------------------------------------
   DASHBOARD — recent items
   ---------------------------------------------------------------- */
function renderRecentWisata() {
  const el = document.getElementById("recentWisata");
  if (!allWisata.length) {
    el.innerHTML = `<div class="recent-empty">Belum ada destinasi</div>`; return;
  }
  el.innerHTML = allWisata.slice(0, 5).map(w => `
    <div class="recent-item">
      <div class="recent-thumb">${thumbEl(w.foto, w.em)}</div>
      <div class="recent-info">
        <div class="recent-name">${esc(w.nama)}</div>
        <div class="recent-meta">${esc(w.kat || "—")}</div>
      </div>
    </div>`).join("");
}

function renderRecentReviews() {
  const el = document.getElementById("recentReviews");
  if (!allReviews.length) {
    el.innerHTML = `<div class="recent-empty">Belum ada ulasan</div>`; return;
  }
  el.innerHTML = allReviews.slice(0, 5).map(r => `
    <div class="recent-item">
      <div class="recent-thumb" style="background:rgba(0,109,119,.1);font-size:.9rem;font-weight:700;color:var(--primary)">
        ${(r.name || "?").charAt(0).toUpperCase()}
      </div>
      <div class="recent-info">
        <div class="recent-name">${esc(r.name || "—")}</div>
        <div class="recent-meta">${"⭐".repeat(Math.min(r.rating || 0, 5))} · ${esc(r.wisataName)}</div>
      </div>
    </div>`).join("");
}

/* ----------------------------------------------------------------
   WISATA TABLE
   ---------------------------------------------------------------- */
function renderWisataTable(list) {
  const rows = list !== undefined ? list : allWisata;
  const tbody = document.getElementById("wisataTableBody");
  const empty = document.getElementById("wisataEmpty");

  if (!rows.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    document.querySelector(".table-wrap").style.display = "none";
    return;
  }
  empty.style.display = "none";
  document.querySelector(".table-wrap").style.display = "";

  tbody.innerHTML = rows.map(w => `
    <tr>
      <td>
        <div class="table-thumb">${thumbEl(w.foto, w.em)}</div>
      </td>
      <td>
        <div class="cell-name">${esc(w.nama)}</div>
        <span class="cat-badge ${catClass(w.kat)}">${esc(w.kat || "—")}</span>
      </td>
      <td><div class="cell-sub" style="max-width:160px">${esc(w.lok || "—")}</div></td>
      <td><div class="cell-sub">${esc(w.harga || "—")}</div></td>
      <td><div class="cell-sub" style="max-width:130px">${esc(w.jam || "—")}</div></td>
      <td>
        <div class="act-btns">
          <button class="btn-edit" onclick="openFormModal('${w.fbKey}')">✏️ Edit</button>
          <button class="btn-del"  onclick="confirmDeleteWisata('${w.fbKey}', '${esc(w.nama)}')">🗑️ Hapus</button>
        </div>
      </td>
    </tr>`).join("");
}

function filterWisataTable() {
  const q   = document.getElementById("wisataSearch").value.toLowerCase();
  const kat = document.getElementById("wisataFilterKat").value;
  const res = allWisata.filter(w =>
    (!kat || w.kat === kat) &&
    (!q   || w.nama.toLowerCase().includes(q) || (w.lok || "").toLowerCase().includes(q))
  );
  renderWisataTable(res);
}

/* ----------------------------------------------------------------
   WISATA FORM MODAL
   ---------------------------------------------------------------- */
function openFormModal(fbKey) {
  editingKey = fbKey || null;
  const w = fbKey ? allWisata.find(x => x.fbKey === fbKey) : null;
  document.getElementById("formModalTitle").textContent =
    w ? "Edit Destinasi Wisata" : "Tambah Destinasi Baru";

  // Reset errors
  ["fNama","fKat","fDesk","fLok"].forEach(id => {
    document.getElementById("ef" + id.charAt(1).toUpperCase() + id.slice(2))?.classList.remove("show");
  });

  // Fill or clear
  document.getElementById("fNama").value   = w ? w.nama  || "" : "";
  document.getElementById("fKat").value    = w ? w.kat   || "" : "";
  document.getElementById("fDesk").value   = w ? w.desk  || "" : "";
  document.getElementById("fLok").value    = w ? w.lok   || "" : "";
  document.getElementById("fKontak").value = w ? w.kontak || "" : "";
  document.getElementById("fJam").value    = w ? w.jam   || "" : "";
  document.getElementById("fHarga").value  = w ? w.harga || "" : "";
  document.getElementById("fEm").value     = w ? w.em    || "" : "";
  document.getElementById("fFoto").value   = w ? (Array.isArray(w.foto) ? w.foto.join(", ") : w.foto || "") : "";
  document.getElementById("fFac").value    = w ? (Array.isArray(w.fac) ? w.fac.join(", ") : w.fac || "") : "";
  document.getElementById("fMaps").value   = w ? w.maps  || "" : "";

  document.getElementById("formModal").classList.add("open");
}

function closeFormModal() {
  document.getElementById("formModal").classList.remove("open");
  editingKey = null;
}

async function saveWisata() {
  const nama  = document.getElementById("fNama").value.trim();
  const kat   = document.getElementById("fKat").value;
  const desk  = document.getElementById("fDesk").value.trim();
  const lok   = document.getElementById("fLok").value.trim();

  let valid = true;
  document.getElementById("efNama").classList.toggle("show", !nama); if (!nama) valid = false;
  document.getElementById("efKat").classList.toggle("show",  !kat);  if (!kat)  valid = false;
  document.getElementById("efDesk").classList.toggle("show", !desk); if (!desk) valid = false;
  document.getElementById("efLok").classList.toggle("show",  !lok);  if (!lok)  valid = false;
  if (!valid) return;

  const fotoRaw = document.getElementById("fFoto").value.trim();
  const facRaw  = document.getElementById("fFac").value.trim();

  const data = {
    nama,
    kat,
    desk,
    lok,
    kontak: document.getElementById("fKontak").value.trim(),
    jam:    document.getElementById("fJam").value.trim(),
    harga:  document.getElementById("fHarga").value.trim(),
    em:     document.getElementById("fEm").value.trim() || "🌴",
    foto:   fotoRaw ? fotoRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
    fac:    facRaw  ? facRaw.split(",").map(s => s.trim()).filter(Boolean) : [],
    maps:   document.getElementById("fMaps").value.trim(),
    updatedAt: new Date().toISOString()
  };

  const btn = document.getElementById("btnSaveForm");
  btn.disabled = true; btn.textContent = "Menyimpan...";

  try {
    if (editingKey) {
      // Update existing
      await fbUpdate("wisata/" + editingKey, data);
      toast("✅ Destinasi berhasil diperbarui!");
    } else {
      // Generate id baru (max id + 1)
      const maxId = allWisata.reduce((m, w) => Math.max(m, w.id || 0), 0);
      data.id = maxId + 1;
      data.createdAt = new Date().toISOString();
      await fbPush("wisata", data);
      toast("✅ Destinasi baru berhasil ditambahkan!");
    }
    closeFormModal();
  } catch (e) {
    console.error(e);
    toast("❌ Gagal menyimpan. Periksa koneksi atau izin database.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Destinasi";
  }
}

/* ----------------------------------------------------------------
   DELETE WISATA
   ---------------------------------------------------------------- */
function confirmDeleteWisata(fbKey, nama) {
  document.getElementById("confirmTitle").textContent = "Hapus Destinasi?";
  document.getElementById("confirmMsg").textContent =
    `"${nama}" akan dihapus permanen dari database termasuk semua datanya. Tindakan ini tidak bisa dibatalkan.`;
  deleteAction = () => deleteWisata(fbKey, nama);
  document.getElementById("btnConfirmDel").onclick = () => { deleteAction(); closeConfirm(); };
  document.getElementById("confirmOv").classList.add("open");
}

async function deleteWisata(fbKey, nama) {
  try {
    await fbDel("wisata/" + fbKey);
    toast(`🗑️ "${nama}" berhasil dihapus dari database`);
  } catch (e) {
    console.error(e);
    toast("❌ Gagal menghapus. Periksa koneksi.");
  }
}

function closeConfirm() {
  document.getElementById("confirmOv").classList.remove("open");
  deleteAction = null;
}

/* ----------------------------------------------------------------
   REVIEW TABLE
   ---------------------------------------------------------------- */
function populateReviewFilter() {
  const sel = document.getElementById("reviewFilterWisata");
  const cur = sel.value;
  sel.innerHTML = `<option value="">Semua Destinasi</option>` +
    allWisata.map(w => `<option value="${w.id}">${esc(w.nama)}</option>`).join("");
  sel.value = cur;
}

function renderReviewTable(list) {
  const rows  = list !== undefined ? list : allReviews;
  const tbody = document.getElementById("reviewTableBody");
  const empty = document.getElementById("reviewEmpty");

  if (!rows.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>
        <div style="font-weight:600;color:var(--dark)">${esc(r.name || "—")}</div>
        <div class="cell-sub">${esc(r.email || "")}</div>
      </td>
      <td><div class="cell-sub">${esc(r.wisataName || "—")}</div></td>
      <td>
        <span class="rating-stars">${"⭐".repeat(Math.min(r.rating || 0, 5))}</span>
        <span class="rating-num">${r.rating || 0}/5</span>
      </td>
      <td><div class="review-text-cell">${esc(r.text || "—")}</div></td>
      <td><div class="cell-sub">${esc(r.date || "—")}</div></td>
      <td>
        <div class="act-btns">
          <button class="btn-del" onclick="confirmDeleteReview('${r.wisataId}','${r.fbKey}','${esc(r.name)}')">🗑️ Hapus</button>
        </div>
      </td>
    </tr>`).join("");
}

function filterReviewTable() {
  const q       = document.getElementById("reviewSearch").value.toLowerCase();
  const wisataId = document.getElementById("reviewFilterWisata").value;
  const res = allReviews.filter(r =>
    (!wisataId || String(r.wisataId) === String(wisataId)) &&
    (!q || (r.name || "").toLowerCase().includes(q) || (r.text || "").toLowerCase().includes(q))
  );
  renderReviewTable(res);
}

function confirmDeleteReview(wisataId, fbKey, name) {
  document.getElementById("confirmTitle").textContent = "Hapus Ulasan?";
  document.getElementById("confirmMsg").textContent =
    `Ulasan dari "${name}" akan dihapus permanen dari database.`;
  document.getElementById("btnConfirmDel").onclick = async () => {
    try {
      await fbDel(`reviews/${wisataId}/${fbKey}`);
      toast("🗑️ Ulasan berhasil dihapus");
    } catch (e) {
      toast("❌ Gagal menghapus ulasan");
    }
    closeConfirm();
  };
  document.getElementById("confirmOv").classList.add("open");
}

/* ----------------------------------------------------------------
   CONTACT TABLE
   ---------------------------------------------------------------- */
function renderContactTable(list) {
  const rows  = list !== undefined ? list : allContacts;
  const tbody = document.getElementById("contactTableBody");
  const empty = document.getElementById("contactEmpty");

  if (!rows.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  tbody.innerHTML = rows.map(c => `
    <tr>
      <td>
        <div style="font-weight:600;color:var(--dark)">${esc(c.nama || "—")}</div>
        <div class="cell-sub">${esc(c.email || "")}</div>
      </td>
      <td><span class="topik-badge">${esc(c.topik || "—")}</span></td>
      <td><div class="msg-preview">${esc(c.pesan || "—")}</div></td>
      <td><div class="cell-sub">${esc(c.tanggal || "—")}</div></td>
      <td>
        <div class="act-btns">
          <button class="btn-view-msg" onclick="viewContact('${c.fbKey}')">👁️ Lihat</button>
          <button class="btn-del" onclick="confirmDeleteContact('${c.fbKey}','${esc(c.nama)}')">🗑️</button>
        </div>
      </td>
    </tr>`).join("");
}

function filterContactTable() {
  const q     = document.getElementById("contactSearch").value.toLowerCase();
  const topik = document.getElementById("contactFilterTopik").value;
  const res = allContacts.filter(c =>
    (!topik || c.topik === topik) &&
    (!q || (c.nama || "").toLowerCase().includes(q) ||
           (c.email || "").toLowerCase().includes(q) ||
           (c.pesan || "").toLowerCase().includes(q))
  );
  renderContactTable(res);
}

function viewContact(fbKey) {
  const c = allContacts.find(x => x.fbKey === fbKey);
  if (!c) return;
  document.getElementById("detailModalTitle").textContent = "Detail Pesan Kontak";
  document.getElementById("detailModalBody").innerHTML = `
    <div class="detail-field">
      <label>Nama Pengirim</label>
      <p>${esc(c.nama || "—")}</p>
    </div>
    <div class="detail-field">
      <label>Email</label>
      <p>${esc(c.email || "—")}</p>
    </div>
    <div class="detail-field">
      <label>Topik</label>
      <p>${esc(c.topik || "Tidak dipilih")}</p>
    </div>
    <div class="detail-field">
      <label>Pesan</label>
      <p style="white-space:pre-wrap;line-height:1.7">${esc(c.pesan || "—")}</p>
    </div>
    <div class="detail-field">
      <label>Dikirim pada</label>
      <p>${esc(c.tanggal || "—")}</p>
    </div>`;
  document.getElementById("detailModal").classList.add("open");
}

function closeDetailModal() {
  document.getElementById("detailModal").classList.remove("open");
}

function confirmDeleteContact(fbKey, nama) {
  document.getElementById("confirmTitle").textContent = "Hapus Pesan?";
  document.getElementById("confirmMsg").textContent =
    `Pesan dari "${nama}" akan dihapus permanen dari database.`;
  document.getElementById("btnConfirmDel").onclick = async () => {
    try {
      await fbDel("contacts/" + fbKey);
      toast("🗑️ Pesan berhasil dihapus");
    } catch (e) {
      toast("❌ Gagal menghapus pesan");
    }
    closeConfirm();
  };
  document.getElementById("confirmOv").classList.add("open");
}

/* ----------------------------------------------------------------
   HELPERS
   ---------------------------------------------------------------- */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function catClass(k) {
  return k === "Sejarah & Budaya"  ? "cat-sejarah"  :
         k === "Religi & Spiritual" ? "cat-religi"   :
         k === "Alam & Pantai"      ? "cat-alam"     :
         k === "Rekreasi Keluarga"  ? "cat-rekreasi" : "cat-kuliner";
}

function thumbEl(foto, em) {
  const f = Array.isArray(foto) ? foto[0] : foto;
  if (f && (f.startsWith("image/") || f.startsWith("http") || f.startsWith("/"))) {
    return `<img src="${f}" alt="" loading="lazy"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
      style="width:100%;height:100%;object-fit:cover;border-radius:inherit">
      <span style="display:none;align-items:center;justify-content:center;width:100%;height:100%">${em || "🌴"}</span>`;
  }
  return `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%">${em || "🌴"}</span>`;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => t.classList.remove("show"), 2800);
}

/* ----------------------------------------------------------------
   STARTUP
   ---------------------------------------------------------------- */
let fbWaitTimer = setTimeout(() => {
  if (isLoggedIn()) showAdminApp();
  else hideLoading();
}, 3000);

document.addEventListener("firebaseReady", () => {
  clearTimeout(fbWaitTimer);
  if (isLoggedIn()) showAdminApp();
  else hideLoading();
}, { once: true });

function hideLoading() {
  const ls = document.getElementById("loading-screen");
  ls.style.opacity = "0";
  setTimeout(() => ls.style.display = "none", 500);
}

window.addEventListener("load", () => {
  setTimeout(hideLoading, 1400);
});


/* ================================================================
   KAPASITAS DATA
   ================================================================ */
const CAPACITY = {
  wisata:   100,
  reviews:  500,
  contacts: 300
};

function updateCapacityBar(barId, count, max, label) {
  const el = document.getElementById(barId);
  if (!el) return;
  const pct = Math.min((count / max) * 100, 100);
  const sisa = max - count;
  let statusClass = "cap-status-ok";
  let statusText = "Normal";
  let statusIcon = "✅";
  let fillClass = "";
  if (pct >= 100) {
    statusClass = "cap-status-full";
    statusText = "Penuh!";
    statusIcon = "🔴";
    fillClass = "full";
  } else if (pct >= 80) {
    statusClass = "cap-status-warn";
    statusText = "Hampir penuh";
    statusIcon = "⚠️";
    fillClass = "warn";
  }
  el.innerHTML = `
    <div class="cap-card-inner">
      <div class="cap-card-left">
        <span class="cap-card-icon">${statusIcon}</span>
        <div>
          <div class="cap-card-title">Kapasitas ${label}</div>
          <div class="cap-card-sub">Sisa slot: <strong>${sisa}</strong> dari <strong>${max}</strong></div>
        </div>
      </div>
      <div class="cap-card-right">
        <div class="cap-card-nums">
          <span class="cap-card-count">${count}</span>
          <span class="cap-card-max">/ ${max}</span>
        </div>
        <div class="cap-card-track">
          <div class="cap-card-fill ${fillClass}" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <div class="cap-card-pct ${statusClass}">${pct.toFixed(0)}% — ${statusText}</div>
      </div>
    </div>`;
}

/* ================================================================
   SISTEM NOTIFIKASI
   ================================================================ */
let notifications = [];

function pushNotif(type, data) {
  const id = Date.now() + "_" + Math.random().toString(36).slice(2);
  let icon, title, sub;
  if (type === "review") {
    icon = "⭐";
    title = "Ulasan baru dari " + (data.name || "Pengunjung");
    sub = (data.wisataName || "Destinasi") + " · " + (data.rating || 0) + "/5 ★";
  } else if (type === "wisata") {
    icon = "🗺️";
    title = "Destinasi baru: " + (data.nama || "Tanpa nama");
    sub = data.kat || "Destinasi Wisata";
  } else {
    icon = "📬";
    title = "Pesan baru dari " + (data.nama || "Pengunjung");
    sub = data.topik || "Tanpa topik";
  }
  notifications.unshift({ id, type, icon, title, sub, read: false, ts: Date.now() });
  renderNotifList();
  updateNotifDot();
}

function renderNotifList() {
  const list = document.getElementById("notifList");
  if (!notifications.length) {
    list.innerHTML = `<div class="notif-empty">Tidak ada notifikasi baru</div>`;
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? "" : "unread"}" onclick="readNotif('${n.id}')">
      <div class="notif-item-icon">${n.icon}</div>
      <div class="notif-item-body">
        <div class="notif-item-title">${esc(n.title)}</div>
        <div class="notif-item-sub">${esc(n.sub)}</div>
      </div>
      ${n.read ? "" : '<div class="notif-unread-dot"></div>'}
    </div>`).join("");
}

function readNotif(id) {
  const n = notifications.find(x => x.id === id);
  if (n) n.read = true;
  renderNotifList();
  updateNotifDot();
}

function markAllRead() {
  notifications.forEach(n => n.read = true);
  renderNotifList();
  updateNotifDot();
}

function updateNotifDot() {
  const hasUnread = notifications.some(n => !n.read);
  // Update semua dot yang ada (mobile topbar & desktop)
  ["notifDot", "notifDotDesktop"].forEach(id => {
    const dot = document.getElementById(id);
    if (dot) dot.style.display = hasUnread ? "block" : "none";
  });
}

function toggleNotifPanel(e) {
  if (e) e.stopPropagation();
  document.getElementById("notifPanel").classList.toggle("open");
}
function closeNotifPanel() {
  document.getElementById("notifPanel").classList.remove("open");
}

/* ================================================================
   BACKUP OTOMATIS SETIAP 2 MINGGU
   ================================================================ */
const BACKUP_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000; // 2 minggu
const BACKUP_KEY = "cp_last_backup_ts";

function checkBackupSchedule() {
  const last = parseInt(localStorage.getItem(BACKUP_KEY) || "0", 10);
  const now  = Date.now();
  if (now - last >= BACKUP_INTERVAL_MS) {
    // Tunggu 3 detik setelah login agar data sudah dimuat
    setTimeout(runScheduledBackup, 3000);
  }
}

async function runScheduledBackup() {
  await runBackup(true); // silent = true, tampil notif saja
}

async function runBackup(silent = false) {
  showBackupModal("running");
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupKey = "backups/" + ts;

    // Salin ulasan ke backups/
    if (allReviews.length) {
      const reviewData = {};
      allReviews.forEach(r => { reviewData[r.fbKey] = r; });
      await fbSet(backupKey + "/reviews", reviewData);
    }

    // Salin kontak ke backups/
    if (allContacts.length) {
      const contactData = {};
      allContacts.forEach(c => { contactData[c.fbKey] = c; });
      await fbSet(backupKey + "/contacts", contactData);
    }

    // Simpan meta info backup
    await fbSet(backupKey + "/meta", { ts, totalReviews: allReviews.length, totalContacts: allContacts.length });

    localStorage.setItem(BACKUP_KEY, Date.now().toString());
    showBackupModal("success", ts);
    toast("✅ Backup selesai & data lama dibersihkan");
    pushNotif("system", { nama: "Sistem", topik: "Backup selesai pada " + new Date().toLocaleString("id-ID") });
  } catch (e) {
    console.error(e);
    showBackupModal("error", "", e.message);
    toast("❌ Backup gagal: " + e.message);
  }
}

function showBackupModal(state, ts, errMsg) {
  const ov    = document.getElementById("backupModalOv");
  const icon  = document.getElementById("backupIcon");
  const title = document.getElementById("backupTitle");
  const msg   = document.getElementById("backupMsg");
  const bar   = document.getElementById("backupBar");
  const btns  = document.getElementById("backupBtns");
  const prog  = document.getElementById("backupProgress");

  ov.classList.add("open");
  if (state === "running") {
    icon.textContent = "💾";
    title.textContent = "Backup Sedang Berjalan";
    msg.textContent = "Menyimpan data ulasan dan kontak ke Firebase...";
    prog.style.display = "block";
    bar.style.width = "0%";
    btns.style.display = "none";
    // Animasi progress bar
    let w = 0;
    const iv = setInterval(() => {
      w = Math.min(w + 8, 90);
      bar.style.width = w + "%";
      if (w >= 90) clearInterval(iv);
    }, 200);
    bar._interval = iv;
  } else if (state === "success") {
    if (bar._interval) clearInterval(bar._interval);
    bar.style.width = "100%";
    bar.style.animation = "none";
    bar.style.background = "#10b981";
    setTimeout(() => { prog.style.display = "none"; }, 600);
    icon.textContent = "✅";
    title.textContent = "Backup Berhasil";
    msg.innerHTML = `Data ulasan & pesan kontak telah disimpan ke Firebase<br><small style="color:var(--muted)">Backup: <code>${ts}</code></small>`;
    btns.style.display = "flex";
  } else {
    if (bar._interval) clearInterval(bar._interval);
    prog.style.display = "none";
    icon.textContent = "❌";
    title.textContent = "Backup Gagal";
    msg.textContent = errMsg || "Terjadi kesalahan saat backup.";
    btns.style.display = "flex";
  }
}

function closeBackupModal() {
  document.getElementById("backupModalOv").classList.remove("open");
  // Reset bar
  const bar = document.getElementById("backupBar");
  bar.style.width = "0%";
  bar.style.background = "";
  bar.style.animation = "";
}

// Expose untuk tombol manual (jika dibutuhkan)
window.runBackupManual = () => runBackup(false);

/* ----------------------------------------------------------------
   BACKUP PANEL (modal baru)
   ---------------------------------------------------------------- */
function openBackupPanel() {
  // Tutup gear menu
  const gm = document.getElementById("gearMenu");
  if (gm) gm.classList.remove("open");
  // Update info sebelum buka
  const last = parseInt(localStorage.getItem(BACKUP_KEY) || "0", 10);
  const lastEl = document.getElementById("lastBackupDate");
  const nextEl = document.getElementById("nextBackupDate");
  const countEl = document.getElementById("backupDataCount");
  if (lastEl) lastEl.textContent = last ? new Date(last).toLocaleString("id-ID") : "Belum pernah";
  if (nextEl && last) {
    const next = new Date(last + BACKUP_INTERVAL_MS);
    nextEl.textContent = next.toLocaleString("id-ID");
  } else if (nextEl) {
    nextEl.textContent = "—";
  }
  if (countEl) countEl.textContent = `${allReviews.length} ulasan · ${allContacts.length} pesan`;
  // Reset progress
  const prog = document.getElementById("backupProgress");
  if (prog) prog.style.display = "none";
  const btn = document.getElementById("btnDoBackup");
  if (btn) { btn.disabled = false; btn.textContent = "🗄️ Backup Sekarang"; }
  document.getElementById("backupModal").classList.add("open");
}

function closeBackupPanel() {
  document.getElementById("backupModal").classList.remove("open");
}

function openDbInfo() {
  const gm = document.getElementById("gearMenu");
  if (gm) gm.classList.remove("open");
  // Isi data
  const wEl = document.getElementById("dbCountWisata");
  const rEl = document.getElementById("dbCountReviews");
  const cEl = document.getElementById("dbCountContacts");
  const sEl = document.getElementById("dbStatusText");
  if (wEl) wEl.textContent = allWisata.length + " destinasi";
  if (rEl) rEl.textContent = allReviews.length + " ulasan";
  if (cEl) cEl.textContent = allContacts.length + " pesan";
  if (sEl) sEl.textContent = "🟢 Terhubung (Realtime)";
  document.getElementById("dbInfoModal").classList.add("open");
}
function closeDbInfo() {
  document.getElementById("dbInfoModal").classList.remove("open");
}

async function doManualBackup() {
  const btn = document.getElementById("btnDoBackup");
  const prog = document.getElementById("backupProgress");
  const fill = document.getElementById("backupProgressFill");
  const txt  = document.getElementById("backupProgressText");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Memproses..."; }
  if (prog) prog.style.display = "block";
  if (fill) fill.style.width = "0%";
  if (txt)  txt.textContent = "Menyiapkan backup...";
  // Animasi progress
  let w = 0;
  const iv = setInterval(() => {
    w = Math.min(w + 10, 85);
    if (fill) fill.style.width = w + "%";
  }, 200);
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const backupKey = "backups/" + ts;
    if (allReviews.length) {
      const reviewData = {};
      allReviews.forEach(r => { reviewData[r.fbKey] = r; });
      await fbSet(backupKey + "/reviews", reviewData);
    }
    if (allContacts.length) {
      const contactData = {};
      allContacts.forEach(c => { contactData[c.fbKey] = c; });
      await fbSet(backupKey + "/contacts", contactData);
    }
    await fbSet(backupKey + "/meta", { ts, totalReviews: allReviews.length, totalContacts: allContacts.length });
    localStorage.setItem(BACKUP_KEY, Date.now().toString());
    clearInterval(iv);
    if (fill) { fill.style.width = "100%"; fill.style.background = "#10b981"; }
    if (txt)  txt.textContent = "✅ Backup berhasil!";
    if (btn) { btn.disabled = false; btn.textContent = "✅ Selesai"; }
    toast("✅ Backup berhasil disimpan");
    pushNotif("system", { nama: "Sistem", topik: "Backup selesai pada " + new Date().toLocaleString("id-ID") });
    setTimeout(() => closeBackupPanel(), 1500);
  } catch (e) {
    clearInterval(iv);
    if (txt) txt.textContent = "❌ Gagal: " + e.message;
    if (btn) { btn.disabled = false; btn.textContent = "🗄️ Coba Lagi"; }
    toast("❌ Backup gagal: " + e.message);
  }
}


// Tutup modal saat klik di luar
document.addEventListener("click", e => {
  // Tutup gear menu
  const gm = document.getElementById("gearMenu");
  const gw = document.getElementById("gearWrap");
  if (gm && gw && !gw.contains(e.target)) {
    gm.classList.remove("open");
  }
  // Tutup notif panel jika klik di luar
  const np = document.getElementById("notifPanel");
  const nbDesktop = document.getElementById("desktopNotifBtn");
  const nbMobile  = document.getElementById("topbarNotifBtn");
  if (np && np.classList.contains("open")) {
    const clickedInside = np.contains(e.target)
      || (nbDesktop && nbDesktop.contains(e.target))
      || (nbMobile  && nbMobile.contains(e.target));
    if (!clickedInside) closeNotifPanel();
  }
  const fModal = document.getElementById("formModal");
  const dModal = document.getElementById("detailModal");
  if (e.target === fModal)   closeFormModal();
  if (e.target === dModal)   closeDetailModal();
  if (e.target === document.getElementById("confirmOv")) closeConfirm();
});

// Enter key di login
document.addEventListener("DOMContentLoaded", () => {
  const passEl = document.getElementById("adminPass");
  if (passEl) passEl.addEventListener("keydown", e => {
    if (e.key === "Enter") doAdminLogin();
  });
});