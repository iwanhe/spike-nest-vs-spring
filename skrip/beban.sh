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

# Pemanasan: hasilnya dibuang. Tanpa ini, JVM diukur saat kodenya belum dioptimalkan.
npx -y autocannon@8 -c 10 -d "${PEMANASAN:-20}" -j "$API/pengajuan/$id" > /dev/null 2>&1
curl -s -o /dev/null "$API/laporan/rekap"

npx -y autocannon@8 -c 10 -d "$DURASI" -j "$API/pengajuan/$id" > sepi.json 2>/dev/null

# Pembanding dengan alat lain: 300 permintaan berurutan lewat curl, satu koneksi.
contoh_curl() {
  local argumen=() i
  for i in $(seq 1 300); do argumen+=(-o /dev/null "$API/pengajuan/$id"); done
  curl -s -w '%{time_total}\n' "${argumen[@]}" | sort -n \
    | awk '{a[NR]=$1} END {printf "{\"median_ms\": %.2f, \"p97_5_ms\": %.2f, \"jumlah\": %d}", a[int(NR*0.5)]*1000, a[int(NR*0.975)]*1000, NR}'
}
curl_sepi=$(contoh_curl)

( akhir=$(( $(date +%s) + DURASI + 2 )); while [ "$(date +%s)" -lt "$akhir" ]; do curl -s -o /dev/null "$API/laporan/rekap"; done ) &
latar=$!
sleep 1
npx -y autocannon@8 -c 10 -d "$DURASI" -j "$API/pengajuan/$id" > sibuk.json 2>/dev/null
wait "$latar" || true

( akhir=$(( $(date +%s) + 6 )); while [ "$(date +%s)" -lt "$akhir" ]; do curl -s -o /dev/null "$API/laporan/rekap"; done ) &
latar=$!
sleep 1
curl_sibuk=$(contoh_curl)
wait "$latar" || true

rss=$(awk '/VmRSS/{print $2}' "/proc/$pid/status")
puncak=$(awk '/VmHWM/{print $2}' "/proc/$pid/status")

ringkas() { jq '{median_ms: .latency.p50, rata_ms: .latency.average, p97_5_ms: .latency.p97_5, p99_ms: .latency.p99, permintaan_per_detik: .requests.average, permintaan_total: .requests.total, galat: (.errors + .non2xx)}' "$1"; }
jq -n --argjson sepi "$(ringkas sepi.json)" --argjson sibuk "$(ringkas sibuk.json)" \
  --argjson laporan "$laporan" --argjson rss "$rss" --argjson puncak "$puncak" \
  --argjson csepi "$curl_sepi" --argjson csibuk "$curl_sibuk" \
  '{laporan: $laporan, sepi: $sepi, saat_laporan: $sibuk, curl_sepi: $csepi, curl_saat_laporan: $csibuk, memori_setelah_beban_kb: $rss, memori_puncak_kb: $puncak}' > "$KELUARAN"
cat "$KELUARAN"
