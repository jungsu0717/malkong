import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { KnowledgeGalaxy } from '@/components/knowledge-galaxy';
import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, IconButton, ListRow, SectionHeader, tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DEFAULT_BABY_NAME } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { topic } from '@/data/briefing';
import { useChat } from '@/data/chat-context';
import { useDraft } from '@/data/draft-context';
import {
  buildProfile,
  factValue,
  knowledgeGrowth,
  suggestions,
  type Domain,
  type DomainId,
} from '@/data/knowledge-profile';
import { useRecords } from '@/data/records-context';
import { useTheme } from '@/hooks/use-theme';

const GALAXY_HEIGHT = 360;

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
 * 우리 아기 탭 — 버디가 아는 우리 아기 (SPEC-BABY-01~06, decisions/013, task baby/001).
 * 지식 지도(3D) · 아는 정도 · 영역 · 한눈에 보는 프로필 · 알려 주면 좋아지는 것 · 함께 쌓아 온 것 · 기록.
 */
export default function BabyScreen() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { messages } = useChat();
  const { setDraft, requestFocus } = useDraft();
  const [selected, setSelected] = useState<DomainId | null>(null);
  /** 탭에 올 때마다 등장 모션을 다시 */
  const [visit, setVisit] = useState(0);
  const [focused, setFocused] = useState(false);
  const [openedAt] = useState(() => Date.now());
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
  const domain = profile.domains.find((d) => d.id === selected) ?? null;

  const askAbout = (prompt: string) => {
    tap();
    setDraft(prompt);
    requestFocus();
    router.navigate('/');
  };

  const questions = messages.filter((m) => m.role === 'user' && !m.meta.replyTo).length;
  const together = Math.max(1, Math.floor((openedAt - new Date(baby.createdAt).getTime()) / 86_400_000) + 1);
  const growth = knowledgeGrowth(records, baby.birthDate);
  const vaccines = factValue(profile, 'vaccines');
  const checkups = factValue(profile, 'checkups');

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

          {/* 지식 지도 — 아는 정도와 단계를 위에 겹쳐 둔다 (SPEC-BABY-01·02) */}
          <View style={[styles.galaxy, { backgroundColor: c.space }]}>
            <KnowledgeGalaxy
              replay={visit}
              active={focused}
              domains={profile.domains}
              selected={selected}
              onSelect={setSelected}
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

          {/* 영역 — 고르면 아는 것과 모르는 것 (SPEC-BABY-02 조작) */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.domainChips}>
            {profile.domains.map((d) => {
              const on = d.id === selected;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    tap();
                    setSelected(on ? null : d.id);
                  }}
                  style={[styles.domainChip, { backgroundColor: on ? c.ink : c.surface }]}>
                  <View style={[styles.colorDot, { backgroundColor: d.color }]} />
                  <ThemedText type="label" style={{ color: on ? c.onInk : c.text, fontWeight: 600 }}>
                    {d.name}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: on ? c.onInk : c.textSecondary }}>
                    {Math.round(d.score * 100)}%
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {domain ? (
            <DomainCard domain={domain} onAsk={askAbout} />
          ) : (
            <Card style={styles.bars}>
              {profile.domains.map((d) => (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  style={styles.barRow}
                  onPress={() => {
                    tap();
                    setSelected(d.id);
                  }}>
                  <ThemedText type="label" style={styles.barName}>
                    {d.name}
                  </ThemedText>
                  <View style={[styles.barTrack, { backgroundColor: c.surface }]}>
                    <View style={[styles.barFill, { backgroundColor: d.color, width: `${Math.max(3, d.score * 100)}%` }]} />
                  </View>
                  <ThemedText type="caption" style={[styles.barValue, { color: c.textSecondary }]}>
                    {Math.round(d.score * 100)}%
                  </ThemedText>
                </Pressable>
              ))}
            </Card>
          )}

          {/* 한눈에 보는 우리 아기 (SPEC-BABY-03) */}
          <View style={styles.section}>
            <SectionHeader title={`한눈에 보는 ${name}`} />
            <View style={styles.grid}>
              <Tile icon="trending-up-outline" label="몸무게" value={factValue(profile, 'weight')} onAsk={() => askAbout('오늘 몸무게는 ')} />
              <Tile icon="resize-outline" label="키" value={factValue(profile, 'height')} onAsk={() => askAbout('최근에 잰 키는 ')} />
              <Tile
                icon="nutrition-outline"
                label="먹기"
                value={factValue(profile, 'feed-type') ?? factValue(profile, 'feed-interval')}
                onAsk={() => askAbout('우리 아기는 수유를 ')}
              />
              <Tile
                icon="moon-outline"
                label="잠"
                value={factValue(profile, 'night') ?? factValue(profile, 'nap')}
                onAsk={() => askAbout('요즘 밤잠은 ')}
              />
              <Tile icon="medkit-outline" label="예방접종" value={vaccines ? `${vaccines} 완료` : null} ratio={vaccines} onAsk={() => router.navigate('/growth')} askLabel="성장 탭에서" />
              <Tile icon="clipboard-outline" label="영유아 검진" value={checkups ? `${checkups} 완료` : null} ratio={checkups} onAsk={() => router.navigate('/growth')} askLabel="성장 탭에서" />
            </View>
          </View>

          {/* 알려 주면 좋아지는 것 (SPEC-BABY-04) — 경고가 아니라 제안으로 */}
          {suggestions(profile).length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="알려 주면 더 정확해져요" />
              <Card style={styles.rows}>
                {suggestions(profile).map((f, i) => (
                  <ListRow
                    key={f.id}
                    divider={i > 0}
                    icon="sparkles-outline"
                    iconTone="accent"
                    title={f.label}
                    detail={f.benefit}
                    onPress={() => askAbout(f.prompt!)}
                  />
                ))}
              </Card>
            </View>
          )}

          {/* 함께 쌓아 온 것 (SPEC-BABY-05) */}
          <View style={styles.section}>
            <SectionHeader title="함께 쌓아 온 것" />
            <Card style={styles.together}>
              <View style={styles.stats}>
                <Stat value={together} unit="일" label="함께한 날" />
                <Stat value={questions} unit="번" label="나눈 질문" />
                <Stat value={records.length} unit="개" label="모은 기록" />
              </View>
              {growth.length >= 2 ? (
                <Sparkline points={growth} color={c.accent} />
              ) : (
                <ThemedText type="caption" style={{ color: c.textSecondary }}>
                  {topic(name)} 기록이 쌓이면 버디가 알게 된 흐름이 여기 그려져요
                </ThemedText>
              )}
            </Card>
          </View>

          <Card style={styles.rows}>
            <ListRow
              icon="document-text-outline"
              title="기록 전체 보기"
              detail={records.length > 0 ? `${records.length}건 · 고치거나 지울 수 있어요` : '대화와 챙길 것에서 모은 기록이 여기 쌓여요'}
              onPress={() => router.push('/records')}
            />
          </Card>

          <ThemedText type="caption" style={[styles.note, { color: c.textSecondary }]}>
            아는 정도는 이 기기에 저장된 기록만으로 세요. 서버로 보내지 않아요.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function DomainCard({ domain, onAsk }: { domain: Domain; onAsk: (prompt: string) => void }) {
  const c = useTheme();
  return (
    <Card style={styles.domainCard}>
      <View style={styles.domainHead}>
        <View style={[styles.colorDot, styles.bigDot, { backgroundColor: domain.color }]} />
        <ThemedText type="heading" style={styles.flex}>
          {domain.name}
        </ThemedText>
        <ThemedText type="heading" style={{ color: c.textSecondary }}>
          {Math.round(domain.score * 100)}%
        </ThemedText>
      </View>
      <View style={[styles.barTrack, { backgroundColor: c.surface }]}>
        <View style={[styles.barFill, { backgroundColor: domain.color, width: `${Math.max(3, domain.score * 100)}%` }]} />
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
            {!known && f.prompt && <Button label="알려 주기" size="sm" variant="secondary" onPress={() => onAsk(f.prompt!)} />}
          </View>
        );
      })}
    </Card>
  );
}

