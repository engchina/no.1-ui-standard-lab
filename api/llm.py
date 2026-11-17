"""Claude API 呼び出し（生成・レビュー・決定カード草稿）。

ANTHROPIC_BASE_URL を設定すると vLLM / Strata などの Anthropic 互換ローカル接続に切り替わる。
その場合は Claude 専用の機能（effort、サーバー側フォールバック、キャッシュ）を送らない。
"""

import json
import os
import re
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "standard" / "astryx-docs"
MODEL = os.environ.get("LAB_MODEL", "claude-opus-5-5")
LOCAL = bool(os.environ.get("ANTHROPIC_BASE_URL"))

client = anthropic.Anthropic()


def _request(system: str, content, max_tokens: int, schema: dict | None = None):
    kw = {"model": MODEL, "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": content}]}
    oc = {} if LOCAL else {"effort": "medium"}
    if schema:
        oc["format"] = {"type": "json_schema", "schema": schema}
    if oc:
        kw["output_config"] = oc
    if LOCAL:
        return client.messages, kw
    # Opus 5.5 は拒否時にサーバー側でフォールバックさせる。system の大きな資料は自動キャッシュ。
    kw |= {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default", "cache_control": {"type": "ephemeral"}}
    return client.beta.messages, kw


def _final(system, content, max_tokens=32000, schema=None) -> str:
    api, kw = _request(system, content, max_tokens, schema)
    with api.stream(**kw) as s:
        msg = s.get_final_message()
    if msg.stop_reason == "refusal":
        raise RuntimeError("モデルが応答を拒否しました")
    if msg.stop_reason == "max_tokens":
        raise RuntimeError("出力が max_tokens で途切れました")
    return "".join(b.text for b in msg.content if b.type == "text")


def doc(ref: str) -> str:
    p = (DOCS / ref).resolve()
    return p.read_text(encoding="utf-8") if p.is_relative_to(DOCS) and p.is_file() else ""


def refs_text(refs: list[str]) -> str:
    return "\n\n".join(f'<doc path="{r}">\n{doc(r)}\n</doc>' for r in refs)


def strip_fence(text: str) -> str:
    m = re.search(r"```[a-zA-Z]*\n(.*?)```", text, re.S)
    return (m.group(1) if m else text).strip() + "\n"


CODE_RULES = """\
あなたは Meta の Astryx（React 19 + StyleX）で画面を作るフロントエンド開発者です。

出力のきまり:
- TSX モジュール 1 つだけを出力する。説明文やコードフェンスは書かない。
- `export default function Demo()` を必ず定義する。Theme プロバイダーはプレビュー側が包むので書かない。
- import は `import {X} from '@astryxdesign/core/X';` の形。react 以外の外部ライブラリは使わない。
- 色・余白・角丸を直書きしない（#hex、rgb()、px のマジックナンバー禁止）。Astryx のコンポーネントとトークンだけで組む。
- 画面上の文言は日本語。ダミーデータもそれらしい日本語にする。
- 比較のための方案なので、問題の論点がはっきり見える最小の画面にする。

使えるコンポーネントの一覧:
"""


def generate(card: dict, prompt: str, code: str):
    """演習台: 指示から方案コードをストリーミング生成する。"""
    system = CODE_RULES + doc("components.index.md") + "\n\n参考ドキュメント:\n" + refs_text(card.get("astryx_refs", []))
    user = f"問題: {card['question']}\nsuite で起きたこと: {card.get('origin', '')}\n\n"
    if code.strip():
        user += f"現在のコード:\n{code}\n\n"
    user += f"指示: {prompt}"
    api, kw = _request(system, user, 32000)
    with api.stream(**kw) as s:
        yield from s.text_stream
        if s.get_final_message().stop_reason == "refusal":
            yield "\n// モデルが応答を拒否しました\n"


REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "issues": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string"},
                    "severity": {"type": "string", "enum": ["high", "medium", "low"]},
                    "principle": {"type": "string"},
                    "suggestion": {"type": "string"},
                },
                "required": ["selector", "severity", "principle", "suggestion"],
                "additionalProperties": False,
            },
        },
        "conflicts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"card_id": {"type": "string"}, "note": {"type": "string"}},
                "required": ["card_id", "note"],
                "additionalProperties": False,
            },
        },
        "summary": {"type": "string"},
    },
    "required": ["issues", "conflicts", "summary"],
    "additionalProperties": False,
}

