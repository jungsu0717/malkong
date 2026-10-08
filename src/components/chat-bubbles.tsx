/**
 * 대화 타임라인의 줄들 — 질문 · 답 · 되묻기 · 위험 신호 · 오류 · 한도 · 날짜 구분선 (task ask/002, 모양은 ask/005).
 * 무엇을 보일지의 규칙은 docs/menu-spec/ask.md 의 SPEC 이 정본이다.
 *
 * 시안 B: 질문은 오른쪽 회색 말풍선, 버디의 답은 말풍선 없는 본문 + 아래 표시 한 줄.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnswerFeedback } from '@/components/answer-feedback';
import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThinkingStatus } from '@/components/thinking-status';
import { Button, Chip, Tag } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { Source } from '@/data/api';
import type { MalkongMessage, TraceStep } from '@/data/chat';
import type { BabyRecord } from '@/data/records';
import { useTheme } from '@/hooks/use-theme';

export function UserBubble({ text }: { text: string }) {
  const c = useTheme();
  return (
    <View style={[styles.userBubble, { backgroundColor: c.surface }]}>
      <ThemedText type="body">{text}</ThemedText>
    </View>
  );
}

export function DateDivider({ label }: { label: string }) {
  const c = useTheme();
  return (
    <View style={styles.divider} accessibilityRole="header">
      <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
      <ThemedText type="caption" style={{ color: c.textSecondary }}>
        {label}
      </ThemedText>
      <View style={[styles.dividerLine, { backgroundColor: c.divider }]} />
    </View>
  );
}

/** 접힌 처리 현황 — 누르면 단계와 한 줄 결과(SPEC-ASK-05) */
export function DoneTrace({ trace, summary }: { trace: TraceStep[]; summary?: string }) {
  if (!trace.length) return null;
  return <ThinkingStatus done summary={summary} steps={trace.map((s) => ({ ...s, done: true }))} />;
}

/** 같은 출처가 여러 항목에 걸쳐 오면(접종 다섯 건이 모두 질병관리청) 한 번만 보인다 */
function SourceList({ sources }: { sources: Source[] }) {
  const c = useTheme();
  const unique = sources.filter(
    (s, i) => sources.findIndex((o) => o.name === s.name && o.url === s.url) === i,
  );
  return (
    <View style={styles.sources}>
      {unique.map((s) => (
        <ExternalLink key={`${s.name}-${s.url}`} href={s.url as `https://${string}`}>
          <View style={styles.sourceRow}>
            <Ionicons name="document-text-outline" size={14} color={c.textSecondary} />
            <ThemedText type="caption" style={{ color: c.textSecondary, textDecorationLine: 'underline' }}>
              {s.name}
            </ThemedText>
          </View>
        </ExternalLink>
      ))}
    </View>
  );
}

