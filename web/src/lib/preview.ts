import {transform} from 'sucrase';

// プレビューとレビュー Worker が同じ HTML を使う。バージョンは web/package.json の Astryx と揃える。
const ASTRYX = '0.7.16';
const REACT = '19.2.0';

const IMPORT_MAP = {
  imports: {
    react: `https://esm.sh/react@${REACT}`,
    'react/jsx-runtime': `https://esm.sh/react@${REACT}/jsx-runtime`,
    'react-dom': `https://esm.sh/react-dom@${REACT}`,
    'react-dom/client': `https://esm.sh/react-dom@${REACT}/client`,
    '@astryxdesign/core': `https://esm.sh/@astryxdesign/core@${ASTRYX}?external=react,react-dom`,
    '@astryxdesign/theme-neutral': `https://esm.sh/@astryxdesign/theme-neutral@${ASTRYX}?external=react,react-dom`,
  },
};

// iframe は sandbox="allow-scripts"（allow-same-origin なし）= 不透明オリジン。さらに CSP で読み込み先を絞る。
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://esm.sh https://cdn.jsdelivr.net",
  "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com https://cdn.jsdelivr.net data:',
  'img-src data: https:',
  'connect-src https://esm.sh https://cdn.jsdelivr.net',
].join('; ');

export type Mode = 'light' | 'dark';

/** 方案の TSX をコンパイルする。失敗したら Error を投げる。 */
export function compile(code: string): string {
  const js = transform(code, {transforms: ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true}).code;
  if (!/export\s+default\s/.test(js)) throw new Error('export default function Demo() がありません');
  return js
    .replace(/(['"])@astryxdesign\/core\/[^'"]+\1/g, '"@astryxdesign/core"') // esm.sh はルート 1 本にまとめる
    .replace(/(['"])@astryxdesign\/theme-neutral\/[^'"]+\1/g, '"@astryxdesign/theme-neutral"')
    .replace(/export\s+default\s+/, 'const __Demo = ');
}

export function buildHtml(code: string, mode: Mode): string {
  const js = compile(code).replace(/<\/script/gi, '<\\/script');
  const css = (pkg: string, path: string) => `<link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/npm/${pkg}@${ASTRYX}/${path}">`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>方案プレビュー</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap">
${css('@astryxdesign/core', 'src/reset.css')}
${css('@astryxdesign/core', 'dist/astryx.css')}
${css('@astryxdesign/theme-neutral', 'dist/theme.css')}
<script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>
<style>html,body{margin:0;height:100%}body{font-family:var(--font-family-body)}#root{height:100%}</style>
<script>
  function __fail(e) {
    var pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;padding:16px;margin:0;color:CanvasText;background:Canvas';
    pre.textContent = '実行エラー: ' + ((e && (e.stack || e.message)) || e);
    var root = document.getElementById('root');
    root.replaceChildren(pre);
  }
  addEventListener('error', function (e) { __fail(e.error || e.message); });
  addEventListener('unhandledrejection', function (e) { __fail(e.reason); });
  setTimeout(function () { var r = document.getElementById('root'); if (r && !r.childElementCount) __fail('20 秒たっても描画されません（CDN に届かない可能性）'); }, 20000);
</script>
</head>
<body>
<div id="root"></div>
<script type="module">
import {createElement as __h} from 'react';
import {createRoot as __createRoot} from 'react-dom/client';
import {Theme as __Theme} from '@astryxdesign/core';
import {neutralTheme as __theme} from '@astryxdesign/theme-neutral';
${js}
__createRoot(document.getElementById('root')).render(__h(__Theme, {theme: __theme, mode: ${JSON.stringify(mode)}}, __h(__Demo)));
</script>
</body>
</html>`;
}

export const STARTER = `import {Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';

export default function Demo() {
  return (
    <Layout
      header={<LayoutHeader><Heading level={1}>方案のタイトル</Heading></LayoutHeader>}
      content={<LayoutContent><Text>ここに方案を組む。</Text></LayoutContent>}
    />
  );
}
`;
