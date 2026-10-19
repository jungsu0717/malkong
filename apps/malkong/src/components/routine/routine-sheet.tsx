/**
 * 루틴 추가 · 편집 (SPEC-MAIN-03 · 05 · 06, task today/002 · 003) — 이름, 종류(체크 / 타이머 / 재고 확인), 반복(매일 / N일마다), 알림 시각,
 * 목표 분(타이머), 단계(체크, 선택) · 확인할 물건(재고 확인), 삭제.
 * 추가할 때는 위에 추천(목욕 · 터미타임 …)이 버튼으로 다 보이고, 누르면 바로 추가된다(이미 있는 것은 체크 표시).
 * 아래 「직접 추가」 칸에 이름을 적지 않았으면 아래 단추는 「완료」(닫기)다.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoutineIcon } from '@/components/routine/routine-icon';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import {
  STOCK_ITEMS,
  isTime,
  timeLabel,
  type Routine,
  type RoutineInput,
  type RoutineKind,
  type RoutineTemplate,
} from '@/data/routine';
import { useTheme } from '@/hooks/use-theme';

const EVERY: { days: number; label: string }[] = [
  { days: 1, label: '매일' },
  { days: 2, label: '2일마다' },
  { days: 3, label: '3일마다' },
];
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const TEMPLATE_COLUMNS = 4;
/** 단계는 여덟 개, 확인할 물건은 스무 개까지 */
const MAX_ITEMS: Record<RoutineKind, number> = { check: 8, stock: 20, minutes: 0 };
const KIND_HINT: Record<RoutineKind, string> = {
  check: '누르면 완료로 바뀌고, 완료한 시각이 기록돼요',
  minutes: '타이머나 +1분 단추로 오늘 한 시간이 기록돼요',
  stock: '물건마다 충분 · 부족을 고르면 부족한 것이 장보기에 추가돼요',
};
const TEMPLATE_GAP = 8;
const TIMES = ['08:00', '13:00', '19:00'];

