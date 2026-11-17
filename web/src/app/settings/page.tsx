'use client';

import {useEffect, useState} from 'react';
import {Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {TextInput} from '@astryxdesign/core/TextInput';
import {api} from '@/lib/api';

interface Settings {
  source: 'ui' | 'env' | '';
  hint: string;
  model: string;
  local: boolean;
  error: string;
}

const SOURCE_LABEL = {ui: 'この画面で保存したキー', env: '環境変数 ANTHROPIC_API_KEY', '': '未設定'};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [key, setKey] = useState('');
  const [message, setMessage] = useState<{status: 'success' | 'error' | 'warning'; text: string} | null>(null);

  useEffect(() => {
    api<Settings>('/settings').then(setSettings, (e) => setMessage({status: 'error', text: `設定を読み込めません: ${e.message}`}));
  }, []);

  const save = async (value: string) => {
    try {
      const s = await api<Settings>('/settings', {method: 'PUT', body: JSON.stringify({api_key: value})});
      setSettings(s);
      setKey('');
      if (s.error) setMessage({status: 'warning', text: `保存しましたが、API に接続できません: ${s.error}`});
      else if (s.source) setMessage({status: 'success', text: value ? 'API キーを保存し、接続を確認しました' : '保存したキーを削除しました（環境変数のキーを使います）'});
      else setMessage({status: 'success', text: '保存したキーを削除しました'});
    } catch (e) {
      setMessage({status: 'error', text: `保存できません: ${(e as Error).message}`});
    }
  };

  return (
    <Layout
      header={
        <LayoutHeader>
          <VStack gap={2}>
            <Heading level={1}>設定</Heading>
            <Text type="supporting">AI 生成・AI 講評・草稿づくりに使う Claude API キー。キーはこの PC のリポジトリ直下 .anthropic-key に保存され、Git には入りません。</Text>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            {message && <Banner status={message.status} title={message.text} isDismissable onDismiss={() => setMessage(null)} collapsible={false} />}
            {settings && (
              <VStack gap={1}>
                <Text>
                  現在のキー: {SOURCE_LABEL[settings.source]} {settings.hint}
                </Text>
                <Text type="supporting">
                  モデル: {settings.model}
                  {settings.local && '（ANTHROPIC_BASE_URL のローカル接続）'}
                </Text>
              </VStack>
            )}
            <HStack gap={2} vAlign="end" wrap="wrap">
              <div className="grow">
                <TextInput
                  type="password"
                  label="Claude API キー"
                  description="console.anthropic.com の API Keys で発行したキー（sk-ant- で始まる）"
                  placeholder="sk-ant-..."
                  value={key}
                  onChange={setKey}
                  onEnter={() => key && save(key)}
                  autoComplete="off"
                  hasSpellCheck={false}
                />
              </div>
              <Button label="保存して接続を確認" variant="primary" isDisabled={!key.trim()} clickAction={() => save(key)} />
              {settings?.source === 'ui' && <Button label="保存したキーを削除" variant="ghost" clickAction={() => save('')} />}
            </HStack>
          </VStack>
        </LayoutContent>
      }
    />
  );
}
