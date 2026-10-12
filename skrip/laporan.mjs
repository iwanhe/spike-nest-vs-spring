#!/usr/bin/env node
// Memperbarui riwayat hasil uji, grafik tren, dan bagian "Hasil uji harian" di README.
// Dijalankan oleh alur GitHub Actions setelah semua varian selesai.
// Pemakaian: node skrip/laporan.mjs <folder berisi hasil-<varian>.json>
// Variabel lingkungan (opsional, dipakai saat mengisi riwayat lama):
//   RUN_ID, RUN_WAKTU (ISO 8601), RUN_PEMICU (schedule, workflow_dispatch, push)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const FOLDER = process.argv[2];
const RIWAYAT = 'hasil/riwayat.jsonl';
const README = 'README.md';
const REPO = process.env.GITHUB_REPOSITORY ?? 'iwanhe/spike-nest-vs-spring';
const RUN_ID = String(process.env.RUN_ID ?? process.env.GITHUB_RUN_ID ?? 'lokal');
const WAKTU = process.env.RUN_WAKTU ?? new Date().toISOString();
const PEMICU = process.env.RUN_PEMICU ?? process.env.GITHUB_EVENT_NAME ?? 'manual';
const JUMLAH_GRAFIK = 30;
const JUMLAH_RIWAYAT = 10;

const VARIAN = [
  { kunci: 'nest', nama: 'NestJS' },
  { kunci: 'spring', nama: 'Spring Boot' },
  { kunci: 'spring-heap256', nama: 'Spring Boot (heap 256 MB)' },
];

// ---------- 1. Ringkas hasil run ini dan tambahkan ke riwayat ----------

const angka = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const bulat = (v, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);

function ringkas(h) {
  const kbKeMb = (v) => (angka(v) === null ? null : bulat(v / 1024));
  const ekspor = h.ekspor_1000000 ?? {};
  const r = {
    uji_lulus: angka(h.uji_lulus),
    uji_gagal: angka(h.uji_gagal),
    uji_s6_lulus: angka(h.uji_s6_lulus),
    uji_s6_gagal: angka(h.uji_s6_gagal),
    siap_detik: angka(h.siap_ms) === null ? null : bulat(h.siap_ms / 1000, 2),
    memori_diam_mb: kbKeMb(h.memori_diam_kb),
    memori_beban_mb: kbKeMb(h.memori_setelah_beban_kb),
    permintaan_per_detik: bulat(angka(h.sepi?.permintaan_per_detik)),
    respons_ms: angka(h.curl_sepi?.median_ms),
    laporan_detik: angka(h.laporan?.detik) === null ? null : bulat(h.laporan.detik, 2),
    ekspor_1jt_detik: angka(ekspor.lama_ms) === null ? null : bulat(ekspor.lama_ms / 1000, 1),
    mati_paksa: h.mati_paksa ?? null,
    s5_mati_paksa: h.s5_mati_paksa ?? null,
    s6_operasional: h.s6_operasional ?? null,
    ekspor_status: ekspor.status ?? null,
    gerbang: h.trivy?.gerbang ?? null,
    rentan: h.trivy?.saat_berjalan
      ? { kritis: h.trivy.saat_berjalan.kritis, tinggi: h.trivy.saat_berjalan.tinggi, sedang: h.trivy.saat_berjalan.sedang }
      : null,
    image_mb: angka(h.wadah?.ukuran_mb),
    rentan_os: h.wadah?.kerentanan_os
      ? { kritis: h.wadah.kerentanan_os.kritis, tinggi: h.wadah.kerentanan_os.tinggi, total: h.wadah.kerentanan_os.total }
      : null,
  };
  r.lulus =
    r.uji_gagal === 0 && r.uji_s6_gagal === 0 && (r.uji_s6_lulus ?? 0) > 0 &&
    r.mati_paksa === 'lulus' && r.s5_mati_paksa === 'lulus' && r.s6_operasional === 'lulus' &&
    r.ekspor_status === 'SELESAI' && (r.gerbang === null || r.gerbang === 'lulus');
  return r;
}

const varian = {};
for (const v of VARIAN) {
  const berkas = join(FOLDER, `hasil-${v.kunci}.json`);
  if (!existsSync(berkas)) continue;
  try {
    const isi = JSON.parse(readFileSync(berkas, 'utf8'));
    if (Object.keys(isi).length > 1) varian[v.kunci] = ringkas(isi);
  } catch {
    // berkas rusak: varian ini dianggap tanpa data
  }
}

mkdirSync('hasil', { recursive: true });
const riwayat = existsSync(RIWAYAT)
  ? readFileSync(RIWAYAT, 'utf8').split('\n').filter(Boolean).map((b) => JSON.parse(b))
  : [];
