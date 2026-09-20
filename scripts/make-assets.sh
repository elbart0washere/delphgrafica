#!/usr/bin/env bash
# Genera los derivados del logo con `sips` (macOS) desde src/logo-original.png (5285×5377 px, fondo transparente).
# Correr desde la raíz del repo. Cuando exista el logo vectorial, esto se reemplaza por el SVG.
set -euo pipefail

SRC="src/logo-original.png"
OUT="assets"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# El lienzo tiene márgenes transparentes. A 2400 px de ancho el logo ocupa 1586×2143 px desde (336, 96);
# se recorta con 20 px de aire: 1626×2183 desde (316, 76).
sips --resampleWidth 2400 "$SRC" --out "$TMP/mid.png" >/dev/null
sips --cropToHeightWidth 2183 1626 --cropOffset 76 316 "$TMP/mid.png" --out "$TMP/trim.png" >/dev/null

# Hero (retina) y versión chica para el encabezado y el pie.
sips --resampleWidth 720 "$TMP/trim.png" --out "$OUT/logo.png" >/dev/null
sips --resampleWidth 160 "$TMP/trim.png" --out "$OUT/logo-sm.png" >/dev/null

# Favicon: cuadrado con el delfín y las gotas (sin el nombre, que no se lee a 32 px).
sips --cropToHeightWidth 1626 1626 --cropOffset 76 316 "$TMP/mid.png" --out "$TMP/sq.png" >/dev/null
sips --resampleHeightWidth 180 180 "$TMP/sq.png" --out "$OUT/favicon.png" >/dev/null

# Imagen para compartir (Open Graph): logo de 540 px de alto centrado en 1200×630 sobre blanco.
sips --resampleHeight 540 "$TMP/trim.png" --out "$TMP/og.png" >/dev/null
sips --padToHeightWidth 630 1200 --padColor FFFFFF "$TMP/og.png" --out "$TMP/og-pad.png" >/dev/null
sips -s format jpeg -s formatOptions 88 "$TMP/og-pad.png" --out "$OUT/og.jpg" >/dev/null

# Logo blanco del pie (fondo oscuro), sin la tarjeta blanca. Fuente: src/logo-blanco-original.png (1695×2000, transparente);
# el logo ocupa 1358×1826 px desde (124, 52), se recorta con 12 px de aire y se achica a 200 px de ancho.
sips --cropToHeightWidth 1850 1382 --cropOffset 40 112 "src/logo-blanco-original.png" --out "$TMP/blanco.png" >/dev/null
sips --resampleWidth 200 "$TMP/blanco.png" --out "$OUT/logo-blanco.png" >/dev/null

echo "Assets generados en $OUT/"
