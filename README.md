# Spike NestJS vs Spring Boot di PostgreSQL

Bahan uji untuk memilih backend umum aplikasi standalone: NestJS 12 atau Spring Boot 4.1, keduanya di PostgreSQL 18.
Dua aplikasi contoh memenuhi kontrak API yang sama dan diuji dengan uji penerimaan yang sama.

Kata sandi di repo ini (`spike_dev_only`, `admin_dev_only`, `budi_dev_only`, `sari_dev_only`) hanya untuk database dan
penyedia identitas uji yang dibuat lalu dibuang. Jangan dipakai di server.

<!-- HASIL-HARIAN:MULAI -->
## Hasil uji harian

Bagian ini diperbarui otomatis oleh alur GitHub Actions setelah setiap run terjadwal (06.17 WIB) atau manual di branch `main`.
Jangan diedit dengan tangan: perubahan akan tertimpa pada run berikutnya. Data mentahnya ada di [`hasil/riwayat.jsonl`](hasil/riwayat.jsonl).

**Run terakhir:** 18 Nov 2026, 11.15 WIB, terjadwal, [run 44236021738](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/44236021738).

| Ukuran | NestJS | Spring Boot | Spring Boot (heap 256 MB) |
|---|---|---|---|
| Status run | ✅ lulus | ✅ lulus | ✅ lulus |
| Uji penerimaan S1, S2, S4, S5 | 15 dari 15 | 15 dari 15 | 15 dari 15 |
| Uji keamanan S6 | 5 dari 5 | 5 dari 5 | 5 dari 5 |
| Mati paksa: persetujuan / pengiriman ERP | lulus / lulus | lulus / lulus | lulus / lulus |
| Waktu sampai siap (detik) | 1 | 8,6 | 6,7 |
| Memori saat diam (MB) | 142 | 440 | 381 |
| Memori setelah beban (MB) | 352 | 663 | 509 |
| Permintaan per detik, 10 koneksi | 1.691 | 5.633 | 7.269 |
| Median waktu respons (ms) | 1,11 | 0,47 | 0,42 |
| Laporan 1 juta baris (detik) | 1,8 | 1,1 | 0,9 |
| Ekspor 1 juta baris (detik) | 13,2 | 11 | 10,6 |
| Gerbang kerentanan | lulus | lulus | – |
| Kerentanan paket saat berjalan (kritis / tinggi / sedang) | 0 / 1 / 1 | 0 / 0 / 1 | – |
| Ukuran image (MB) | 95 | 194 | – |
| Kerentanan OS di image (kritis / tinggi) | 1 / 37 dari 226 | 0 / 2 dari 99 | – |
| Gerbang OS image (mode peringatan) | lulus | peringatan (2 temuan sudah ada perbaikan) | – |
| Mesin CI | 4 inti, 16 GB, AMD EPYC 7763 64-Core Processor | 4 inti, 16 GB, AMD EPYC 9V45 96-Core Processor | 4 inti, 16 GB, AMD EPYC 9V45 96-Core Processor |

Varian heap 256 MB tidak dipindai kerentanannya dan tidak dibuatkan image; jarnya sama dengan varian Spring Boot.

### Tren 30 run terakhir

