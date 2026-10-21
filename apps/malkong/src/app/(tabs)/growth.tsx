/**
 * 성장 탭 (SPEC-STAGE-01~03, task growth/004, decisions/031) — 지금 시기의 우리 아기.
 *
 * 위쪽 먹색 그림(growth-hero)에 태어난 지 며칠 · 몇 주차, 시기에 맞는 버디, 다음 발달 네 칸 막대.
 * 그 아래 카드 둘(다음 발달 · 우리 아기 메모)과 「이맘때」(해 주면 좋아요 · 잠 · 먹기, 세 줄까지).
 * 내용은 모두 승인된 공공 지식(L1, 미국 CDC)이다 — 블로그 · 커뮤니티 · 원더윅스는 쓰지 않는다(헌장 5).
 * 「이맘때」의 터미타임 · 책 읽어 주기는 그 자리에서 루틴에 추가할 수 있다.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdBanner } from '@/components/ad-banner';
import { GrowthHero } from '@/components/growth/growth-hero';
import { KnowledgeSheet } from '@/components/growth/knowledge-sheet';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { tap, type IconName } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { allItems, itemsForMonth, type KnowledgeItem } from '@/data/l1';
import { useMemos } from '@/data/memos-context';
import { ROUTINE_TEMPLATES, templateInput, titleKey, type RoutineTemplate } from '@/data/routine';
import { useRoutines } from '@/data/routines-context';
import { daysSince, nowItems, poseOf, splitTitle, stageWindow, weekOf, type StageStop } from '@/data/stage';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/** 「이맘때」 줄에서 바로 루틴으로 — L1 항목 → 루틴 추천 이름 */
const ROUTINE_OF: Record<string, string> = {
  'k-life-0001': '터미타임',
  'k-life-0002': '책 읽어 주기',
};

const KIND_ICON: Record<string, IconName> = {
  생활: 'happy-outline',
  수면: 'moon-outline',
  수유: 'nutrition-outline',
};

type Detail = { item: KnowledgeItem; title: string; sub: string | null; template: RoutineTemplate | null };

export default function GrowthScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { baby, age } = useBaby();
  const { memos } = useMemos();
  const { routines, addRoutine } = useRoutines();
  const now = useNow(false);
  const [detail, setDetail] = useState<Detail | null>(null);

  if (!baby || !age) return <ScreenLoading />;
  const days = daysSince(baby.birthDate, now);
  const stage = stageWindow(baby.birthDate, now);
  const items = allItems();
  const have = new Set(routines.map((r) => titleKey(r.title)));
  const templateOf = (item: KnowledgeItem) => {
    const name = ROUTINE_OF[item.id];
    return name ? (ROUTINE_TEMPLATES.find((t) => t.title === name) ?? null) : null;
  };
  const openStop = (s: StageStop) => {
    const item = s.l1Id ? items.find((i) => i.id === s.l1Id) : null;
    if (item) setDetail({ item, title: s.name, sub: `대부분 ${s.month}개월까지`, template: null });
  };
  const openItem = (item: KnowledgeItem) => {
    const { head, tail } = splitTitle(item.title);
    setDetail({ item, title: head, sub: tail, template: templateOf(item) });
  };
  const addTemplate = (t: RoutineTemplate) => {
    tap('success');
    void addRoutine(templateInput(t));
  };
  const next = stage.next ?? stage.stops[stage.stops.length - 1];
  const lastMemo = memos[0];
  const list = nowItems(itemsForMonth(age.month));
  const detailTemplate = detail?.template && !have.has(titleKey(detail.template.title)) ? detail.template : null;

  return (
    <ThemedView style={styles.container}>
      {focused && <StatusBar style="light" />}
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <GrowthHero topInset={insets.top} days={days} week={weekOf(days)} pose={poseOf(age.month)} stage={stage} onStop={openStop} />

        <View style={styles.body}>
          {/* 다음 발달 · 우리 아기 메모 (SPEC-STAGE-01 · 03) */}
          <View style={styles.cards}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tap();
                openStop(next);
              }}
              style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                {stage.next ? '다음 발달 ›' : '발달 ›'}
              </ThemedText>
              <ThemedText type="heading" style={styles.cardValue} numberOfLines={1}>
                {next.name}
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
                대부분 {next.month}개월까지
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tap();
                router.push('/memos');
              }}
              style={({ pressed }) => [styles.card, { backgroundColor: pressed ? c.surfaceStrong : c.surface }]}>
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                우리 아기 메모 ›
              </ThemedText>
              <ThemedText type="heading" style={styles.cardValue}>
                {memos.length}개
              </ThemedText>
              <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
                {lastMemo ? `마지막 · D+${daysSince(baby.birthDate, new Date(lastMemo.at))}` : '처음 웃은 날을 적어 두세요'}
              </ThemedText>
            </Pressable>
          </View>

          {/* 이맘때 (SPEC-STAGE-02) */}
          {list.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="body" style={styles.sectionTitle}>
                이맘때
              </ThemedText>
              <View style={[styles.list, { backgroundColor: c.surface }]}>
                {list.map((item, i) => {
                  const { head } = splitTitle(item.title);
                  const template = templateOf(item);
                  const added = template ? have.has(titleKey(template.title)) : false;
                  return (
                    // 「루틴에 추가」는 줄 버튼 안의 버튼이 되지 않게 옆에 둔다
                    <View
                      key={item.id}
                      style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.surfaceStrong }]}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          tap();
                          openItem(item);
                        }}
                        style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.6 }]}>
                        <View style={[styles.icon, { backgroundColor: c.background }]}>
                          <Ionicons name={KIND_ICON[item.kind] ?? 'ellipse-outline'} size={19} color={c.text} />
                        </View>
                        <View style={styles.flex}>
                          <ThemedText type="caption" style={{ color: item.label === '해 주면 좋아요' ? c.accentText : c.textSecondary, fontWeight: 700 }}>
                            {item.label}
                          </ThemedText>
                          <ThemedText type="body" style={{ fontWeight: 700 }} numberOfLines={2}>
                            {head}
                          </ThemedText>
                        </View>
                        {!(template && !added) && <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />}
                      </Pressable>
                      {template && !added && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${template.title} 루틴에 추가`}
                          hitSlop={6}
                          onPress={() => addTemplate(template)}
                          style={({ pressed }) => [styles.pill, { backgroundColor: c.ink, opacity: pressed ? 0.8 : 1 }]}>
                          <ThemedText type="caption" style={{ color: c.onInk, fontWeight: 700 }}>
                            루틴에 추가
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
      {/* 아래로 넘긴 글이 상태 표시줄 밑으로 들어가도 시계가 보이게 */}
      <View style={[styles.statusStrip, { height: insets.top, backgroundColor: c.hero }]} />
      <AdBanner anchored />

      <KnowledgeSheet
        item={detail?.item ?? null}
        title={detail?.title ?? ''}
        sub={detail?.sub}
        action={
          detailTemplate
            ? {
                label: `${detailTemplate.title} 루틴에 추가`,
                onPress: () => {
                  addTemplate(detailTemplate);
                  setDetail(null);
                },
              }
            : null
        }
        onClose={() => setDetail(null)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.four },
  body: {
    paddingHorizontal: Gutter,
    paddingTop: 18,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0 },
  cards: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 2 },
  cardValue: { fontWeight: 700 },
  section: { gap: 10 },
  sectionTitle: { fontWeight: 700, paddingHorizontal: 4 },
  list: { borderRadius: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 14 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 14 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 30, paddingHorizontal: 12, borderRadius: Radius.pill, justifyContent: 'center' },
});