const sebelumnya = riwayat.findIndex((e) => e.run_id === RUN_ID);
const entri = { run_id: RUN_ID, waktu: WAKTU, pemicu: PEMICU, varian };
if (sebelumnya >= 0) riwayat[sebelumnya] = entri; else riwayat.push(entri);
riwayat.sort((a, b) => a.waktu.localeCompare(b.waktu));
writeFileSync(RIWAYAT, riwayat.map((e) => JSON.stringify(e)).join('\n') + '\n');

// ---------- 2. Grafik tren (SVG, versi terang dan gelap) ----------

// Palet kategori yang sudah divalidasi (skill dataviz): slot 1 biru untuk NestJS, slot 2 oranye untuk Spring Boot.
const TEMA = {
  terang: {
    permukaan: '#fcfcfb', tinta: '#0b0b0b', tinta2: '#52514e', redup: '#898781',
    grid: '#e1e0d9', dasar: '#c3c2b7', bingkai: 'rgba(11,11,11,0.10)',
    seri: { nest: '#2a78d6', spring: '#eb6834' },
  },
  gelap: {
    permukaan: '#1a1a19', tinta: '#f0efec', tinta2: '#c3c2b7', redup: '#898781',
    grid: '#2c2c2a', dasar: '#383835', bingkai: 'rgba(255,255,255,0.10)',
    seri: { nest: '#3987e5', spring: '#d95926' },
  },
};

const fmt = (v, d = 0) =>
  v === null || v === undefined ? '–' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: d, minimumFractionDigits: 0 }).format(v);
const tanggalPendek = (iso) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short' }).format(new Date(iso));
const jam = (iso) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const tanggalPanjang = (iso) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) + ' WIB';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function skalaAtas(maks) {
  if (maks <= 0) return { atas: 1, langkah: 0.25 };
  const kasar = maks / 4;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const langkah = [1, 2, 2.5, 5, 10].map((k) => k * pangkat).find((l) => l >= kasar);
  return { atas: Math.ceil(maks / langkah) * langkah, langkah };
}

