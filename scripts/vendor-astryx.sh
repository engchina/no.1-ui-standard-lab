#!/usr/bin/env bash
# Astryx の設計ドキュメントとコンポーネント文書を standard/astryx-docs/ に固定する。
# Astryx を上げるとき: web/package.json のバージョンを上げて npm i → このスクリプトを再実行。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/standard/astryx-docs"
CLI="node $ROOT/web/node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs"
VER="$(grep -m1 '"version"' "$ROOT/web/node_modules/@astryxdesign/core/package.json" | grep -o '[0-9][^"]*')"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --quiet --depth 1 https://github.com/meta/astryx.git "$TMP/astryx"
SHA="$(git -C "$TMP/astryx" rev-parse HEAD)"

rm -rf "$OUT" && mkdir -p "$OUT/design" "$OUT/families" "$OUT/components"
cp "$TMP/astryx/docs/design/"*.md "$OUT/design/"
cp "$TMP/astryx/docs/families/"*.md "$OUT/families/"
rm -f "$OUT/design/README.md" "$OUT/families/README.md"
cp "$TMP/astryx/IME_GUARD_DESIGN.md" "$OUT/design/ime-guard.md"

# コンポーネント: 1 つ 1 ファイル（dense 版）+ 生成 AI 用の 1 行索引
: > "$OUT/components.index.md"
for name in $($CLI component --list 2>/dev/null | awk '/^name:/{print $2}'); do
  $CLI component "$name" --dense 2>/dev/null > "$OUT/components/$name.md"
  imp="$(grep -m1 -o "import {[^}]*} from '[^']*'" "$OUT/components/$name.md" || true)"
  props="$(sed -n '/^## Props/,/^## [^P]/p' "$OUT/components/$name.md" | grep -o '^| `[^`]*`' | cut -c4- | tr -d '`' | paste -sd, - || true)"
  echo "- $name — \`$imp\` — props: $props" >> "$OUT/components.index.md"
done

cat > "$OUT/SOURCE.md" <<EOF
# 出典

- リポジトリ: https://github.com/meta/astryx （MIT）
- コミット: $SHA
- npm: @astryxdesign/core@$VER
- design/, families/: docs/design, docs/families をそのままコピー
- components/: \`astryx component <Name> --dense\` の出力
EOF
echo "vendored astryx $VER ($SHA)"
