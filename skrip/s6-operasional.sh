#!/usr/bin/env bash
# S6, bagian operasional: jejak log satu permintaan, dan health check saat database mati.
# Pemakaian (dari folder aplikasi): SEHAT_URL=... ID_KORELASI=... skrip/s6-operasional.sh
set -uo pipefail
KELUARAN=${KELUARAN:-ukur-s6.json}
SEHAT=${SEHAT_URL:?SEHAT_URL wajib diisi}
WADAH_DB=${WADAH_DB:-$(docker ps -q --filter ancestor=postgres:18 | head -1)}

# 1. Jejak log: baris log berformat JSON dengan ID korelasi yang sama, dari permintaan masuk sampai panggilan ERP.
baris_json=$(jq -R 'fromjson? | select(type == "object")' app.log 2>/dev/null | jq -s length)
baris_semua=$(grep -c . app.log)
jejak=0
if [ -n "${ID_KORELASI:-}" ]; then
  jejak=$(jq -R 'fromjson? | select(type == "object")' app.log | jq -s --arg k "$ID_KORELASI" '[.[] | select(.idKorelasi == $k)] | length')
  jq -R 'fromjson? | select(type == "object")' app.log | jq -c --arg k "$ID_KORELASI" 'select(.idKorelasi == $k)' | cut -c1-400
fi

# 2. Health check: 200 saat database hidup, bukan 200 saat database mati, lalu 200 lagi setelah database hidup.
cek() { curl -s -o /dev/null -m 60 -w '%{http_code} %{time_total}' "$SEHAT" || true; }
read -r hidup _ <<< "$(cek)"
docker stop "$WADAH_DB" > /dev/null
read -r mati lama_mati <<< "$(cek)"
pid=$(cat app.pid)
proses_bertahan=tidak; kill -0 "$pid" 2>/dev/null && proses_bertahan=ya
docker start "$WADAH_DB" > /dev/null
t0=$(date +%s%3N); pulih=000
for _ in $(seq 1 120); do
  read -r pulih _ <<< "$(curl -s -o /dev/null -m 5 -w '%{http_code} %{time_total}' "$SEHAT" || true)"
  [ "$pulih" = 200 ] && break
  sleep 0.5
done
pulih_ms=$(( $(date +%s%3N) - t0 ))
kill -0 "$pid" 2>/dev/null || proses_bertahan=tidak

hasil=gagal
[ "$hidup" = 200 ] && [ "$mati" != 200 ] && [ "$pulih" = 200 ] && [ "$proses_bertahan" = ya ] && [ "$jejak" -ge 2 ] && hasil=lulus
jq -n --arg h "$hasil" --arg a "$hidup" --arg m "$mati" --arg p "$pulih" --arg pb "$proses_bertahan" \
  --argjson lm "${lama_mati:-0}" --argjson pm "$pulih_ms" --argjson j "$jejak" --argjson bj "$baris_json" --argjson bs "$baris_semua" \
  '{s6_operasional: $h, s6_sehat_db_hidup: $a, s6_sehat_db_mati: $m, s6_sehat_db_mati_detik: $lm,
    s6_sehat_setelah_db_hidup_lagi: $p, s6_pulih_ms: $pm, s6_proses_bertahan: $pb,
    s6_baris_log_dengan_id_korelasi: $j, s6_baris_log_json: $bj, s6_baris_log_semua: $bs}' > "$KELUARAN"
cat "$KELUARAN"
[ "$hasil" = lulus ]
