# Spike NestJS vs Spring Boot di PostgreSQL

Bahan uji untuk memilih backend umum aplikasi standalone: NestJS 12 atau Spring Boot 4.1, keduanya di PostgreSQL 18.
Dua aplikasi contoh memenuhi kontrak API yang sama dan diuji dengan uji penerimaan yang sama.

Kata sandi di repo ini (`spike_dev_only`, `admin_dev_only`, `budi_dev_only`, `sari_dev_only`) hanya untuk database dan
penyedia identitas uji yang dibuat lalu dibuang. Jangan dipakai di server.

<!-- HASIL-HARIAN:MULAI -->
## Hasil uji harian

Bagian ini diperbarui otomatis oleh alur GitHub Actions setelah setiap run terjadwal (06.17 WIB) atau manual di branch `main`.
Jangan diedit dengan tangan: perubahan akan tertimpa pada run berikutnya. Data mentahnya ada di [`hasil/riwayat.jsonl`](hasil/riwayat.jsonl).

**Run terakhir:** 19 Okt 2026, 08.13 WIB, terjadwal, [run 39184347706](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/39184347706).

| Ukuran | NestJS | Spring Boot | Spring Boot (heap 256 MB) |
|---|---|---|---|
| Status run | ✅ lulus | ✅ lulus | ✅ lulus |
| Uji penerimaan S1, S2, S4, S5 | 15 dari 15 | 15 dari 15 | 15 dari 15 |
| Uji keamanan S6 | 5 dari 5 | 5 dari 5 | 5 dari 5 |
| Mati paksa: persetujuan / pengiriman ERP | lulus / lulus | lulus / lulus | lulus / lulus |
| Waktu sampai siap (detik) | 1,1 | 10,4 | 7,1 |
| Memori saat diam (MB) | 143 | 467 | 373 |
| Memori setelah beban (MB) | 345 | 590 | 494 |
| Permintaan per detik, 10 koneksi | 1.677 | 3.038 | 6.036 |
| Median waktu respons (ms) | 1,1 | 0,84 | 0,52 |
| Laporan 1 juta baris (detik) | 1,7 | 1,8 | 1 |
| Ekspor 1 juta baris (detik) | 12,7 | 14,2 | 10,7 |
| Gerbang kerentanan | lulus | lulus | – |
| Kerentanan paket saat berjalan (kritis / tinggi / sedang) | 0 / 0 / 1 | 0 / 0 / 0 | – |
| Ukuran image (MB) | 300 | 408 | – |
| Kerentanan OS di image (kritis / tinggi) | 4 / 60 dari 241 | 0 / 0 dari 57 | – |

Varian heap 256 MB tidak dipindai kerentanannya dan tidak dibuatkan image; jarnya sama dengan varian Spring Boot.

### Tren 13 run terakhir

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
| [19 Okt 2026, 08.13 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/39184347706) | terjadwal | ✅ lulus | ✅ lulus | 143 / 467 | 1,1 / 10,4 | 0 / 0 / 1 | 0 / 0 / 0 |
| [18 Okt 2026, 08.00 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/39084862589) | terjadwal | ✅ lulus | ✅ lulus | 141 / 475 | 1 / 7,3 | 0 / 0 / 1 | 0 / 0 / 0 |
| [17 Okt 2026, 08.17 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38990202470) | terjadwal | ✅ lulus | ✅ lulus | 140 / 445 | 0,8 / 10,4 | 0 / 0 / 1 | 0 / 0 / 0 |
| [16 Okt 2026, 08.18 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38834423549) | terjadwal | ✅ lulus | ✅ lulus | 146 / 499 | 0,9 / 11 | 0 / 0 / 1 | 0 / 0 / 0 |
| [15 Okt 2026, 08.26 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38665675235) | terjadwal | ✅ lulus | ✅ lulus | 145 / 452 | 1 / 8,7 | 0 / 0 / 1 | 0 / 0 / 0 |
| [14 Okt 2026, 08.53 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38498117474) | terjadwal | ✅ lulus | ✅ lulus | 142 / 451 | 0,8 / 10,4 | 0 / 0 / 1 | 0 / 0 / 0 |
| [13 Okt 2026, 10.31 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38342117228) | terjadwal | ✅ lulus | ✅ lulus | 143 / 460 | 0,8 / 10,9 | 0 / 0 / 1 | 0 / 0 / 0 |
| [13 Okt 2026, 08.07 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38330641799) | manual | ✅ lulus | ✅ lulus | 143 / 458 | 0,8 / 10,3 | 0 / 0 / 1 | 0 / 0 / 0 |
| [12 Okt 2026, 19.09 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38247216866) | manual | ✅ lulus | ✅ lulus | 143 / 457 | 0,9 / 8,4 | 0 / 0 / 1 | 0 / 0 / 0 |
| [12 Okt 2026, 09.21 WIB](https://github.com/iwanhe/spike-nest-vs-spring/actions/runs/38195470612) | terjadwal | ✅ lulus | ✅ lulus | 140 / 466 | 1 / 10,6 | 0 / 0 / 1 | 0 / 0 / 0 |

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
dan tanggal kedaluwarsa. Tambalan yang sedang berlaku: `tomcat.version` dan `jackson-bom.version`
di `app-spring/pom.xml`.

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
