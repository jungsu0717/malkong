import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BarChart, LineChart } from '@/components/log/charts';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Card, Segmented } from '@/components/ui';
import { Gutter, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBaby } from '@/data/baby-context';
import { durationLabel, lastDays, usual } from '@/data/event-summary';
import { useEvents } from '@/data/events-context';
import { itemById } from '@/data/l1';
import { useTheme } from '@/hooks/use-theme';

type Tab = 'feed' | 'sleep' | 'diaper' | 'growth';

/**
 * 기준표에 쓰는 L1 항목(SPEC-LOG-04) — 승인된 것만 나온다(itemById 는 승인 항목만 안다). 월령에 맞는 것만.
 * 수유는 월령별 하루 양이 공공 자료에 없어 횟수 · 간격 기준을 보인다
 */
const NORMS: { label: string; ids: string[]; warn?: boolean }[] = [
  { label: '수유', ids: ['k-feed-0001', 'k-feed-0002', 'k-feed-0201', 'k-feed-0604'] },
  { label: '잠', ids: ['k-sleep-0006', 'k-sleep-0401', 'k-sleep-1201'] },
  // 기저귀는 기준이 아니라 바로 진료가 필요한 신호(탈수)를 보인다
  { label: '기저귀', ids: ['k-warn-0006'], warn: true },
];

function normsFor(month: number) {
  return NORMS.map((n) => ({
    label: n.label,
    warn: n.warn ?? false,
    items: n.ids.map((id) => itemById(id)).filter((i) => i !== undefined && i.months.includes(month)),
  }));
}

/** 잠 기준의 시간 범위 — 「하루 12~16시간」 → [12, 16] */
function sleepBand(month: number): [number, number] | null {
  for (const item of normsFor(month).find((n) => n.label === '잠')?.items ?? []) {
    const m = item!.title.match(/(\d+)~(\d+)시간/);
    if (m) return [Number(m[1]), Number(m[2])];
  }
  return null;
}

/**
 * 일주일 그래프 (SPEC-LOG-04) — 수유 · 잠 · 기저귀는 최근 7일 막대와 평소(지난날 평균) 점선, 키와 몸무게는 기록한 날마다 선.
 * 숫자로 정상 · 이상을 판정하지 않는다(헌장 2) — 걱정되면 버디에게 묻도록 잇는다.
 */
export default function LogStatsScreen() {
  const c = useTheme();
  const { events } = useEvents();
  const { age } = useBaby();
  const month = age?.month ?? 0;
  const [tab, setTab] = useState<Tab>('feed');
  const days = useMemo(() => lastDays(events, 7), [events]);
  const avg = useMemo(() => usual(lastDays(events, 8)), [events]);
  const weights = events.filter((e) => e.kind === 'weight' && e.amount !== null).map((e) => ({ at: e.startAt, value: e.amount! }));
  const heights = events.filter((e) => e.kind === 'height' && e.amount !== null).map((e) => ({ at: e.startAt, value: e.amount! }));
  const bars = (pick: (d: (typeof days)[number]) => number) => days.map((d) => ({ label: d.weekday, value: pick(d), today: d.isToday }));

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Standards month={month} />
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
              band={sleepBand(month)}
            />
            <ThemedText type="caption" style={{ color: c.textTertiary }}>
              시간 단위 · 자정을 넘긴 잠은 날마다 나눠 셌어요{sleepBand(month) ? ' · 옅은 띠는 이 월령의 공공 기준' : ''}
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

/** 이 월령의 기준표 — 맨 위(SPEC-LOG-04). 공공 기준이 없는 칸은 없다고 말한다 */
function Standards({ month }: { month: number }) {
  const c = useTheme();
  const rows = normsFor(month);
  return (
    <Card tone="filled" style={styles.standards}>
      <ThemedText type="heading">{month === 0 ? '첫 달' : `${month}개월`} 기준</ThemedText>
      {rows.map((row) => (
        <View key={row.label} style={styles.normRow}>
          <ThemedText type="label" style={[styles.normLabel, { color: c.textSecondary }]}>
            {row.label}
          </ThemedText>
          <View style={styles.normBody}>
            {row.items.length === 0 ? (
              <ThemedText type="small" style={{ color: c.textTertiary }}>
                이 월령의 공공 기준은 아직 없어요
              </ThemedText>
            ) : (
              row.items.map((item) => (
                <View key={item!.id} style={styles.normItem}>
                  {row.warn && (
                    <ThemedText type="caption" style={{ color: c.danger, fontWeight: 600 }}>
                      이럴 땐 바로 진료
                    </ThemedText>
                  )}
                  <ThemedText type="small" style={{ fontWeight: 600 }}>
                    {item!.title}
                  </ThemedText>
                  <ExternalLink href={item!.source.url as `https://${string}`}>
                    <ThemedText type="caption" style={{ color: c.textSecondary, textDecorationLine: 'underline' }}>
                      {item!.source.name}
                    </ThemedText>
                  </ExternalLink>
                </View>
              ))
            )}
          </View>
        </View>
      ))}
      <ThemedText type="caption" style={{ color: c.textTertiary }}>
        키 · 몸무게 기준(성장 도표)은 아직 없어요. 영유아 검진 때 함께 봐요.
      </ThemedText>
    </Card>
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
  standards: { gap: 10 },
  normRow: { flexDirection: 'row', gap: Spacing.two },
  normLabel: { width: 44, fontWeight: 600, paddingTop: 2 },
  normBody: { flex: 1, gap: 6 },
  normItem: { gap: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