/** 「기록했어요」 줄 — 누르면 지우기를 고를 수 있다(자동이되 투명하게, ask.md L2 추출 규칙) */
function SavedRecordRow({ record, onRemove }: { record: BabyRecord; onRemove: (id: string) => void }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.savedRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="누르면 이 기록을 지울 수 있어요"
        style={styles.savedChip}
        onPress={() => setOpen((o) => !o)}>
        <Ionicons name="checkmark-circle" size={16} color={c.accent} />
        <ThemedText type="small" style={{ color: c.textSecondary }}>
          기록했어요 · <ThemedText type="small">{record.label}</ThemedText>
        </ThemedText>
      </Pressable>
      {open && (
        <Pressable onPress={() => onRemove(record.id)} hitSlop={8}>
          <ThemedText type="label" style={{ color: c.danger }}>
            지우기
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/** 버디의 짐작 줄 — 해석은 사람이 확인해야 기록이 된다(SPEC-ASK-12). 「맞아요」면 요약으로 저장, 「아니에요」면 줄만 사라진다 */
function GuessRow({ label, onConfirm, onDismiss }: { label: string; onConfirm: () => void; onDismiss: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.guessRow}>
      <View style={styles.savedChip}>
        <Ionicons name="help-circle-outline" size={16} color={c.textSecondary} />
        <ThemedText type="small" style={[styles.grow, { color: c.textSecondary }]}>
          버디의 짐작 · <ThemedText type="small">{label}</ThemedText>
        </ThemedText>
      </View>
      <View style={styles.guessChips}>
        <Chip label="맞아요" icon="checkmark" onPress={onConfirm} />
        <Chip label="아니에요" onPress={onDismiss} />
      </View>
    </View>
  );
}

export function AnswerBubble({
  message,
  question,
  records,
  onRemoveRecord,
  onConfirmGuess,
  onDismissGuess,
}: {
  message: MalkongMessage;
  /** 이 답이 답한 질문 — 피드백에 「함께 보내기」를 고르면 같이 간다 */
  question: string | null;
  records: BabyRecord[];
  onRemoveRecord: (id: string) => void;
  /** 버디의 짐작에 「맞아요」 「아니에요」 */
  onConfirmGuess: (label: string) => void;
  onDismissGuess: (label: string) => void;
}) {
  if (message.meta.type !== 'answer') return null;
  const { sources, eco, recordIds, usedRecords = 0, guesses = [] } = message.meta;
  // 지운 기록은 줄도 사라진다
  const saved = recordIds
    .map((id) => records.find((r) => r.id === id))
    .filter((r): r is BabyRecord => !!r);

  return (
    <View style={styles.answer}>
      <ThemedText type="body" style={styles.answerText}>
        {message.content}
      </ThemedText>
      <View style={styles.tags}>
        {usedRecords > 0 && <Tag tone="accent" label={`우리 아기 기록 ${usedRecords}건 참고`} />}
        {sources.length > 0 ? (
          <Tag label="공공 기준" />
        ) : (
          <Tag label={eco ? '일반 기준 · 기록 없이' : '일반 정보'} />
        )}
      </View>
      {sources.length > 0 && <SourceList sources={sources} />}
      {saved.length > 0 && (
        <View style={styles.savedList}>
          {saved.map((r) => (
            <SavedRecordRow key={r.id} record={r} onRemove={onRemoveRecord} />
          ))}
        </View>
      )}
      {guesses.length > 0 && (
        <View style={styles.savedList}>
          {guesses.map((g) => (
            <GuessRow key={g.label} label={g.label} onConfirm={() => onConfirmGuess(g.label)} onDismiss={() => onDismissGuess(g.label)} />
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
  /** 마지막 줄이고 기다리는 중이 아닐 때만 칩을 누를 수 있다 */
  open: boolean;
  onChip: (chip: string) => void;
}) {
  const c = useTheme();
  if (message.meta.type !== 'followup') return null;
  return (
    <View style={styles.answer}>
      <ThemedText type="body" style={styles.answerText}>
        {message.content}
      </ThemedText>
      {open && (
        <>
          <View style={styles.chips}>
            {message.meta.followup.chips.map((chip) => (
              <Chip key={chip} label={chip} onPress={() => onChip(chip)} />
            ))}
          </View>
          <ThemedText type="caption" style={{ color: c.textSecondary }}>
            알려 주시면 기록해 두고, 같은 건 다시 묻지 않아요
          </ThemedText>
        </>
      )}
    </View>
  );
}

/** 위험 신호 고정 응답(SPEC-ASK-02) — 채운 경고 머리로 포인트 색과 모양부터 다르게. 전화 단추는 두지 않는다(2026-10-06 Julian) */
export function RedflagCard({ message }: { message: MalkongMessage }) {
  const c = useTheme();
  if (message.meta.type !== 'redflag') return null;
  return (
    <View style={[styles.redflag, { borderColor: c.danger, backgroundColor: c.background }]}>
      <View style={[styles.redflagHead, { backgroundColor: c.dangerFill }]}>
        <Ionicons name="warning" size={18} color={c.onDanger} />
        <ThemedText type="heading" style={{ color: c.onDanger, fontSize: 15 }}>
          바로 진료가 필요할 수 있어요
        </ThemedText>
      </View>
      <View style={styles.redflagBody}>
        <ThemedText type="body">{message.content}</ThemedText>
        {message.meta.sources.length > 0 && <SourceList sources={message.meta.sources} />}
      </View>
    </View>
  );
}

export function ErrorBubble({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const c = useTheme();
  return (
    <View style={styles.answer}>
      <View style={styles.inline}>
        <Ionicons name="cloud-offline-outline" size={18} color={c.textSecondary} />
        <ThemedText type="body" style={[styles.answerText, { color: c.textSecondary }]}>
          {text}
        </ThemedText>
      </View>
      {onRetry && (
        <View style={styles.chips}>
          <Chip icon="refresh" label="다시 시도" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

/**
 * 하루 정밀 답변을 다 썼을 때(429) — 아예 막지 않고 선택지를 준다(ask.md 한도 표시).
 * 광고 충전(1편에 정밀 답변 5회, decisions/019)은 보상형 광고가 붙으면 `onReward` 로 들어온다.
 */
export function LimitBubble({
  dailyLimit,
  rewardPerAd,
  rewardMaxPerDay,
  busy = false,
  note = null,
  onEco,
  onReward,
}: {
  dailyLimit: number | null;
  /** 광고 1편이 채우는 정밀 답변 수와 하루 편수(서버 자격) */
  rewardPerAd: number;
  rewardMaxPerDay: number;
  /** 광고를 보는 중이면 단추를 잠근다 */
  busy?: boolean;
  /** 충전 확인이 안 됐을 때처럼 한 줄 덧붙일 말 */
  note?: string | null;
  /** 일반 기준 답까지 오늘 다 썼으면 없다 */
  onEco?: () => void;
  onReward?: () => void;
}) {
  const c = useTheme();
  const refill = `광고 1편을 보면 우리 아기 기록을 반영한 답변 ${rewardPerAd}회가 채워져요(하루 ${rewardMaxPerDay}편까지).`;
  // 선택지가 하나도 없으면 오늘은 여기까지다 — 위험 신호 안내는 그래도 나간다(SPEC-ASK-02)
  const body =
    onReward && onEco
      ? `${refill} 지금 바로 일반 기준으로 답해 드릴 수도 있어요.`
      : onReward
        ? `${refill} 일반 기준 답은 오늘 다 썼어요.`
        : onEco
          ? '지금 바로 일반 기준으로 답해 드릴 수 있어요. 정밀 답변은 내일 0시에 다시 채워져요.'
          : '오늘 답할 수 있는 만큼 다 답했어요. 내일 0시에 다시 채워져요. 위험해 보이는 증상을 말씀하시면 그 안내는 지금도 바로 드려요.';
  return (
    <View style={[styles.limit, { backgroundColor: c.surface }]}>
      <ThemedText type="heading" style={{ fontSize: 15 }}>
        {onReward || onEco
          ? `오늘 정밀 답변${dailyLimit ? ` ${dailyLimit}회를` : '을'} 다 썼어요`
          : '오늘은 여기까지예요'}
      </ThemedText>
      <ThemedText type="small" style={{ color: c.textSecondary }}>
        {body}
      </ThemedText>
      <View style={styles.limitActions}>
        {onReward && (
          <Button
            label={busy ? '광고를 불러오는 중…' : '광고 보고 정밀 답변'}
            icon="play-circle-outline"
            busy={busy}
            onPress={onReward}
          />
        )}
        {onEco && (
          <Button label="일반 기준으로 바로 답변" variant="secondary" disabled={busy} onPress={onEco} />
        )}
      </View>
      {note && (
        <ThemedText type="caption" style={{ color: c.textSecondary }}>
          {note}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginVertical: Spacing.one },
  dividerLine: { flex: 1, height: 1 },
  answer: { gap: 10 },
  answerText: { lineHeight: 25 },
  inline: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sources: { gap: 6 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savedList: { gap: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, flexWrap: 'wrap' },
  savedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  guessRow: { gap: 6 },
  guessChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  redflag: { borderWidth: 1.5, borderRadius: Radius.lg, overflow: 'hidden' },
  redflagHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: 14, paddingVertical: 10 },
  redflagBody: { padding: 14, gap: 12 },
  limit: { borderRadius: Radius.lg, padding: Spacing.three, gap: 10 },
  limitActions: { gap: Spacing.two, marginTop: Spacing.one },
});
