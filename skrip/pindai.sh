#!/usr/bin/env bash
# S7: pemindaian kerentanan dependency dengan Trivy, alat yang sama untuk kedua kandidat.
# Pemakaian: skrip/pindai.sh nest|spring
# Versi Trivy dikunci. Jangan memakai tag "latest": pada Maret 2026 beberapa tag Trivy
# sempat disusupi (CVE-2026-33634), jadi versi harus dipilih dengan sengaja.
set -euo pipefail
KANDIDAT=$1
TRIVY=${TRIVY:-ghcr.io/aquasecurity/trivy:0.74.0}
KELUARAN=${KELUARAN:-ukur-trivy.json}
mkdir -p "$HOME/.cache/trivy" "$HOME/.m2"

pindai() { # $1 = nama berkas hasil, sisanya = argumen trivy
  local nama=$1; shift
  docker run --rm -v "$PWD:/kerja:ro" -v "$HOME/.cache/trivy:/root/.cache/trivy" -v "$HOME/.m2:/root/.m2:ro" \
    "$TRIVY" "$@" --scanners vuln --list-all-pkgs --format json --quiet > "trivy-$nama.json" \
    || echo '{"galat": true}' > "trivy-$nama.json"
}
ringkas() { # jumlah paket yang dikenali dan jumlah kerentanan per tingkat
  jq -c 'if .galat then null else
    ([.Results[]?.Vulnerabilities[]?] | unique_by([.VulnerabilityID, .PkgName, .InstalledVersion])) as $v
    | { paket: ([.Results[]?.Packages[]?] | length),
        total: ($v | length),
        kritis: ([$v[] | select(.Severity == "CRITICAL")] | length),
        tinggi: ([$v[] | select(.Severity == "HIGH")] | length),
        sedang: ([$v[] | select(.Severity == "MEDIUM")] | length),
        rendah: ([$v[] | select(.Severity == "LOW")] | length),
        lain:   ([$v[] | select(.Severity != "CRITICAL" and .Severity != "HIGH" and .Severity != "MEDIUM" and .Severity != "LOW")] | length) } end' "$1"
}
daftar() { # satu baris per temuan, yang paling berat di akhir
  jq -r 'if .galat then "pemindaian gagal" else
    [.Results[]?.Vulnerabilities[]?] | unique_by([.VulnerabilityID, .PkgName, .InstalledVersion])
    | sort_by({"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}[.Severity] // 0) | .[]
    | "\(.Severity) \(.VulnerabilityID) \(.PkgName) \(.InstalledVersion) -> \(.FixedVersion // "belum ada perbaikan")" end' "$1"
}

if [ "$KANDIDAT" = nest ]; then
  # Sumber: package-lock.json. "jalan" = tanpa alat pengembangan, "semua" = termasuk alat pengembangan.
  pindai jalan fs /kerja/app-nest/package-lock.json
  pindai semua fs /kerja/app-nest/package-lock.json --include-dev-deps
  sumber_jalan="package-lock.json tanpa devDependencies"; sumber_semua="package-lock.json dengan devDependencies"
else
  # Sumber "jalan": jar hasil build, yaitu apa yang benar-benar ikut ke server.
  # Sumber "semua": pom.xml, sebagai pembanding.
  mkdir -p pindai-jar && cp app-spring/target/*.jar pindai-jar/
  pindai jalan rootfs /kerja/pindai-jar
  pindai semua fs /kerja/app-spring/pom.xml
  sumber_jalan="jar hasil build"; sumber_semua="pom.xml"
  # Versi pustaka yang benar-benar ada di dalam jar.
  unzip -Z1 app-spring/target/*.jar | grep -E 'lib/(tomcat-embed-core|jackson-core|jackson-databind|spring-boot|spring-core|flowable-engine)-[0-9]' | sed 's|.*/||' > versi-jar.txt
fi

jq -n --arg t "$TRIVY" --arg sj "$sumber_jalan" --arg ss "$sumber_semua" \
  --argjson j "$(ringkas trivy-jalan.json)" --argjson s "$(ringkas trivy-semua.json)" \
  '{trivy: {versi: $t, saat_berjalan: ($j + {sumber: $sj}), pembanding: (if $s then $s + {sumber: $ss} else null end)}}' > "$KELUARAN"
cat "$KELUARAN"
{
  [ -f versi-jar.txt ] && { echo "== isi jar"; cat versi-jar.txt; }
  echo "== $sumber_semua"; daftar trivy-semua.json
  echo "== $sumber_jalan"; daftar trivy-jalan.json
  jq -c .trivy "$KELUARAN"
} | tee trivy-daftar.txt
