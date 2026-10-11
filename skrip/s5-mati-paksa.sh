#!/usr/bin/env bash
# S5: aplikasi dimatikan paksa (kill -9) saat sedang mengirim ke ERP yang lambat.
# Lulus bila setelah hidup lagi setiap pengajuan tercatat di ERP tepat satu kali
# dan semua baris outbox-nya berstatus TERKIRIM.
# Pemakaian: skrip/s5-mati-paksa.sh "<perintah menjalankan aplikasi>"
set -euo pipefail
PERINTAH=$1
PORT_APP=${PORT:-3000}
API=${API_URL:-http://localhost:$PORT_APP}
ERP=${ERP_URL:-http://localhost:4000}
KELUARAN=${KELUARAN:-ukur-s5.json}
SQL=(psql -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U spike -d spike -At)
export TANPA_DIAM=1

mode() { curl -s -o /dev/null -X POST "$ERP/admin/mode" -H 'content-type: application/json' -d "{\"mode\":\"$1\"}"; }
trap 'mode normal' EXIT

awalan="S5MATI-$(date +%s%N)"
mode lambat   # ERP baru menjawab setelah 5 detik; batas waktu aplikasi lebih pendek
for n in 1 2 3; do
  curl -s -o /dev/null -X POST "$API/pengajuan" -H 'content-type: application/json' \
    -d "{\"nomor\":\"$awalan-$n\",\"pemohon\":\"budi\",\"pemasok\":\"PEMASOK-001\",\"baris\":[{\"namaBarang\":\"Pulpen\",\"jumlah\":\"2\",\"hargaSatuan\":\"1500.00\"}]}"
done
punya="pengajuan_id in (select id from pengajuan where nomor like '$awalan-%')"

# Tunggu sampai pengiriman pertama sedang berjalan, lalu matikan paksa.
for _ in $(seq 1 100); do
  [ "$("${SQL[@]}" -c "select count(*) from outbox where $punya and percobaan >= 1")" -ge 1 ] && break
  sleep 0.1
done
pid=$(cat app.pid)
kill -KILL "$pid"
for _ in $(seq 1 100); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done

mode normal
KELUARAN=/tmp/abaikan-s5.json ../skrip/mulai.sh "$PERINTAH" > /dev/null

terkirim=0
for _ in $(seq 1 240); do
  terkirim=$("${SQL[@]}" -c "select count(*) from outbox where $punya and status = 'TERKIRIM'")
  [ "$terkirim" = 3 ] && break
  sleep 0.25
done
sleep 6   # beri waktu kiriman lambat yang tertinggal untuk sampai di ERP

percobaan=$("${SQL[@]}" -c "select coalesce(sum(percobaan), 0) from outbox where $punya")
di_erp=$(curl -s "$ERP/erp/pengajuan" | jq --arg a "$awalan-" '[.data[] | select(.isi.nomor // "" | startswith($a))] | length')
nomor_unik=$(curl -s "$ERP/erp/pengajuan" | jq --arg a "$awalan-" '[.data[] | select(.isi.nomor // "" | startswith($a)) | .isi.nomor] | unique | length')

hasil=gagal
[ "$terkirim" = 3 ] && [ "$di_erp" = 3 ] && [ "$nomor_unik" = 3 ] && hasil=lulus
printf '{"s5_mati_paksa": "%s", "s5_outbox_terkirim": %s, "s5_tercatat_di_erp": %s, "s5_jumlah_percobaan": %s}\n' \
  "$hasil" "$terkirim" "$di_erp" "$percobaan" > "$KELUARAN"
cat "$KELUARAN"
[ "$hasil" = lulus ]
