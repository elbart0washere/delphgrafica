#!/usr/bin/env bash
# Prepara el video de fondo de Trabajos con ffmpeg a partir del original del celular: sin audio, sin metadatos (los videos
# de celular traen fecha y datos del equipo, a veces la ubicación), H.264 (lo reproducen todos los navegadores) a 720 px de
# ancho, 30 fps y `faststart` (empieza a reproducirse antes de bajarlo entero). Más una portada JPG del mismo fotograma.
#
# Conviene partir del original y no de una copia mandada por WhatsApp: esa ya viene muy comprimida y, estirada a todo el
# ancho de la pantalla, deja ver los bloques ("pixelado"). ffmpeg aplica solo la rotación del celular.
#
# Uso: ./scripts/make-video.sh "/ruta/al/video-original.mp4" [segundo-de-la-portada]
set -euo pipefail

SRC="${1:?Falta la ruta del video original}"
POSTER_AT="${2:-4}"
OUT="assets"
FILTER="scale=720:-2:flags=lanczos"

# Calidad 36 (CRF): un video de 30 s pasa de ~54 MB a ~4 MB. No se baja al cargar la página, solo cuando está por verse.
ffmpeg -y -v error -i "$SRC" -an -map_metadata -1 -vf "$FILTER" -c:v libx264 -preset slow -crf 36 -pix_fmt yuv420p -movflags +faststart -r 30 "$OUT/calcos-plotter.mp4"
ffmpeg -y -v error -ss "$POSTER_AT" -i "$SRC" -an -map_metadata -1 -vf "$FILTER" -frames:v 1 -q:v 6 "$OUT/calcos-plotter.jpg"
echo "Video y portada generados en $OUT/"