export function RoutineSheet({
  open,
  routine,
  existingTitles,
  onClose,
  onSave,
  templates,
  onQuickAdd,
  onMore,
  onSkip,
  skippedToday = false,
  onDelete,
}: {
  open: boolean;
  /** 편집할 루틴 — 없으면 추가 */
  routine: Routine | null;
  existingTitles: string[];
  onClose: () => void;
  onSave: (input: RoutineInput) => void;
  /** 지금 시기의 추천(SPEC-MAIN-03 · 07) */
  templates: RoutineTemplate[];
  /** 추천 버튼 — 누르면 바로 추가(시트는 열린 채로) */
  onQuickAdd: (t: RoutineTemplate) => void;
  /** 「시기별 추천 전체 보기」 */
  onMore: () => void;
  /** 편집할 때 — 「오늘은 건너뛰기」 ↔ 「건너뛰기 취소」 */
  onSkip?: () => void;
  skippedToday?: boolean;
  onDelete?: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(routine?.title ?? '');
  const [kind, setKind] = useState<RoutineKind>(routine?.kind ?? 'check');
  const [everyText, setEveryText] = useState(String(routine?.everyDays ?? 1));
  /** 요일 반복 — 비어 있으면 N일마다 */
  const [weekdays, setWeekdays] = useState<number[]>(routine?.weekdays ?? []);
  const byWeekday = weekdays.length > 0;
  const [timeText, setTimeText] = useState(routine?.time ?? '');
  const [goalText, setGoalText] = useState(routine?.goalMinutes ? String(routine.goalMinutes) : '');
  const [items, setItems] = useState<string[]>(routine?.items ?? []);
  // 종류를 바꾸면 단계 · 물건 목록도 그 종류의 처음 것으로 — 원래 종류로 돌아오면 원래 목록
  const changeKind = (k: RoutineKind) => {
    setKind(k);
    if (routine && routine.kind === k) setItems(routine.items ?? []);
    else setItems(k === 'stock' ? STOCK_ITEMS : []);
  };
  const cleaned = items.map((x) => x.trim()).filter(Boolean).slice(0, MAX_ITEMS[kind]);

  const everyDays = Number(everyText);
  const everyOk = byWeekday || (Number.isInteger(everyDays) && everyDays >= 1 && everyDays <= 365);
  const timeOk = !timeText.trim() || isTime(timeText);
  const goal = Number(goalText);
  const goalOk = !goalText.trim() || (Number.isInteger(goal) && goal >= 1 && goal <= 600);
  const have = new Set(existingTitles.map((t) => t.replace(/\s+/g, '')));
  const added = (t: RoutineTemplate) => have.has(t.title.replace(/\s+/g, ''));
  const canSave = !!title.trim() && everyOk && timeOk && goalOk && (kind !== 'stock' || cleaned.length > 0);
  // 추가 화면에서 이름을 비워 두면 아래 단추는 닫기
  const closeOnly = !routine && !title.trim();
  const [gridWidth, setGridWidth] = useState(0);
  const templateWidth = gridWidth ? Math.floor((gridWidth - TEMPLATE_GAP * (TEMPLATE_COLUMNS - 1)) / TEMPLATE_COLUMNS) : 0;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <ThemedText type="title">{routine ? '루틴 편집' : '루틴 추가'}</ThemedText>

            {!routine && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  추천
                </ThemedText>
                <View style={styles.templates} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
                  {templateWidth > 0 &&
                    templates.map((t) => {
                      const on = added(t);
                      return (
                        <Pressable
                          key={t.title}
                          accessibilityRole="button"
                          accessibilityLabel={on ? `${t.title}, 추가됨` : `${t.title} 추가`}
                          accessibilityState={{ disabled: on }}
                          disabled={on}
                          onPress={() => {
                            tap('success');
                            onQuickAdd(t);
                          }}
                          style={({ pressed }) => [styles.template, { width: templateWidth, opacity: pressed ? 0.6 : 1 }]}>
                          <View>
                            <View style={[styles.templateCircle, { backgroundColor: on ? c.ink : c.surface }]}>
                              <RoutineIcon title={t.title} kind={t.kind} size={24} color={on ? c.onInk : c.text} />
                            </View>
                            <View style={[styles.badge, { backgroundColor: on ? c.accent : c.ink, borderColor: c.background }]}>
                              <Ionicons name={on ? 'checkmark' : 'add'} size={12} color={c.onInk} />
                            </View>
                          </View>
                          <ThemedText type="caption" numberOfLines={2} style={[styles.templateName, { color: on ? c.textSecondary : c.text }]}>
                            {t.title}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                </View>
                <Pressable accessibilityRole="button" onPress={onMore} style={styles.more}>
                  <ThemedText type="label" style={{ color: c.accentText, fontWeight: 600 }}>
                    시기별 추천 전체 보기
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={c.accentText} />
                </Pressable>
                <ThemedText type="label" style={[styles.directHead, { color: c.textSecondary }]}>
                  직접 추가
                </ThemedText>
              </>
            )}

            {routine && (
              <ThemedText type="label" style={{ color: c.textSecondary }}>
                이름
              </ThemedText>
            )}
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={title}
              onChangeText={setTitle}
              placeholder={routine ? '예: 목욕' : '이름 (예: 로션 바르기)'}
              placeholderTextColor={c.textTertiary}
              maxLength={30}
            />

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              종류
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="체크" selected={kind === 'check'} onPress={() => changeKind('check')} />
              <Chip label="타이머" selected={kind === 'minutes'} onPress={() => changeKind('minutes')} />
              <Chip label="재고 확인" selected={kind === 'stock'} onPress={() => changeKind('stock')} />
            </View>
            <ThemedText type="caption" style={{ color: c.textSecondary }}>
              {KIND_HINT[kind]}
            </ThemedText>

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              반복
            </ThemedText>
            <View style={styles.chips}>
              {EVERY.map((e) => (
                <Chip
                  key={e.days}
                  label={e.label}
                  selected={!byWeekday && everyDays === e.days}
                  onPress={() => {
                    setWeekdays([]);
                    setEveryText(String(e.days));
                  }}
                />
              ))}
              <Chip label="요일 지정" selected={byWeekday} onPress={() => !byWeekday && setWeekdays([new Date().getDay()])} />
            </View>
            {byWeekday ? (
              <View style={styles.days}>
                {DAY_NAMES.map((name, d) => {
                  const on = weekdays.includes(d);
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${name}요일`}
                      onPress={() => {
                        tap();
                        // 하나는 남긴다 — 다 빼고 싶으면 위에서 「매일」 같은 반복을 고른다
                        setWeekdays((prev) => (on ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d].sort()));
                      }}
                      style={[styles.day, { backgroundColor: on ? c.ink : c.surface }]}>
                      <ThemedText type="label" style={{ color: on ? c.onInk : c.text, fontWeight: on ? 700 : 400 }}>
                        {name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.row}>
                <TextInput
                  style={[styles.field, styles.number, { color: c.text, backgroundColor: c.surface }]}
                  value={everyText}
                  onChangeText={setEveryText}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel="며칠마다"
                />
                <ThemedText type="body">일마다</ThemedText>
              </View>
            )}

            <ThemedText type="label" style={{ color: c.textSecondary }}>
              알림
            </ThemedText>
            <View style={styles.chips}>
              <Chip label="없음" selected={!timeText.trim()} onPress={() => setTimeText('')} />
              {TIMES.map((t) => (
                <Chip key={t} label={timeLabel(t)} selected={timeText.trim() === t} onPress={() => setTimeText(t)} />
              ))}
            </View>
            <TextInput
              style={[styles.field, { color: c.text, backgroundColor: c.surface }]}
              value={timeText}
              onChangeText={setTimeText}
              placeholder="직접 입력 (예: 20:30)"
              placeholderTextColor={c.textTertiary}
              maxLength={5}
            />
            {!timeOk && (
              <ThemedText type="caption" style={{ color: c.accentText }}>
                20:30 형식으로 입력해 주세요
              </ThemedText>
            )}

            {kind === 'minutes' && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  하루 목표 (선택)
                </ThemedText>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.field, styles.number, { color: c.text, backgroundColor: c.surface }]}
                    value={goalText}
                    onChangeText={setGoalText}
                    keyboardType="number-pad"
                    maxLength={3}
                    accessibilityLabel="하루 목표 분"
                  />
                  <ThemedText type="body">분</ThemedText>
                </View>
              </>
            )}

            {kind !== 'minutes' && (
              <>
                <ThemedText type="label" style={{ color: c.textSecondary }}>
                  {kind === 'check' ? '단계 (선택)' : '확인할 물건'}
                </ThemedText>
                {kind === 'check' && items.length === 0 && (
                  <ThemedText type="caption" style={{ color: c.textSecondary }}>
                    밤잠 준비처럼 순서대로 하는 일이면 단계를 나눠 체크할 수 있어요
                  </ThemedText>
                )}
                {items.map((item, i) => (
                  <View key={i} style={styles.row}>
                    <TextInput
                      style={[styles.field, styles.flex, { color: c.text, backgroundColor: c.surface }]}
                      value={item}
                      onChangeText={(v) => setItems((prev) => prev.map((x, j) => (j === i ? v : x)))}
                      placeholder={kind === 'check' ? `${i + 1}단계` : '물건 이름'}
                      placeholderTextColor={c.textTertiary}
                      maxLength={30}
                      accessibilityLabel={kind === 'check' ? `${i + 1}단계` : `물건 ${i + 1}`}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item || (kind === 'check' ? `${i + 1}단계` : '물건')} 빼기`}
                      hitSlop={8}
                      onPress={() => setItems((prev) => prev.filter((_, j) => j !== i))}>
                      <Ionicons name="close-circle" size={22} color={c.textTertiary} />
                    </Pressable>
                  </View>
                ))}
                {items.length < MAX_ITEMS[kind] && (
                  <Pressable accessibilityRole="button" onPress={() => setItems((prev) => [...prev, ''])} style={styles.addItem}>
                    <Ionicons name="add" size={16} color={c.textSecondary} />
                    <ThemedText type="label" style={{ color: c.textSecondary, fontWeight: 600 }}>
                      {kind === 'check' ? '단계 추가' : '물건 추가'}
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
          <Button
            size="lg"
            label={routine ? '저장' : closeOnly ? '완료' : '추가'}
            disabled={!closeOnly && !canSave}
            onPress={() =>
              closeOnly
                ? onClose()
                : onSave({
                title: title.trim(),
                kind,
                everyDays: byWeekday ? 7 : everyDays,
                weekdays: byWeekday ? weekdays : null,
                time: timeText.trim() || null,
                goalMinutes: kind === 'minutes' && goalText.trim() ? goal : null,
                items: kind === 'minutes' || cleaned.length === 0 ? null : cleaned,
              })
            }
          />
          {routine && onSkip && (
            <Button variant="ghost" size="sm" label={skippedToday ? '건너뛰기 취소' : '오늘은 건너뛰기'} onPress={onSkip} />
          )}
          {routine && onDelete && <Button variant="danger" size="sm" label="삭제" onPress={onDelete} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
    gap: Spacing.two,
    maxHeight: '92%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  content: { gap: Spacing.two, paddingBottom: Spacing.two },
  field: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FontFamily.regular,
  },
  number: { width: 72, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  templates: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: TEMPLATE_GAP },
  template: { alignItems: 'center', gap: 6 },
  templateCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  templateName: { textAlign: 'center' },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directHead: { marginTop: Spacing.two },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 6 },
});