function grafikGaris({ judul, satuan, desimal, ambil }, entriGrafik, tema) {
  const t = TEMA[tema];
  const L = 760, T = 300, kiri = 64, kanan = 150, atas = 72, bawah = 40;
  const lebar = L - kiri - kanan, tinggi = T - atas - bawah;
  const seri = [
    { kunci: 'nest', nama: 'NestJS' },
    { kunci: 'spring', nama: 'Spring Boot' },
  ].map((s) => ({ ...s, nilai: entriGrafik.map((e) => (e.varian[s.kunci] ? ambil(e.varian[s.kunci]) : null)) }));
  const semua = seri.flatMap((s) => s.nilai).filter((v) => v !== null);
  const { atas: yMaks, langkah } = skalaAtas(semua.length ? Math.max(...semua) : 1);
  const n = entriGrafik.length;
  const x = (i) => kiri + (n === 1 ? lebar / 2 : (i * lebar) / (n - 1));
  const y = (v) => atas + tinggi - (v / yMaks) * tinggi;

  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${T}" viewBox="0 0 ${L} ${T}" role="img" aria-label="${esc(judul)}">`);
  o.push(`<style>text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.angka{font-variant-numeric:tabular-nums}</style>`);
  o.push(`<rect x="0.5" y="0.5" width="${L - 1}" height="${T - 1}" rx="8" fill="${t.permukaan}" stroke="${t.bingkai}"/>`);
  o.push(`<text x="20" y="28" font-size="15" font-weight="600" fill="${t.tinta}">${esc(judul)}</text>`);
  o.push(`<text x="20" y="48" font-size="12" fill="${t.redup}">${esc(satuan)} · ${n} run terakhir</text>`);

  // Legenda di kanan atas: kunci garis berwarna, teks tetap memakai warna tinta.
  let lx = L - 20;
  for (const s of [...seri].reverse()) {
    const lebarTeks = s.nama.length * 7 + 8;
    lx -= lebarTeks;
    o.push(`<text x="${lx}" y="32" font-size="12" fill="${t.tinta2}">${esc(s.nama)}</text>`);
    o.push(`<line x1="${lx - 22}" y1="28" x2="${lx - 6}" y2="28" stroke="${t.seri[s.kunci]}" stroke-width="2" stroke-linecap="round"/>`);
    lx -= 34;
  }

  // Garis bantu tipis dan label sumbu Y.
  for (let v = 0; v <= yMaks + 1e-9; v += langkah) {
    const yy = y(v);
    o.push(`<line x1="${kiri}" y1="${yy}" x2="${kiri + lebar}" y2="${yy}" stroke="${v === 0 ? t.dasar : t.grid}" stroke-width="1"/>`);
    o.push(`<text class="angka" x="${kiri - 8}" y="${yy + 4}" font-size="11" text-anchor="end" fill="${t.redup}">${fmt(v, langkah < 1 ? 2 : 0)}</text>`);
  }
  // Label sumbu X: tanggal (ditambah jam bila ada dua run di hari yang sama), dijarangkan supaya tidak bertumpuk.
  const tanggal = entriGrafik.map((e) => tanggalPendek(e.waktu));
  const adaKembar = new Set(tanggal).size < tanggal.length;
  const jarak = Math.max(1, Math.ceil(n / (adaKembar ? 6 : 8)));
  entriGrafik.forEach((e, i) => {
    if (i % jarak === 0 || i === n - 1) {
      const label = adaKembar ? `${tanggal[i]} ${jam(e.waktu)}` : tanggal[i];
      o.push(`<text x="${x(i)}" y="${T - 16}" font-size="11" text-anchor="middle" fill="${t.redup}">${esc(label)}</text>`);
    }
  });

  // Garis 2px, titik 8px dengan cincin permukaan 2px. Nilai kosong memutus garis.
  const ujung = [];
  for (const s of seri) {
    const warna = t.seri[s.kunci];
    let jalur = '', mulai = true;
    s.nilai.forEach((v, i) => {
      if (v === null) { mulai = true; return; }
      jalur += `${mulai ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      mulai = false;
    });
    if (jalur) o.push(`<path d="${jalur.trim()}" fill="none" stroke="${warna}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    s.nilai.forEach((v, i) => {
      if (v !== null) o.push(`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" fill="${warna}" stroke="${t.permukaan}" stroke-width="2"/>`);
    });
    const terakhir = s.nilai.map((v, i) => [v, i]).filter(([v]) => v !== null).pop();
    if (terakhir) ujung.push({ s, v: terakhir[0], px: x(terakhir[1]), py: y(terakhir[0]) });
  }

  // Label nilai di ujung garis. Bila terlalu dekat, label kedua digeser dan diberi garis penghubung.
  ujung.sort((a, b) => a.py - b.py);
  let ySebelum = -Infinity;
  for (const u of ujung) {
    const yLabel = Math.max(u.py, ySebelum + 16);
    ySebelum = yLabel;
    const xLabel = kiri + lebar + 14;
    if (Math.abs(yLabel - u.py) > 1) {
      o.push(`<line x1="${u.px + 6}" y1="${u.py}" x2="${xLabel - 4}" y2="${yLabel - 4}" stroke="${t.redup}" stroke-width="1"/>`);
    }
    o.push(`<text class="angka" x="${xLabel}" y="${yLabel + 4}" font-size="12" fill="${t.tinta2}">${esc(u.s.nama)}: <tspan fill="${t.tinta}" font-weight="600">${fmt(u.v, desimal)}</tspan></text>`);
  }
  o.push('</svg>');
  return o.join('\n');
}

const GRAFIK = [
  { berkas: 'grafik-memori', judul: 'Memori saat diam', satuan: 'MB, makin rendah makin baik', desimal: 0, ambil: (r) => r.memori_diam_mb },
  { berkas: 'grafik-siap', judul: 'Waktu sampai siap melayani', satuan: 'detik, makin rendah makin baik', desimal: 1, ambil: (r) => r.siap_detik },
  { berkas: 'grafik-permintaan', judul: 'Permintaan per detik, 10 koneksi', satuan: 'permintaan per detik, makin tinggi makin baik', desimal: 0, ambil: (r) => r.permintaan_per_detik },
  { berkas: 'grafik-ekspor', judul: 'Ekspor 1 juta baris ke CSV dan Excel', satuan: 'detik, makin rendah makin baik', desimal: 1, ambil: (r) => r.ekspor_1jt_detik },
];
const entriGrafik = riwayat.slice(-JUMLAH_GRAFIK);
for (const g of GRAFIK) {
  for (const tema of ['terang', 'gelap']) {
    writeFileSync(`hasil/${g.berkas}-${tema}.svg`, grafikGaris(g, entriGrafik, tema) + '\n');
  }
}

// ---------- 3. Bagian README ----------

