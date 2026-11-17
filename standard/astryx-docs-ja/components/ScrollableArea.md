package: @astryxdesign/core

# ScrollableArea

ビューポートとコンテンツを一式で構成する場合に使用します。既存の構造に適用する場合は useScrollableArea を使用してください。

**インポート:** `import {ScrollableArea} from '@astryxdesign/core/ScrollableArea';`

## 構成要素

| 要素 | 必須 | 説明 |
|---------|----------|-------------|
| Viewport | はい | ルートとなるネイティブのスクロールコンテナ。アクセシブルネームを持ち、スクロールが有効な間はフォーカス対象となり、`astryx-scrollable-area` のテーマ適用対象でもあります。 |
| Content box | はい | ビューポートとあわせて監視される、実体を持つ内側のレイアウトボックス。インライン方向のスクロールでは、最小幅 100% の max-content によるインラインサイズ指定を使用します。 |

## ベストプラクティス

- **推奨:** 簡潔なラベルを必ず指定してください。
- **推奨:** overscroll は allow を基本とし、contain は意図的にネストしたインタラクションに限って使用してください。
- **推奨:** インセットの公開にはコンテンツの padding 系 props を使用し、isFullBleed はビューポートをはみ出させる場合にのみ使用してください。
- **非推奨:** 別の overflow ラッパーで囲んでネストしないでください。

## Props

| Prop | 型 | デフォルト | 説明 |
|------|------|---------|-------------|
| `axis` | `'inline' \| 'block' \| 'both'` | `'block'` | 論理的なスクロール方向:'inline' \| 'block'(デフォルト) \| 'both' |
| `label` | `string` | - | ビューポートのアクセシブルネーム(必須) **(必須)** |
| `role` | `'group' \| 'region'` | `'group'` | 名前付きビューポートのセマンティクス:'group'(デフォルト) \| 'region'(ランドマークナビゲーションの対象とする場合のみ) |
| `overscroll` | `'allow' \| 'contain'` | `'allow'` | 端に達したときの挙動:'allow'(デフォルト) \| 'contain'(スクロールが有効な軸にのみ適用) |
| `width` | `SizeValue` | - | ビューポートの幅 |
| `height` | `SizeValue` | - | ビューポートの高さ |
| `maxWidth` | `SizeValue` | - | ビューポートの最大幅 |
| `minHeight` | `SizeValue` | - | ビューポートの最小高さ |
| `stickyContainment` | `'whenScrollable' \| 'always'` | `'whenScrollable'` | 内部の Sticky を包含する条件:'whenScrollable'(デフォルト) \| 'always' |
| `padding` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | `0` | 全辺のコンテンツインセット。デフォルトは 0 で、ジオメトリ情報を公開します |
| `paddingInline` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | - | 論理インライン軸方向のコンテンツインセット |
| `paddingInlineStart` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | - | 論理インライン開始側のコンテンツインセット |
| `paddingInlineEnd` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | - | 論理インライン終了側のコンテンツインセット |
| `paddingBlock` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | - | 論理ブロック軸方向のコンテンツインセット |
| `paddingBlockStart` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | - | 論理ブロック開始側のコンテンツインセット |
| `paddingBlockEnd` | `0 \| 0.5 \| 1 \| 1.5 \| 2 \| 3 \| 4 \| 5 \| 6 \| 8 \| 10` | - | 論理ブロック終了側のコンテンツインセット |
| `isFullBleed` | `boolean` | `false` | 継承したコンテナの padding からビューポートをはみ出させる(オプトイン) |
| `children` | `ReactNode` | - | 監視対象ボックス内のコンテンツ |
| `xstyle` | `StyleXStyles` | - | ビューポートのサイズ指定およびネイティブスクロールバーの表示を上書きするスタイル |

## テーマ設定

| コンポーネントクラス | 推奨 data 属性 | Props | 状態 |
|-----------------|---------------------------|-------|--------|
| `astryx-scrollable-area` | `data-axis` | axis | - |

defineTheme で上書きします:
```ts
components: {
  'scrollable-area': {
    base: { /* CSS properties */ },
    'axis:value': { /* variant-specific */ },
  },
}
```
<!-- source-sha256: 189bd8a4491709c3 -->
