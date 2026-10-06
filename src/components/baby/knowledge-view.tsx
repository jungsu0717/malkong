/**
 * 「버디가 아는 것」 상세 (SPEC-BABY-01 · 02 조작 · 04 · 05, task baby/004) — 우리 아기 탭의 「더 보기」와 지도의 행성에서 들어온다.
 * 주제 여섯 막대(누르면 고름) → 고른 주제의 사실 목록(알려 주기 · 고치기) → 버디와 함께한 시간(한 문장과 알게 된 흐름) →
 * 모은 기록 전체(보고 고치기, SPEC-BABY-06).
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import type { ChatMessage } from '@/data/chat';
import { useChat } from '@/data/chat-context';
import { buildProfile, knowledgeGrowth, type Domain, type Fact } from '@/data/knowledge-profile';
import { useRecords } from '@/data/records-context';
import { useQuickAsk } from '@/hooks/use-quick-ask';
import { useTheme } from '@/hooks/use-theme';

/** 내가 한 질문 수 — 되묻기에 답한 것은 빼고 */
export const questionCount = (messages: ChatMessage[]) =>
  messages.filter((m) => m.role === 'user' && !m.meta.replyTo).length;

/** 버디와 함께한 시간을 한 문장으로 — 「함께한 지 3일째 · 질문 6번 · 기록 2개」(SPEC-BABY-05, 통계 칸 대신) */
export function togetherLine(createdAt: string, questions: number, recordCount: number): string {
  const days = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000) + 1);
  return `함께한 지 ${days}일째 · 나눈 질문 ${questions}번 · 모은 기록 ${recordCount}개`;
}

export function KnowledgeView() {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  const { messages } = useChat();
  // 「알려 주기」는 이 자리에서 묻는다(task baby/002)
  const { ask, sheet } = useQuickAsk();
  const { domain: param } = useLocalSearchParams<{ domain?: string }>();
  const [selected, setSelected] = useState<string | null>(param ?? null);
  const profile = useMemo(() => (baby ? buildProfile(baby, records) : null), [baby, records]);
  if (!baby || !profile) return <ScreenLoading />;
  const name = baby.name ?? DEFAULT_BABY_NAME;
  const domain = profile.domains.find((d) => d.id === selected) ?? profile.domains[0];
  const growth = knowledgeGrowth(records, baby.birthDate);
  const askFact = (fact: Fact) => {
    if (!fact.ask) return;
    tap();
    ask(fact.ask, fact.record, fact.value);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ThemedText type="display">{profile.percent}%</ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            Lv.{profile.level.step} {profile.level.name} · 알게 된 것 {profile.knownCount} / {profile.totalCount}
          </ThemedText>
        </View>

        <View style={styles.section}>
          <SectionHeader title="주제별로" aside="누르면 아래에 자세히" />
          <Card style={styles.bars}>
            {profile.domains.map((d) => {
              const on = d.id === domain.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={styles.barRow}
                  onPress={() => {
                    tap();
                    setSelected(d.id);
                  }}>
                  <ThemedText type="label" style={[styles.barName, { fontWeight: on ? 700 : 500 }]}>
                    {d.name}
                  </ThemedText>
                  <View style={[styles.barTrack, { backgroundColor: c.surface }]}>
                    <View style={[styles.barFill, { backgroundColor: d.color, width: `${Math.max(3, d.score * 100)}%` }]} />
                  </View>
                  <ThemedText type="caption" style={[styles.barValue, { color: on ? c.text : c.textSecondary }]}>
                    {Math.round(d.score * 100)}%
                  </ThemedText>
                </Pressable>
              );
            })}
          </Card>
          <DomainCard domain={domain} onAsk={askFact} />
        </View>

        {/* 함께한 시간 (SPEC-BABY-05) — 숫자 칸이 아니라 한 문장 */}
        <View style={styles.section}>
          <SectionHeader title="버디와 함께한 시간" />
          <Card style={styles.together}>
            <ThemedText type="body" style={{ fontWeight: 600 }}>
              {togetherLine(baby.createdAt, questionCount(messages), records.length)}
            </ThemedText>
            {growth.length >= 2 ? (
              <Sparkline points={growth} color={c.accent} />
            ) : (
              <ThemedText type="caption" style={{ color: c.textSecondary }}>
                기록이 쌓이면 버디가 {name}에 대해 알아 간 흐름이 여기 그려져요
              </ThemedText>
            )}
          </Card>
        </View>

        {/* 기록 전체 (SPEC-BABY-06) — 아는 것의 바탕이 되는 기록을 보고 고친다 */}
        <Card style={styles.rows}>
          <ListRow
            icon="document-text-outline"
            title="모은 기록 전체 보기"
            detail={records.length > 0 ? `${records.length}건 · 고치거나 지울 수 있어요` : '버디와 나눈 이야기에서 모은 기록이 여기 쌓여요'}
            onPress={() => router.push('/records')}
          />
        </Card>

        <ThemedText type="caption" style={[styles.note, { color: c.textSecondary }]}>
          이 숫자는 이 폰에 저장된 기록으로만 계산해요. 서버로 보내지 않아요.
        </ThemedText>
      </ScrollView>
      {sheet}
    </>
  );
}

