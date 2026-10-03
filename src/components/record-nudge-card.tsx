import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, type IconName } from '@/components/ui';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { cleanNumber, DAILY_LOGS, latestLog, valueOf, writtenAgo, type LogDef, type LogKey } from '@/data/daily-log';
import type { BabyRecord } from '@/data/records';
import { useTheme } from '@/hooks/use-theme';

export const LOG_ICONS: Record<LogKey, IconName> = {
  'feed-total': 'water-outline',
  'feed-interval': 'time-outline',
  weight: 'trending-up-outline',
  note: 'create-outline',
};

/** 적었다는 표시를 보이고 저절로 닫히기까지 */
const DONE_MS = 1600;

export type LogEntryInput = { def: LogDef; value: string };

function cleaned(def: LogDef, text: string): string {
  return def.unit === null ? text.trim() : cleanNumber(text);
}

function valid(def: LogDef, value: string): boolean {
  return def.unit === null ? value.length > 0 : Number(value) > 0;
}

/**
 * 기록 요청 카드 (SPEC-BABY-07, task baby/003) — 하루 기록이 며칠 비었을 때 저절로 뜬다(`record-nudge.tsx`).
 * 위에 적을 칸 넷(모두 고를 수 있게), 아래에 건너뛰면 버디가 대화 중에 물어본다는 안내와 「건너뛰기」 · 「기록할게요」,
 * 맨 아래 「다시 보지 않기」. 바깥을 눌러 닫아도 건너뛰기와 같다. 모델을 부르지 않는다.
 * 열 때마다 빈칸으로 시작하려면 부르는 쪽이 `key` 를 바꾼다.
 */
