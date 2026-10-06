/**
 * 「한눈에 보는 우리 아기」 상세 (SPEC-BABY-03, task baby/004) — 몸무게 · 키 · 먹기 · 잠 · 접종 · 검진 타일.
 * 모르는 칸은 누르면 그 자리에서 묻는다(SPEC-BABY-04). 접종 · 검진은 일정 탭에서 완료를 알린다. 하루 기록은 오늘 브리핑에서.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenLoading } from '@/components/screen-loading';
import { ThemedText } from '@/components/themed-text';
import { tap } from '@/components/ui';
import { Gutter, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { buildProfile, factOf, factValue, type Fact } from '@/data/knowledge-profile';
import { useRecords } from '@/data/records-context';
import { useQuickAsk } from '@/hooks/use-quick-ask';
import { useTheme } from '@/hooks/use-theme';

export function ProfileView() {
  const c = useTheme();
  const { baby, age } = useBaby();
  const { records } = useRecords();
  const { ask, sheet } = useQuickAsk();
  const profile = useMemo(() => (baby ? buildProfile(baby, records) : null), [baby, records]);
  if (!baby || !age || !profile) return <ScreenLoading />;

  const askFact = (fact: Fact | null) => {
    if (!fact?.ask) return;
    tap();
    ask(fact.ask, fact.record, fact.value);
  };
  /** 묶인 칸(수유 · 잠) — 아직 모르는 것부터 묻는다 */
  const askFirst = (...ids: string[]) => {
    const facts = ids.map((id) => factOf(profile, id));
    askFact(facts.find((f) => f && f.score === 0) ?? facts[0]);
  };
  const vaccines = factValue(profile, 'vaccines');
  const checkups = factValue(profile, 'checkups');

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          {baby.birthDate.replace(/-/g, '. ')}생 · 태어난 지 {age.days}일 · 만 {age.month}개월
        </ThemedText>
        <View style={styles.grid}>
          <Tile icon="trending-up-outline" label="몸무게" value={factValue(profile, 'weight')} onAsk={() => askFirst('weight')} />
          <Tile icon="resize-outline" label="키" value={factValue(profile, 'height')} onAsk={() => askFirst('height')} />
          <Tile
            icon="nutrition-outline"
            label="먹기"
            value={factValue(profile, 'feed-type') ?? factValue(profile, 'feed-interval')}
            onAsk={() => askFirst('feed-type', 'feed-interval')}
          />
          <Tile
            icon="moon-outline"
            label="잠"
            value={factValue(profile, 'night') ?? factValue(profile, 'nap')}
            onAsk={() => askFirst('night', 'nap')}
          />
          <Tile
            icon="medkit-outline"
            label="예방접종"
            value={vaccines ? `${vaccines} 완료` : null}
            ratio={vaccines}
            onAsk={() => router.navigate('/schedule')}
            askLabel="일정 탭에서"
          />
          <Tile
            icon="clipboard-outline"
            label="영유아 검진"
            value={checkups ? `${checkups} 완료` : null}
            ratio={checkups}
            onAsk={() => router.navigate('/schedule')}
            askLabel="일정 탭에서"
          />
        </View>
        <ThemedText type="caption" style={[styles.note, { color: c.textSecondary }]}>
          적어 둔 기록에서 찾은 값이에요. 비어 있는 칸은 눌러서 알려 주세요
        </ThemedText>

      </ScrollView>
      {sheet}
    </>
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
        <View style={[styles.barTrack, { backgroundColor: c.background }]}>
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

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.8%', flexGrow: 1, flexBasis: '45%', borderRadius: Radius.lg, padding: 14, gap: 6, minHeight: 96 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  barTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  barFill: { height: '100%', borderRadius: 3 },
  note: { textAlign: 'center' },
});
