#!/usr/bin/env bash
set -euo pipefail

# ===== 設定 =====
WIDTH=390        # 最終横幅
FPS=10           # フレームレート
COLORS=256       # 色数

# 対象（拡張子なしのベース名）
FILES=(
  emomu_formdemo
  emomu_create_bookmark_playlist
  emomu_playlist_edit
  emomu_commentdemo
)

need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: '$1' not found"; exit 1; }; }
need ffmpeg
need gifsicle

for f in "${FILES[@]}"; do
  MP4="docs/videos/${f}.mp4"
  OUT="docs/images/${f}.gif"
  [ -f "$MP4" ] || { echo "SKIP: $MP4 not found"; continue; }

  echo "==> ${f}"

  WORK="$(mktemp -d)"
  PAL="$WORK/palette.png"

  ffmpeg -hide_banner -y -i "$MP4" \
    -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,hqdn3d=0.6:0.6:2:2,unsharp=3:3:0.5:3:3:0.0,palettegen=max_colors=${COLORS}:stats_mode=diff" \
    -an "$PAL"

  ffmpeg -hide_banner -y -i "$MP4" -i "$PAL" \
    -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,hqdn3d=0.6:0.6:2:2,unsharp=3:3:0.5:3:3:0.0,paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
    -loop 0 "$OUT"

  gifsicle -O3 --no-comments --no-names --careful "$OUT" -o "$OUT"

  rm -rf "$WORK"
done

echo "Done. => docs/images/*.gif を確認してください。"
