import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { questionCount, togetherLine } from '@/components/baby/knowledge-view';
import { KnowledgeGalaxy } from '@/components/knowledge-galaxy';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, IconButton, ListRow } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { useChat } from '@/data/chat-context';
import { buildProfile } from '@/data/knowledge-profile';
import { useRecords } from '@/data/records-context';
import { useTheme } from '@/hooks/use-theme';

const GALAXY_HEIGHT = 330;

/** 0 에서 목표까지 숫자가 올라가는 짧은 등장(SPEC-BABY-02 처음) */
function useCountUp(target: number, replay: number, duration = 1300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, replay, duration]);
  return value;
}

/**
 * 우리 아기 탭 — 버디가 아는 우리 아기 (SPEC-BABY-01~07, decisions/013, task baby/001 · 003 · 004, home/011).
 * 탭에는 한눈 요약만: 지식 지도(아는 정도 · 단계 — 누르면 「버디가 아는 것」 `/knowledge`, 행성은 그 주제로) · 함께한 시간 한 줄 ·
 * 한눈에 보는 아기 `/profile` 한 줄. 적는 메뉴는 두지 않는다 — 하루 기록은 오늘 브리핑에서, 알려 주기는 상세와 대화의
 * 되묻기에서. 기록 전체는 「버디가 아는 것」 안에(2026-10-06 Julian).
 */
export default function BabyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { messages } = useChat();
  /** 탭에 올 때마다 등장 모션을 다시 */
  const [visit, setVisit] = useState(0);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setVisit((v) => v + 1);
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const profile = useMemo(() => (baby ? buildProfile(baby, records) : null), [baby, records]);
  const shown = useCountUp(profile?.percent ?? 0, visit);

  if (!baby || !age || !profile) return <ScreenLoading />;
  const name = baby.name ?? DEFAULT_BABY_NAME;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <ThemedText type="display">{name}</ThemedText>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                태어난 지 {age.days}일 · 만 {age.month}개월
              </ThemedText>
            </View>
            <IconButton icon="create-outline" label="아기 정보 고치기" onPress={() => router.push('/onboarding?edit=1')} />
          </View>

          {/* 지식 지도 — 아는 정도와 단계를 위에 겹쳐 둔다 (SPEC-BABY-01·02). 행성을 누르면 그 영역의 상세로 */}
          <View style={styles.section}>
            <View style={[styles.galaxy, { backgroundColor: c.space }]}>
              <KnowledgeGalaxy
                replay={visit}
                active={focused}
                domains={profile.domains}
                selected={null}
                // 행성은 그 주제로, 빈 자리는 전체로 — 지도가 곧 「버디가 아는 것」의 입구다
                onSelect={(id) => router.push(id ? { pathname: '/knowledge', params: { domain: id } } : '/knowledge')}
                height={GALAXY_HEIGHT}
                coreColor={c.accent}
              />
              <View pointerEvents="none" style={styles.overlayTop}>
                <ThemedText type="label" style={{ color: c.onSpaceDim }}>
                  버디가 아는 {name}
                </ThemedText>
                <ThemedText style={[styles.percent, { color: c.onSpace }]}>{shown}%</ThemedText>
                <View style={styles.levelChip}>
                  <ThemedText type="caption" style={{ color: c.onSpace, fontWeight: 600 }}>
                    Lv.{profile.level.step} · {profile.level.step === 5 ? `${name} ${profile.level.name}` : profile.level.name}
                  </ThemedText>
                </View>
              </View>
              <View pointerEvents="none" style={styles.overlayBottom}>
                <View style={styles.legend}>
                  <View style={[styles.dotFilled, { backgroundColor: c.onSpace }]} />
                  <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                    알게 된 것 {profile.knownCount}
                  </ThemedText>
                  <View style={[styles.dotHollow, { borderColor: c.onSpaceDim }]} />
                  <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                    알아 갈 것 {profile.totalCount - profile.knownCount}
                  </ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                  누르면 자세히 · 행성을 누르면 그 주제로
                </ThemedText>
              </View>
            </View>
            {/* 함께한 시간 (SPEC-BABY-05) — 숫자 칸 대신 한 문장 */}
            <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
              {togetherLine(baby.createdAt, questionCount(messages), records.length)}
            </ThemedText>
          </View>

          {/* 한눈에 보는 아기 — 최근 값 한 화면 (SPEC-BABY-03). 기록 전체는 「버디가 아는 것」 상세 안에 */}
          <Card style={styles.rows}>
            <ListRow
              icon="person-outline"
              title={`한눈에 보는 ${name}`}
              detail="몸무게 · 키 · 먹기 · 잠 · 접종 · 검진"
              onPress={() => router.push('/profile')}
            />
          </Card>

          <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
            이 숫자는 이 폰에 저장된 기록으로만 계산해요. 서버로 보내지 않아요.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
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
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  galaxy: { borderRadius: 24, overflow: 'hidden', height: GALAXY_HEIGHT },
  overlayTop: { position: 'absolute', top: 18, left: 20, gap: 2 },
  percent: { fontSize: 44, lineHeight: 52, fontWeight: 700, letterSpacing: -1.5 },
  levelChip: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  overlayBottom: { position: 'absolute', left: 20, right: 20, bottom: 14, gap: 4 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dotFilled: { width: 8, height: 8, borderRadius: 4 },
  dotHollow: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.2, marginLeft: 8 },
  section: { gap: 10 },
  rows: { paddingVertical: 2 },
  center: { textAlign: 'center' },
});
