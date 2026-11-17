'use client';

import {useEffect, useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {api, type CardDetail} from '@/lib/api';
import {STARTER, type Mode} from '@/lib/preview';
import {Preview} from './Preview';

type Drafts = Record<string, string>;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const stripFence = (s: string) => (s.match(/```[a-zA-Z]*\n([\s\S]*?)```/)?.[1] ?? s).trim() + '\n';

export function Playground(props: {
  detail: CardDetail;
  drafts: Drafts;
  setDrafts: React.Dispatch<React.SetStateAction<Drafts>>;
  width: number;
  mode: Mode;
  reload: () => Promise<unknown>;
}) {
  const {detail, drafts, setDrafts, width, mode, reload} = props;
  const names = Object.keys(drafts);
  const [current, setCurrent] = useState(names[0] ?? '');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{status: 'success' | 'error'; text: string} | null>(null);

  const code = drafts[current] ?? '';
  const debounced = useDebounced(code, 600);
  const [frozen, setFrozen] = useState('');
  const shown = generating ? frozen : debounced; // 生成中は途中のコードでプレビューを壊さない

  const dirty = code !== (detail.codes[current] ?? null);
  const setCode = (v: string) => setDrafts((d) => ({...d, [current]: v}));

  const addOption = () => {
    const name = `option-${String.fromCharCode(97 + names.length)}`; // option-a, option-b, ...
    setDrafts((d) => ({...d, [name]: STARTER}));
    setCurrent(name);
  };

  const save = async () => {
    try {
      await api(`/questions/${detail.id}/options/${current}`, {method: 'PUT', body: JSON.stringify({code})});
      await reload();
      setMessage({status: 'success', text: `${current} を保存しました`});
    } catch (e) {
      setMessage({status: 'error', text: `保存できません: ${(e as Error).message}`});
    }
  };

  const remove = async () => {
    if (!confirm(`${current} を削除しますか？`)) return;
    await api(`/questions/${detail.id}/options/${current}`, {method: 'DELETE'});
    const rest = {...drafts};
    delete rest[current];
    setDrafts(rest);
    setCurrent(Object.keys(rest)[0] ?? '');
    await reload();
  };

  const generate = async () => {
    setFrozen(debounced);
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/questions/${detail.id}/generate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({prompt, code}),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let acc = '';
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        acc += value;
        setCode(acc);
      }
      setCode(stripFence(acc));
    } catch (e) {
      setMessage({status: 'error', text: `生成できません（「設定」の API キーとネットワークを確認）: ${(e as Error).message}`});
    } finally {
      setGenerating(false);
    }
  };

  if (!current) {
    return (
      <EmptyState
        title="まだ方案がありません"
        description="方案を追加して Astryx で組むか、AI に指示して生成します。比較するには 2〜3 案あるとよい。"
        actions={<Button variant="primary" label="方案を追加" onClick={addOption} />}
      />
    );
  }

  return (
    <VStack gap={3}>
      <HStack hAlign="between" vAlign="center" gap={2} wrap="wrap">
        <TabList value={current} onChange={setCurrent} size="sm">
          {names.map((n) => (
            <Tab key={n} value={n} label={n === current && dirty ? `${n} ●` : n} />
          ))}
        </TabList>
        <HStack gap={2}>
          <Button label="方案を追加" size="sm" onClick={addOption} />
          <Button label="削除" size="sm" variant="ghost" onClick={remove} />
          <Button label="保存" size="sm" variant="primary" isDisabled={!dirty} clickAction={save} />
        </HStack>
      </HStack>
      {message && <Banner status={message.status} title={message.text} isDismissable onDismiss={() => setMessage(null)} collapsible={false} />}
      <div className="split">
        <VStack gap={2}>
          <HStack gap={2} vAlign="end">
            <div className="grow">
              <TextInput
                label="AI への指示"
                placeholder="例: 右側に詳細パネルを出す案にして"
                value={prompt}
                onChange={setPrompt}
                onEnter={() => prompt && !generating && generate()}
              />
            </div>
            <Button label="生成" isLoading={generating} isDisabled={!prompt} onClick={generate} />
          </HStack>
          <div className="code-editor">
            <TextArea label="方案のコード（TSX）" value={code} onChange={setCode} rows={30} hasSpellCheck={false} />
          </div>
        </VStack>
        <Preview code={shown} width={width} mode={mode} title={`${current} のプレビュー`} />
      </div>
    </VStack>
  );
}
