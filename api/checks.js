// 機械チェック: Playwright の page.evaluate で実行し、生の計測値を返す。合否判定は review.py 側。
() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const sel = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.body && parts.length < 4; n = n.parentElement) {
      let p = n.tagName.toLowerCase();
      const role = n.getAttribute('role');
      if (role) p += `[role="${role}"]`;
      const sib = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      if (sib.length > 1) p += `:nth-of-type(${sib.indexOf(n) + 1})`;
      parts.unshift(p);
    }
    return parts.join(' > ');
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('');
  const all = [...document.querySelectorAll('body *')].filter(visible);
  const texts = all.filter((el) => ownText(el));

  // 縦スクロールが実際に起きている要素（document 自体を含む）
  const scrollers = all
    .filter((el) => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)
    .map(sel);
  if (document.scrollingElement.scrollHeight > innerHeight + 1) scrollers.unshift('document');

  const hOverflow = document.documentElement.scrollWidth > innerWidth + 1;
  const truncated = texts
    .filter((el) => el.scrollWidth > el.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(el).overflowX))
    .map(sel);
  // 領域の中で横スクロールが出ている（コードブロックは除く）
  const hScroll = all
    .filter((el) => el.tagName !== 'PRE' && /(auto|scroll)/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
    .map(sel);
  // 押しつぶされた領域: 幅 80px 未満のスクロール領域に文章が入っている（例: 幅なしの LayoutPanel に本文が押し出される）
  const squeezed = all
    .filter((el) => el.getBoundingClientRect().width < 80 && /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.innerText.trim().length > 40)
    .map(sel);

  // 余白:Astryx の刻み（0.5 = 2px, 1 = 4px, ...）。ponytail: 2/6px と 4 の倍数だけ許可、必要ならトークン表から生成
  const okSpace = (v) => v === 0 || v === 2 || v === 6 || v % 4 === 0;
  const spacing = new Map();
  const props = ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'rowGap', 'columnGap'];
  for (const el of all) {
    const s = getComputedStyle(el);
    for (const p of props) {
      const v = Math.abs(parseFloat(s[p]));
      if (!Number.isNaN(v) && !okSpace(v)) {
        const k = `${p} ${v}px`;
        if (!spacing.has(k)) spacing.set(k, sel(el));
      }
    }
  }

  const fontSizes = [...new Set(texts.map((el) => getComputedStyle(el).fontSize))].sort((a, b) => parseFloat(a) - parseFloat(b));

  const clickable = all.filter((el) =>
    el.matches('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem]'),
  );
  const smallTargets = clickable
    .filter((el) => {
      const r = el.getBoundingClientRect();
      const inlineLink = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
      return !inlineLink && (r.width < 24 || r.height < 24);
    })
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${sel(el)} (${Math.round(r.width)}×${Math.round(r.height)})`;
    });

  // 和文: 20 字を超える日本語の段落で行間 < 1.5、和文フォントの指定
  const jp = /[぀-ヿ一-鿿]/;
  const tightLines = texts
    .filter((el) => jp.test(ownText(el)) && ownText(el).length > 20)
    .filter((el) => {
      const s = getComputedStyle(el);
      const lh = s.lineHeight === 'normal' ? 1.2 : parseFloat(s.lineHeight) / parseFloat(s.fontSize);
      return lh < 1.5;
    })
    .map(sel);
  const jpFont = /Noto Sans (JP|CJK)|Hiragino|Yu ?Gothic|游ゴシック|Meiryo|メイリオ|BIZ UD|M PLUS|Zen Kaku/i;
  const fonts = [...new Set(texts.map((el) => getComputedStyle(el).fontFamily))];
  const jpFontOk = fonts.length === 0 || fonts.every((f) => jpFont.test(f));

  // スピナー: Astryx Spinner は role=progressbar（aria-valuenow なし）。ponytail: CSS だけの自作スピナーは数えない
  const spinners = all
    .filter((el) => el.matches('[role=progressbar]:not([aria-valuenow])') || (el.matches('[aria-busy=true]') && !el.querySelector('[role=progressbar]')))
    .map(sel);

  // AI レビュー用の DOM 要約
  const lines = [];
  const walk = (el, depth) => {
    if (lines.join('\n').length > 6000 || depth > 12) return;
    if (!visible(el)) return;
    const role = el.getAttribute('role');
    const label = el.getAttribute('aria-label');
    const t = ownText(el).slice(0, 60);
    const r = el.getBoundingClientRect();
    if (role || label || t || /^(main|nav|header|footer|aside|section|table|form|button|input|h[1-6])$/i.test(el.tagName)) {
      lines.push(`${'  '.repeat(depth)}${el.tagName.toLowerCase()}${role ? `[${role}]` : ''}${label ? ` "${label}"` : ''} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}${t ? ` : ${t}` : ''}`);
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(document.body, 0);

  return {
    scrollers,
    hOverflow,
    truncated: truncated.slice(0, 20),
    hScroll: hScroll.slice(0, 10),
    squeezed: squeezed.slice(0, 10),
    spacing: [...spacing].slice(0, 30).map(([k, v]) => `${k} — ${v}`),
    fontSizes,
    smallTargets: smallTargets.slice(0, 30),
    tightLines: tightLines.slice(0, 20),
    fonts,
    jpFontOk,
    spinners,
    dom: lines.join('\n'),
  };
}
