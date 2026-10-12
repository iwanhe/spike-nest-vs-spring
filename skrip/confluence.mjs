#!/usr/bin/env node
// Menulis ulang halaman Confluence "Hasil Uji Harian" dari hasil/riwayat.jsonl.
// Dijalankan oleh alur GitHub Actions setelah skrip/laporan.mjs.
//
// Pemakaian:
//   node skrip/confluence.mjs                 kirim ke Confluence (perlu variabel di bawah)
//   node skrip/confluence.mjs --cetak storage cetak isi halaman dalam format storage, tanpa mengirim
//   node skrip/confluence.mjs --cetak html    cetak isi halaman dalam HTML biasa, tanpa mengirim
//
// Variabel lingkungan untuk mengirim:
//   ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN  akun dan API token Atlassian (disimpan sebagai secret repo)
//   CONFLUENCE_PAGE_ID                    id halaman yang ditulis ulang
//   CONFLUENCE_BASE                       alamat dasar API, contoh:
//       https://api.atlassian.com/ex/confluence/<cloudId>   untuk API token ber-scope
//       https://kcsi.atlassian.net                          untuk API token biasa
import { readFileSync } from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'iwanhe/spike-nest-vs-spring';
const RAW = `https://raw.githubusercontent.com/${REPO}/main`;
const JUMLAH_RIWAYAT = 15;
const VARIAN = [
  { kunci: 'nest', nama: 'NestJS' },
  { kunci: 'spring', nama: 'Spring Boot' },
  { kunci: 'spring-heap256', nama: 'Spring Boot (heap 256 MB)' },
];
const GRAFIK = [
  ['grafik-memori', 'Memori saat diam (MB)'],
  ['grafik-siap', 'Waktu sampai siap (detik)'],
  ['grafik-permintaan', 'Permintaan per detik, 10 koneksi'],
  ['grafik-ekspor', 'Ekspor 1 juta baris (detik)'],
];

const riwayat = readFileSync('hasil/riwayat.jsonl', 'utf8').split('\n').filter(Boolean).map((b) => JSON.parse(b));
const terbaru = riwayat[riwayat.length - 1];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v, d = 0) =>
  v === null || v === undefined ? '–' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: d }).format(v);
const waktuWib = (iso) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) + ' WIB';
const urlRun = (id) => (/^\d+$/.test(id) ? `https://github.com/${REPO}/actions/runs/${id}` : null);
const namaPemicu = { schedule: 'terjadwal', workflow_dispatch: 'manual', push: 'push' };
const status = (r) => (!r ? 'tidak ada data' : r.lulus ? '✅ lulus' : '❌ gagal');
const rentan = (x) => (!x ? '–' : `${x.kritis} / ${x.tinggi} / ${x.sedang}`);
const rentanOs = (x) => (!x ? '–' : `${x.kritis} / ${x.tinggi} dari ${fmt(x.total)}`);
const uji = (l, g) => (l === null || l === undefined ? '–' : `${l} dari ${l + (g ?? 0)}`);

const BARIS = [
  ['Status run', (r) => status(r)],
  ['Uji penerimaan S1, S2, S4, S5', (r) => uji(r.uji_lulus, r.uji_gagal)],
  ['Uji keamanan S6', (r) => uji(r.uji_s6_lulus, r.uji_s6_gagal)],
  ['Mati paksa: persetujuan / pengiriman ERP', (r) => `${r.mati_paksa ?? '–'} / ${r.s5_mati_paksa ?? '–'}`],
  ['Waktu sampai siap (detik)', (r) => fmt(r.siap_detik, 1)],
  ['Memori saat diam (MB)', (r) => fmt(r.memori_diam_mb)],
  ['Memori setelah beban (MB)', (r) => fmt(r.memori_beban_mb)],
  ['Permintaan per detik, 10 koneksi', (r) => fmt(r.permintaan_per_detik)],
  ['Median waktu respons (ms)', (r) => fmt(r.respons_ms, 2)],
  ['Laporan 1 juta baris (detik)', (r) => fmt(r.laporan_detik, 1)],
  ['Ekspor 1 juta baris (detik)', (r) => fmt(r.ekspor_1jt_detik, 1)],
  ['Gerbang kerentanan', (r) => r.gerbang ?? '–'],
  ['Kerentanan paket saat berjalan (kritis / tinggi / sedang)', (r) => rentan(r.rentan)],
  ['Ukuran image (MB)', (r) => fmt(r.image_mb)],
  ['Kerentanan OS di image (kritis / tinggi)', (r) => rentanOs(r.rentan_os)],
];

