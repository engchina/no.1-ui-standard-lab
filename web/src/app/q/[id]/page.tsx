'use client';

import {useCallback, useEffect, useState} from 'react';
import {useParams} from 'next/navigation';
import {Layout, LayoutContent, LayoutHeader, LayoutPanel} from '@astryxdesign/core/Layout';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Selector} from '@astryxdesign/core/Selector';
import {Markdown} from '@astryxdesign/core/Markdown';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {api, STATUS_LABEL, STATUS_VARIANT, type CardDetail, type Review, type Reviews} from '@/lib/api';
import type {Mode} from '@/lib/preview';
import {Playground} from '@/components/Playground';
import {Compare} from '@/components/Compare';
import {CardEditor} from '@/components/CardEditor';

type View = 'play' | 'compare' | 'card';

export default function Workbench() {
  const {id} = useParams<{id: string}>();
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('play');
  const [width, setWidth] = useState(1280);
  const [mode, setMode] = useState<Mode>('light');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Reviews>({});

  const reload = useCallback(async () => {
    try {
      const d = await api<CardDetail>(`/questions/${id}`);
      setDetail(d);
      return d;
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    api<CardDetail>(`/questions/${id}`).then(
      (d) => {
        setDetail(d);
        setDrafts(d.codes);
      },
      (e) => setError(e.message),
    );
  }, [id]);

  // 実行中のレビューを 2 秒ごとに確認する
  const running = Object.entries(reviews).filter(([, r]) => r.result.status === 'running');
  useEffect(() => {
    if (!running.length) return;
    const t = setInterval(async () => {
      for (const [name, r] of running) {
        const result = await api<Review>(`/reviews/${r.key}`).catch((e) => ({status: 'error' as const, error: e.message}));
        if (result.status !== 'running') setReviews((all) => ({...all, [name]: {key: r.key, result}}));
      }
    }, 2000);
    return () => clearInterval(t);
  }, [running.map(([n, r]) => n + r.key).join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Banner status="error" title="問題を読み込めません" description={error} collapsible={false} />;
  if (!detail) return <Skeleton height={320} />;

  const widthSwitch = (
    <HStack gap={2}>
      <SegmentedControl label="プレビュー幅" size="sm" value={String(width)} onChange={(v) => setWidth(Number(v))}>
        <SegmentedControlItem value="375" label="375" />
        <SegmentedControlItem value="768" label="768" />
        <SegmentedControlItem value="1280" label="1280" />
      </SegmentedControl>
      <SegmentedControl label="配色" size="sm" value={mode} onChange={(v) => setMode(v as Mode)}>
        <SegmentedControlItem value="light" label="ライト" />
        <SegmentedControlItem value="dark" label="ダーク" />
      </SegmentedControl>
    </HStack>
  );

  return (
    <Layout
      header={
        <LayoutHeader hasDivider>
          <VStack gap={2}>
            <HStack gap={2} vAlign="center">
              <Badge label={detail.unit} />
              <Badge variant={STATUS_VARIANT[detail.status]} label={STATUS_LABEL[detail.status]} />
              <Text type="supporting">{detail.category}</Text>
            </HStack>
            <Heading level={1}>{detail.question}</Heading>
            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
              <TabList value={view} onChange={(v) => setView(v as View)}>
                <Tab value="play" label="演習台" />
                <Tab value="compare" label="方案比較" />
                <Tab value="card" label="決定カード" />
              </TabList>
              {view !== 'card' && widthSwitch}
            </HStack>
          </VStack>
        </LayoutHeader>
      }
      start={
        <LayoutPanel width={360} hasDivider label="問題と Astryx ドキュメント">
          <DocsPanel detail={detail} />
        </LayoutPanel>
      }
      content={
        <LayoutContent label={view === 'play' ? '演習台' : view === 'compare' ? '方案比較' : '決定カード'}>
          {view === 'play' && <Playground detail={detail} drafts={drafts} setDrafts={setDrafts} width={width} mode={mode} reload={reload} />}
          {view === 'compare' && <Compare detail={detail} drafts={drafts} width={width} mode={mode} reviews={reviews} setReviews={setReviews} />}
          {view === 'card' && <CardEditor detail={detail} reviews={reviews} reload={reload} />}
        </LayoutContent>
      }
    />
  );
}

function DocsPanel({detail}: {detail: CardDetail}) {
  const [ref, setRef] = useState(detail.astryx_refs[0] ?? '');
  const [loaded, setLoaded] = useState({ref: '', text: '', translating: false, error: ''});
  useEffect(() => {
    if (!ref) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    // 日本語訳を取りに行く。初回は API が Claude で訳すので 202 の間は 3 秒ごとに待つ。訳せなければ英語の原文を出す。
    const load = () =>
      api<string | {status: string}>(`/docs/${ref}?lang=ja`).then(
        (r) => {
          if (!alive) return;
          if (typeof r === 'string') setLoaded({ref, text: r, translating: false, error: ''});
          else {
            setLoaded((l) => ({...l, ref, translating: true}));
            timer = setTimeout(load, 3000);
          }
        },
        (e) =>
          api<string>(`/docs/${ref}`).then(
            (text) => alive && setLoaded({ref, text, translating: false, error: e.message}),
            (e2) => alive && setLoaded({ref, text: `読み込めません: ${e2.message}`, translating: false, error: ''}),
          ),
      );
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ref]);
  const current = loaded.ref === ref ? loaded : null;
  const doc = current?.text ?? '';

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="label">背景</Text>
        <Text>{detail.origin}</Text>
      </VStack>
      {detail.decision && (
        <VStack gap={1}>
          <Text type="label">現在の決定</Text>
          <Text>{detail.decision}</Text>
        </VStack>
      )}
      <Selector
        label="Astryx の教材"
        value={ref}
        onChange={(v) => v && setRef(v)}
        options={detail.astryx_refs.map((r) => ({value: r, label: r}))}
      />
      {current?.translating && <Text type="supporting">日本語に翻訳しています（初回のみ、長い文書は数分かかります）…</Text>}
      {current?.error && (
        <Banner
          status="warning"
          title="日本語訳を表示できないため原文を表示しています"
          description={`「設定」で API キーを入れると、初回表示時に翻訳して保存します。${current.error}`}
          collapsible={false}
        />
      )}
      {doc ? <Markdown density="compact">{doc}</Markdown> : <Skeleton height={240} />}
    </VStack>
  );
}
