"""UI/UX 訓練場 API。問題・決定カード・方案は Git 上のファイル、レビュー結果は .cache/ に置く。"""

import hashlib
import itertools
import json
import re
import subprocess
import threading
from pathlib import Path

import frontmatter
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel

import llm
import review

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "standard" / "cards"
OPTIONS = ROOT / "standard" / "options"
DOCS = ROOT / "standard" / "astryx-docs"
DOCS_JA = ROOT / "standard" / "astryx-docs-ja"  # 日本語訳（初回表示時に Claude で訳して保存）
CACHE = ROOT / ".cache" / "reviews"
NAME = re.compile(r"[A-Za-z0-9_-]{1,64}")
JOBS: dict[str, str] = {}  # key -> running | error message。ponytail: プロセス内のみ、複数ワーカーにするなら Redis へ

app = FastAPI(title="UI/UX 訓練場 API")


def safe(name: str) -> str:
    if not NAME.fullmatch(name):
        raise HTTPException(400, "名前は英数字・-・_ のみ")
    return name


def card_path(qid: str) -> Path:
    p = CARDS / f"{safe(qid)}.md"
    if not p.is_file():
        raise HTTPException(404, "問題が見つかりません")
    return p


def load_card(qid: str) -> dict:
    return frontmatter.load(card_path(qid)).metadata


def load_options(qid: str) -> dict[str, str]:
    d = OPTIONS / safe(qid)
    return {p.stem: p.read_text(encoding="utf-8") for p in sorted(d.glob("*.tsx"))} if d.is_dir() else {}


def write_card(qid: str, meta: dict, body: str) -> None:
    text = "---\n" + yaml.safe_dump(meta, allow_unicode=True, sort_keys=False) + "---\n\n" + body.lstrip()
    card_path(qid).write_text(text, encoding="utf-8")


@app.get("/api/questions")
def questions():
    return [frontmatter.load(p).metadata for p in sorted(CARDS.glob("*.md"))]


@app.get("/api/questions/{qid}")
def question(qid: str):
    post = frontmatter.load(card_path(qid))
    return {**post.metadata, "body": post.content, "raw": card_path(qid).read_text(encoding="utf-8"), "codes": load_options(qid)}


class Code(BaseModel):
    code: str


@app.put("/api/questions/{qid}/options/{name}")
def save_option(qid: str, name: str, body: Code):
    post = frontmatter.load(card_path(qid))
    d = OPTIONS / safe(qid)
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{safe(name)}.tsx").write_text(body.code, encoding="utf-8")
    if post.metadata.get("status") == "todo":
        post.metadata["status"] = "researching"
        write_card(qid, post.metadata, post.content)
    return {"ok": True}


@app.delete("/api/questions/{qid}/options/{name}")
def delete_option(qid: str, name: str):
    (OPTIONS / safe(qid) / f"{safe(name)}.tsx").unlink(missing_ok=True)
    return {"ok": True}


TRANSLATING: dict[str, str] = {}  # ref -> running | エラー
SHA_MARK = "\n<!-- source-sha256: "


def _translate(ref: str, body: str, sha: str):
    try:
        out = DOCS_JA / ref
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(llm.translate(body).rstrip() + SHA_MARK + sha + " -->\n", encoding="utf-8")
        TRANSLATING.pop(ref, None)
    except Exception as e:
        TRANSLATING[ref] = f"{type(e).__name__}: {e}"


@app.get("/api/docs/{ref:path}", response_class=PlainTextResponse)
def astryx_doc(ref: str, lang: str = ""):
    p = (DOCS / ref).resolve()
    if not (p.is_relative_to(DOCS) and p.suffix == ".md" and p.is_file()):
        raise HTTPException(404, "ドキュメントが見つかりません")
    body = frontmatter.loads(p.read_text(encoding="utf-8")).content
    if lang != "ja":
        return body
    # 日本語訳は standard/astryx-docs-ja/ に保存して 1 回だけ訳す。原文が変わったら（Astryx 更新時）訳し直す。
    ref = p.relative_to(DOCS).as_posix()
    sha = hashlib.sha256(body.encode()).hexdigest()[:16]
    ja = DOCS_JA / ref
    if ja.is_file():
        text, _, mark = ja.read_text(encoding="utf-8").rpartition(SHA_MARK)
        if mark.startswith(sha):
            return text
    if not (llm.LOCAL or llm.api_key()[0]):
        raise HTTPException(502, "API キーが未設定です")
    state = TRANSLATING.get(ref)
    if state and state != "running":
        TRANSLATING.pop(ref)  # 次の要求で再試行できるように
        raise HTTPException(502, state)
    if not state:
        TRANSLATING[ref] = "running"
        threading.Thread(target=_translate, args=(ref, body, sha), daemon=True).start()
    return JSONResponse({"status": "translating"}, status_code=202)


class GenerateIn(BaseModel):
    prompt: str
    code: str = ""