function Tile({
  icon,
  label,
  value,
  ratio,
  onAsk,
  askLabel = '알려 주기',
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | null;
  /** 「3 / 10」 — 작은 진행 막대 */
  ratio?: string | null;
  onAsk: () => void;
  askLabel?: string;
}) {
  const c = useTheme();
  const [done, total] = ratio ? ratio.split('/').map((n) => Number(n.trim())) : [0, 0];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={value && !ratio ? undefined : onAsk}
      style={[styles.tile, { backgroundColor: c.surface }]}>
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={16} color={c.textSecondary} />
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {label}
        </ThemedText>
      </View>
      <ThemedText type="body" style={{ fontWeight: 600, color: value ? c.text : c.textTertiary }} numberOfLines={2}>
        {value ?? '아직 몰라요'}
      </ThemedText>
      {ratio ? (
        <View style={[styles.barTrack, styles.tileBar, { backgroundColor: c.background }]}>
          <View style={[styles.barFill, { backgroundColor: c.accent, width: `${total ? Math.max(3, (done / total) * 100) : 0}%` }]} />
        </View>
      ) : (
        !value && (
          <ThemedText type="caption" style={{ color: c.accentText, fontWeight: 600 }}>
            {askLabel} →
          </ThemedText>
        )
      )}
    </Pressable>
  );
}

function Stat({ value, unit, label }: { value: number; unit: string; label: string }) {
  const c = useTheme();
  return (
    <View style={styles.stat}>
      <ThemedText type="title">
        {value}
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {unit}
        </ThemedText>
      </ThemedText>
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        {label}
      </ThemedText>
    </View>
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
  domainChips: { gap: 6, paddingVertical: 2 },
  domainChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, minHeight: 36 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  bigDot: { width: 12, height: 12, borderRadius: 6 },
  bars: { gap: 12 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  barName: { width: 36 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  barValue: { width: 36, textAlign: 'right' },
  domainCard: { gap: 10 },
  domainHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 1 },
  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.8%', flexGrow: 1, flexBasis: '45%', borderRadius: Radius.lg, padding: 14, gap: 6, minHeight: 96 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileBar: { flex: 0, marginTop: 2, height: 6 },
  rows: { paddingVertical: 2 },
  together: { gap: 14 },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, gap: 2 },
  note: { textAlign: 'center' },
});
