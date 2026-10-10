SELECT to_char(date_trunc('month', dibuat_pada AT TIME ZONE 'Asia/Jakarta'), 'YYYY-MM') AS bulan,
       pemasok,
       count(*)   AS jumlah_pengajuan,
       sum(total) AS total
FROM pengajuan
WHERE status = 'DISETUJUI'
GROUP BY 1, 2
ORDER BY 1, 2;
