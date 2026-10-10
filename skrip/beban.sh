#!/usr/bin/env bash
# Mengukur waktu respons permintaan ringan: saat sepi, lalu saat laporan berat berjalan terus.
set -euo pipefail
PORT_APP=${PORT:-3000}
API=${API_URL:-http://localhost:$PORT_APP}
KELUARAN=${KELUARAN:-ukur-beban.json}
DURASI=${DURASI:-15}
pid=$(cat app.pid)

id=$(curl -s -X POST "$API/pengajuan" -H 'content-type: application/json' \
  -d "{\"nomor\":\"UKUR-$(date +%s%N)\",\"pemohon\":\"budi\",\"pemasok\":\"PEMASOK-001\",\"baris\":[{\"namaBarang\":\"Pulpen\",\"jumlah\":\"2\",\"hargaSatuan\":\"1500.00\"}]}" \
  | jq -r .id)

# Satu kali laporan, untuk mencatat lama dan ukurannya.
laporan=$(curl -s -o /dev/null -w '{"detik": %{time_total}, "byte": %{size_download}, "status": %{http_code}}' "$API/laporan/rekap")

npx -y autocannon@8 -c 10 -d "$DURASI" -j "$API/pengajuan/$id" > sepi.json 2>/dev/null

( akhir=$(( $(date +%s) + DURASI + 2 )); while [ "$(date +%s)" -lt "$akhir" ]; do curl -s -o /dev/null "$API/laporan/rekap"; done ) &
latar=$!
sleep 1
npx -y autocannon@8 -c 10 -d "$DURASI" -j "$API/pengajuan/$id" > sibuk.json 2>/dev/null
wait "$latar" || true

rss=$(awk '/VmRSS/{print $2}' "/proc/$pid/status")
puncak=$(awk '/VmHWM/{print $2}' "/proc/$pid/status")

ringkas() { jq '{median_ms: .latency.p50, p97_5_ms: .latency.p97_5, p99_ms: .latency.p99, permintaan_per_detik: .requests.average, galat: (.errors + .non2xx)}' "$1"; }
jq -n --argjson sepi "$(ringkas sepi.json)" --argjson sibuk "$(ringkas sibuk.json)" \
  --argjson laporan "$laporan" --argjson rss "$rss" --argjson puncak "$puncak" \
  '{laporan: $laporan, sepi: $sepi, saat_laporan: $sibuk, memori_setelah_beban_kb: $rss, memori_puncak_kb: $puncak}' > "$KELUARAN"
cat "$KELUARAN"
