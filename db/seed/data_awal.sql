-- Data awal: 1 juta pengajuan historis, nilainya selalu sama setiap kali dijalankan
INSERT INTO pengajuan (nomor, pemohon, pemasok, status, total, dibuat_pada)
SELECT 'HIST-' || lpad(g::text, 7, '0'),
       'pemohon' || (g % 200),
       'PEMASOK-' || lpad((g % 497)::text, 3, '0'),
       'DISETUJUI',
       ((g::bigint * 7919) % 5000000000)::numeric / 100,
       timestamptz '2024-01-01 00:00:00+07' + (g % 1000) * interval '1 day'
FROM generate_series(1, 1000000) AS g;

ANALYZE pengajuan;
