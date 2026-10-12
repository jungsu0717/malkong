import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BarChart, LineChart } from '@/components/log/charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Segmented } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { durationLabel, lastDays, usual } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { useTheme } from '@/hooks/use-theme';

type Tab = 'feed' | 'sleep' | 'diaper' | 'growth';

/**
 * 일주일 그래프 (SPEC-LOG-04) — 수유 · 잠 · 기저귀는 최근 7일 막대와 평소(지난날 평균) 점선, 키와 몸무게는 기록한 날마다 선.
 * 숫자로 정상 · 이상을 판정하지 않는다(헌장 2) — 걱정되면 버디에게 묻도록 잇는다.
 */
export default function LogStatsScreen() {
  const c = useTheme();
  const { events } = useEvents();
  const [tab, setTab] = useState<Tab>('feed');
  const days = useMemo(() => lastDays(events, 7), [events]);
  const avg = useMemo(() => usual(lastDays(events, 8)), [events]);
  const weights = events.filter((e) => e.kind === 'weight' && e.amount !== null).map((e) => ({ at: e.startAt, value: e.amount! }));
  const heights = events.filter((e) => e.kind === 'height' && e.amount !== null).map((e) => ({ at: e.startAt, value: e.amount! }));
  const bars = (pick: (d: (typeof days)[number]) => number) => days.map((d) => ({ label: d.weekday, value: pick(d), today: d.isToday }));

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Segmented
          options={[
            { value: 'feed', label: '수유' },
            { value: 'sleep', label: '잠' },
            { value: 'diaper', label: '기저귀' },
            { value: 'growth', label: '키 · 몸무게' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />

        {tab === 'feed' && (
          <>
            <ChartCard title="하루 수유 횟수" note={avg ? `평소 하루 ${Math.round(avg.feeds)}번` : null}>
              <BarChart bars={bars((d) => d.stats.feeds)} format={(v) => `${v}`} avg={avg?.feeds ?? null} />
            </ChartCard>
            <ChartCard title="하루 분유 양" note={avg && avg.formulaMl > 0 ? `평소 하루 ${Math.round(avg.formulaMl)}ml` : null}>
              <BarChart bars={bars((d) => Math.round(d.stats.formulaMl))} format={(v) => `${v}`} avg={avg?.formulaMl ?? null} />
            </ChartCard>
            <ChartCard title="하루 모유 시간" note={avg && avg.breastMin > 0 ? `평소 하루 ${durationLabel(avg.breastMin)}` : null}>
              <BarChart bars={bars((d) => Math.round(d.stats.breastMin))} format={(v) => `${v}분`} avg={avg?.breastMin ?? null} />
            </ChartCard>
          </>
        )}

        {tab === 'sleep' && (
          <ChartCard title="하루 잠" note={avg ? `평소 하루 ${durationLabel(avg.sleepMin)}` : null}>
            <BarChart
              bars={bars((d) => Math.round((d.stats.sleepMin / 60) * 10) / 10)}
              format={(v) => `${v}`}
              avg={avg ? avg.sleepMin / 60 : null}
            />
            <ThemedText type="caption" style={{ color: c.textTertiary }}>
              시간 단위 · 자정을 넘긴 잠은 날마다 나눠 셌어요
            </ThemedText>
          </ChartCard>
        )}

        {tab === 'diaper' && (
          <>
            <ChartCard title="하루 기저귀" note={avg ? `평소 하루 ${Math.round(avg.diapers)}번` : null}>
              <BarChart bars={bars((d) => d.stats.diapers)} format={(v) => `${v}`} avg={avg?.diapers ?? null} />
            </ChartCard>
            <ChartCard title="하루 대변" note={avg ? `평소 하루 ${Math.round(avg.poo * 10) / 10}번` : null}>
              <BarChart bars={bars((d) => d.stats.poo)} format={(v) => `${v}`} avg={avg?.poo ?? null} />
            </ChartCard>
          </>
        )}

        {tab === 'growth' && (
          <>
            <ChartCard title="몸무게" note={weights.length > 0 ? `${weights.length}번 기록` : null}>
              {weights.length > 0 ? (
                <LineChart points={weights} format={(v) => `${Number(v.toFixed(2))}kg`} />
              ) : (
                <Empty text="기록 탭의 「몸무게」로 남기면 여기에 이어져요" />
              )}
            </ChartCard>
            <ChartCard title="키" note={heights.length > 0 ? `${heights.length}번 기록` : null}>
              {heights.length > 0 ? (
                <LineChart points={heights} format={(v) => `${Number(v.toFixed(1))}cm`} />
              ) : (
                <Empty text="기록 탭의 「키」로 남기면 여기에 이어져요" />
              )}
            </ChartCard>
          </>
        )}

        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          점선은 지난 며칠 가운데 기록한 날의 평균이에요. 숫자로 괜찮은지 판단해 드리지는 않아요. 걱정되면 버디에게 물어보세요.
        </ThemedText>
        <Button label="버디에게 물어보기" variant="secondary" icon="chatbubble-ellipses-outline" onPress={() => router.navigate('/chat')} />
      </ScrollView>
    </ThemedView>
  );
}

function ChartCard({ title, note, children }: { title: string; note: string | null; children: React.ReactNode }) {
  const c = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.cardHead}>
        <ThemedText type="heading">{title}</ThemedText>
        {note && (
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {note}
          </ThemedText>
        )}
      </View>
      {children}
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  const c = useTheme();
  return (
    <ThemedText type="small" style={{ color: c.textSecondary, paddingVertical: Spacing.three, textAlign: 'center' }}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Gutter,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { gap: Spacing.three },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