@app.post("/api/questions/{qid}/generate")
def generate(qid: str, body: GenerateIn):
    gen = llm.generate(load_card(qid), body.prompt, body.code)
    # 最初の 1 片を先に取り、認証やネットワークのエラーをストリーム開始前に HTTP エラーとして返す
    try:
        first = next(gen, "")
    except Exception as e:
        raise HTTPException(502, f"{type(e).__name__}: {e}")
    return StreamingResponse(itertools.chain([first], gen), media_type="text/plain; charset=utf-8")


class ReviewIn(BaseModel):
    option: str
    code: str
    html: str  # プレビューと同じ HTML（ブラウザでコンパイル済み）


def decided_cards() -> list[dict]:
    return [m for m in questions() if m.get("status") == "decided"]


def _run_review(key: str, card: dict, body: ReviewIn):
    try:
        review.run(CACHE / key, card, body.code, body.html, decided_cards())
        JOBS.pop(key, None)
    except Exception as e:
        JOBS[key] = f"{type(e).__name__}: {e}"


@app.post("/api/questions/{qid}/reviews")
def start_review(qid: str, body: ReviewIn):
    card = load_card(qid)
    # 同じ方案は 1 回だけ評価する（キャッシュキー = 問題 + HTML）。AI が失敗した結果は再実行する。
    key = hashlib.sha256(f"{qid}\n{body.html}".encode()).hexdigest()[:32]
    result = CACHE / key / "result.json"
    cached = result.is_file() and "ai_error" not in json.loads(result.read_text(encoding="utf-8"))
    if not cached and JOBS.get(key) != "running":
        JOBS[key] = "running"
        threading.Thread(target=_run_review, args=(key, card, body), daemon=True).start()
    return {"key": key}


@app.get("/api/reviews/{key}")
def get_review(key: str):
    state = JOBS.get(safe(key))
    if state == "running":
        return {"status": "running"}
    if state:
        return {"status": "error", "error": state}
    result = CACHE / key / "result.json"
    if not result.is_file():
        raise HTTPException(404, "レビューが見つかりません")
    return {"status": "done", **json.loads(result.read_text(encoding="utf-8"))}


@app.get("/api/reviews/{key}/{width}.png")
def review_shot(key: str, width: int):
    p = CACHE / safe(key) / f"{width}.png"
    if not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


class DraftIn(BaseModel):
    reviews: dict[str, str] = {}  # 方案名 -> レビューキー


@app.post("/api/questions/{qid}/draft")
def draft(qid: str, body: DraftIn):
    raw = card_path(qid).read_text(encoding="utf-8")
    results = {}
    for name, key in body.reviews.items():
        f = CACHE / safe(key) / "result.json"
        if f.is_file():
            r = json.loads(f.read_text(encoding="utf-8"))
            results[name] = {"checks": [c for c in r["checks"] if not c["ok"]], "ai": r.get("ai")}
    try:
        return {"text": llm.draft(raw, load_card(qid), load_options(qid), results)}
    except Exception as e:
        raise HTTPException(502, f"草稿の生成に失敗しました: {type(e).__name__}: {e}")


def settings_view(error: str = "") -> dict:
    key, source = llm.api_key()
    # キーそのものは返さない（末尾 4 文字だけ）
    return {"source": source, "hint": f"…{key[-4:]}" if key else "", "model": llm.MODEL, "local": llm.LOCAL, "error": error}


@app.get("/api/settings")
def get_settings():
    return settings_view()


class SettingsIn(BaseModel):
    api_key: str  # 空文字で画面から保存したキーを消す（環境変数に戻る）


@app.put("/api/settings")
def save_settings(body: SettingsIn):
    key = body.api_key.strip()
    if key and not re.fullmatch(r"[\x21-\x7e]{20,300}", key):
        raise HTTPException(400, "API キーの形式が正しくありません")
    if key:
        llm.KEY_FILE.write_text(key, encoding="utf-8")
    else:
        llm.KEY_FILE.unlink(missing_ok=True)
    return settings_view(llm.check_key() if llm.api_key()[0] else "")


class CardIn(BaseModel):
    text: str
    commit: bool = False


@app.put("/api/questions/{qid}")
def save_card(qid: str, body: CardIn):
    path = card_path(qid)
    try:
        meta = frontmatter.loads(body.text).metadata
    except Exception as e:
        raise HTTPException(400, f"フロントマターを読めません: {e}")
    if meta.get("id") != qid:
        raise HTTPException(400, "id を変えることはできません")
    if meta.get("status") not in ("todo", "researching", "decided"):
        raise HTTPException(400, "status は todo / researching / decided のいずれか")
    path.write_text(body.text, encoding="utf-8")
    if not body.commit:
        return {"ok": True}
    paths = [str(path.relative_to(ROOT))]
    if (OPTIONS / qid).is_dir():
        paths.append(str((OPTIONS / qid).relative_to(ROOT)))
    git = lambda *a: subprocess.run(["git", *a], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    git("add", "--", *paths)
    r = git("commit", "-m", f"card({qid}): {meta.get('question', '')[:50]}", "--", *paths)
    if r.returncode != 0:
        raise HTTPException(409, (r.stdout + r.stderr).strip() or "コミットできませんでした")
    return {"ok": True, "commit": git("rev-parse", "--short", "HEAD").stdout.strip()}
