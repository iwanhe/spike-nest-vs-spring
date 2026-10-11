#!/usr/bin/env bash
# S4: mengukur ekspor besar. Selagi ekspor berjalan, memori proses dicatat tiap 0,1 detik
# dan permintaan ringan terus dikirim untuk melihat apakah pengguna lain ikut tertahan.
# Pemakaian (dari folder aplikasi): skrip/ekspor.sh [jumlah baris]
set -euo pipefail
JUMLAH=${1:-100000}
PORT_APP=${PORT:-3000}
API=${API_URL:-http://localhost:$PORT_APP}
KELUARAN=${KELUARAN:-ukur-ekspor.json}
pid=$(cat app.pid)
rss() { awk '/VmRSS/{print $2}' "/proc/$pid/status"; }

id_ringan=$(curl -s -X POST "$API/pengajuan" -H 'content-type: application/json' \
  -d "{\"nomor\":\"EKSPOR-$(date +%s%N)\",\"pemohon\":\"budi\",\"pemasok\":\"PEMASOK-001\",\"baris\":[{\"namaBarang\":\"Pulpen\",\"jumlah\":\"2\",\"hargaSatuan\":\"1500.00\"}]}" | jq -r .id)

sebelum=$(rss)
t0=$(date +%s%3N)
id=$(curl -s -X POST "$API/ekspor" -H 'content-type: application/json' -d "{\"jumlahBaris\": $JUMLAH}" | jq -r .idPekerjaan)

puncak=$sebelum; terlama=0; jumlah_ringan=0; status=BERJALAN
while [ "$status" = BERJALAN ] && [ $(( $(date +%s%3N) - t0 )) -lt 300000 ]; do
  r=$(rss); [ "$r" -gt "$puncak" ] && puncak=$r
  ms=$(curl -s -o /dev/null -w '%{time_total}' "$API/pengajuan/$id_ringan" | awk '{printf "%d", $1 * 1000}')
  [ "$ms" -gt "$terlama" ] && terlama=$ms
  jumlah_ringan=$((jumlah_ringan + 1))
  status=$(curl -s "$API/ekspor/$id" | jq -r .status)
  sleep 0.1
done
lama=$(( $(date +%s%3N) - t0 ))
r=$(rss); [ "$r" -gt "$puncak" ] && puncak=$r

curl -s -o /tmp/hasil-ekspor.csv "$API/ekspor/$id/csv"
curl -s -o /tmp/hasil-ekspor.xlsx "$API/ekspor/$id/xlsx"
baris_csv=$(wc -l < /tmp/hasil-ekspor.csv)
baris_xlsx=$(unzip -p /tmp/hasil-ekspor.xlsx xl/worksheets/sheet1.xml | grep -o '<row ' | wc -l)

jq -n --arg s "$status" --arg sha "$(sha256sum /tmp/hasil-ekspor.csv | cut -c1-16)" \
  --argjson n "$JUMLAH" --argjson lama "$lama" --argjson a "$sebelum" --argjson p "$puncak" \
  --argjson t "$terlama" --argjson jr "$jumlah_ringan" --argjson bc "$baris_csv" --argjson bx "$baris_xlsx" \
  --argjson kc "$(stat -c %s /tmp/hasil-ekspor.csv)" --argjson kx "$(stat -c %s /tmp/hasil-ekspor.xlsx)" \
  '{("ekspor_" + ($n | tostring)): {status: $s, lama_ms: $lama, memori_sebelum_kb: $a, memori_puncak_kb: $p,
     kenaikan_memori_kb: ($p - $a), permintaan_ringan_terlama_ms: $t, permintaan_ringan_jumlah: $jr,
     baris_csv: $bc, baris_xlsx: $bx, byte_csv: $kc, byte_xlsx: $kx, sha256_csv: $sha}}' > "$KELUARAN"
cat "$KELUARAN"
[ "$status" = SELESAI ] && [ "$baris_csv" = $((JUMLAH + 1)) ] && [ "$baris_xlsx" = $((JUMLAH + 1)) ]
