'use client';

import {useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Markdown} from '@astryxdesign/core/Markdown';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {VStack} from '@astryxdesign/core/VStack';
import {api, type CardDetail, type Reviews} from '@/lib/api';

export function CardEditor({detail, reviews, reload}: {detail: CardDetail; reviews: Reviews; reload: () => Promise<unknown>}) {
  const [text, setText] = useState(detail.raw);
  const [message, setMessage] = useState<{status: 'success' | 'error' | 'info'; text: string} | null>(null);
  const reviewed = Object.fromEntries(Object.entries(reviews).filter(([, r]) => r.result.status === 'done').map(([n, r]) => [n, r.key]));

  const makeDraft = async () => {
    setMessage(null);
    try {
      const {text} = await api<{text: string}>(`/questions/${detail.id}/draft`, {method: 'POST', body: JSON.stringify({reviews: reviewed})});
      setText(text);
      setMessage({status: 'info', text: '草稿を入れました。内容を確かめて、決めたら status を decided にして保存します。'});
    } catch (e) {
      setMessage({status: 'error', text: (e as Error).message});
    }
  };

  const save = async (commit: boolean) => {
    try {
      const r = await api<{commit?: string}>(`/questions/${detail.id}`, {method: 'PUT', body: JSON.stringify({text, commit})});
      await reload();
      setMessage({status: 'success', text: commit ? `保存して Git にコミットしました（${r.commit}）` : '保存しました'});
    } catch (e) {
      setMessage({status: 'error', text: `保存できません: ${(e as Error).message}`});
    }
  };

  return (
    <VStack gap={3}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
        <Text type="supporting">
          {`レビュー済みの方案 ${Object.keys(reviewed).length} 件をもとに AI が草稿を書きます。決定は自分で行います。`}
        </Text>
        <HStack gap={2}>
          <Button label="AI で草稿を作る" clickAction={makeDraft} />
          <Button label="保存" isDisabled={text === detail.raw} clickAction={() => save(false)} />
          <Button label="保存して Git にコミット" variant="primary" clickAction={() => save(true)} />
        </HStack>
      </HStack>
      {message && <Banner status={message.status} title={message.text} isDismissable onDismiss={() => setMessage(null)} collapsible={false} />}
      <div className="split">
        <div className="code-editor">
          <TextArea label="決定カード（YAML フロントマター + Markdown）" value={text} onChange={setText} rows={36} hasSpellCheck={false} />
        </div>
        <VStack gap={2}>
          <Heading level={2}>表示</Heading>
          <Markdown>{text.replace(/^---[\s\S]*?\n---\n/, '')}</Markdown>
        </VStack>
      </div>
    </VStack>
  );
}
