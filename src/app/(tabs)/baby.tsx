import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { questionCount, togetherLine } from '@/components/baby/knowledge-view';
import { KnowledgeGalaxy } from '@/components/knowledge-galaxy';
import { LOG_ICONS } from '@/components/record-nudge-card';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, IconButton, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { useChat } from '@/data/chat-context';
import { DAILY_LOGS, latestLog, valueOf, writtenAgo } from '@/data/daily-log';
import { buildProfile, suggestions, type Fact } from '@/data/knowledge-profile';
import { useRecords } from '@/data/records-context';
import { useQuickAsk } from '@/hooks/use-quick-ask';
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
 * 우리 아기 탭 — 버디가 아는 우리 아기 (SPEC-BABY-01~07, decisions/013, task baby/001 · 003 · 004).
 * 탭에는 한눈 요약과 바로 할 행동만: 지식 지도(아는 정도 · 단계) · 함께한 시간 한 줄 · 알려 주면 좋아지는 것 · 하루 기록 ·
 * 더 보기(버디가 아는 것 `/knowledge` · 한눈에 보는 아기 `/profile` · 기록 전체 `/records`). 자세한 것은 상세 화면에서.
 */
export default function BabyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { messages } = useChat();
  // 「알려 주기」는 대화 탭으로 넘어가지 않고 이 자리에서 묻는다(task baby/002)
  const { ask, sheet } = useQuickAsk();
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

  const askFact = (fact: Fact) => {
    if (!fact.ask) return;
    tap();
    ask(fact.ask, fact.record, fact.value);
  };
  const suggested = suggestions(profile);

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
                onSelect={(id) => {
                  if (id) router.push({ pathname: '/knowledge', params: { domain: id } });
                }}
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
                    아는 것 {profile.knownCount}
                  </ThemedText>
                  <View style={[styles.dotHollow, { borderColor: c.onSpaceDim }]} />
                  <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                    아직 모르는 것 {profile.totalCount - profile.knownCount}
                  </ThemedText>
                </View>
                <ThemedText type="caption" style={{ color: c.onSpaceDim }}>
                  끌어서 돌리고, 행성을 눌러 보세요
                </ThemedText>
              </View>
            </View>
            {/* 함께한 시간 (SPEC-BABY-05) — 숫자 칸 대신 한 문장 */}
            <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
              {togetherLine(baby.createdAt, questionCount(messages), records.length)}
            </ThemedText>
          </View>

          {/* 알려 주면 좋아지는 것 (SPEC-BABY-04) — 경고가 아니라 제안으로 */}
          {suggested.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="알려 주면 더 정확해져요" />
              <Card style={styles.rows}>
                {suggested.map((f, i) => (
                  <ListRow
                    key={f.id}
                    divider={i > 0}
                    icon="sparkles-outline"
                    iconTone="accent"
                    title={f.label}
                    detail={f.benefit}
                    onPress={() => askFact(f)}
                  />
                ))}
              </Card>
            </View>
          )}

          {/* 하루 기록 (SPEC-BABY-07) — 매일이 아니어도 생각날 때. 며칠 비면 버디가 카드로 한 번 묻는다 */}
          <View style={styles.section}>
            <SectionHeader title="하루 기록" aside="생각날 때 적어요" />
            <Card style={styles.rows}>
              {DAILY_LOGS.map((def, i) => {
                const last = latestLog(def, records);
                return (
                  <ListRow
                    key={def.key}
                    divider={i > 0}
                    icon={LOG_ICONS[def.key]}
                    title={def.title}
                    detail={last ? `${valueOf(def, last)} · ${writtenAgo(last)} 적음` : def.hint}
                    right={<Button label="적기" size="sm" variant="secondary" onPress={() => ask(def)} />}
                  />
                );
              })}
            </Card>
          </View>

          {/* 더 보기 — 자세한 것은 상세 화면에서 (task baby/004) */}
          <View style={styles.section}>
            <SectionHeader title="더 보기" />
            <Card style={styles.rows}>
              <ListRow
                icon="planet-outline"
                title="버디가 아는 것"
                detail={`영역별로 · 아는 것 ${profile.knownCount} / ${profile.totalCount}`}
                onPress={() => router.push('/knowledge')}
              />
              <ListRow
                divider
                icon="person-outline"
                title={`한눈에 보는 ${name}`}
                detail="몸무게 · 키 · 먹기 · 잠 · 접종 · 검진"
                onPress={() => router.push('/profile')}
              />
              <ListRow
                divider
                icon="document-text-outline"
                title="기록 전체 보기"
                detail={records.length > 0 ? `${records.length}건 · 고치거나 지울 수 있어요` : '대화와 챙길 것에서 모은 기록이 여기 쌓여요'}
                onPress={() => router.push('/records')}
              />
            </Card>
          </View>

          <ThemedText type="caption" style={[styles.center, { color: c.textSecondary }]}>
            아는 정도는 이 기기에 저장된 기록만으로 세요. 서버로 보내지 않아요.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
      {sheet}
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
