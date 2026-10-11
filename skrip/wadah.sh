#!/usr/bin/env bash
# S6, bagian image container: dibangun, diperiksa penggunanya, dicoba jalan, lalu dipindai.
# Pemakaian (dari akar repo): skrip/wadah.sh nest|spring
set -uo pipefail
KANDIDAT=$1
KELUARAN=${KELUARAN:-ukur-wadah.json}
TRIVY=${TRIVY:-ghcr.io/aquasecurity/trivy:0.74.0}
IMAGE=spike-$KANDIDAT:uji
PORT_WADAH=3100

t0=$(date +%s)
docker build -q -t "$IMAGE" "app-$KANDIDAT" > /dev/null || { echo '{"wadah": "gagal dibangun"}' > "$KELUARAN"; cat "$KELUARAN"; exit 1; }
bangun=$(( $(date +%s) - t0 ))
ukuran_mb=$(( $(docker image inspect "$IMAGE" --format '{{.Size}}') / 1000000 ))
uid=$(docker run --rm --entrypoint id "$IMAGE" -u)

# Dicoba jalan sebagai pengguna bukan root, lalu health check dipanggil.
if [ "$KANDIDAT" = nest ]; then sehat="http://localhost:$PORT_WADAH/sehat"; else sehat="http://localhost:$PORT_WADAH/actuator/health"; fi
docker run -d --name uji-wadah --network host -e PORT=$PORT_WADAH \
  -e DATABASE_URL="postgres://spike:spike_dev_only@localhost:5432/spike" "$IMAGE" > /dev/null
kode=000
for _ in $(seq 1 120); do
  kode=$(curl -s -o /dev/null -m 3 -w '%{http_code}' "$sehat" || true)
  [ "$kode" = 200 ] && break
  sleep 0.5
done
[ "$kode" = 200 ] || docker logs uji-wadah 2>&1 | tail -30
docker rm -f uji-wadah > /dev/null

# Pemindaian image: paket sistem operasi di dalam image, yang tidak terlihat oleh pemindaian dependency.
mkdir -p "$HOME/.cache/trivy"
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$HOME/.cache/trivy:/root/.cache/trivy" \
  "$TRIVY" image --scanners vuln --pkg-types os --format json --quiet "$IMAGE" > trivy-image.json || echo '{}' > trivy-image.json
os=$(jq -c '{dasar: (.Metadata.OS.Family // "?") + " " + (.Metadata.OS.Name // ""),
  total: ([.Results[]?.Vulnerabilities[]?] | length),
  kritis: ([.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL")] | length),
  tinggi: ([.Results[]?.Vulnerabilities[]? | select(.Severity == "HIGH")] | length),
  ada_perbaikan: ([.Results[]?.Vulnerabilities[]? | select((.FixedVersion // "") != "")] | length)}' trivy-image.json)

hasil=gagal; [ "$uid" != 0 ] && [ "$kode" = 200 ] && hasil=lulus
jq -n --arg h "$hasil" --arg u "$uid" --arg k "$kode" --argjson m "$ukuran_mb" --argjson b "$bangun" --argjson os "$os" \
  '{wadah: {hasil: $h, uid: $u, sehat: $k, ukuran_mb: $m, bangun_detik: $b, kerentanan_os: $os}}' > "$KELUARAN"
cat "$KELUARAN"
[ "$hasil" = lulus ]
