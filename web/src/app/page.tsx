'use client';

import {useEffect, useMemo, useState} from 'react';
import {Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Link} from '@astryxdesign/core/Link';
import {Banner} from '@astryxdesign/core/Banner';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Table, pixel, proportional, type TableColumn} from '@astryxdesign/core/Table';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {api, PRIORITY_UNITS, STATUS_LABEL, STATUS_VARIANT, type Card, type Status} from '@/lib/api';

type Scope = 'priority' | 'all';
type StatusFilter = 'all' | Status;

export default function QuestionList() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState('');
  // 範囲（どの問題か）と状態（どこまで進んだか）は別の軸なので、別々に選んで組み合わせる
  const [scope, setScope] = useState<Scope>('priority');
  const [status, setStatus] = useState<StatusFilter>('all');

  useEffect(() => {
    api<Card[]>('/questions').then(setCards, (e) => setError(String(e.message)));
  }, []);

  const rows = useMemo(
    () =>
      (cards ?? []).filter(
        (c) => (scope === 'all' || PRIORITY_UNITS.includes(c.unit)) && (status === 'all' || c.status === status),
      ),
    [cards, scope, status],
  );

  const done = cards?.filter((c) => c.status === 'decided').length ?? 0;

  const columns: TableColumn<Card>[] = [
    {key: 'unit', header: '単元', width: pixel(72)},
    {key: 'category', header: '区分', width: proportional(1, {minWidth: 140})},
    {
      key: 'question',
      header: '問題',
      width: proportional(3, {minWidth: 240}),
      renderCell: (c: Card) => <Link href={`/q/${c.id}`}>{c.question}</Link>,
    },
    {
      key: 'status',
      header: '状態',
      width: pixel(104),
      renderCell: (c: Card) => <Badge variant={STATUS_VARIANT[c.status]} label={STATUS_LABEL[c.status]} />,
    },
  ];

  return (
    <Layout
      header={
        <LayoutHeader>
          <VStack gap={2}>
            <Heading level={1}>問題一覧</Heading>
            <Text type="supporting">
              実際に起きた UI の問題を 1 つずつ Astryx で考え直し、決定カードにする。{cards && `決定済み ${done} / ${cards.length}`}
            </Text>
            <HStack gap={6} wrap="wrap" vAlign="end">
              <VStack gap={1}>
                <Text type="label">範囲</Text>
                <SegmentedControl label="範囲" value={scope} onChange={(v) => setScope(v as Scope)}>
                  <SegmentedControlItem value="priority" label="優先（U5・U11・U12・U15）" />
                  <SegmentedControlItem value="all" label="すべて" />
                </SegmentedControl>
              </VStack>
              <VStack gap={1}>
                <Text type="label">状態</Text>
                <SegmentedControl label="状態" value={status} onChange={(v) => setStatus(v as StatusFilter)}>
                  <SegmentedControlItem value="all" label="すべて" />
                  <SegmentedControlItem value="todo" label={STATUS_LABEL.todo} />
                  <SegmentedControlItem value="researching" label={STATUS_LABEL.researching} />
                  <SegmentedControlItem value="decided" label={STATUS_LABEL.decided} />
                </SegmentedControl>
              </VStack>
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {error ? (
            <Banner status="error" title="問題一覧を読み込めません" description={`API（FastAPI）が起動しているか確認してください: ${error}`} />
          ) : cards && rows.length === 0 ? (
            <EmptyState title="該当する問題はありません" description="範囲か状態の絞り込みを変えてください。" />
          ) : cards ? (
            <Table data={rows} columns={columns} idKey="id" hasHover />
          ) : (
            <VStack gap={2}>
              {Array.from({length: 6}, (_, i) => (
                <Skeleton key={i} height={40} />
              ))}
            </VStack>
          )}
        </LayoutContent>
      }
    />
  );
}
