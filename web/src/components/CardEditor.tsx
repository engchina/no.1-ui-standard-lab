'use client';

import {useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Markdown} from '@astryxdesign/core/Markdown';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {VStack} from '@astryxdesign/core/VStack';
import {api, streamText, type CardDetail, type Reviews} from '@/lib/api';

export function CardEditor({detail, reviews, reload}: {detail: CardDetail; reviews: Reviews; reload: () => Promise<unknown>}) {
  const [text, setText] = useState(detail.raw);
  const [drafting, setDrafting] = useState(false);
  const [message, setMessage] = useState<{status: 'success' | 'error' | 'info'; text: string} | null>(null);
  const reviewed = Object.fromEntries(Object.entries(reviews).filter(([, r]) => r.result.status === 'done').map(([n, r]) => [n, r.key]));

  const makeDraft = async () => {
    setMessage(null);
    setDrafting(true);
    try {
      // 草稿は長いので少しずつ届く。書いている途中もそのまま欄に出す
      setText(await streamText(`/questions/${detail.id}/draft`, {reviews: reviewed}, setText));
      setMessage({status: 'info', text: '草稿を入れました。内容を確かめて、決めたら status を decided にして保存します。'});
    } catch (e) {
      setMessage({status: 'error', text: `草稿を作れません（「設定」の API キーとネットワークを確認）: ${(e as Error).message}`});
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    try {
      await api(`/questions/${detail.id}`, {method: 'PUT', body: JSON.stringify({text})});
      await reload();
      setMessage({status: 'success', text: '保存しました'});
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
          <Button label="AI で草稿を作る" isLoading={drafting} onClick={makeDraft} />
          <Button label="保存" variant="primary" isDisabled={drafting || text === detail.raw} clickAction={save} />
        </HStack>
      </HStack>
      {message && <Banner status={message.status} title={message.text} isDismissable onDismiss={() => setMessage(null)} collapsible={false} />}
      <Grid columns={{minWidth: 360, repeat: 'fit'}} gap={6} align="start">
        <TextArea
          label="決定カード（YAML フロントマター + Markdown）"
          value={text}
          onChange={setText}
          isReadOnly={drafting}
          rows={36}
          hasSpellCheck={false}
          containerClassName="code-input"
        />
        <VStack gap={2}>
          <Heading level={2}>表示</Heading>
          <Markdown>{text.replace(/^---[\s\S]*?\n---\n/, '')}</Markdown>
        </VStack>
      </Grid>
    </VStack>
  );
}
