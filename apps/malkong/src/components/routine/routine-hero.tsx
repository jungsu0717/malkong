/**
 * 루틴 탭 위쪽 먹색 머리 (SPEC-MAIN-01, task today/004 · 시안 C) — 날짜 · 제목 · 보기 전환, 코랄 진행 고리,
 * 「3개 남았어요」 「다음 · 목욕 오후 8:00」, 그리고 다음 루틴을 바로 하는 큰 흰 단추 하나.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth } from '@/constants/theme';
import type { Routine } from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

export type RoutineView = 'grid' | 'timeline';

const RING = 100;
const STROKE = 10;
const R = (RING - STROKE) / 2 - 3;
const LENGTH = 2 * Math.PI * R;

export function RoutineHero({
  topInset,
  dateText,
  view,
  onView,
  ring,
  headline,
  sub,
  action,
  onAction,
}: {
  topInset: number;
  /** 「10월 20일 화요일 · 태어난 지 31일」 */
  dateText: string;
  view: RoutineView;
  onView: (v: RoutineView) => void;
  /** 오늘 할 루틴이 없으면 고리를 그리지 않는다 */
  ring: { done: number; total: number } | null;
  headline: string;
  sub: string | null;
  /** 큰 단추 — 다음 루틴과 그 이름표(「목욕 시작하기」 「비타민D 완료」) */
  action: { routine: Routine; label: string } | null;
  onAction: (routine: Routine) => void;
}) {
  const c = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: c.hero, paddingTop: topInset + 16 }]}>
      {/* 위로 당겨도 흰 바탕이 보이지 않게 */}
      <View style={[styles.overscroll, { backgroundColor: c.hero }]} />
      <View style={styles.inner}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <ThemedText type="small" style={{ color: c.onHeroDim }}>
              {dateText}
            </ThemedText>
            <ThemedText type="display" style={[styles.title, { color: c.onHero }]}>
              루틴
            </ThemedText>
          </View>
          <View style={[styles.toggle, { backgroundColor: c.heroTrack }]} accessibilityLabel="보기 전환">
            {(['grid', 'timeline'] as RoutineView[]).map((v) => {
              const on = view === v;
              return (
                <Pressable
                  key={v}
                  accessibilityRole="button"
                  accessibilityLabel={v === 'grid' ? '버튼 보기' : '시간순 보기'}
                  accessibilityState={{ selected: on }}
                  onPress={() => onView(v)}
                  style={[styles.toggleItem, on && { backgroundColor: c.heroTrack }]}>
                  <Ionicons name={v === 'grid' ? 'grid-outline' : 'list-outline'} size={17} color={on ? c.onHero : c.onHeroDim} />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.body}>
          {ring && (
            <View
              style={styles.ring}
              accessible
              accessibilityLabel={`오늘 루틴 ${ring.total}개 중 ${ring.done}개 완료`}>
              <Svg width={RING} height={RING} style={styles.ringSvg}>
                <Circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={c.heroTrack} strokeWidth={STROKE} />
                {ring.done > 0 && (
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={R}
                    fill="none"
                    stroke={c.heroAccent}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${(LENGTH * ring.done) / ring.total} ${LENGTH}`}
                  />
                )}
              </Svg>
              <View style={[StyleSheet.absoluteFill, styles.ringText]}>
                <View style={styles.ringRow}>
                  <ThemedText style={[styles.ringDone, { color: c.onHero }]}>{ring.done}</ThemedText>
                  <ThemedText type="body" style={[styles.ringTotal, { color: c.onHeroDim }]}>
                    /{ring.total}
                  </ThemedText>
                </View>
              </View>
            </View>
          )}
          <View style={[styles.flex, styles.texts]}>
            {ring && (
              <ThemedText type="label" style={{ color: c.onHeroDim, fontWeight: 600 }}>
                오늘 루틴
              </ThemedText>
            )}
            <ThemedText type="title" style={[styles.headline, { color: c.onHero }]}>
              {headline}
            </ThemedText>
            {sub && (
              <ThemedText type="label" style={{ color: c.onHeroDim }} numberOfLines={2}>
                {sub}
              </ThemedText>
            )}
          </View>
        </View>

        {action && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tap(action.routine.kind === 'check' && !action.routine.items?.length ? 'success' : 'light');
              onAction(action.routine);
            }}
            style={({ pressed }) => [styles.button, { backgroundColor: c.onHero, opacity: pressed ? 0.85 : 1 }]}>
            <RoutineIcon title={action.routine.title} kind={action.routine.kind} size={18} color={c.accent} />
            <ThemedText type="body" numberOfLines={1} style={[styles.buttonText, { color: c.hero }]}>
              {action.label}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 22, paddingHorizontal: Gutter },
  overscroll: { position: 'absolute', left: 0, right: 0, top: -1000, height: 1000 },
  inner: { gap: 18, width: '100%', maxWidth: MaxContentWidth - Gutter * 2, alignSelf: 'center' },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  title: { fontSize: 30, lineHeight: 38 },
  toggle: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 12 },
  toggleItem: { width: 38, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  ring: { width: RING, height: RING },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringText: { alignItems: 'center', justifyContent: 'center' },
  ringRow: { flexDirection: 'row', alignItems: 'baseline' },
  ringDone: { fontSize: 32, lineHeight: 40, fontWeight: 700, letterSpacing: -1 },
  ringTotal: { fontWeight: 600 },
  texts: { gap: 4 },
  headline: { fontSize: 24, lineHeight: 30 },
  button: { height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  buttonText: { fontWeight: 700, flexShrink: 1 },
});
