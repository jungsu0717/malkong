/**
 * 가족과 함께 보기 (SPEC-MY-05, task my/007) — 마이의 한 줄에서 들어온다.
 * 가족이 없으면 설명 · 동의 · 「가족 만들기」 · 「초대 코드로 들어가기」, 있으면 초대 코드 · 함께 보는 폰 수 · 나가기.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, tap } from '@/components/ui';
import { FontFamily, Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ApiError } from '@/data/api';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { useFamily } from '@/data/family-context';
import { useTheme } from '@/hooks/use-theme';

const CONSENT_TEXT = '아기 이름 · 생일 · 건강 기록을 육아버디 서버에 저장하고 가족과 공유하는 데 동의해요';

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVITE_NOT_FOUND') return '맞는 초대 코드가 없어요';
    if (error.code === 'FAMILY_FULL') return '가족이 가득 찼어요(6명까지)';
    if (error.code === 'TOO_MANY_ATTEMPTS') return '오늘은 더 시도할 수 없어요';
    if (error.code === 'ALREADY_IN_FAMILY') return '이미 가족이 있어요';
    if (error.code === 'NETWORK') return '서버에 닿지 못했어요. 연결을 확인해 주세요';
  }
  return '잠깐 문제가 생겼어요. 다시 시도해 주세요';
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function FamilyScreen() {
  const c = useTheme();
  const { baby } = useBaby();
  const { status, state, syncing, create, join, leave, syncNow } = useFamily();
  const [consent, setConsent] = useState(false);
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const name = baby?.name ?? DEFAULT_BABY_NAME;

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      tap('success');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async (inviteCode: string) => {
    try {
      await Share.share({ message: `육아버디 초대 코드: ${inviteCode}\n마이 → 가족과 함께 보기 → 초대 코드로 들어가기에 넣어 주세요` });
    } catch {
      // 웹처럼 공유가 없는 곳에서는 코드를 보고 적는다
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {status === 'member' && state ? (
          <>
            <Card style={styles.card}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                초대 코드
              </ThemedText>
              <ThemedText selectable style={styles.code}>
                {state.info.inviteCode}
              </ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                가족 폰의 마이 → 가족과 함께 보기 → 초대 코드로 들어가기에 넣으면 돼요
              </ThemedText>
              <Button label="코드 보내기" icon="share-outline" onPress={() => void share(state.info.inviteCode)} />
            </Card>

            <Card style={styles.card}>
              <ThemedText type="heading" style={{ fontSize: 15 }}>
                함께 보는 폰 {state.info.members}대
              </ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {name}의 이름 · 생일과 기록이 서로 맞춰져요. 대화는 각자 폰에만 남아요.
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                {syncing ? '맞추는 중…' : state.syncedAt ? `마지막으로 맞춘 때 ${timeOf(state.syncedAt)}` : '아직 맞추지 못했어요'}
              </ThemedText>
              <Button label="지금 맞추기" variant="secondary" size="sm" busy={syncing} onPress={() => void syncNow()} />
            </Card>

            <Card style={styles.card}>
              {confirmLeave ? (
                <>
                  <ThemedText type="small">
                    나가면 이 폰은 더 맞추지 않아요. 지금까지의 기록은 이 폰에 그대로 남아요.
                  </ThemedText>
                  <View style={styles.row}>
                    <Button label="나가기" variant="secondary" busy={busy} onPress={() => void act(leave)} />
                    <Button label="취소" variant="ghost" onPress={() => setConfirmLeave(false)} />
                  </View>
                </>
              ) : (
                <Button label="가족에서 나가기" variant="ghost" onPress={() => setConfirmLeave(true)} />
              )}
              {error && (
                <ThemedText type="caption" style={{ color: c.danger }}>
                  {error}
                </ThemedText>
              )}
            </Card>
          </>
        ) : (
          <>
            <Card style={styles.card}>
              <ThemedText type="heading" style={{ fontSize: 15 }}>
                같은 아기를 보는 가족이 한 앱을 함께 써요
              </ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                {name}의 이름 · 생일과 기록이 육아버디 서버에 저장되어 폰끼리 맞춰져요. 누가 적든 다음 답과 브리핑에 바로
                들어가요. 대화는 각자 폰에만 남아요.
              </ThemedText>
              <Pressable
                style={styles.consent}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                disabled={busy}
                onPress={() => setConsent((v) => !v)}>
                <Ionicons name={consent ? 'checkbox' : 'square-outline'} size={20} color={consent ? c.accent : c.textSecondary} />
                <ThemedText type="small" style={styles.flex}>
                  {CONSENT_TEXT}
                </ThemedText>
              </Pressable>
            </Card>

            {joining ? (
              <Card style={styles.card}>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  초대 코드
                </ThemedText>
                <TextInput
                  style={[styles.input, { color: c.text, backgroundColor: c.surface }]}
                  value={code}
                  onChangeText={(t) => setCode(t.toUpperCase())}
                  placeholder="6자리"
                  placeholderTextColor={c.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  editable={!busy}
                />
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  들어가면 이 폰의 아기는 가족의 아기로 바뀌고, 기록은 합쳐져요
                </ThemedText>
                <View style={styles.row}>
                  <Button
                    label="들어가기"
                    busy={busy}
                    disabled={!consent || code.trim().length < 6}
                    onPress={() => void act(() => join(code))}
                  />
                  <Button label="취소" variant="ghost" disabled={busy} onPress={() => setJoining(false)} />
                </View>
              </Card>
            ) : (
              <View style={styles.actions}>
                <Button label="가족 만들기" size="lg" busy={busy} disabled={!consent} onPress={() => void act(create)} />
                <Button label="초대 코드로 들어가기" size="lg" variant="secondary" disabled={!consent || busy} onPress={() => setJoining(true)} />
                {!consent && (
                  <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
                    위 동의에 표시하면 누를 수 있어요
                  </ThemedText>
                )}
              </View>
            )}
            {error && (
              <ThemedText type="caption" style={[styles.center, { color: c.danger }]}>
                {error}
              </ThemedText>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { gap: 10 },
  code: { fontFamily: FontFamily.bold, fontSize: 34, lineHeight: 44, letterSpacing: 6 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actions: { gap: 10 },
  center: { textAlign: 'center' },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 4,
    fontFamily: FontFamily.semibold,
  },
});