// Dua bentuk keluaran: "storage" untuk REST API Confluence, "html" untuk pembuatan awal lewat konektor.
function susun(format) {
  const storage = format === 'storage';
  const tautan = (url, teks) => `<a href="${esc(url)}">${esc(teks)}</a>`;
  const panel = (isi) =>
    storage
      ? `<ac:structured-macro ac:name="info"><ac:rich-text-body><p>${isi}</p></ac:rich-text-body></ac:structured-macro>`
      : `<div data-type="panel-info"><p>${isi}</p></div>`;
  // Nomor run ditempel di alamat gambar supaya Confluence tidak menampilkan gambar lama dari cache.
  const gambar = (berkas, judul) => {
    const url = `${RAW}/hasil/${berkas}-terang.png?run=${terbaru.run_id}`;
    return storage
      ? `<p><ac:image ac:width="760" ac:alt="${esc(judul)}"><ri:url ri:value="${esc(url)}" /></ac:image></p>`
      : `<p><img src="${esc(url)}" alt="${esc(judul)}" width="760" height="300"></p>`;
  };
  const tabel = (kepala, isi) =>
    `<table><tbody><tr>${kepala.map((k) => `<th><p>${esc(k)}</p></th>`).join('')}</tr>` +
    isi.map((b) => `<tr>${b.map((c) => `<td><p>${c}</p></td>`).join('')}</tr>`).join('') +
    '</tbody></table>';

  const o = [];
  o.push(panel(
    `Halaman ini ditulis ulang otomatis oleh GitHub Actions setelah setiap run terjadwal (06.17 WIB) atau manual di repo ` +
    `${tautan(`https://github.com/${REPO}`, REPO)}. Jangan diedit dengan tangan: perubahan akan tertimpa pada run berikutnya. ` +
    'Catatan dan keputusan ditulis di halaman induk.'));
  const url = urlRun(terbaru.run_id);
  o.push(`<p><strong>Run terakhir:</strong> ${esc(waktuWib(terbaru.waktu))}, ${esc(namaPemicu[terbaru.pemicu] ?? terbaru.pemicu)}` +
    `${url ? `, ${tautan(url, `run ${terbaru.run_id}`)}` : ''}.</p>`);

  o.push('<h2>Hasil terakhir</h2>');
  o.push(tabel(
    ['Ukuran', ...VARIAN.map((v) => v.nama)],
    BARIS.map(([label, f]) => [esc(label), ...VARIAN.map((v) => esc(terbaru.varian[v.kunci] ? f(terbaru.varian[v.kunci]) : '–'))]),
  ));
  o.push('<p>Varian heap 256 MB tidak dipindai kerentanannya dan tidak dibuatkan image; jarnya sama dengan varian Spring Boot.</p>');

  o.push(`<h2>Tren ${Math.min(30, riwayat.length)} run terakhir</h2>`);
  for (const [berkas, judul] of GRAFIK) o.push(gambar(berkas, judul));

  o.push(`<h2>Riwayat ${Math.min(JUMLAH_RIWAYAT, riwayat.length)} run terakhir</h2>`);
  o.push(tabel(
    ['Waktu', 'Pemicu', 'NestJS', 'Spring Boot', 'Memori diam (MB), NestJS / Spring', 'Siap (detik), NestJS / Spring', 'Kerentanan NestJS (k / t / s)', 'Kerentanan Spring Boot (k / t / s)'],
    riwayat.slice(-JUMLAH_RIWAYAT).reverse().map((e) => {
      const a = e.varian.nest, b = e.varian.spring;
      const u = urlRun(e.run_id);
      return [
        u ? tautan(u, waktuWib(e.waktu)) : esc(waktuWib(e.waktu)),
        esc(namaPemicu[e.pemicu] ?? e.pemicu),
        esc(status(a)), esc(status(b)),
        esc(`${fmt(a?.memori_diam_mb)} / ${fmt(b?.memori_diam_mb)}`),
        esc(`${fmt(a?.siap_detik, 1)} / ${fmt(b?.siap_detik, 1)}`),
        esc(rentan(a?.rentan)), esc(rentan(b?.rentan)),
      ];
    }),
  ));
  o.push('<p>Angka kinerja berasal dari mesin CI yang dipakai bersama; satu kandidat bisa berbeda dua kali lipat antar-run. Baca trennya, bukan satu titik. ' +
    `Data mentah: ${tautan(`https://github.com/${REPO}/blob/main/hasil/riwayat.jsonl`, 'hasil/riwayat.jsonl')}.</p>`);
  return o.join('\n');
}

const i = process.argv.indexOf('--cetak');
if (i >= 0) {
  process.stdout.write(susun(process.argv[i + 1] ?? 'storage') + '\n');
  process.exit(0);
}

const { ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, CONFLUENCE_PAGE_ID, CONFLUENCE_BASE } = process.env;
if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN || !CONFLUENCE_PAGE_ID || !CONFLUENCE_BASE) {
  console.log('::notice title=Confluence::Pembaruan Confluence dilewati: ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, CONFLUENCE_PAGE_ID, atau CONFLUENCE_BASE belum diisi.');
  process.exit(0);
}

const alamat = `${CONFLUENCE_BASE.replace(/\/$/, '')}/wiki/api/v2/pages/${CONFLUENCE_PAGE_ID}`;
const kepala = {
  authorization: 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64'),
  accept: 'application/json',
  'content-type': 'application/json',
};

const lama = await fetch(alamat, { headers: kepala });
if (!lama.ok) {
  console.error(`Gagal membaca halaman ${CONFLUENCE_PAGE_ID}: HTTP ${lama.status} ${await lama.text()}`);
  process.exit(1);
}
const halaman = await lama.json();
const baru = await fetch(alamat, {
  method: 'PUT',
  headers: kepala,
  body: JSON.stringify({
    id: CONFLUENCE_PAGE_ID,
    status: 'current',
    title: halaman.title,
    body: { representation: 'storage', value: susun('storage') },
    version: { number: halaman.version.number + 1, message: `Hasil run ${terbaru.run_id}` },
  }),
});
if (!baru.ok) {
  console.error(`Gagal menulis halaman ${CONFLUENCE_PAGE_ID}: HTTP ${baru.status} ${await baru.text()}`);
  process.exit(1);
}
console.log(`Halaman Confluence ${CONFLUENCE_PAGE_ID} diperbarui ke versi ${halaman.version.number + 1}.`);
