/**
 * 성장 탭 (SPEC-STAGE-01~03, task growth/004 · 005, decisions/031) — 지금 시기의 우리 아기, 한 화면 요약.
 *
 * 위쪽 먹색 그림(growth-hero)에 태어난 지 며칠 · 몇 주차, 시기에 맞는 버디, 달마다 · 50일 · 100일 칸의 막대. 칸의 날 당일에는 기념일 장면.
 * 그 아래 날마다 바뀌는 「오늘의 놀이」(task growth/007), 탭에서 바로 누르는 카드 둘 — 발달 체크 · 이맘때 챙기면 좋은 일(task growth/009),
 * 목록 하나에 두 줄 — 성장 일기 · 알아 두면 좋아요.
 * 긴 내용은 줄을 눌러 들어가는 상세 화면에.
 * 내용은 승인된 공공 지식(L1)이고, 출처는 화면 대신 「의학 정보 출처와 한계 고지」에 모은다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { CheckCard, PrepCard } from '@/components/growth/growth-cards';
import { GrowthHero } from '@/components/growth/growth-hero';
import { KnowledgeSheet } from '@/components/growth/knowledge-sheet';
import { TodayPlay } from '@/components/growth/today-play';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap, type IconName } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { itemById, itemsByIds, type KnowledgeItem } from '@/data/l1';
import { isPlayMemo } from '@/data/growth-plus';
import { useMemos } from '@/data/memos-context';
import { todoRecommend } from '@/data/recommend';
import {
  KNOW_COMMON,
  checklistIds,
  checkpointFor,
  dayNumber,
  daysSince,
  forMonth,
  poseOf,
  splitTitle,
  stageWindow,
  weekOf,
  type StageStop,
} from '@/data/stage';
import { useNow } from '@/hooks/use-now';
import { usePlace } from '@/hooks/use-place';
import { useTheme } from '@/hooks/use-theme';

const heads = (items: KnowledgeItem[], n = 2) => {
  const names = items.slice(0, n).map((i) => splitTitle(i.title).head);
  return names.join(' · ') + (items.length > n ? ` 외 ${items.length - n}가지` : '');
};

export default function GrowthScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { baby, age } = useBaby();
  const { memos } = useMemos();
  const now = useNow(false);
  const [place] = usePlace();
  const [detail, setDetail] = useState<{ item: KnowledgeItem; title: string; sub: string | null } | null>(null);

  if (!baby || !age) return <ScreenLoading />;
  const days = daysSince(baby.birthDate, now);
  const stage = stageWindow(baby.birthDate, now);
  const cp = checkpointFor(age.month);
  const checks = itemsByIds(checklistIds(cp));
  const common = forMonth(itemsByIds(KNOW_COMMON), age.month);
  // 성장 일기 줄에는 놀이를 뺀 마지막 기록(메모 · 발달 체크)
  const last = memos.find((m) => !isPlayMemo(m));

  const openStop = (s: StageStop) => {
    if (s.milestone) {
      const item = itemById(s.milestone.l1Id);
      if (item) setDetail({ item, title: s.milestone.name, sub: `대부분 ${s.label}까지` });
      return;
    }
    // 50일 · 100일 · 돌 — 기념일 할 일(촬영 예약 같은)이 있는 아기 일정으로
    router.push({ pathname: '/todo', params: { cat: 'baby', at: String(Date.now()) } });
  };

  return (
    <ThemedView style={styles.container}>
      {focused && <StatusBar style="light" />}
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GrowthHero topInset={insets.top} days={dayNumber(baby.birthDate, now)} week={weekOf(days)} pose={poseOf(age.month)} stage={stage} onStop={openStop} />

        <View style={styles.body}>
          <TodayPlay birthDate={baby.birthDate} now={now} />
          {checks.length > 0 && <CheckCard birthDate={baby.birthDate} checkpoint={cp} checks={checks} />}
          <PrepCard rec={todoRecommend(place, age.month)} />
          <View style={[styles.list, { borderColor: c.border }]}>
            {/* 체크 항목이 아직 승인 전이면 카드 대신 단계 요약으로 가는 줄 */}
            {checks.length === 0 && (
              <Row icon="checkbox-outline" title="발달 체크" sub={`${cp}개월까지 대부분 하는 것`} onPress={() => router.push('/growth-check')} />
            )}
            <Row
              icon="book-outline"
              title="성장 일기"
              sub={last ? `D+${dayNumber(baby.birthDate, new Date(last.at))} · ${last.text}` : '처음 웃은 날을 적어 두세요'}
              divider={checks.length === 0}
              onPress={() => router.push('/memos')}
            />
            {common.length > 0 && (
              <Row icon="information-circle-outline" title="알아 두면 좋아요" sub={heads(common)} divider onPress={() => router.push('/growth-know')} />
            )}
          </View>
        </View>
      </ScrollView>
      {/* 아래로 넘긴 글이 상태 표시줄 밑으로 들어가도 시계가 보이게 */}
      <View style={[styles.statusStrip, { height: insets.top, backgroundColor: c.hero }]} />
      <AdBanner anchored />

      <KnowledgeSheet item={detail?.item ?? null} title={detail?.title ?? ''} sub={detail?.sub} onClose={() => setDetail(null)} />
    </ThemedView>
  );
}

function Row({
  icon,
  title,
  sub,
  right,
  divider = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub: string;
  right?: ReactNode;
  divider?: boolean;
  onPress: () => void;
}) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface }]}>
      {divider && <View style={[styles.divider, { backgroundColor: c.divider }]} />}
      <View style={[styles.icon, { backgroundColor: c.surface }]}>
        <Ionicons name={icon} size={20} color={c.text} />
      </View>
      <View style={styles.text}>
        <ThemedText type="body" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText type="small" style={{ color: c.textSecondary }} numberOfLines={1}>
          {sub}
        </ThemedText>
      </View>
      {right}
      <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.four },
  body: {
    paddingHorizontal: Gutter,
    paddingTop: 12,
    gap: 12,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0 },
  list: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, paddingHorizontal: 16 },
  divider: { position: 'absolute', top: 0, left: 70, right: 0, height: StyleSheet.hairlineWidth * 2 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontWeight: 700, fontSize: 16 },
});
