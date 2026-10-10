#!/usr/bin/env bash
# S2: aplikasi dimatikan paksa (kill -9) saat pengajuan menunggu keputusan.
# Lulus bila setelah hidup lagi keputusan tetap diproses dan tercatat tepat satu kali.
# Pemakaian: skrip/mati-paksa.sh "<perintah menjalankan aplikasi>"
set -euo pipefail
PERINTAH=$1
PORT_APP=${PORT:-3000}
API=${API_URL:-http://localhost:$PORT_APP}
KELUARAN=${KELUARAN:-ukur-matipaksa.json}
SQL=(psql -h localhost -U spike -d spike -At)

hentikan() { # $1 = sinyal
  local pid; pid=$(cat app.pid)
  kill "$1" "$pid" 2>/dev/null || true
  for _ in $(seq 1 100); do kill -0 "$pid" 2>/dev/null || return 0; sleep 0.1; done
  echo "Proses $pid tidak mau berhenti"; return 1
}
tunggu_status() { # $1 = id, $2 = status yang diharapkan
  for _ in $(seq 1 80); do
    [ "$("${SQL[@]}" -c "select status from pengajuan where id = '$1'")" = "$2" ] && return 0
    sleep 0.25
  done
  echo "Status $2 tidak tercapai untuk $1"; return 1
}

# Batas waktu dibuat panjang, supaya eskalasi tidak ikut campur.
export BATAS_PERSETUJUAN=3d TANPA_DIAM=1
hentikan -TERM
KELUARAN=/tmp/abaikan.json ../skrip/mulai.sh "$PERINTAH" > /dev/null

id=$(curl -s -X POST "$API/pengajuan" -H 'content-type: application/json' \
  -d "{\"nomor\":\"MATI-$(date +%s%N)\",\"pemohon\":\"budi\",\"pemasok\":\"PEMASOK-001\",\"baris\":[{\"namaBarang\":\"Pulpen\",\"jumlah\":\"2\",\"hargaSatuan\":\"1500.00\"}]}" \
  | jq -r .id)
curl -s -o /dev/null -X POST "$API/pengajuan/$id/ajukan"
tunggu_status "$id" DIAJUKAN

hentikan -KILL
KELUARAN=/tmp/pulih.json ../skrip/mulai.sh "$PERINTAH" > /dev/null
pulih_ms=$(jq -r .siap_ms /tmp/pulih.json)

curl -s -o /dev/null -X POST "$API/pengajuan/$id/keputusan" -H 'content-type: application/json' \
  -d '{"keputusan":"SETUJU","penyetuju":"sari"}'
tunggu_status "$id" DISETUJUI
sleep 2
catatan=$("${SQL[@]}" -c "select count(*) from persetujuan where pengajuan_id = '$id'")

hasil=gagal; [ "$catatan" = "1" ] && hasil=lulus
printf '{"mati_paksa": "%s", "catatan_persetujuan": %s, "pulih_ms": %s}\n' "$hasil" "$catatan" "$pulih_ms" > "$KELUARAN"
cat "$KELUARAN"
[ "$hasil" = lulus ]
