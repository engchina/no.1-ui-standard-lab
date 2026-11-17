---
id: U06-japanese
unit: U6
category: 日本語
question: 日本語の折り返し、文言のトーン、日付・数値の書式、IME をどう扱うか
origin: 単語の途中で折り返す。文言の語調が揃わない。変換確定の Enter で誤送信する
astryx_refs:
- design/ime-guard.md
- components/InternationalizationProvider.md
- components/TextInput.md
options: []
decision: ''
rationale: ''
checks:
- 和文組版
- IME 変換中の Enter で送信しない
status: todo
---

## 背景

単語の途中で折り返す。文言の語調が揃わない。変換確定の Enter で誤送信する
