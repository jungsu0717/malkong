/**
 * 물어보기 타임라인의 말풍선들 — 질문 · 답변 · 되묻기 · 위험 신호 · 오류 · 날짜 구분선 (task ask/002).
 * 무엇을 보일지의 규칙은 docs/menu-spec/ask.md 의 SPEC 이 정본이다.
 */

import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { AnswerFeedback } from '@/components/answer-feedback';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThinkingStatus } from '@/components/thinking-status';
import { Colors, Spacing } from '@/constants/theme';
import type { Source } from '@/data/api';
import type { MalkongMessage, TraceStep } from '@/data/chat';
import type { BabyRecord } from '@/data/records';

function useColors() {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'];
}

export function UserBubble({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
      <ThemedText style={styles.userBubbleText}>{text}</ThemedText>
    </View>
  );
}

export function DateDivider({ label }: { label: string }) {
  const colors = useColors();
  return (
    <ThemedText type="small" style={[styles.divider, { color: colors.textSecondary }]}>
      {label}
    </ThemedText>
  );
}

/** 접힌 처리 현황 — 누르면 단계와 한 줄 결과(SPEC-ASK-05) */
export function DoneTrace({ trace }: { trace: TraceStep[] }) {
  if (!trace.length) return null;
  return <ThinkingStatus done steps={trace.map((s) => ({ ...s, done: true }))} />;
}

/** 같은 출처가 여러 항목에 걸쳐 오면(접종 다섯 건이 모두 질병관리청) 한 번만 보인다 */
function SourceList({ sources }: { sources: Source[] }) {
  const colors = useColors();
  const unique = sources.filter(
    (s, i) => sources.findIndex((o) => o.name === s.name && o.url === s.url) === i,
  );
  return (
    <View style={styles.sources}>
      {unique.map((s) => (
        <ExternalLink key={`${s.name}-${s.url}`} href={s.url as `https://${string}`}>
          <View style={styles.sourceRow}>
            <Ionicons name="link-outline" size={13} color={colors.textSecondary} />
            <ThemedText type="small" style={{ color: colors.textSecondary }}>
              {s.name}
            </ThemedText>
          </View>
        </ExternalLink>
      ))}
    </View>
  );
}

