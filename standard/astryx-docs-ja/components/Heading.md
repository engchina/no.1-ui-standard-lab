package: @astryxdesign/core

# Heading

テーマに沿ったスタイルを持つセマンティックな h1〜h6。タイプスケールトークンによるテーマ準拠のサイズ指定と、line-clamp による省略表示に対応しています。

**インポート:** `import {Heading} from '@astryxdesign/core/Heading';`

## Props

| Prop | 型 | デフォルト | 説明 |
|------|------|---------|-------------|
| `level` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | - | 見出しレベル。HTML 要素と、テーマに基づくスタイルを決定します（type が指定されている場合を除く）。**（必須）** |
| `type` | `'display-1' \| 'display-2' \| 'display-3'` | - | ディスプレイバリアント（display-1/2/3、またはテーマ独自のカスタムタイプ）。level による見た目のスタイルを上書きします。 |
| `weight` | `'normal' \| 'medium' \| 'semibold' \| 'bold'` | - | 明示的なフォントウェイト。type や見出しレベルのデフォルトより優先されます。 |
| `children` | `ReactNode` | - | 見出しの内容。**（必須）** |
| `accessibilityLevel` | `1 \| 2 \| 3 \| 4 \| 5 \| 6` | - | 文書アウトライン上のレベルが level と異なる場合に aria-level を上書きします。 |
| `color` | `'primary' \| 'secondary' \| 'disabled' \| 'placeholder' \| 'accent' \| 'inherit'` | `'primary'` | テキストの色。テーマでカスタムカラーを追加できます。 |
| `display` | `'inline' \| 'block'` | `'block'` | 表示タイプ。maxLines>0 または hasCapsize の場合は 'block' に上書きされます。 |
| `maxLines` | `number` | `0` | 省略表示されるまでの最大行数。0 の場合は省略しません。省略された場合はツールチップを表示します。 |
| `hasTruncateTooltip` | `boolean \| 'above' \| 'below' \| 'start' \| 'end'` | `true` | 省略されたテキストのツールチップ。true でデフォルト位置、false で無効、または表示位置（'above' \| 'below' \| 'start' \| 'end'）を指定します。 |
| `wordBreak` | `'break-word' \| 'break-all'` | - | 省略表示時の改行の挙動。デフォルトは 1 行の場合 'break-all'、それ以外は 'break-word' です。省略されない長いトークンは折り返されます（overflow-wrap: break-word）。flex の子要素の場合は min-width: 0 が必要です。独自のコンテナに指定した overflow-wrap: anywhere はこのテキストには適用されません（Astryx のコンテナは自身の設定を引き継ぎます）。 |
| `textWrap` | `'wrap' \| 'nowrap' \| 'balance' \| 'pretty'` | - | テキストの折り返しの挙動。 |
| `justify` | `'start' \| 'center' \| 'end'` | `'start'` | テキストの配置（行揃え）。RTL に対応するため論理値 'start' \| 'center' \| 'end' を使用します。 |
| `hasCapsize` | `boolean` | `false` | text-box-trim による視覚的な位置合わせ。ブロック表示を強制します。 |
| `hasStrikethrough` | `boolean` | `false` | 取り消し線のテキスト装飾。 |
| `id` | `string` | - | HTML の id 属性。 |
| `xstyle` | `StyleXStyles` | - | 見出しに適用する StyleX スタイル。stylex.create() の値のみ指定できます。 |
| `className` | `string` | - | 見出しに適用する CSS クラス。 |
| `style` | `React.CSSProperties` | - | 見出しに適用するインラインスタイル。maxLines>1 の場合、line clamp が WebkitLineClamp を置き換えます。 |
| `ref` | `React.Ref<HTMLHeadingElement>` | - | 見出し要素への ref。 |

## テーマ設定

| コンポーネントクラス | 推奨されるデータ属性 | Props | 状態 |
|-----------------|---------------------------|-------|--------|
| `astryx-heading` | `data-level`, `data-color`, `data-type`, `data-weight` | level, color, type, weight | - |

defineTheme で上書きします:
```ts
components: {
  'heading': {
    base: { /* CSS properties */ },
    'level:value': { /* variant-specific */ },
  },
}
```
<!-- source-sha256: c4c839a01907b453 -->
