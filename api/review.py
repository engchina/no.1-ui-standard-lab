"""レビュー: 第 1 層 機械チェック（Playwright + axe-core）→ 第 2 層 AI 講評。"""

import base64
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

import llm

WIDTHS = (375, 768, 1280)
CHECKS_JS = (Path(__file__).parent / "checks.js").read_text(encoding="utf-8")
AXE_URL = "https://cdn.jsdelivr.net/npm/axe-core@4.10.3/axe.min.js"
HARD_COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(")
MAX_FONT_SIZES = 6  # ponytail: 問題ごとの上限が要るならカードの frontmatter に持たせる


def _item(name, ok, detail, items=()):
    return {"name": name, "ok": ok, "detail": detail, "items": list(items)}


def render(html: str, out: Path) -> tuple[dict, dict, list[str]]:
    """3 幅でレンダリングし、幅ごとの計測値・axe 結果・ページエラーを返す。"""
    metrics, errors = {}, []
    axe = {"violations": []}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for w in WIDTHS:
                page = browser.new_page(viewport={"width": w, "height": 800})
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.set_content(html, wait_until="networkidle", timeout=60_000)
                page.wait_for_function("document.getElementById('root')?.childElementCount > 0", timeout=30_000)
                page.wait_for_timeout(300)  # フォントとアニメーション開始を待つ
                page.screenshot(path=out / f"{w}.png", full_page=True)
                metrics[w] = page.evaluate(f"({CHECKS_JS})()")
                if w == 1280:
                    page.add_script_tag(url=AXE_URL)
                    axe = page.evaluate("axe.run(document, {resultTypes: ['violations']})")
                page.close()
        finally:
            browser.close()
    return metrics, axe, sorted(set(errors))


def judge(code: str, metrics: dict, axe: dict) -> list[dict]:
    """計測値を設計書の既定基準で合否にする。"""
    big = metrics[1280]
    viol = axe.get("violations", [])
    contrast = [n["target"][0] for v in viol if v["id"] == "color-contrast" for n in v["nodes"]]
    serious = [f"{v['id']}（{v['impact']}）: {v['help']}" for v in viol if v["id"] != "color-contrast" and v["impact"] in ("serious", "critical")]
    colors = sorted(set(HARD_COLOR.findall(code)))
    resp = [f"{w}px: 横方向にはみ出し" for w in WIDTHS if metrics[w]["hOverflow"]]
    resp += [f"{w}px: 文字の切れ {s}" for w in WIDTHS for s in metrics[w]["truncated"]]
    scroll = {w: metrics[w]["scrollers"] for w in WIDTHS}
    return [
        _item("文字コントラスト", not contrast, "WCAG 2.2 AA（本文 4.5:1 以上）", contrast),
        _item("アクセシビリティ", not serious, "axe-core で serious / critical なし", serious),
        _item("クリック領域", not big["smallTargets"], "24×24 CSS px 以上（WCAG 2.5.8）", big["smallTargets"]),
        _item("余白の一貫性", not big["spacing"], "Astryx の刻み（2・6px と 4 の倍数）", big["spacing"]),
        _item("文字サイズの段階", len(big["fontSizes"]) <= MAX_FONT_SIZES, f"{MAX_FONT_SIZES} 段階以内", big["fontSizes"]),
        _item("色の直書きなし", not colors, "コードに #hex / rgb() などがない", colors),
        _item("レスポンシブ", not resp, "375 / 768 / 1280 で横はみ出し・文字切れなし", resp),
        _item("和文組版", not big["tightLines"] and big["jpFontOk"], "本文の行間 1.5 以上、和文フォントの指定あり",
              big["tightLines"] + ([] if big["jpFontOk"] else [f"和文フォントなし: {f}" for f in big["fonts"]])),
        _item("縦スクロールバーは 1 本", all(len(s) <= 1 for s in scroll.values()), "各幅で縦スクロール領域が 1 つ以下",
              [f"{w}px: {', '.join(s)}" for w, s in scroll.items() if len(s) > 1]),
        _item("同一処理のスピナーは 1 つ", len(big["spinners"]) <= 1, "回転中のスピナーが 1 つ以下", big["spinners"]),
    ]


def run(out: Path, card: dict, code: str, html: str, decided: list[dict]) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    metrics, axe, errors = render(html, out)
    checks = judge(code, metrics, axe)
    result = {"checks": checks, "errors": errors, "widths": list(WIDTHS)}
    try:
        shots = [(w, base64.standard_b64encode((out / f"{w}.png").read_bytes()).decode()) for w in WIDTHS]
        result["ai"] = llm.review(card, shots, checks, metrics[1280]["dom"], decided)
    except Exception as e:  # AI が使えなくても機械チェックの結果は残す
        result["ai_error"] = f"{type(e).__name__}: {e}"
    (out / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    return result
