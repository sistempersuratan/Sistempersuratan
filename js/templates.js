// ===========================================================
// default-templates.js — Template surat bawaan.
// Dipakai halaman Kelola Template (tombol "Impor Template Contoh").
// Format data SAMA dengan yang disimpan Template Editor, jadi setelah
// diimpor, template bisa diedit/dinonaktifkan seperti template biasa.
//
// Catatan:
// - {{nomor_surat}} diisi otomatis oleh sistem saat surat dirilis.
// - Semua field yang dipakai di HTML dibuat wajib diisi (required),
//   supaya tidak ada {{placeholder}} kosong yang tampil di surat.
// - seedKey = penanda unik agar impor ulang tidak membuat template ganda.
// ===========================================================

// ---------- Potongan HTML yang dipakai berulang ----------

const WRAP_OPEN = `<div style="font-family:'Times New Roman',Times,serif; font-size:12pt; line-height:1.5; color:#000;">`;
const WRAP_CLOSE = `</div>`;

const KOP = `<div style="text-align:center; border-bottom:3px double #000; padding-bottom:8px; margin-bottom:18px;">
<div style="font-size:16pt; font-weight:bold; text-transform:uppercase;">{{nama_instansi}}</div>
<div style="font-size:11pt;">{{alamat_instansi}}</div>
</div>`;

const judul = (teks, tampilNomor = true) => `<div style="text-align:center; margin-bottom:16px;">
<strong><u>${teks}</u></strong>${tampilNomor ? `<br>Nomor: {{nomor_surat}}` : ""}
</div>`;

const TTD = `<div style="margin-top:36px; margin-left:55%;">
<div>{{kota}}, {{tanggal_surat}}</div>
<div>{{jabatan_penandatangan}},</div>
<div style="height:70px;"></div>
<div><strong><u>{{nama_penandatangan}}</u></strong></div>
</div>`;

const baris = (label, isi) => `<tr><td style="width:150px; vertical-align:top; padding:2px 0;">${label}</td><td style="width:14px; vertical-align:top;">:</td><td style="padding:2px 0;">${isi}</td></tr>`;
const tabel = (...rows) => `<table style="border:none; border-collapse:collapse; margin:6px 0 6px 28px;">${rows.join("")}</table>`;
const p = (teks) => `<p style="text-align:justify; margin:8px 0;">${teks}</p>`;
// Teks dari textarea: baris baru tetap tampil
const isiBebas = (nama) => `<div style="white-space:pre-line; text-align:justify; margin:8px 0;">{{${nama}}}</div>`;

// ---------- Definisi field yang dipakai berulang ----------

const f = (name, label, type = "text", extra = {}) => ({ name, label, type, required: true, ...extra });

const FIELDS_INSTANSI = [
  f("nama_instansi", "Nama Instansi / Lembaga"),
  f("alamat_instansi", "Alamat Instansi (kop surat)")
];

const FIELDS_TTD = [
  f("kota", "Kota Penerbitan"),
  f("tanggal_surat", "Tanggal Surat", "date"),
  f("jabatan_penandatangan", "Jabatan Penandatangan"),
  f("nama_penandatangan", "Nama Penandatangan")
];

const FORMAT_NOMOR = "{no}/{kode}/{bln}/{tahun}";

const susun = (isiHtml) => WRAP_OPEN + KOP + isiHtml + WRAP_CLOSE;

// ---------- Daftar template ----------