/** 한 영역의 사실 목록 — 아는 것은 값과 「고치기」, 모르는 것은 「알려 주기」 */
function DomainCard({ domain, onAsk }: { domain: Domain; onAsk: (fact: Fact) => void }) {
  const c = useTheme();
  return (
    <Card style={styles.domainCard}>
      <View style={styles.domainHead}>
        <View style={[styles.bigDot, { backgroundColor: domain.color }]} />
        <ThemedText type="heading" style={styles.flex}>
          {domain.name}
        </ThemedText>
        <ThemedText type="heading" style={{ color: c.textSecondary }}>
          {Math.round(domain.score * 100)}%
        </ThemedText>
      </View>
      {domain.facts.map((f) => {
        const known = f.score >= 0.5;
        return (
          <View key={f.id} style={[styles.factRow, { borderTopColor: c.divider }]}>
            <Ionicons
              name={known ? 'checkmark-circle' : f.score > 0 ? 'ellipse' : 'ellipse-outline'}
              size={18}
              color={known ? domain.color : f.score > 0 ? domain.color : c.textTertiary}
            />
            <View style={styles.flex}>
              <ThemedText type="body" style={{ fontWeight: 600 }}>
                {f.label}
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={2}>
                {f.value ?? `아직 몰라요 · ${f.benefit}`}
              </ThemedText>
            </View>
            {f.ask &&
              (known ? (
                <Button label="고치기" size="sm" variant="ghost" onPress={() => onAsk(f)} />
              ) : (
                <Button label="알려 주기" size="sm" variant="secondary" onPress={() => onAsk(f)} />
              ))}
          </View>
        );
      })}
    </Card>
  );
}

/** 알게 된 것이 쌓인 흐름 — 날짜(D+N)별 누적 기록 수 */
function Sparkline({ points, color }: { points: { day: number; total: number }[]; color: string }) {
  const c = useTheme();
  const [width, setWidth] = useState(0);
  const h = 72;
  const minDay = points[0].day;
  const maxDay = Math.max(points.at(-1)!.day, minDay + 1);
  const maxTotal = points.at(-1)!.total;
  const xy = points.map((p) => [((p.day - minDay) / (maxDay - minDay)) * (width - 8) + 4, h - 6 - (p.total / maxTotal) * (h - 14)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy.at(-1)![0].toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`;
  const last = xy.at(-1)!;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: h }}>
      {width > 0 && (
        <Svg width={width} height={h} accessibilityLabel={`알게 된 것 ${maxTotal}개까지 늘어난 흐름`}>
          <Defs>
            <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#area)" />
          <Path d={line} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke={c.background} strokeWidth={2} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  head: { gap: 2 },
  section: { gap: 10 },
  bars: { gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  barName: { width: 36 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 36, textAlign: 'right' },
  domainCard: { gap: 10 },
  domainHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bigDot: { width: 12, height: 12, borderRadius: 6 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1 },
  together: { gap: 14 },
  rows: { paddingVertical: 2 },
  note: { textAlign: 'center' },
});
