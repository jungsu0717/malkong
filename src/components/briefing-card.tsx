/**
 * 아침 브리핑 카드 (SPEC-HOME-06, task home/004) — 대화의 하루 첫 메시지와 보관함이 같이 쓴다.
 * 했는지는 저장된 목록이 아니라 지금의 기록(L2)으로 센다 — 어디서 완료해도 같은 모습이 보인다.
 */

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { ageFrom } from '@/data/baby';
import { useBaby } from '@/data/baby-context';
import { whenText, type BriefingItem, type BriefingTodo } from '@/data/briefing';
import type { MalkongMessage } from '@/data/chat';
import { itemById } from '@/data/l1';
import type { BabyRecord } from '@/data/records';
import { useRecords } from '@/data/records-context';
import type { GapGroup, L1Item } from '@/data/timeline';
import { useTheme } from '@/hooks/use-theme';

const ICONS: Record<string, IconName> = {
  접종: 'medkit-outline',
  검진: 'clipboard-outline',
  수면: 'moon-outline',
  수유: 'nutrition-outline',
  안전: 'shield-checkmark-outline',
  생활: 'happy-outline',
  발달: 'footsteps-outline',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function groupOf(todo: BriefingTodo): GapGroup {
  return {
    key: todo.key,
    status: todo.status,
    month: todo.month,
    label: todo.label,
    items: todo.itemIds.map((id) => itemById(id)).filter((i): i is L1Item => !!i),
  };
}

function isDone(todo: BriefingTodo, records: BabyRecord[]): boolean {
  const covered = new Set(records.flatMap((r) => r.covers));
  return todo.itemIds.every((id) => covered.has(id));
}

export function BriefingCard({
  message,
  today,
  onPick,
  onPrompt,
  justSaved,
  onUndo,
}: {
  message: MalkongMessage;
  /** 오늘 것이면 큰 인사와 함께, 지난 것은 날짜 머리만 */
  today: boolean;
  onPick: (group: GapGroup) => void;
  /** 상태 확인 줄을 누르면 입력창에 담을 말 */
  onPrompt?: (text: string) => void;
  justSaved?: BabyRecord | null;
  onUndo?: () => void;
}) {
  const c = useTheme();
  const { baby } = useBaby();
  const { records } = useRecords();
  if (message.meta.type !== 'briefing' || !baby) return null;
  const { greeting, headline, items } = message.meta;
  const made = new Date(message.createdAt);
  const { month } = ageFrom(baby.birthDate, made);
  const date = `${made.getMonth() + 1}월 ${made.getDate()}일 ${WEEKDAYS[made.getDay()]}요일`;
  // 상태 확인(몸무게)은 그날만 묻는다 — 지난 브리핑에서 다시 누를 일은 없다
  const shown = today ? items : items.filter((i) => i.kind === 'todo');

  const row = (item: BriefingItem, index: number) => {
    if (item.kind === 'check') {
      return (
        <ListRow
          key={item.key}
          divider={index > 0}
          icon="trending-up-outline"
          title={item.label}
          detail={item.detail}
          onPress={onPrompt ? () => onPrompt(item.prompt) : undefined}
        />
      );
    }
    const done = isDone(item, records);
    const when = whenText(item, baby.birthDate, ageFrom(baby.birthDate).month);
    const verb = item.life ? '확인' : '완료';
    return (
      <ListRow
        key={item.key}
        divider={index > 0}
        icon={done ? 'checkmark' : (ICONS[item.category] ?? 'ellipse-outline')}
        iconTone={item.status === 'soon' && !done ? 'accent' : 'neutral'}
        title={item.label}
        detail={done ? `${verb}했어요` : when.text}
        muted={done}
        onPress={done ? undefined : () => onPick(groupOf(item))}
        right={
          done ? null : when.dday !== null ? (
            <ThemedText type="label" style={{ color: c.accentText, fontWeight: 700 }}>
              {when.dday === 0 ? '오늘' : `D-${when.dday}`}
            </ThemedText>
          ) : (
            <Button label={verb} size="sm" variant="secondary" onPress={() => onPick(groupOf(item))} />
          )
        }
      />
    );
  };

  return (
    <View style={styles.wrap}>
      {today ? (
        <View style={styles.hello}>
          <ThemedText type="display" style={styles.greeting}>
            {greeting}.{'\n'}
            {headline}
          </ThemedText>
          <ThemedText type="small" style={{ color: c.textSecondary }}>
            {date} · 만 {month}개월
          </ThemedText>
        </View>
      ) : null}
      <Card style={styles.card}>
        <View style={styles.head}>
          <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
            {today ? '오늘의 브리핑' : `${made.getMonth() + 1}월 ${made.getDate()}일 브리핑`}
          </ThemedText>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            {today ? '말콩이가 정리했어요' : headline}
          </ThemedText>
        </View>
        {shown.length > 0 ? (
          shown.map(row)
        ) : (
          <ThemedText type="small" style={[styles.empty, { color: c.textSecondary }]}>
            지금은 챙길 게 없어요. 궁금한 게 생기면 언제든 물어보세요
          </ThemedText>
        )}
        {justSaved && (
          <View style={[styles.saved, { backgroundColor: c.surface }]}>
            <ThemedText type="caption" style={{ flex: 1 }}>
              「{justSaved.label}」로 기록했어요
            </ThemedText>
            {onUndo && (
              <Pressable onPress={onUndo} hitSlop={8} accessibilityRole="button">
                <ThemedText type="label" style={{ fontWeight: 700 }}>
                  되돌리기
                </ThemedText>
              </Pressable>
            )}
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.three },
  hello: { gap: 6, paddingTop: Spacing.two },
  greeting: { fontSize: 26, lineHeight: 35 },
  card: { paddingVertical: 4 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: 10,
    paddingBottom: 4,
  },
  empty: { paddingVertical: 12 },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
});
