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
# Pengecualian di .trivyignore berlaku juga di sini, sama seperti pemindaian dependency (skrip/pindai.sh).
mkdir -p "$HOME/.cache/trivy"
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$HOME/.cache/trivy:/root/.cache/trivy" \
  -v "$PWD/.trivyignore:/kerja/.trivyignore:ro" \
  "$TRIVY" image --scanners vuln --pkg-types os --ignorefile /kerja/.trivyignore --format json --quiet "$IMAGE" \
  > trivy-image.json || echo '{}' > trivy-image.json

# Gerbang OS, MODE PERINGATAN: dihitung dengan aturan yang sama seperti gerbang dependency (kritis atau tinggi
# yang sudah punya versi perbaikan), tetapi TIDAK menggagalkan job. Dinaikkan menjadi pemblokir setelah
# rincian temuannya ditinjau dan pengecualian yang perlu sudah dicatat di .trivyignore.
os=$(jq -c '[.Results[]?.Vulnerabilities[]?] as $v
  | ([$v[] | select((.Severity == "CRITICAL" or .Severity == "HIGH") and ((.FixedVersion // "") != ""))]
     | unique_by([.VulnerabilityID, .PkgName]) | length) as $p
  | {dasar: ((.Metadata.OS.Family // "?") + " " + (.Metadata.OS.Name // "")),
     total: ($v | length),
     kritis: ([$v[] | select(.Severity == "CRITICAL")] | length),
     tinggi: ([$v[] | select(.Severity == "HIGH")] | length),
     ada_perbaikan: ([$v[] | select((.FixedVersion // "") != "")] | length),
     gerbang: (if .Metadata.OS == null then "pemindaian gagal" elif $p == 0 then "lulus" else "peringatan" end),
     penahan_gerbang: $p}' trivy-image.json)

# Rincian temuan kritis dan tinggi, yang punya perbaikan lebih dulu, untuk ditinjau dan dibaca rangkuman pagi.
jq -r '[.Results[]?.Vulnerabilities[]? | select(.Severity == "CRITICAL" or .Severity == "HIGH")]
  | unique_by([.VulnerabilityID, .PkgName])
  | sort_by([(if (.FixedVersion // "") == "" then 1 else 0 end), (if .Severity == "CRITICAL" then 0 else 1 end), .PkgName])
  | .[] | "\(.Severity) \(.VulnerabilityID) \(.PkgName) \(.InstalledVersion) -> \(.FixedVersion // "" | if . == "" then "belum ada perbaikan" else . end)"' \
  trivy-image.json > trivy-image-daftar.txt 2>/dev/null || : > trivy-image-daftar.txt

os=${os:-null}
penahan_os=$(jq -r '.penahan_gerbang // 0' <<< "$os" 2>/dev/null || echo 0)
if [ "${penahan_os:-0}" != 0 ]; then
  echo "::warning title=Gerbang OS image ($KANDIDAT)::$penahan_os temuan kritis/tinggi di paket OS image sudah punya versi perbaikan. Mode peringatan: job tidak digagalkan. Rincian ada di anotasi TRIVYOS."
fi
hasil=gagal; [ "$uid" != 0 ] && [ "$kode" = 200 ] && hasil=lulus
jq -n --arg h "$hasil" --arg u "$uid" --arg k "$kode" --argjson m "$ukuran_mb" --argjson b "$bangun" --argjson os "$os" \
  '{wadah: {hasil: $h, uid: $u, sehat: $k, ukuran_mb: $m, bangun_detik: $b, kerentanan_os: $os}}' > "$KELUARAN"
cat "$KELUARAN"
[ "$hasil" = lulus ]
