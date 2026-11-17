# no.1-ui-standard-lab

Meta の [Astryx](https://github.com/meta/astryx) を土台に、次の新規プロジェクトで初日から使える UI/UX 標準を作り、作りながら学ぶための訓練場です。
「問題 → Astryx を読む → 方案を比べる → 決定カード」の流れを回します（MVP: U5 スクロール・U11 メッセージ・U12 読み込み・U15 詳細の出し方）。

## 構成

| 場所 | 中身 |
| --- | --- |
| `standard/cards/` | 問題 = 決定カード。1 問 1 ファイル（YAML フロントマター + Markdown）。`status`: todo / researching / decided |
| `standard/options/<id>/` | 方案のコード（`export default function Demo()` を持つ TSX） |
| `standard/astryx-docs/` | Astryx の設計ドキュメントとコンポーネント文書の固定コピー（`scripts/vendor-astryx.sh` で更新） |
| `standard/astryx-docs-ja/` | 上の文書の日本語訳。左パネルで初めて開いたときに Claude で訳して保存（原文が変わると訳し直す）。コミットして共有する |
| `web/` | 画面（Next.js + React 19 + Astryx）。`/api` は FastAPI へ転送 |
| `api/` | FastAPI。カードの読み書き・Git コミット、Claude での生成 / 講評 / 草稿、Playwright + axe-core の機械チェック |

方案のプレビューはブラウザ内で TSX をコンパイル（sucrase）し、`sandbox="allow-scripts"` の iframe（不透明オリジン + CSP）で esm.sh から Astryx を読み込んで描画します。レビュー Worker も同じ HTML を Playwright で 375 / 768 / 1280 幅に描画してチェックします。

## 起動

前提: Node 22+、[uv](https://docs.astral.sh/uv/)、インターネット接続（esm.sh / jsDelivr から Astryx を読むため）。

```bash
npm --prefix web install
uv --project api sync
uv run --project api playwright install chromium
```

Claude を使う機能（生成・AI 講評・草稿）には API キーが要ります。画面左の「設定」で入力するか（リポジトリ直下の `.anthropic-key` に保存、Git 対象外、環境変数より優先）、環境変数で渡します。

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

API と画面を別々のターミナルで起動します。

```bash
uv run --project api uvicorn main:app --app-dir api --port 8710
```

```bash
npm --prefix web run dev -- --port 3710
```

http://localhost:3710 を開きます。API キーがなくても、問題一覧・演習台・機械チェック・カード編集は動きます（AI 講評欄に理由が出ます）。

### 設定

| 環境変数 | 既定 | 用途 |
| --- | --- | --- |
| `LAB_MODEL` | `claude-opus-5-5` | 使うモデル |
| `ANTHROPIC_BASE_URL` | （なし） | vLLM / Strata など Anthropic 互換のローカル接続に切り替える。Claude 専用の機能（effort・フォールバック・キャッシュ）は送らない |
| `LAB_API_URL` | `http://127.0.0.1:8710` | 画面から見た API の場所 |

## 使い方

1. 問題一覧から問題を開く。左に背景と Astryx の教材（日本語訳）。
2. 演習台で方案を 2〜3 案作る（コードを書くか、AI に指示して生成）。幅 375 / 768 / 1280、ライト / ダークで確かめて保存。
3. 方案比較で「すべてレビュー」。機械チェック 10 項目と AI 講評が並ぶ。同じ方案は 1 回だけ評価され、結果は `.cache/reviews/` に残る。
4. 決定カードで「AI で草稿を作る」→ 自分で直して `status: decided` → 「保存して Git にコミット」。

新規プロジェクトで標準にない問題に出会ったら、`standard/cards/` にカードを足してこの流れに戻します。

## 機械チェック

文字コントラスト / アクセシビリティ（axe-core serious・critical）/ クリック領域 24px / 余白の刻み / 文字サイズの段階 ≤ 6 / 色の直書き / レスポンシブ（横はみ出し・文字切れ）/ 和文組版（行間 1.5・和文フォント）/ 縦スクロールバー 1 本 / スピナー 1 つ。実装は `api/checks.js`（計測）と `api/review.py`（合否）。

## 設計書との差分（MVP で省いたもの）

- **Redis・PostgreSQL・Docker Compose なし**: 1 人で使う MVP なので、レビューは API プロセス内のスレッド、結果はファイル。複数人・複数ワーカーにするときに入れる。
- **esbuild-wasm → sucrase**: TSX を JS にするだけなので軽い方を採用。
- **独立ドメインのプレビュー → 不透明オリジンの sandbox iframe + CSP**。
- **Worker の断網**: Astryx を CDN から読むので今はネットが要る。断網にするなら Astryx のバンドルをローカル配信に切り替える。
- **temperature 0**: Claude Opus 5.5 は temperature を受け付けない。同じ方案はキャッシュで 1 回だけ評価する。
- **未実装のチェック**: 揃え（左端のクラスタリング）、状態の網羅（空 / 読み込み / エラー）、IME 中の Enter。
- **標準パッケージ出力・項目チェック・研修モード**: 段階 2・3。

## Astryx を上げるとき

`web/package.json` の `@astryxdesign/*` と `web/src/lib/preview.ts` の `ASTRYX` を同じ版に上げ、`npm --prefix web install` の後に `bash scripts/vendor-astryx.sh` を実行します。
