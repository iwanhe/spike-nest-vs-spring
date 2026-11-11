#!/usr/bin/env bash
# Mencatat mesin dan versi perangkat lunak tempat run ini berjalan, supaya angka kinerja antar-run
# bisa dibandingkan dengan jujur (runner GitHub bisa berganti jenis mesin tanpa pemberitahuan).
# Juga mencatat digest base image yang sedang dipakai Dockerfile kandidat.
# Pemakaian (dari akar repo): skrip/lingkungan.sh nest|spring
set -uo pipefail
KANDIDAT=$1
KELUARAN=${KELUARAN:-ukur-lingkungan.json}

cpu=$(awk -F': ' '/^model name/{print $2; exit}' /proc/cpuinfo)
inti=$(nproc)
ram_mb=$(awk '/MemTotal/{printf "%d", $2/1024}' /proc/meminfo)
os=$( . /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-?}" )
runner="${ImageOS:-?} ${ImageVersion:-?}"
node_v=$(node -v 2>/dev/null || echo null)
# Baris "Picked up JAVA_TOOL_OPTIONS" (dipakai varian heap256) dilewati; hanya baris versi yang diambil.
java_v=""
[ "$KANDIDAT" = spring ] && java_v=$(java -version 2>&1 | grep -m1 -i ' version ' | sed 's/"//g' || true)
pg_v=$(psql -h localhost -U spike -d spike -Atc "show server_version" 2>/dev/null || echo "?")

# Digest base image: dibaca dari baris FROM, lalu ditanyakan ke registry.
# Bila FROM sudah memakai @sha256:..., digest itulah yang dicatat.
base_images='[]'
while read -r ref; do
  [ -n "$ref" ] || continue
  case "$ref" in
    *@sha256:*) digest=${ref##*@} ;;
    *) digest=$(docker buildx imagetools inspect "$ref" 2>/dev/null | awk '/^Digest:/{print $2; exit}') ;;
  esac
  base_images=$(jq -c --arg r "${ref%%@*}" --arg d "${digest:-?}" '. + [{image: $r, digest: $d}]' <<< "$base_images")
done < <(awk 'toupper($1)=="FROM"{print $2}' "app-$KANDIDAT/Dockerfile" | sort -u)

jq -n --arg cpu "$cpu" --argjson inti "$inti" --argjson ram "$ram_mb" --arg os "$os" --arg runner "$runner" \
  --arg node "$node_v" --arg java "${java_v:-}" --arg pg "$pg_v" --argjson base "$base_images" \
  '{lingkungan: {cpu: $cpu, inti: $inti, ram_mb: $ram, os: $os, runner: $runner,
    node: $node, java: (if $java == "" then null else $java end), postgres: $pg, base_image: $base}}' > "$KELUARAN"
cat "$KELUARAN"