export const DEFAULT_TEMPLATES = [
  {
    seedKey: "surat-tugas",
    name: "Surat Tugas",
    category: "Kepegawaian",
    description: "Penugasan seseorang untuk menjalankan kegiatan tertentu.",
    numberCode: "ST",
    fields: [
      ...FIELDS_INSTANSI,
      f("nama_petugas", "Nama yang Ditugaskan"),
      f("jabatan_petugas", "Jabatan yang Ditugaskan"),
      f("uraian_tugas", "Uraian Tugas / Kegiatan", "textarea"),
      f("tempat_tugas", "Tempat Pelaksanaan"),
      f("waktu_tugas", "Waktu Pelaksanaan (mis. 20–22 November 2026)"),
      ...FIELDS_TTD
    ],
    html: susun(
      judul("SURAT TUGAS") +
      p("Yang bertanda tangan di bawah ini memberikan tugas kepada:") +
      tabel(baris("Nama", "{{nama_petugas}}"), baris("Jabatan", "{{jabatan_petugas}}")) +
      p("Untuk melaksanakan tugas sebagai berikut:") +
      isiBebas("uraian_tugas") +
      tabel(baris("Tempat", "{{tempat_tugas}}"), baris("Waktu", "{{waktu_tugas}}")) +
      p("Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan dilaporkan setelah tugas selesai.") +
      TTD
    )
  },

  {
    seedKey: "surat-keterangan",
    name: "Surat Keterangan",
    category: "Umum",
    description: "Menerangkan status atau keadaan seseorang untuk keperluan tertentu.",
    numberCode: "SK",
    fields: [
      ...FIELDS_INSTANSI,
      f("nama", "Nama Lengkap"),
      f("tempat_lahir", "Tempat Lahir"),
      f("tanggal_lahir", "Tanggal Lahir", "date"),
      f("pekerjaan", "Pekerjaan / Status"),
      f("alamat", "Alamat", "textarea"),
      f("isi_keterangan", "Isi Keterangan", "textarea"),
      f("keperluan", "Keperluan Surat Ini"),
      ...FIELDS_TTD
    ],
    html: susun(
      judul("SURAT KETERANGAN") +
      p("Yang bertanda tangan di bawah ini menerangkan bahwa:") +
      tabel(
        baris("Nama", "{{nama}}"),
        baris("Tempat/Tgl. Lahir", "{{tempat_lahir}}, {{tanggal_lahir}}"),
        baris("Pekerjaan", "{{pekerjaan}}"),
        baris("Alamat", "{{alamat}}")
      ) +
      isiBebas("isi_keterangan") +
      p("Surat keterangan ini dibuat untuk keperluan <strong>{{keperluan}}</strong>. Demikian agar dapat dipergunakan sebagaimana mestinya.") +
      TTD
    )
  },

  {
    seedKey: "surat-undangan",
    name: "Surat Undangan",
    category: "Umum",
    description: "Undangan rapat, acara, atau kegiatan.",
    numberCode: "UND",
    fields: [
      ...FIELDS_INSTANSI,
      f("lampiran", "Lampiran (mis. 1 berkas / -)"),
      f("perihal", "Perihal"),
      f("kepada", "Kepada Yth. (nama/jabatan)"),
      f("nama_acara", "Nama Acara / Kegiatan"),
      f("hari_tanggal", "Hari, Tanggal (mis. Senin, 23 November 2026)"),
      f("waktu", "Waktu (mis. 09.00 WIB s.d. selesai)"),
      f("tempat", "Tempat"),
      f("agenda", "Agenda / Keterangan Tambahan", "textarea"),
      ...FIELDS_TTD
    ],
    html: susun(
      tabel(
        baris("Nomor", "{{nomor_surat}}"),
        baris("Lampiran", "{{lampiran}}"),
        baris("Perihal", "<strong>{{perihal}}</strong>")
      ) +
      `<div style="margin:14px 0 4px 0;">Kepada Yth.<br><strong>{{kepada}}</strong><br>di tempat</div>` +
      p("Dengan hormat,") +
      p("Sehubungan dengan akan dilaksanakannya <strong>{{nama_acara}}</strong>, kami mengundang Bapak/Ibu untuk hadir pada:") +
      tabel(baris("Hari/Tanggal", "{{hari_tanggal}}"), baris("Waktu", "{{waktu}}"), baris("Tempat", "{{tempat}}"), baris("Agenda", "")) +
      isiBebas("agenda") +
      p("Mengingat pentingnya acara tersebut, kami mengharapkan kehadiran Bapak/Ibu tepat waktu. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.") +
      TTD
    )
  },

  {
    seedKey: "surat-permohonan",
    name: "Surat Permohonan",
    category: "Umum",
    description: "Permohonan resmi kepada pihak tertentu.",
    numberCode: "PMH",
    fields: [
      ...FIELDS_INSTANSI,
      f("lampiran", "Lampiran (mis. 1 berkas / -)"),
      f("perihal", "Perihal"),
      f("kepada", "Kepada Yth. (nama/jabatan)"),
      f("alamat_tujuan", "Tempat/Kota Tujuan"),
      f("isi_permohonan", "Isi Permohonan", "textarea"),
      ...FIELDS_TTD
    ],
    html: susun(
      tabel(
        baris("Nomor", "{{nomor_surat}}"),
        baris("Lampiran", "{{lampiran}}"),
        baris("Perihal", "<strong>{{perihal}}</strong>")
      ) +
      `<div style="margin:14px 0 4px 0;">Kepada Yth.<br><strong>{{kepada}}</strong><br>di {{alamat_tujuan}}</div>` +
      p("Dengan hormat,") +
      isiBebas("isi_permohonan") +
      p("Demikian permohonan ini kami sampaikan. Atas perhatian dan perkenan Bapak/Ibu, kami ucapkan terima kasih.") +
      TTD
    )
  },

  {
    seedKey: "surat-pengantar",
    name: "Surat Pengantar",
    category: "Umum",
    description: "Mengantar dokumen/berkas kepada pihak lain.",
    numberCode: "PGT",
    fields: [
      ...FIELDS_INSTANSI,
      f("kepada", "Kepada Yth. (nama/jabatan)"),
      f("alamat_tujuan", "Tempat/Kota Tujuan"),
      f("daftar_berkas", "Daftar Berkas yang Dikirim (satu per baris)", "textarea"),
      f("keterangan", "Keterangan / Maksud Pengiriman"),
      ...FIELDS_TTD
    ],
    html: susun(
      judul("SURAT PENGANTAR") +
      `<div style="margin:10px 0;">Kepada Yth.<br><strong>{{kepada}}</strong><br>di {{alamat_tujuan}}</div>` +
      p("Dengan hormat, bersama surat ini kami kirimkan berkas-berkas berikut:") +
      isiBebas("daftar_berkas") +
      p("Keterangan: {{keterangan}}.") +
      p("Mohon berkas tersebut diterima dengan baik. Atas perhatian Bapak/Ibu, kami ucapkan terima kasih.") +
      TTD
    )
  },

  {
    seedKey: "surat-izin-cuti",
    name: "Surat Izin / Cuti",
    category: "Kepegawaian",
    description: "Pemberitahuan atau permohonan izin tidak masuk / cuti.",
    numberCode: "IZN",
    fields: [
      f("nama_instansi", "Nama Instansi / Lembaga"),
      f("kepada", "Kepada Yth. (atasan/pimpinan)"),
      f("kota", "Kota"),
      f("tanggal_surat", "Tanggal Surat", "date"),
      f("nama", "Nama Pemohon"),
      f("jabatan", "Jabatan / Kelas"),
      f("jenis_izin", "Jenis", "select", { options: ["Izin", "Sakit", "Cuti Tahunan", "Cuti Lainnya"] }),
      f("alasan", "Alasan", "textarea"),
      f("lama_izin", "Lama (mis. 3 hari)"),
      f("tanggal_mulai", "Mulai Tanggal", "date"),
      f("tanggal_selesai", "Sampai Tanggal", "date")
    ],
    html: WRAP_OPEN +
      `<div style="text-align:right;">{{kota}}, {{tanggal_surat}}</div>` +
      `<div style="margin:14px 0;">Kepada Yth.<br><strong>{{kepada}}</strong><br>{{nama_instansi}}<br>di tempat</div>` +
      `<div style="margin:10px 0;"><strong>Perihal: Permohonan {{jenis_izin}}</strong></div>` +
      p("Dengan hormat,") +
      p("Saya yang bertanda tangan di bawah ini:") +
      tabel(baris("Nama", "{{nama}}"), baris("Jabatan/Kelas", "{{jabatan}}")) +
      p("mengajukan permohonan <strong>{{jenis_izin}}</strong> selama <strong>{{lama_izin}}</strong>, terhitung mulai tanggal {{tanggal_mulai}} sampai dengan {{tanggal_selesai}}, dengan alasan:") +
      isiBebas("alasan") +
      p("Demikian permohonan ini saya sampaikan. Atas perhatian dan izin Bapak/Ibu, saya ucapkan terima kasih.") +
      `<div style="margin-top:36px; margin-left:55%;"><div>Hormat saya,</div><div style="height:70px;"></div><div><strong><u>{{nama}}</u></strong></div></div>` +
      WRAP_CLOSE
  },

  {
    seedKey: "surat-kuasa",
    name: "Surat Kuasa",
    category: "Hukum",
    description: "Pemberian kuasa dari satu pihak kepada pihak lain.",
    numberCode: "KSA",
    fields: [
      ...FIELDS_INSTANSI,
      f("nama_pemberi", "Nama Pemberi Kuasa"),
      f("jabatan_pemberi", "Jabatan / Pekerjaan Pemberi Kuasa"),
      f("alamat_pemberi", "Alamat Pemberi Kuasa"),
      f("nama_penerima", "Nama Penerima Kuasa"),
      f("jabatan_penerima", "Jabatan / Pekerjaan Penerima Kuasa"),
      f("alamat_penerima", "Alamat Penerima Kuasa"),
      f("isi_kuasa", "Hal yang Dikuasakan", "textarea"),
      f("kota", "Kota Penerbitan"),
      f("tanggal_surat", "Tanggal Surat", "date")
    ],
    html: susun(
      judul("SURAT KUASA") +
      p("Yang bertanda tangan di bawah ini:") +
      tabel(baris("Nama", "{{nama_pemberi}}"), baris("Jabatan", "{{jabatan_pemberi}}"), baris("Alamat", "{{alamat_pemberi}}")) +
      p("Selanjutnya disebut <strong>Pemberi Kuasa</strong>, dengan ini memberikan kuasa kepada:") +
      tabel(baris("Nama", "{{nama_penerima}}"), baris("Jabatan", "{{jabatan_penerima}}"), baris("Alamat", "{{alamat_penerima}}")) +
      p("Selanjutnya disebut <strong>Penerima Kuasa</strong>.") +
      p("Untuk dan atas nama Pemberi Kuasa, Penerima Kuasa berwenang untuk:") +
      isiBebas("isi_kuasa") +
      p("Demikian surat kuasa ini dibuat untuk dipergunakan sebagaimana mestinya.") +
      `<div style="margin-top:28px; display:flex; justify-content:space-between;">
<div style="text-align:center;"><div>Penerima Kuasa,</div><div style="height:70px;"></div><div><strong><u>{{nama_penerima}}</u></strong></div></div>
<div style="text-align:center;"><div>{{kota}}, {{tanggal_surat}}</div><div>Pemberi Kuasa,</div><div style="height:70px;"></div><div><strong><u>{{nama_pemberi}}</u></strong></div></div>
</div>`
    )
  },

  {
    seedKey: "surat-pernyataan",
    name: "Surat Pernyataan",
    category: "Hukum",
    description: "Pernyataan tertulis seseorang atas suatu hal.",
    numberCode: "PNY",
    fields: [
      f("nama", "Nama Lengkap"),
      f("nik", "NIK / No. Identitas"),
      f("tempat_lahir", "Tempat Lahir"),
      f("tanggal_lahir", "Tanggal Lahir", "date"),
      f("pekerjaan", "Pekerjaan"),
      f("alamat", "Alamat", "textarea"),
      f("isi_pernyataan", "Isi Pernyataan", "textarea"),
      f("kota", "Kota"),
      f("tanggal_surat", "Tanggal Surat", "date")
    ],
    html: WRAP_OPEN +
      judul("SURAT PERNYATAAN", false) +
      p("Yang bertanda tangan di bawah ini:") +
      tabel(
        baris("Nama", "{{nama}}"),
        baris("NIK", "{{nik}}"),
        baris("Tempat/Tgl. Lahir", "{{tempat_lahir}}, {{tanggal_lahir}}"),
        baris("Pekerjaan", "{{pekerjaan}}"),
        baris("Alamat", "{{alamat}}")
      ) +
      p("Dengan ini menyatakan dengan sesungguhnya bahwa:") +
      isiBebas("isi_pernyataan") +
      p("Demikian surat pernyataan ini saya buat dengan sebenar-benarnya dan penuh kesadaran, tanpa paksaan dari pihak mana pun, serta bersedia menerima konsekuensi sesuai ketentuan yang berlaku apabila pernyataan ini tidak benar.") +
      `<div style="margin-top:36px; margin-left:55%;"><div>{{kota}}, {{tanggal_surat}}</div><div>Yang membuat pernyataan,</div><div style="height:70px; color:#888; font-size:10pt;">materai</div><div><strong><u>{{nama}}</u></strong></div></div>` +
      WRAP_CLOSE
  },

  {
    seedKey: "berita-acara",
    name: "Berita Acara",
    category: "Umum",
    description: "Catatan resmi atas suatu kegiatan atau kejadian.",
    numberCode: "BA",
    fields: [
      ...FIELDS_INSTANSI,
      f("judul_kegiatan", "Judul Kegiatan (mis. Serah Terima Barang)"),
      f("hari_tanggal", "Hari, Tanggal Pelaksanaan"),
      f("tempat", "Tempat Pelaksanaan"),
      f("pihak_pertama", "Nama Pihak Pertama"),
      f("jabatan_pertama", "Jabatan Pihak Pertama"),
      f("pihak_kedua", "Nama Pihak Kedua"),
      f("jabatan_kedua", "Jabatan Pihak Kedua"),
      f("uraian", "Uraian Kejadian / Hasil Kegiatan", "textarea"),
      f("kota", "Kota Penerbitan"),
      f("tanggal_surat", "Tanggal Surat", "date")
    ],
    html: susun(
      judul("BERITA ACARA<br>{{judul_kegiatan}}") +
      p("Pada hari ini, {{hari_tanggal}}, bertempat di {{tempat}}, kami yang bertanda tangan di bawah ini:") +
      tabel(
        baris("Nama", "{{pihak_pertama}}"),
        baris("Jabatan", "{{jabatan_pertama}}")
      ) +
      p("selanjutnya disebut <strong>Pihak Pertama</strong>, dan") +
      tabel(
        baris("Nama", "{{pihak_kedua}}"),
        baris("Jabatan", "{{jabatan_kedua}}")
      ) +
      p("selanjutnya disebut <strong>Pihak Kedua</strong>, telah melaksanakan kegiatan dengan uraian sebagai berikut:") +
      isiBebas("uraian") +
      p("Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.") +
      `<div style="margin-top:28px; display:flex; justify-content:space-between;">
<div style="text-align:center;"><div>Pihak Kedua,</div><div style="height:70px;"></div><div><strong><u>{{pihak_kedua}}</u></strong></div></div>
<div style="text-align:center;"><div>{{kota}}, {{tanggal_surat}}</div><div>Pihak Pertama,</div><div style="height:70px;"></div><div><strong><u>{{pihak_pertama}}</u></strong></div></div>
</div>`
    )
  },

  {
    seedKey: "surat-edaran",
    name: "Surat Edaran",
    category: "Umum",
    description: "Pemberitahuan resmi kepada banyak pihak di lingkungan instansi.",
    numberCode: "SE",
    fields: [
      ...FIELDS_INSTANSI,
      f("tentang", "Tentang (perihal edaran)"),
      f("kepada", "Ditujukan Kepada"),
      f("isi_edaran", "Isi Edaran", "textarea"),
      ...FIELDS_TTD
    ],
    html: susun(
      judul("SURAT EDARAN") +
      `<div style="text-align:center; margin:-8px 0 14px 0;">Tentang<br><strong>{{tentang}}</strong></div>` +
      `<div style="margin:10px 0;">Kepada Yth.<br><strong>{{kepada}}</strong><br>di tempat</div>` +
      p("Dengan hormat,") +
      isiBebas("isi_edaran") +
      p("Demikian surat edaran ini disampaikan untuk diketahui dan dilaksanakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.") +
      TTD
    )
  }
].map((t) => ({ numberFormat: FORMAT_NOMOR, ...t }));
