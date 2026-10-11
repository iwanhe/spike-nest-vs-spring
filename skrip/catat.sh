#!/usr/bin/env bash
# Menulis masukan standar sebagai anotasi GitHub Actions, supaya bisa dibaca lewat API.
# Pemakaian: perintah | skrip/catat.sh "JUDUL"
set -euo pipefail
judul=$1
isi=$(tail -c 6000 | sed -e 's/\x1b\[[0-9;]*m//g' -e 's/%/%25/g' | sed -e ':a' -e 'N' -e '$!ba' -e 's/\r//g' -e 's/\n/%0A/g')
echo "::notice title=${judul}::${isi}"