REVIEW_SYSTEM = """\
あなたは UI/UX のレビュアーです。Astryx の設計ドキュメントを根拠に、提出された画面の問題点を日本語で指摘します。
- 点数はつけない。問題だけを挙げる。
- 各問題には CSS セレクタ（DOM 要約から分かる範囲で）、深刻度、背後にある設計原理（どの Astryx ドキュメントのどの考え方か）、具体的な修正案を書く。
- 機械チェックの結果は事実として扱い、重複して列挙しない。機械では分からない点（情報の優先度、状態の伝わり方、操作の流れ）を中心に見る。
- 既存の決定カードと食い違う点があれば conflicts に入れる。
- summary は一文で総評を書く。"""


def review(card: dict, shots: list[tuple[int, str]], checks: list, dom: str, decided: list[dict]) -> dict:
    content = []
    for width, b64 in shots:
        content.append({"type": "text", "text": f"幅 {width}px のスクリーンショット:"})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}})
    cards = "\n\n".join(f"<card id=\"{c['id']}\">決定: {c.get('decision', '')}\n理由: {c.get('rationale', '')}</card>" for c in decided) or "（まだない）"
    content.append({
        "type": "text",
        "text": f"問題: {card['question']}\nsuite で起きたこと: {card.get('origin', '')}\n\n"
        f"機械チェックの結果:\n{json.dumps(checks, ensure_ascii=False, indent=1)}\n\n"
        f"DOM 要約（幅 1280px）:\n{dom}\n\n既存の決定カード:\n{cards}\n\n"
        f"関連する Astryx ドキュメント:\n{refs_text(card.get('astryx_refs', []))}",
    })
    return json.loads(_final(REVIEW_SYSTEM, content, schema=REVIEW_SCHEMA))


DRAFT_SYSTEM = """\
あなたは UI 標準の決定カードを書く編集者です。与えられた問題・方案・レビュー結果から、決定カードの草稿を日本語で書きます。
最終的な決定は人が行うので、決定欄は「推奨案」として書き、迷う点は本文に「要確認」として残します。

出力はファイル全体（YAML フロントマター + Markdown 本文）だけ。コードフェンスや説明は書かない。
フロントマターは元のキー（id, unit, category, question, origin, astryx_refs, options, decision, rationale, checks, status）を保ち、
- options: 方案ごとに {name, summary} のリスト
- decision: 推奨案を一文で
- rationale: 理由を一文で（Astryx のドキュメント名を必ず含める）
- checks: 検査方法（lint / Playwright / 人の目）のリスト
- status: researching のまま
本文の章立て: ## 問題 / ## 選択肢 / ## 決定 / ## 理由 / ## 良い例・悪い例 / ## 検査方法
理由には Astryx の出典（ドキュメントのパス）を必ず書く。Astryx に答えがない点は「自定」と明記し、NN/g などの公開資料を根拠にする。
suite と同じやり方になる場合も、Astryx から導いた理由を書く。"""


def draft(card_text: str, card: dict, options: dict[str, str], reviews: dict[str, dict]) -> str:
    parts = [f"現在のカード:\n{card_text}"]
    for name, code in options.items():
        parts.append(f'<option name="{name}">\n{code}\n</option>')
        if name in reviews:
            parts.append(f'<review option="{name}">\n{json.dumps(reviews[name], ensure_ascii=False)}\n</review>')
    parts.append(f"関連する Astryx ドキュメント:\n{refs_text(card.get('astryx_refs', []))}")
    return strip_fence(_final(DRAFT_SYSTEM, "\n\n".join(parts)))
