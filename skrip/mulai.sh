#!/usr/bin/env bash
# Menjalankan aplikasi di latar, lalu mencatat waktu sampai siap dan memori saat diam.
# Pemakaian: skrip/mulai.sh "<perintah menjalankan aplikasi>"
set -euo pipefail
PERINTAH=$1
PORT_APP=${PORT:-3000}
API=${API_URL:-http://localhost:$PORT_APP}
KELUARAN=${KELUARAN:-ukur-mulai.json}

t0=$(date +%s%3N)
# exec membuat PID yang dicatat adalah PID aplikasi itu sendiri.
nohup bash -c "exec $PERINTAH" > app.log 2>&1 &
pid=$!
echo "$pid" > app.pid

siap=0
for _ in $(seq 1 600); do
  if curl -s -o /dev/null -m 2 "$API/pengajuan/00000000-0000-0000-0000-000000000000"; then siap=1; break; fi
  sleep 0.1
done
t1=$(date +%s%3N)
if [ "$siap" != 1 ]; then echo "Aplikasi tidak siap dalam 60 detik"; tail -50 app.log; exit 1; fi

sleep 15
if ! kill -0 "$pid" 2>/dev/null; then
  echo "Aplikasi berhenti sendiri setelah dijalankan"; tail -50 app.log; exit 1
fi
rss_diam=$(awk '/VmRSS/{print $2}' "/proc/$pid/status")

printf '{"siap_ms": %s, "memori_diam_kb": %s}\n' "$((t1 - t0))" "$rss_diam" > "$KELUARAN"
cat "$KELUARAN"