![Memori saat diam](hasil/grafik-memori-terang.svg#gh-light-mode-only)
![Memori saat diam](hasil/grafik-memori-gelap.svg#gh-dark-mode-only)

![Waktu sampai siap melayani](hasil/grafik-siap-terang.svg#gh-light-mode-only)
![Waktu sampai siap melayani](hasil/grafik-siap-gelap.svg#gh-dark-mode-only)

![Permintaan per detik, 10 koneksi](hasil/grafik-permintaan-terang.svg#gh-light-mode-only)
![Permintaan per detik, 10 koneksi](hasil/grafik-permintaan-gelap.svg#gh-dark-mode-only)

![Ekspor 1 juta baris ke CSV dan Excel](hasil/grafik-ekspor-terang.svg#gh-light-mode-only)
![Ekspor 1 juta baris ke CSV dan Excel](hasil/grafik-ekspor-gelap.svg#gh-dark-mode-only)

### Riwayat 10 run terakhir

| Waktu | Pemicu | NestJS | Spring Boot | Memori diam (MB), NestJS / Spring | Siap (detik), NestJS / Spring | Kerentanan NestJS (k / t / s) | Kerentanan Spring Boot (k / t / s) |
|---|---|---|---|---|---|---|---|
| [18 Nov 2026, 11.15 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/44236021738) | terjadwal | ✅ lulus | ✅ lulus | 142 / 440 | 1 / 8,6 | 0 / 1 / 1 | 0 / 0 / 1 |
| [17 Nov 2026, 12.03 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/44021384616) | terjadwal | ✅ lulus | ✅ lulus | 139 / 456 | 0,9 / 11,9 | 0 / 0 / 1 | 0 / 0 / 1 |
| [16 Nov 2026, 09.42 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/43793815290) | terjadwal | ✅ lulus | ✅ lulus | 143 / 450 | 0,8 / 8,7 | 0 / 0 / 1 | 0 / 0 / 1 |
| [15 Nov 2026, 09.37 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/43668648734) | terjadwal | ✅ lulus | ✅ lulus | 142 / 456 | 0,8 / 7,1 | 0 / 0 / 1 | 0 / 0 / 1 |
| [14 Nov 2026, 10.11 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/43550275115) | terjadwal | ✅ lulus | ✅ lulus | 142 / 464 | 0,6 / 11,3 | 0 / 0 / 1 | 0 / 0 / 1 |
| [13 Nov 2026, 10.23 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/43358684008) | terjadwal | ✅ lulus | ✅ lulus | 145 / 463 | 0,6 / 9,4 | 0 / 0 / 1 | 0 / 0 / 1 |
| [12 Nov 2026, 10.47 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/43150549461) | terjadwal | ✅ lulus | ✅ lulus | 140 / 462 | 0,8 / 7,9 | 0 / 0 / 1 | 0 / 0 / 1 |
| [11 Nov 2026, 09.45 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/42948144383) | terjadwal | ✅ lulus | ✅ lulus | 141 / 451 | 0,8 / 7,2 | 0 / 0 / 1 | 0 / 0 / 1 |
| [10 Nov 2026, 11.36 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/42756952311) | terjadwal | ✅ lulus | ✅ lulus | 144 / 445 | 0,6 / 8,4 | 0 / 0 / 1 | 0 / 0 / 1 |
| [9 Nov 2026, 09.38 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/42552050066) | terjadwal | ✅ lulus | ✅ lulus | 140 / 466 | 0,8 / 9,6 | 0 / 0 / 1 | 0 / 0 / 1 |

Angka kinerja berasal dari mesin CI yang dipakai bersama; satu kandidat bisa berbeda dua kali lipat antar-run. Baca trennya, bukan satu titik.
<!-- HASIL-HARIAN:SELESAI -->

## Isi

| Folder | Isi |
|---|---|
| `app-nest/` | Contoh NestJS 12, TypeORM, `@nestjs/workflows` |
| `app-spring/` | Contoh Spring Boot 4.1, JPA, Flowable 8 |
| `db/` | Skema (Flyway) dan data awal 1 juta baris |
| `erp-tiruan/` | ERP tiruan dengan mode gangguan, untuk S5 |
| `idp/` | Realm Keycloak untuk S6 |
| `uji-penerimaan/` | Uji kotak hitam S1, S2, S4, S5, S6 (`node --test`) |
| `skrip/` | Skrip ukur: waktu siap, beban, mati paksa, ekspor, health check, image, pemindaian |
| `.github/workflows/spike.yml` | Alur uji otomatis untuk semua varian |

## Skenario

| Kode | Yang diuji | Cara |
|---|---|---|
| S1 | Transaksi uang: presisi angka dan rollback | uji penerimaan |
| S2 | Alur persetujuan, termasuk mati paksa di tengah proses | uji penerimaan dan `skrip/mati-paksa.sh` |
| S3 | Laporan berat tidak mengganggu permintaan lain | `skrip/beban.sh` |
| S4 | Ekspor 100.000 dan 1.000.000 baris ke CSV dan Excel di latar | uji penerimaan dan `skrip/ekspor.sh` |
| S5 | Pengiriman ke ERP tepat satu kali lewat outbox | uji penerimaan dan `skrip/s5-mati-paksa.sh` |
| S6 | Token Keycloak, peran, log JSON ber-ID korelasi, health check, image bukan root | uji penerimaan, `skrip/s6-operasional.sh`, `skrip/wadah.sh` |
| S7 | Kerentanan dependency dan latihan menambal | `skrip/pindai.sh` |

## Varian yang dijalankan

`nest`, `spring`, dan `spring-heap256` (heap JVM dibatasi 256 MB).

## Gerbang kerentanan

Build gagal bila pemindaian menemukan kerentanan kritis atau tinggi pada paket yang ikut ke server
dan versi perbaikannya sudah ada. Temuan yang sengaja diterima dicatat di `.trivyignore`, dengan alasan
dan tanggal kedaluwarsa. Tambalan yang sedang berlaku:

- `tomcat.version` dan `jackson-bom.version` di `app-spring/pom.xml` (sejak 11 Oktober 2026).
- `overrides.multer` 2.5.0 di `app-nest/package.json` (sejak 25 Oktober 2026, CVE-2026-113872).
  `@nestjs/platform-express` 12.2.0 masih mengunci multer 2.4.0, jadi versi perbaikan hanya bisa
  dipaksa lewat `overrides`. Cabut setelah rilis NestJS memakai multer 2.5.0 atau lebih baru.

Tambalan lewat lockfile tanpa override: body-parser 2.3.0 ke 2.4.0 (CVE-2026-111181), karena
express 5.2.1 meminta `^2.3.0`.

### Image container

- **Base image dikunci ke digest** (`FROM image:tag@sha256:...`) di kedua Dockerfile, sejak 11 November 2026.
  Isi image tidak lagi berubah diam-diam antar-run. Dependabot (`.github/dependabot.yml`) memeriksa digest
  baru setiap Senin dan membuka PR; PR itu menjalankan seluruh uji sebelum boleh di-merge.
- **Gerbang OS, mode peringatan.** Paket sistem operasi di image dipindai dengan aturan yang sama seperti
  gerbang dependency (kritis atau tinggi yang sudah punya perbaikan, dikurangi `.trivyignore`). Bila ada,
  run memberi peringatan dan README menampilkan "peringatan", tetapi job tidak digagalkan. Rincian per CVE
  ada di anotasi `TRIVYOS <varian>` dan artifact `trivy-image-daftar.txt`. Gerbang ini dinaikkan menjadi
  pemblokir setelah beberapa run ditinjau.

### Mesin runner

Setiap varian mencatat model CPU, jumlah inti, RAM, image runner, versi Node, Java, PostgreSQL, dan
digest base image di kunci `lingkungan` pada `hasil/riwayat.jsonl`. Ketiga varian dalam satu run bisa
mendapat mesin yang berbeda; bandingkan kinerja dengan melihat kolom ini lebih dulu.

## Confluence

Hasil yang sama juga ditulis ke halaman Confluence KCSI "Spike NestJS vs Spring Boot - Hasil Uji Harian"
(space SD, di bawah "Pemilihan Backend: Spike NestJS vs Spring Boot"). Langkah ini butuh dua secret repo:
`ATLASSIAN_EMAIL` dan `ATLASSIAN_API_TOKEN`. Tanpa keduanya langkah itu dilewati dan run tetap lulus.

## Jadwal dan cara membaca hasil

Alur berjalan pada setiap push ke `main` atau `spike`, bisa dijalankan manual dari tab **Actions**, dan
berjalan sendiri setiap hari pukul 06.17 WIB setelah file alur ini ada di branch `main`.

Buka satu run di tab **Actions**, lalu lihat bagian **Summary**: tiap varian menulis satu blok JSON hasil.
Rincian per uji ada di anotasi berjudul `UJI`, `UJIS6`, `S4S6`, dan `TRIVY`.

Angka kinerja berasal dari mesin CI yang dipakai bersama. Pakai sebagai urutan besaran dan bandingkan
antar-hari, bukan sebagai angka kapasitas server.
