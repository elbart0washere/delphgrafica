#!/usr/bin/env bash
# Genera los derivados del logo con `sips` (macOS) desde src/logo-original.png.
# Provisorio hasta tener el logo vectorial. Correr desde la raíz del repo.
set -euo pipefail

SRC="src/logo-original.png"
OUT="assets"
mkdir -p "$OUT"

# Logo del encabezado: JPG de ~480 px de ancho. Se muestra con mix-blend-mode: multiply,
# así que su fondo blanco (#ffffff) se funde con la página.
sips -s format jpeg -s formatOptions 82 --resampleWidth 480 "$SRC" --out "$OUT/logo.jpg" >/dev/null

# Favicon: el delfín con las gotas (cuadrado de 600 px arriba a la izquierda), a 180 px.
sips -s format png --cropToHeightWidth 600 600 --cropOffset 60 140 "$SRC" --out "$OUT/favicon.png" >/dev/null
sips --resampleHeightWidth 180 180 "$OUT/favicon.png" >/dev/null

# Imagen para compartir (Open Graph): logo a 630 px de alto, centrado en 1200×630 con fondo blanco (el del logo).
sips -s format jpeg -s formatOptions 85 --resampleHeight 630 "$SRC" --out "$OUT/og.jpg" >/dev/null
sips --padToHeightWidth 630 1200 --padColor FFFFFF "$OUT/og.jpg" >/dev/null

echo "Assets generados en $OUT/"
