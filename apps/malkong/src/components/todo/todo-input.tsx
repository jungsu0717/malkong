/**
 * 할 일 적는 칸 (SPEC-TOPIC-03) — 화면 바닥에 늘 있다. 칸을 누르고 쓰고 완료, 두 번 터치로 한 줄이 생긴다.
 * 「내일 오전 10시」 같은 말은 바로 읽어 칸 위에 미리 보여 주고, 적은 뒤에도 칸을 비워 둔 채 키보드를 남겨 이어 적게 한다.
 * 칩을 주면 어디에 넣을지 고를 수 있다 — 장보기는 살 곳(마트 · 온라인 …).
 * `dateChips` 를 주면 칸 위에 「오늘 · 내일 · 날짜 고르기 · 날짜 없음」 — 날짜를 글로 적지 않아도 정해진다(글에 날짜가 있으면 글이 이긴다, task topic/009).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { DateWheel, INLINE_WHEEL, pickDate } from '@/components/time-picker';
import { Button, Chip, tap } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { dueLabel, parseDue, type ParsedDue } from '@/data/due-parse';
import { repeatLabel } from '@/data/repeat';
import { useTheme } from '@/hooks/use-theme';

export function TodoInput({
  placeholder,
  onAdd,
  options,
  selected = null,
  onSelect,
  noneLabel,
  dateChips = false,
}: {
  placeholder: string;
  onAdd: (parsed: ParsedDue) => void;
  /** 고를 수 있는 것 — 주면 칸 위에 칩으로 보인다 */
  options?: { id: string; label: string }[];
  /** 고른 것 — null 이면 `noneLabel` */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** 아무것도 고르지 않았을 때의 칩 이름(예: 「선택 안 함」). 없으면 그 칩을 두지 않는다 */
  noneLabel?: string;
  /** 날짜 칩(오늘 · 내일 · 날짜 고르기 · 날짜 없음) */
  dateChips?: boolean;
}) {
  const c = useTheme();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const parsed = text.trim() ? parseDue(text) : null;
  const canAdd = !!parsed;

  const insets = useSafeAreaInsets();
  /** 날짜 칩 — 글에 날짜가 없을 때 쓴다 */
  const [when, setWhen] = useState<'today' | 'tomorrow' | 'none' | Date>('today');
  const [picking, setPicking] = useState<Date | null>(null);
  const dayOf = (offset: number) => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  };
  const chipDue = (): Date | null =>
    when === 'today' ? dayOf(0) : when === 'tomorrow' ? dayOf(1) : when === 'none' ? null : when;
  const openPicker = () => {
    const start = when instanceof Date ? when : dayOf(1);
    if (INLINE_WHEEL) setPicking(start);
    else pickDate(start, (d) => setWhen(new Date(d.getFullYear(), d.getMonth(), d.getDate())));
  };

  const submit = () => {
    if (!parsed) return;
    tap('success');
    onAdd(dateChips && !parsed.dueAt ? { ...parsed, dueAt: chipDue(), hasTime: false } : parsed);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      {/* 칩을 누르는 순간 입력칸이 포커스를 잃어도 칩이 사라지지 않게 — 적는 중이거나 주제를 골라 둔 동안에도 보인다 */}
      {options && onSelect && (focused || !!text || !!selected) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          {noneLabel && <Chip label={noneLabel} selected={!selected} onPress={() => onSelect(null)} />}
          {options.map((o) => (
            <Chip key={o.id} label={o.label} selected={selected === o.id} onPress={() => onSelect(o.id)} />
          ))}
        </ScrollView>
      )}
      {dateChips && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
          <Chip label="오늘" selected={when === 'today'} onPress={() => setWhen('today')} />
          <Chip label="내일" selected={when === 'tomorrow'} onPress={() => setWhen('tomorrow')} />
          <Chip label={when instanceof Date ? `${when.getMonth() + 1}월 ${when.getDate()}일` : '날짜 고르기'} icon="calendar-outline" selected={when instanceof Date} onPress={openPicker} />
          <Chip label="날짜 없음" selected={when === 'none'} onPress={() => setWhen('none')} />
        </ScrollView>
      )}
      {parsed?.dueAt && (
        <ThemedText type="caption" style={[styles.preview, { color: c.accentText }]}>
          {parsed.repeat
            ? `${repeatLabel(parsed.repeat)} 반복 · ${dueLabel(parsed.dueAt, parsed.hasTime)}부터`
            : parsed.hasTime
              ? `${dueLabel(parsed.dueAt, true)}에 알려 드려요`
              : `기한 ${dueLabel(parsed.dueAt, false)}`}
        </ThemedText>
      )}
      <View style={[styles.box, { backgroundColor: c.surface }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: c.text }]}
          placeholder={placeholder}
          placeholderTextColor={c.textTertiary}
          value={text}
          onChangeText={setText}
          onFocus={() => setFocused(true)}
          // 칩을 누를 때 먼저 오는 blur 로 칩이 사라지면 누른 것이 무시된다 — 조금 늦게 접는다
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onSubmitEditing={submit}
          submitBehavior="submit"
          returnKeyType="done"
          maxLength={200}
          {...(Platform.OS === 'web' ? { numberOfLines: 1 } : {})}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="할 일 추가"
          accessibilityState={{ disabled: !canAdd }}
          disabled={!canAdd}
          onPress={submit}
          style={[styles.send, { backgroundColor: canAdd ? c.ink : c.surfaceStrong }]}>
          <Ionicons name="add" size={22} color={canAdd ? c.onInk : c.textTertiary} />
        </Pressable>
      </View>

      {/* 날짜 고르기 — iOS 는 달력, 웹은 날짜 칸. 안드로이드는 창이 따로 뜬다 */}
      <Modal visible={picking !== null} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <View style={styles.sheetWrap}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={() => setPicking(null)} accessibilityLabel="닫기" />
          <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.four + insets.bottom }]}>
            <ThemedText type="title">날짜 고르기</ThemedText>
            {picking && <DateWheel value={picking} onChange={(d) => setPicking(d)} />}
            <Button
              size="lg"
              label="완료"
              onPress={() => {
                if (picking) setWhen(new Date(picking.getFullYear(), picking.getMonth(), picking.getDate()));
                setPicking(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: Spacing.one, paddingBottom: Spacing.two, gap: 6 },
  chips: { paddingHorizontal: Spacing.three, gap: 6 },
  preview: { paddingHorizontal: Spacing.four, fontWeight: 600 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
    gap: Spacing.two,
  },
  // minWidth 0 — 웹의 한 줄 입력칸은 기본 너비가 있어 줄지 않으면 넣기 단추를 밀어낸다
  input: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: FontFamily.regular, lineHeight: 22, paddingVertical: 9 },
  send: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
});