const terbaru = riwayat[riwayat.length - 1];
const urlRun = (id) => (/^\d+$/.test(id) ? `https://github.com/${REPO}/actions/runs/${id}` : null);
const namaPemicu = { schedule: 'terjadwal', workflow_dispatch: 'manual', push: 'push' };
const status = (r) => (!r ? 'tidak ada data' : r.lulus ? '✅ lulus' : '❌ gagal');
const rentan = (x) => (!x ? '–' : `${x.kritis} / ${x.tinggi} / ${x.sedang}`);
const rentanOs = (x) => (!x ? '–' : `${x.kritis} / ${x.tinggi} dari ${fmt(x.total)}`);
const uji = (l, g) => (l === null ? '–' : `${l} dari ${l + (g ?? 0)}`);

const baris = [
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

const md = [];
md.push('<!-- HASIL-HARIAN:MULAI -->');
md.push('## Hasil uji harian');
md.push('');
md.push('Bagian ini diperbarui otomatis oleh alur GitHub Actions setelah setiap run terjadwal (06.17 WIB) atau manual di branch `main`.');
md.push('Jangan diedit dengan tangan: perubahan akan tertimpa pada run berikutnya. Data mentahnya ada di [`hasil/riwayat.jsonl`](hasil/riwayat.jsonl).');
md.push('');
if (terbaru) {
  const url = urlRun(terbaru.run_id);
  md.push(`**Run terakhir:** ${tanggalPanjang(terbaru.waktu)}, ${namaPemicu[terbaru.pemicu] ?? terbaru.pemicu}${url ? `, [run ${terbaru.run_id}](${url})` : ''}.`);
  md.push('');
  md.push(`| Ukuran | ${VARIAN.map((v) => v.nama).join(' | ')} |`);
  md.push(`|---|${VARIAN.map(() => '---').join('|')}|`);
  for (const [label, f] of baris) {
    md.push(`| ${label} | ${VARIAN.map((v) => (terbaru.varian[v.kunci] ? f(terbaru.varian[v.kunci]) : '–')).join(' | ')} |`);
  }
  md.push('');
  md.push('Varian heap 256 MB tidak dipindai kerentanannya dan tidak dibuatkan image; jarnya sama dengan varian Spring Boot.');
  md.push('');
  md.push(`### Tren ${entriGrafik.length} run terakhir`);
  md.push('');
  for (const g of GRAFIK) {
    md.push(`![${g.judul}](hasil/${g.berkas}-terang.svg#gh-light-mode-only)`);
    md.push(`![${g.judul}](hasil/${g.berkas}-gelap.svg#gh-dark-mode-only)`);
    md.push('');
  }
  md.push(`### Riwayat ${Math.min(JUMLAH_RIWAYAT, riwayat.length)} run terakhir`);
  md.push('');
  md.push('| Waktu | Pemicu | NestJS | Spring Boot | Memori diam (MB), NestJS / Spring | Siap (detik), NestJS / Spring | Kerentanan NestJS (k / t / s) | Kerentanan Spring Boot (k / t / s) |');
  md.push('|---|---|---|---|---|---|---|---|');
  for (const e of riwayat.slice(-JUMLAH_RIWAYAT).reverse()) {
    const a = e.varian.nest, b = e.varian.spring;
    const url = urlRun(e.run_id);
    const waktu = url ? `[${tanggalPanjang(e.waktu)}](${url})` : tanggalPanjang(e.waktu);
    md.push(`| ${waktu} | ${namaPemicu[e.pemicu] ?? e.pemicu} | ${status(a)} | ${status(b)} | ${fmt(a?.memori_diam_mb)} / ${fmt(b?.memori_diam_mb)} | ${fmt(a?.siap_detik, 1)} / ${fmt(b?.siap_detik, 1)} | ${rentan(a?.rentan)} | ${rentan(b?.rentan)} |`);
  }
  md.push('');
  md.push('Angka kinerja berasal dari mesin CI yang dipakai bersama; satu kandidat bisa berbeda dua kali lipat antar-run. Baca trennya, bukan satu titik.');
}
md.push('<!-- HASIL-HARIAN:SELESAI -->');

let readme = readFileSync(README, 'utf8');
const pola = /<!-- HASIL-HARIAN:MULAI -->[\s\S]*?<!-- HASIL-HARIAN:SELESAI -->/;
if (pola.test(readme)) {
  readme = readme.replace(pola, md.join('\n'));
} else {
  // Pertama kali: letakkan tepat sebelum bagian "## Isi".
  const i = readme.indexOf('\n## Isi');
  readme = i >= 0 ? readme.slice(0, i) + '\n' + md.join('\n') + '\n' + readme.slice(i) : readme + '\n' + md.join('\n') + '\n';
}
writeFileSync(README, readme);
console.log(`Riwayat: ${riwayat.length} run. Run ${RUN_ID}: ${Object.keys(varian).join(', ') || 'tanpa data'}.`);
