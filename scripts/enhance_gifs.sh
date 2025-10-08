#!/usr/bin/env bash
set -euo pipefail

WIDTH=390
FPS=12
COLORS=256

FILES=(
  emomu_formdemo
  emomu_create_bookmark_playlist
  emomu_playlist_edit
  emomu_commentdemo
)

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' not found"; exit 1; }; }
need ffmpeg
need gifsicle

mkdir -p docs/images

for f in "${FILES[@]}"; do
  IN="docs/images_enhanced/${f}.gif"
  OUT="docs/images/${f}.gif"
  [ -f "$IN" ] || { echo "SKIP: $IN not found"; continue; }

  echo "==> enhance $f"

  WORK="$(mktemp -d)"
  PAL="$WORK/palette.png"

  # --- パレット生成（本当にうっすら補正） ---
  ffmpeg -hide_banner -y -i "$IN" \
    -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,\
eq=contrast=1.01:brightness=0.005:saturation=1.02,\
palettegen=max_colors=${COLORS}:stats_mode=diff" \
    -an "$PAL"

  # --- パレット適用 ---
  ffmpeg -hide_banner -y -i "$IN" -i "$PAL" \
    -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,\
eq=contrast=1.01:brightness=0.005:saturation=1.02,\
paletteuse=dither=floyd_steinberg:diff_mode=rectangle" \
    -loop 0 "$OUT"

  # --- gifsicle で軽く最適化 ---
  gifsicle -O2 --no-comments --no-names --careful "$OUT" -o "$OUT"

  rm -rf "$WORK"
done

echo "✅ 完了: docs/images/*.gif に高画質化済み"

# --- コマンドメモ./scripts/enhance_gifs.sh ---
