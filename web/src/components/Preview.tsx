'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {buildHtml, type Mode} from '@/lib/preview';

const HEIGHT = 800;

/** 方案を指定幅で描画し、置き場所の幅に収まるよう縮小して見せる。 */
export function Preview({code, width, mode, title}: {code: string; width: number; mode: Mode; title: string}) {
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(width);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const built = useMemo(() => {
    try {
      return {html: buildHtml(code, mode)};
    } catch (e) {
      return {error: (e as Error).message};
    }
  }, [code, mode]);

  const scale = Math.min(1, avail / width);
  return (
    <div ref={box} style={{width: '100%', height: HEIGHT * scale, overflow: 'hidden'}}>
      {'error' in built ? (
        <Banner status="error" title="コンパイルエラー" description={built.error} collapsible={false} />
      ) : (
        <iframe
          title={title}
          className="preview-frame"
          sandbox="allow-scripts"
          srcDoc={built.html}
          style={{width, height: HEIGHT, transform: `scale(${scale})`}}
        />
      )}
    </div>
  );
}
