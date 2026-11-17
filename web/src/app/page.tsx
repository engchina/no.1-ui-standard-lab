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
import {api, MVP_UNITS, STATUS_LABEL, STATUS_VARIANT, type Card} from '@/lib/api';

type Filter = 'mvp' | 'all' | 'todo' | 'researching' | 'decided';

export default function QuestionList() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('mvp');

  useEffect(() => {
    api<Card[]>('/questions').then(setCards, (e) => setError(String(e.message)));
  }, []);

  const rows = useMemo(() => {
    if (!cards) return [];
    if (filter === 'all') return cards;
    if (filter === 'mvp') return cards.filter((c) => MVP_UNITS.includes(c.unit));
    return cards.filter((c) => c.status === filter);
  }, [cards, filter]);

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
            <HStack>
              <SegmentedControl label="絞り込み" value={filter} onChange={(v) => setFilter(v as Filter)}>
                <SegmentedControlItem value="mvp" label="MVP（U5・U11・U12・U15）" />
                <SegmentedControlItem value="all" label="すべて" />
                <SegmentedControlItem value="todo" label="未着手" />
                <SegmentedControlItem value="researching" label="研究中" />
                <SegmentedControlItem value="decided" label="決定済み" />
              </SegmentedControl>
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {error ? (
            <Banner status="error" title="問題一覧を読み込めません" description={`API（FastAPI）が起動しているか確認してください: ${error}`} />
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
