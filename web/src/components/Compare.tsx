'use client';

import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {Link} from '@astryxdesign/core/Link';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {api, type CardDetail, type Review, type Reviews} from '@/lib/api';
import {buildHtml, type Mode} from '@/lib/preview';
import {Preview} from './Preview';

const SEVERITY = {high: ['error', '高'], medium: ['warning', '中'], low: ['neutral', '低']} as const;

export function Compare(props: {
  detail: CardDetail;
  drafts: Record<string, string>;
  width: number;
  mode: Mode;
  reviews: Reviews;
  setReviews: React.Dispatch<React.SetStateAction<Reviews>>;
}) {
  const {detail, drafts, width, mode, reviews, setReviews} = props;
  const names = Object.keys(drafts);

  const start = async (name: string) => {
    const code = drafts[name];
    try {
      // レビューは常にライトモードの同じ HTML で行う（キャッシュが効くように）
      const {key} = await api<{key: string}>(`/questions/${detail.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({option: name, code, html: buildHtml(code, 'light')}),
      });
      const result = await api<Review>(`/reviews/${key}`).catch(() => ({status: 'running'}) as Review);
      setReviews((all) => ({...all, [name]: {key, result}}));
    } catch (e) {
      setReviews((all) => ({...all, [name]: {key: '', result: {status: 'error', error: (e as Error).message}}}));
    }
  };

  if (names.length === 0) {
    return <EmptyState title="比較する方案がありません" description="演習台で方案を 2〜3 案作ってから比較します。" />;
  }

  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
        <Text type="supporting">機械チェック → AI 講評の順に実行します。結果は判断材料で、決めるのは自分です。</Text>
        <Button label="すべてレビュー" variant="primary" clickAction={async () => void (await Promise.all(names.map(start)))} />
      </HStack>
      <Grid columns={{minWidth: 420, repeat: 'fit'}} gap={6} align="start">
        {names.map((name) => (
          <VStack key={name} gap={3}>
            <HStack hAlign="between" vAlign="center">
              <Heading level={2}>{name}</Heading>
              <Button label="レビュー" size="sm" clickAction={() => start(name)} />
            </HStack>
            <Preview code={drafts[name]} width={width} mode={mode} title={`${name} のプレビュー`} />
            {reviews[name] && <ReviewView review={reviews[name]} />}
          </VStack>
        ))}
      </Grid>
    </VStack>
  );
}

function ReviewView({review: {key, result}}: {review: Reviews[string]}) {
  if (result.status === 'running') return <ProgressBar label="レビュー中（3 幅で描画 → 機械チェック → AI 講評）" />;
  if (result.status === 'error') return <Banner status="error" title="レビューに失敗しました" description={result.error} collapsible={false} />;

  const failed = result.checks?.filter((c) => !c.ok) ?? [];
  return (
    <VStack gap={3}>
      {!!result.errors?.length && <Banner status="error" title="ページでエラーが出ています" description={result.errors.join('\n')} collapsible={false} />}
      <Card>
        <VStack gap={2}>
          <Heading level={3}>機械チェック（{result.checks!.length - failed.length} / {result.checks!.length} 合格）</Heading>
          {result.checks!.map((c) => (
            <VStack key={c.name} gap={1}>
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Badge variant={c.ok ? 'success' : 'error'} label={c.ok ? '合格' : '要確認'} />
                <Text weight="semibold">{c.name}</Text>
                <Text type="supporting">{c.detail}</Text>
              </HStack>
              {!c.ok && c.items.slice(0, 8).map((it) => (
                <Text key={it} type="code" size="sm">
                  {it}
                </Text>
              ))}
            </VStack>
          ))}
          <HStack gap={3} wrap="wrap">
            {result.widths?.map((w) => (
              <Link key={w} href={`/api/reviews/${key}/${w}.png`} target="_blank">
                {`${w}px のスクリーンショット`}
              </Link>
            ))}
          </HStack>
        </VStack>
      </Card>
      <Card>
        <VStack gap={2}>
          <Heading level={3}>AI 講評</Heading>
          {result.ai_error && <Banner status="warning" title="AI 講評を実行できませんでした" description={result.ai_error} collapsible={false} />}
          {result.ai && (
            <>
              <Text weight="semibold">{result.ai.summary}</Text>
              {result.ai.issues.map((is, i) => (
                <VStack key={i} gap={1}>
                  <HStack gap={2} vAlign="center">
                    <Badge variant={SEVERITY[is.severity][0]} label={SEVERITY[is.severity][1]} />
                    <Text type="code" size="sm">
                      {is.selector}
                    </Text>
                  </HStack>
                  <Text>{is.suggestion}</Text>
                  <Text type="supporting">原理: {is.principle}</Text>
                </VStack>
              ))}
              {result.ai.conflicts.map((c) => (
                <Banner key={c.card_id} status="warning" title={`決定カード ${c.card_id} と食い違い`} description={c.note} collapsible={false} />
              ))}
            </>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}
