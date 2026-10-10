# Spike: NestJS vs Spring Boot di PostgreSQL

Repo percobaan untuk membandingkan NestJS 12 dan Spring Boot 4.1 sebagai backend di atas PostgreSQL.
Kode di sini bahan uji, bukan kode produksi.

| Folder | Isi |
| --- | --- |
| `app-nest` | Aplikasi uji di NestJS 12 |
| `app-spring` | Aplikasi uji di Spring Boot |
| `db` | Skema (Flyway) dan data awal 1 juta baris |
| `erp-tiruan` | ERP palsu yang bisa disuruh gagal, lambat, atau diam |
| `uji-penerimaan` | Uji otomatis yang sama untuk kedua aplikasi |
| `skrip` | Skrip ukur: waktu siap, memori, waktu respons |
| `.github/workflows/spike.yml` | Menjalankan semuanya di GitHub Actions |

Setiap push ke `main` menjalankan kedua kandidat di mesin yang sama jenisnya, dengan database,
data, dan uji yang sama. Hasil tiap kandidat muncul di ringkasan run dan sebagai artifact `hasil-*`.

Kata sandi di repo ini (`spike_dev_only`) hanya untuk database sementara di mesin uji.
