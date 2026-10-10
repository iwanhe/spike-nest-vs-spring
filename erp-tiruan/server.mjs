// ERP tiruan untuk spike. Tanpa dependency: jalankan dengan `node server.mjs`.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4000);
const tersimpan = new Map(); // kunci idempotensi -> dokumen
let mode = 'normal';         // normal | gagal | lambat | diam | simpan-lalu-gagal
let panggilan = 0;

function bacaBody(req) {
  return new Promise((selesai, gagal) => {
    let teks = '';
    req.on('data', (potongan) => (teks += potongan));
    req.on('end', () => {
      try { selesai(teks ? JSON.parse(teks) : {}); } catch (e) { gagal(e); }
    });
  });
}

function kirim(res, status, isi) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(isi));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'POST' && url.pathname === '/admin/mode') {
      const body = await bacaBody(req);
      mode = body.mode ?? 'normal';
      return kirim(res, 200, { mode });
    }
    if (req.method === 'DELETE' && url.pathname === '/admin/data') {
      tersimpan.clear(); panggilan = 0; mode = 'normal';
      return kirim(res, 200, { reset: true });
    }
    if (req.method === 'GET' && url.pathname === '/erp/pengajuan') {
      return kirim(res, 200, { jumlah: tersimpan.size, panggilan, data: [...tersimpan.values()] });
    }
    if (req.method === 'POST' && url.pathname === '/erp/pengajuan') {
      panggilan += 1;
      const kunci = req.headers['idempotency-key'];
      if (!kunci) return kirim(res, 400, { pesan: 'Header Idempotency-Key wajib diisi' });
      const body = await bacaBody(req);

      if (mode === 'diam') return;                       // tidak pernah menjawab
      if (mode === 'gagal') return kirim(res, 503, { pesan: 'ERP sedang tidak tersedia' });
      if (mode === 'lambat') await new Promise((r) => setTimeout(r, 5000));

      if (tersimpan.has(kunci)) {                        // kiriman ulang: jangan catat dua kali
        return kirim(res, 200, { ...tersimpan.get(kunci), duplikat: true });
      }
      const dokumen = { nomorErp: `ERP-${String(tersimpan.size + 1).padStart(6, '0')}`, kunci, isi: body };
      tersimpan.set(kunci, dokumen);

      if (mode === 'simpan-lalu-gagal') return kirim(res, 500, { pesan: 'Tersimpan, tetapi jawaban gagal dikirim' });
      return kirim(res, 201, { ...dokumen, duplikat: false });
    }
    kirim(res, 404, { pesan: 'Alamat tidak dikenal' });
  } catch (e) {
    kirim(res, 400, { pesan: 'Body bukan JSON yang sah' });
  }
});

server.listen(PORT, () => console.log(`ERP tiruan berjalan di http://localhost:${PORT}`));