export function RecordNudgeCard({
  visible,
  records,
  onSave,
  onSkip,
  onNeverAgain,
  onDone,
}: {
  visible: boolean;
  records: BabyRecord[];
  /** 적은 칸만 온다 — 기록을 더한다 */
  onSave: (entries: LogEntryInput[]) => Promise<void>;
  onSkip: () => void;
  onNeverAgain: () => void;
  /** 적었다는 표시를 보인 뒤 닫는다 */
  onDone: () => void;
}) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Partial<Record<LogKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const now = new Date();

  useEffect(() => {
    if (saved === null) return;
    const timer = setTimeout(onDone, DONE_MS);
    return () => clearTimeout(timer);
  }, [saved, onDone]);

  const entries = DAILY_LOGS.map((def) => ({ def, value: cleaned(def, values[def.key] ?? '') })).filter(({ def, value }) =>
    valid(def, value),
  );
  const set = (key: LogKey, text: string) => setValues((prev) => ({ ...prev, [key]: text }));

  const save = async () => {
    if (entries.length === 0 || saving) return;
    setSaving(true);
    await onSave(entries);
    setSaved(entries.length);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={saved === null ? onSkip : onDone}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
          onPress={saved === null ? onSkip : onDone}
          accessibilityLabel="닫기"
        />
        <View style={[styles.sheet, { backgroundColor: c.background, paddingBottom: Spacing.three + insets.bottom }]}>
          <View style={[styles.grabber, { backgroundColor: c.surfaceStrong }]} />

          {saved !== null ? (
            <View style={styles.done} accessibilityLiveRegion="polite">
              <View style={[styles.headIcon, styles.doneIcon, { backgroundColor: c.accentSoft }]}>
                <Ionicons name="checkmark" size={30} color={c.accent} />
              </View>
              <ThemedText type="title">{saved}개 기록했어요</ThemedText>
              <ThemedText type="small" style={[styles.center, { color: c.textSecondary }]}>
                다음 답부터 버디가 참고해요{'\n'}우리 아기 탭에서 보고 고칠 수 있어요
              </ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.head}>
                <View style={[styles.headIcon, { backgroundColor: c.accentSoft }]}>
                  <Ionicons name="create-outline" size={20} color={c.accent} />
                </View>
                <ThemedText type="title" style={styles.flex}>
                  요 며칠 기록이 비었어요
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: c.textSecondary }}>
                생각나는 것만 적어 주세요. 버디 답이 더 정확해져요
              </ThemedText>

              <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
                {DAILY_LOGS.map((def, i) => {
                  const last = latestLog(def, records);
                  const value = values[def.key] ?? '';
                  const text = def.unit === null;
                  return (
                    <View key={def.key} style={[styles.field, i > 0 && { borderTopColor: c.divider, borderTopWidth: StyleSheet.hairlineWidth * 2 }]}>
                      <View style={styles.fieldHead}>
                        <View style={[styles.fieldIcon, { backgroundColor: c.surface }]}>
                          <Ionicons name={LOG_ICONS[def.key]} size={17} color={c.text} />
                        </View>
                        <View style={styles.flex}>
                          <ThemedText type="body" style={{ fontWeight: 600 }}>
                            {def.title}
                          </ThemedText>
                          <ThemedText type="caption" style={{ color: c.textSecondary }} numberOfLines={1}>
                            {last ? `지난 기록 ${writtenAgo(last, now)} · ${valueOf(def, last)}` : def.hint}
                          </ThemedText>
                        </View>
                        {!text && (
                          <View style={[styles.numberBox, { backgroundColor: c.surface }]}>
                            <TextInput
                              value={value}
                              onChangeText={(t) => set(def.key, cleanNumber(t))}
                              placeholder={def.placeholder}
                              placeholderTextColor={c.textTertiary}
                              keyboardType="decimal-pad"
                              maxLength={6}
                              style={[styles.numberInput, { color: c.text }]}
                              accessibilityLabel={`${def.title}, ${def.unit}`}
                            />
                            <ThemedText type="label" style={{ color: c.textSecondary }}>
                              {def.unit}
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      {text && (
                        <View style={[styles.textBox, { backgroundColor: c.surface }]}>
                          <TextInput
                            value={value}
                            onChangeText={(t) => set(def.key, t)}
                            placeholder={def.placeholder}
                            placeholderTextColor={c.textTertiary}
                            maxLength={80}
                            style={[styles.textInput, { color: c.text }]}
                            accessibilityLabel={def.title}
                          />
                        </View>
                      )}
                      {def.options.length > 0 && (
                        <View style={styles.chips}>
                          {def.options.map((o) => (
                            <Chip
                              key={o}
                              label={text ? o : `${o}${def.unit}`}
                              selected={value === o}
                              onPress={() => set(def.key, value === o ? '' : o)}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <View style={[styles.guide, { backgroundColor: c.surface }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={c.textSecondary} />
                <ThemedText type="caption" style={[styles.flex, { color: c.textSecondary }]}>
                  건너뛰면 대화하다 필요할 때 버디가 물어보고 채워 둘게요
                </ThemedText>
              </View>
              <View style={styles.buttons}>
                <Button label="건너뛰기" variant="secondary" size="lg" style={styles.flex} onPress={onSkip} />
                <Button
                  label={entries.length > 0 ? `${entries.length}개 기록할게요` : '기록할게요'}
                  size="lg"
                  style={styles.flex}
                  disabled={entries.length === 0}
                  busy={saving}
                  onPress={() => void save()}
                />
              </View>
              <View style={styles.never}>
                <Button label="다시 보지 않기" variant="ghost" size="sm" onPress={onNeverAgain} />
                <ThemedText type="caption" style={{ color: c.textTertiary }}>
                  마이 › 알림에서 다시 켤 수 있어요
                </ThemedText>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: 10,
    gap: Spacing.two,
    maxHeight: '92%',
  },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, marginBottom: Spacing.one },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0 },
  bodyContent: { paddingTop: Spacing.one },
  field: { gap: 10, paddingVertical: 12 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  numberBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    minHeight: 46,
    width: 118,
  },
  numberInput: { flex: 1, minWidth: 0, fontFamily: FontFamily.semibold, fontSize: 18, paddingVertical: 10, textAlign: 'right' },
  textBox: { borderRadius: Radius.md, paddingHorizontal: 14, minHeight: 46, justifyContent: 'center' },
  textInput: { fontFamily: FontFamily.regular, fontSize: 16, paddingVertical: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  guide: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  never: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  done: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five },
  doneIcon: { width: 60, height: 60, borderRadius: 30, marginBottom: Spacing.one },
});