/** 「기록됨」 칩 — 누르면 지우기를 고를 수 있다(자동이되 투명하게, ask.md L2 추출 규칙) */
function SavedRecordChip({
  record,
  onRemove,
}: {
  record: BabyRecord;
  onRemove: (id: string) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.savedRow}>
      <Pressable
        style={[styles.savedChip, { backgroundColor: colors.background }]}
        onPress={() => setOpen((o) => !o)}>
        <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
        <ThemedText type="small" style={{ color: colors.text }}>
          기록됨 · {record.label}
        </ThemedText>
      </Pressable>
      {open && (
        <Pressable onPress={() => onRemove(record.id)} hitSlop={8}>
          <ThemedText type="small" style={{ color: colors.danger }}>
            지우기
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

export function AnswerBubble({
  message,
  question,
  records,
  onRemoveRecord,
}: {
  message: MalkongMessage;
  /** 이 답이 답한 질문 — 피드백에 「함께 보내기」를 고르면 같이 간다 */
  question: string | null;
  records: BabyRecord[];
  onRemoveRecord: (id: string) => void;
}) {
  const colors = useColors();
  if (message.meta.type !== 'answer') return null;
  const { sources, eco, recordIds } = message.meta;
  // 지운 기록은 칩도 사라진다
  const saved = recordIds
    .map((id) => records.find((r) => r.id === id))
    .filter((r): r is BabyRecord => !!r);

  return (
    <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText>{message.content}</ThemedText>
      {sources.length > 0 ? (
        <SourceList sources={sources} />
      ) : (
        <ThemedText type="small" style={[styles.note, { color: colors.textSecondary }]}>
          공공 지식 근거 없음 · 일반 정보
        </ThemedText>
      )}
      {eco && (
        <ThemedText type="small" style={[styles.note, { color: colors.textSecondary }]}>
          우리 아기 기록 없이 일반 기준으로 답했어요
        </ThemedText>
      )}
      {saved.length > 0 && (
        <View style={styles.savedList}>
          {saved.map((r) => (
            <SavedRecordChip key={r.id} record={r} onRemove={onRemoveRecord} />
          ))}
        </View>
      )}
      <AnswerFeedback message={message} question={question} />
    </View>
  );
}

export function FollowupBubble({
  message,
  open,
  onChip,
}: {
  message: MalkongMessage;
  /** 마지막 말풍선이고 기다리는 중이 아닐 때만 칩을 누를 수 있다 */
  open: boolean;
  onChip: (chip: string) => void;
}) {
  const colors = useColors();
  if (message.meta.type !== 'followup') return null;
  return (
    <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText>{message.content}</ThemedText>
      {open && (
        <>
          <View style={styles.quickChips}>
            {message.meta.followup.chips.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, { backgroundColor: colors.accentSoft }]}
                onPress={() => onChip(c)}>
                <ThemedText type="small" style={{ color: colors.accent }}>
                  {c}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <ThemedText type="small" style={[styles.note, { color: colors.textSecondary }]}>
            알려주시면 기록해 두고, 같은 건 다시 묻지 않아요
          </ThemedText>
        </>
      )}
    </View>
  );
}

/** 위험 신호 고정 응답(SPEC-ASK-02) — 일반 답과 다른 모양으로, 바로 전화할 수 있게 */
export function RedflagCard({ message }: { message: MalkongMessage }) {
  const colors = useColors();
  if (message.meta.type !== 'redflag') return null;
  return (
    <View style={[styles.bubble, styles.redflag, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
      <View style={styles.redflagHead}>
        <Ionicons name="warning" size={18} color={colors.danger} />
        <ThemedText type="smallBold" style={{ color: colors.danger }}>
          바로 진료가 필요할 수 있어요
        </ThemedText>
      </View>
      <ThemedText>{message.content}</ThemedText>
      <Pressable
        style={[styles.callButton, { backgroundColor: colors.danger }]}
        onPress={() => Linking.openURL('tel:119')}>
        <Ionicons name="call" size={16} color="#ffffff" />
        <ThemedText type="smallBold" style={styles.callText}>
          119 전화하기
        </ThemedText>
      </Pressable>
      {message.meta.sources.length > 0 && <SourceList sources={message.meta.sources} />}
    </View>
  );
}

export function ErrorBubble({ text, onRetry }: { text: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText>{text}</ThemedText>
      <Pressable
        style={[styles.chip, styles.retry, { backgroundColor: colors.accentSoft }]}
        onPress={onRetry}>
        <Ionicons name="refresh" size={14} color={colors.accent} />
        <ThemedText type="small" style={{ color: colors.accent }}>
          다시 시도
        </ThemedText>
      </Pressable>
    </View>
  );
}

/**
 * 하루 정밀 답변을 다 썼을 때(429) — 아예 막지 않고 선택지를 준다(ask.md 한도 표시).
 * 광고 충전(정밀 답변 +1)은 보상형 광고가 붙으면 `onReward` 로 들어온다.
 */
export function LimitBubble({
  dailyLimit,
  onEco,
  onReward,
}: {
  dailyLimit: number | null;
  onEco: () => void;
  onReward?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.bubble, { backgroundColor: colors.backgroundElement }]}>
      <ThemedText>
        오늘 우리 아기 기록을 반영한 정밀 답변{dailyLimit ? ` ${dailyLimit}회` : ''}를 다 썼어요.
        {onReward
          ? ' 광고 1편을 보면 정밀 답변 1회가 충전돼요(오늘 3편까지). 아니면 지금 바로 일반 기준으로 답해 드릴 수 있어요.'
          : ' 지금 바로 일반 기준으로 답해 드릴 수 있어요. 정밀 답변은 내일 0시에 다시 채워져요.'}
      </ThemedText>
      <View style={styles.quickChips}>
        {onReward && (
          <Pressable style={[styles.chip, { backgroundColor: colors.accent }]} onPress={onReward}>
            <ThemedText type="small" style={styles.callText}>
              광고 보고 정밀 답변
            </ThemedText>
          </Pressable>
        )}
        <Pressable style={[styles.chip, { backgroundColor: colors.accentSoft }]} onPress={onEco}>
          <ThemedText type="small" style={{ color: colors.accent }}>
            일반 기준으로 바로 답변
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 20,
    borderTopLeftRadius: Spacing.one,
    padding: Spacing.four,
    alignSelf: 'flex-start',
    maxWidth: '90%',
    gap: Spacing.two,
  },
  userBubble: {
    borderRadius: 20,
    borderTopRightRadius: Spacing.one,
    padding: Spacing.three,
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  userBubbleText: { color: '#ffffff' },
  divider: { textAlign: 'center', marginVertical: Spacing.one },
  note: { marginTop: Spacing.half },
  sources: { gap: Spacing.one, marginTop: Spacing.one },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  savedList: { gap: Spacing.one, marginTop: Spacing.one },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  quickChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  retry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, alignSelf: 'flex-start' },
  redflag: { borderWidth: 1, maxWidth: '95%' },
  redflagHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 12,
    paddingVertical: Spacing.two,
  },
  callText: { color: '#ffffff' },
});
