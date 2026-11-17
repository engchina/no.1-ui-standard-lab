export type Status = 'todo' | 'researching' | 'decided';

export interface Card extends Record<string, unknown> {
  id: string;
  unit: string;
  category: string;
  question: string;
  origin: string;
  astryx_refs: string[];
  decision: string;
  rationale: string;
  checks: string[];
  status: Status;
}

export interface CardDetail extends Card {
  body: string;
  raw: string;
  codes: Record<string, string>;
}

export interface CheckItem {
  name: string;
  ok: boolean;
  detail: string;
  items: string[];
}

export interface Review {
  status: 'running' | 'done' | 'error';
  error?: string;
  checks?: CheckItem[];
  errors?: string[];
  widths?: number[];
  ai?: {
    issues: {selector: string; severity: 'high' | 'medium' | 'low'; principle: string; suggestion: string}[];
    conflicts: {card_id: string; note: string}[];
    summary: string;
  };
  ai_error?: string;
}

export const STATUS_LABEL: Record<Status, string> = {todo: '未着手', researching: '研究中', decided: '決定済み'};
export const STATUS_VARIANT = {todo: 'neutral', researching: 'warning', decided: 'success'} as const;
/** 最初に取り組む単元（設計書: スクロール・メッセージ・読み込み・詳細の出し方） */
export const PRIORITY_UNITS = ['U5', 'U11', 'U12', 'U15'];

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? {'Content-Type': 'application/json', ...init?.headers} : init?.headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

/** 方案名 -> レビュー（キーと最新の結果） */
export type Reviews = Record<string, {key: string; result: Review}>;
